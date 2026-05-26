<script lang="ts">
  import { onMount } from "svelte";
  import logo from "$lib/assets/logo-goldd.png";
  import { hadiths } from "$lib/data/hadiths";
  import * as SunCalc from "suncalc";
  type PrayerTimes = {
    Imsak: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
  };

  let loading = $state(true);

  let hadithSource = $state("");

  let prayers = $state<PrayerTimes>({
    Imsak: "",
    Sunrise: "",
    Dhuhr: "",
    Asr: "",
    Maghrib: "",
    Isha: "",
  });

  let nextPrayer = $state("");
  let countdown = $state("");
  let hadith = $state("");

  let currentCity = $state("");

  let cityInput = $state("");

  let cityResults = $state<any[]>([]);

  let showCitySelection = $state(false);

  let locationError = $state(false);

  let deferredPrompt = $state<any>(null);
  let countdownInterval: ReturnType<typeof setInterval>;

  let latitude = $state<number | null>(null);
  let longitude = $state<number | null>(null);

  async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }

  async function searchCity() {
    if (!cityInput) return;

    const response = await fetch(`/api/location-search?city=${cityInput}`);

    const data = await response.json();

    cityResults = data;
  }

  async function selectCity(city: any) {
    currentCity = city.region;

    if (currentCity) {
      localStorage.setItem("city", currentCity);
    }
    localStorage.setItem("location-id", city.id.toString());

    cityResults = [];

    showCitySelection = false;
    locationError = false;

    await fetchPrayerTimes(city.id);

    fetchHadith();
  }

  function getPrayerDate(time?: string) {
    if (!time) {
      console.error("Prayer time missing:", time);
      return new Date(NaN);
    }

    const [hours, minutes] = time.split(":").map(Number);

    const date = new Date();

    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);

    return date;
  }

  // function formatTime(date: Date) {
  //   return date.toLocaleTimeString("tr-TR", {
  //     hour: "2-digit",
  //     minute: "2-digit",
  //   });
  // }

  function addMinutes(time: string, minutes: number) {
    const [hours, mins] = time.split(":").map(Number);

    const date = new Date();

    date.setHours(hours);
    date.setMinutes(mins + minutes);
    date.setSeconds(0);

    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function calculateNextPrayer() {
    if (!prayers) return;

    if (!prayers.Imsak) return;

    const now = new Date();

    const prayerList = [
      { name: "İmsak", time: prayers.Imsak },
      { name: "Güneş", time: prayers.Sunrise },
      { name: "Öğle", time: prayers.Dhuhr },
      { name: "İkindi", time: prayers.Asr },
      { name: "Akşam", time: prayers.Maghrib },
      { name: "Yatsı", time: prayers.Isha },
    ].filter((p) => p.time);

    for (const prayer of prayerList) {
      const prayerDate = getPrayerDate(prayer.time);

      if (isNaN(prayerDate.getTime())) {
        console.error("Invalid prayer date:", prayer);
        continue;
      }

      if (prayerDate > now) {
        console.log(prayerDate);

        nextPrayer = prayer.name;
        updateCountdown(prayerDate);
        return;
      }
    }

    // Morgen İmsak
    const tomorrowFajr = getPrayerDate(prayers.Imsak);

    if (isNaN(tomorrowFajr.getTime())) {
      console.error("Invalid İmsak");
      return;
    }

    tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);

    nextPrayer = "İmsak";
    updateCountdown(tomorrowFajr);
  }

  function updateCountdown(target: Date) {
    clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      const now = new Date();

      const diff = target.getTime() - now.getTime();

      // Falls Zeit vorbei ist
      if (diff <= 0) {
        calculateNextPrayer();
        return;
      }

      const hours = Math.floor(diff / 1000 / 60 / 60);

      const minutes = Math.floor((diff / 1000 / 60) % 60);

      const seconds = Math.floor((diff / 1000) % 60);

      countdown =
        `${String(hours).padStart(2, "0")}:` +
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`;
    }, 1000);
  }

  async function fetchPrayerTimes(locationId: number) {
    const response = await fetch(`/api/prayer-times?locationId=${locationId}`);

    const data = await response.json();

    console.log(data);

    if (!Array.isArray(data)) {
      console.error("Prayer API returned invalid data:", data);

      loading = false;

      return;
    }

    const timings = data?.[0];

    if (!timings) {
      console.error("No timings found for today");

      loading = false;
      return;
    }

    prayers = {
      Imsak: timings.fajr,
      Sunrise: timings.sun,
      Dhuhr: timings.dhuhr,
      Asr: timings.asr,
      Maghrib: timings.maghrib,
      Isha: timings.isha,
    };

    calculateNextPrayer();

    loading = false;
  }

  function fetchHadith() {
    const today = new Date().getDate();

    const selected = hadiths[today % hadiths.length];

    hadith = selected.text;

    hadithSource = selected.source;
  }

  async function getCity(lat: number, lon: number) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    );

    const data = await response.json();

    return (
      data.address.city ||
      data.address.town ||
      data.address.village ||
      data.address.municipality ||
      ""
    );
  }

  function getKerahatTimes() {
    console.log("hier:", latitude, longitude);
    if (latitude === null || longitude === null) {
      return null;
    }

    const today = new Date();

    const times = SunCalc.getTimes(today, latitude, longitude);

    const sunrise = times.sunrise;
    const sunset = times.sunset;
    const solarNoon = times.solarNoon;

    const sunriseEnd = new Date(sunrise.getTime() + 45 * 60 * 1000);

    const sunsetStart = new Date(sunset.getTime() - 45 * 60 * 1000);

    const zawalStart = new Date(solarNoon.getTime() - 45 * 60 * 1000);

    return {
      sunriseStart: prayers.Sunrise,
      sunriseEnd: addMinutes(prayers.Sunrise, 45),

      zawalStart: addMinutes(prayers.Dhuhr, -45),
      zawalEnd: prayers.Dhuhr,

      sunsetStart: addMinutes(prayers.Maghrib, -45),
      sunsetEnd: prayers.Maghrib,
    };
  }

  onMount(async () => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
    });
    const cachedLocationId = localStorage.getItem("location-id");

    const cachedCity = localStorage.getItem("city");
    const cachedLat = localStorage.getItem("lat");
    const cachedLon = localStorage.getItem("lon");

    const handleVisibility = () => {
      if (!document.hidden) {
        calculateNextPrayer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    if (cachedLat && cachedLon) {
      latitude = Number(cachedLat);
      longitude = Number(cachedLon);
    }
    if (cachedCity && cachedCity !== "undefined") {
      currentCity = cachedCity;
    }
    if (cachedLocationId) {
      navigator.geolocation.getCurrentPosition((position) => {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;

        localStorage.setItem("lat", latitude.toString());
        localStorage.setItem("lon", longitude.toString());
      });
      await fetchPrayerTimes(Number(cachedLocationId));

      fetchHadith();

      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;

        const lon = position.coords.longitude;

        latitude = lat;
        longitude = lon;
        localStorage.setItem("lat", lat.toString());
        localStorage.setItem("lon", lon.toString());

        const city = await getCity(lat, lon);
        currentCity = city || "";
        showCitySelection = false;
        if (city) {
          localStorage.setItem("city", city);
        }

        const searchResponse = await fetch(`/api/location-search?city=${city}`);

        const locations = await searchResponse.json();

        const locationId = locations[0].id;

        localStorage.setItem("location-id", locationId.toString());

        await fetchPrayerTimes(locationId);

        fetchHadith();
      },
      () => {
        locationError = true;
        showCitySelection = true;

        loading = false;
      },
    );
    return () => {
      clearInterval(countdownInterval);

      document.removeEventListener("visibilitychange", handleVisibility);
    };
  });

  async function refreshLocation() {
    loading = true;

    localStorage.removeItem("location-id");

    localStorage.removeItem("city");

    currentCity = "";

    cityInput = "";

    cityResults = [];

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;

        const lon = position.coords.longitude;
        latitude = lat;
        longitude = lon;
        localStorage.setItem("lat", lat.toString());
        localStorage.setItem("lon", lon.toString());

        const city = await getCity(lat, lon);

        currentCity = city || "";
        showCitySelection = false;
        if (city) {
          localStorage.setItem("city", city);
        }

        const searchResponse = await fetch(`/api/location-search?city=${city}`);

        const locations = await searchResponse.json();

        if (!locations?.length) {
          loading = false;
          currentCity = "";
          return;
        }
        const locationId = locations[0].id;

        localStorage.setItem("location-id", locationId.toString());

        await fetchPrayerTimes(locationId);

        fetchHadith();

        loading = false;
      },
      () => {
        loading = false;

        currentCity = "";
      },
    );
  }
</script>

{#if currentCity}
  <div class="min-h-screen bg-black px-5 py-8 text-white">
    <div class="mx-auto max-w-md">
      <div
        class="mb-5 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
      >
        <p class="text-sm tracking-wide text-white/50">Sonraki Namaz</p>

        {#if loading}
          <div
            class="mt-3 h-10 w-32 animate-pulse rounded-xl bg-white/10"
          ></div>

          <div
            class="mt-5 h-14 w-48 animate-pulse rounded-2xl bg-white/10"
          ></div>
        {:else}
          <h1 class="mt-2 text-4xl font-light">
            {nextPrayer}
          </h1>

          <p class="mt-4 text-5xl font-bold tracking-wider">
            {countdown}
          </p>
        {/if}
      </div>

      <div
        class="mb-5 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
      >
        <h2 class="mb-5 text-xl font-semibold">Namaz Vakitleri</h2>

        {#if loading}
          <div class="space-y-4">
            {#each Array(6) as _}
              <div class="h-6 animate-pulse rounded bg-white/10"></div>
            {/each}
          </div>
        {:else}
          <div class="space-y-4">
            <div class="flex justify-between">
              <span>İmsak</span>
              <span>{prayers.Imsak}</span>
            </div>

            <div class="flex justify-between">
              <span>Güneş</span>
              <span>{prayers.Sunrise}</span>
            </div>

            <div class="flex justify-between">
              <span>Öğle</span>
              <span>{prayers.Dhuhr}</span>
            </div>

            <div class="flex justify-between">
              <span>İkindi</span>
              <span>{prayers.Asr}</span>
            </div>

            <div class="flex justify-between">
              <span>Akşam</span>
              <span>{prayers.Maghrib}</span>
            </div>

            <div class="flex justify-between">
              <span>Yatsı</span>
              <span>{prayers.Isha}</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- <div
        class="mb-5 rounded-[32px] border border-orange-400/10 bg-orange-400/5 p-6 shadow-2xl backdrop-blur-xl"
      >
        <h2 class="mb-5 text-xl font-semibold text-orange-100">
          Kerahat Vakitleri
        </h2>

        {#if loading}
          <div class="space-y-4">
            {#each Array(3) as _}
              <div class="h-6 animate-pulse rounded bg-white/10"></div>
            {/each}
          </div>
        {:else if latitude && longitude}
          <div class="space-y-4 text-sm">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-white">🌅 Kerahat Güneş</p>
              </div>

              <span class="text-orange-200">
                {getKerahatTimes()?.sunriseStart}
                -
                {getKerahatTimes()?.sunriseEnd}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-white">☀️ Kerahat Öğle</p>
              </div>

              <span class="text-orange-200">
                {getKerahatTimes()?.zawalStart}
                -
                {getKerahatTimes()?.zawalEnd}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-white">🌇 Kerahat Akşam</p>
              </div>

              <span class="text-orange-200">
                {getKerahatTimes()?.sunsetStart}
                -
                {getKerahatTimes()?.sunsetEnd}
              </span>
            </div>
          </div>
        {/if}
      </div> -->

      <div
        class="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
      >
        <h2 class="mb-5 text-xl font-semibold">Günün Hadisi</h2>

        {#if loading}
          <div class="space-y-3">
            <div class="h-5 w-full animate-pulse rounded bg-white/10"></div>

            <div class="h-5 w-5/6 animate-pulse rounded bg-white/10"></div>
          </div>
        {:else}
          <p class="text-lg leading-9 text-white/90 italic">
            “{hadith}”
          </p>

          <div class="mt-6 flex items-center gap-2">
            <div class="h-px flex-1 bg-white/10"></div>

            <p class="text-sm tracking-wide text-white/50">
              {hadithSource}
            </p>
          </div>
        {/if}
      </div>

      <button
        type="button"
        onclick={refreshLocation}
        class="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70"
      >
        📍 Konumu Güncelle
      </button>

      <div class="mt-4 text-center text-sm text-white/40">
        📍 Konum:
        <span class="text-white/70">
          {currentCity}
        </span>
      </div>

      {#if deferredPrompt}
        <button
          type="button"
          onclick={installApp}
          class="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 rounded-2xl bg-yellow-500 px-5 py-4 text-lg font-semibold text-black shadow-2xl"
        >
          📲 Uygulamayı Yükle
        </button>
      {/if}

      <div class="mb-1 mt-8 flex justify-center">
        <img src={logo} alt="Logo" class="w-28 opacity-95" />
      </div>
      <div
        class="mt-1 mb-8 flex items-center justify-center gap-2 text-sm text-white/40"
      >
        <span>© Havva Demir</span>
        <a
          href="https://www.linkedin.com/in/havva-demir-dev"
          target="_blank"
          rel="noopener noreferrer"
          class="transition hover:text-white/80"
        >
          LinkedIn
        </a>
      </div>
    </div>
  </div>
{:else}
  <div class="min-h-screen bg-black px-5 py-8 text-white">
    <div class="mx-auto max-w-md">
      <div
        class="rounded-[32px] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl"
      >
        <p class="mb-4 text-sm text-white/60">
          Konum alınamadı. Lütfen şehir seçin.
        </p>

        <input
          bind:value={cityInput}
          placeholder="Şehir ara..."
          class="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none"
        />

        <button
          type="button"
          onclick={searchCity}
          class="mt-3 w-full rounded-2xl bg-white/10 p-4"
        >
          Şehir Ara
        </button>

        {#if cityResults.length > 0}
          <div class="mt-3 space-y-2">
            {#each cityResults as city}
              <button
                type="button"
                onclick={() => selectCity(city)}
                class="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left text-white"
              >
                {city.region || city.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="mb-1 mt-8 flex justify-center">
      <img src={logo} alt="Logo" class="w-28 opacity-95" />
    </div>
    <div
      class="mt-1 mb-8 flex items-center justify-center gap-2 text-sm text-white/40"
    >
      <span>© Havva Demir</span>
      <a
        href="https://www.linkedin.com/in/havva-demir-dev"
        target="_blank"
        rel="noopener noreferrer"
        class="transition hover:text-white/80"
      >
        LinkedIn
      </a>
    </div>
  </div>
{/if}
