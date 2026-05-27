<script lang="ts">
  import { onMount } from "svelte";
  import logo from "$lib/assets/logo-goldd.png";
  import { hadiths } from "$lib/data/hadiths";
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

  let nowTime = $state(new Date());

  let hijriDate = $derived.by(() => {
    try {
      // Verwendung der nativen Intl API für den türkischen Sprachraum mit islamischem Kalender
      const formatter = new Intl.DateTimeFormat("tr-TR-u-ca-islamic-umalqura", {
        day: "numeric",
        month: "long", // Gibt den Monatsnamen aus (z.B. Ramazan, Şevval, Muharrem)
        year: "numeric",
      });

      return formatter.format(nowTime);
    } catch (e) {
      console.error("Hicri takvim hesaplanamadı:", e);
      return "";
    }
  });

  // Objekt mit den wichtigsten Feiertagen (Format: "Tag Monat")
  const ISLAMIC_HOLIDAYS: Record<
    string,
    { name: string; icon: string; isBayram: boolean }
  > = {
    "1-9": { name: "Ramazan-ı Şerif Başlangıcı", icon: "🌙", isBayram: false },
    "26-9": { name: "Kadir Gecesi", icon: "✨", isBayram: false },
    "1-10": { name: "Ramazan Bayramı (1. Gün)", icon: "🍬", isBayram: true },
    "2-10": { name: "Ramazan Bayramı (2. Gün)", icon: "🍬", isBayram: true },
    "3-10": { name: "Ramazan Bayramı (3. Gün)", icon: "🍬", isBayram: true },
    "9-12": { name: "Kurban Bayramı Arifesi", icon: "🤲", isBayram: false },
    "10-12": { name: "Kurban Bayramı (1. Gün)", icon: "🐑", isBayram: true }, // HEUTE!
    "11-12": { name: "Kurban Bayramı (2. Gün)", icon: "🐑", isBayram: true }, // MORGEN!
    "12-12": { name: "Kurban Bayramı (3. Gün)", icon: "🐑", isBayram: true },
    "13-12": { name: "Kurban Bayramı (4. Gün)", icon: "🐑", isBayram: true },
    "1-1": { name: "Hicri Yılbaşı", icon: "🗓️", isBayram: false },
    "10-1": { name: "Aşure Günü", icon: "🥣", isBayram: false },
    "26-7": { name: "Mirac Kandili", icon: "🌹", isBayram: false },
    "14-8": { name: "Berat Kandili", icon: "🕯️", isBayram: false },
    "12-3": { name: "Mevlid Kandili", icon: "🕌", isBayram: false },
  };

  let currentHoliday = $derived.by(() => {
    try {
      // Wir holen Tag und Monat numerisch direkt aus der Core-API des Systems
      const dayFormatter = new Intl.DateTimeFormat(
        "en-US-u-ca-islamic-umalqura",
        { day: "numeric" },
      );
      const monthFormatter = new Intl.DateTimeFormat(
        "en-US-u-ca-islamic-umalqura",
        { month: "numeric" },
      );

      // en-US sorgt dafür, dass wir reine, unformatierte West-Zahlen erhalten
      const hijriDay = dayFormatter.format(nowTime).trim();
      const hijriMonth = monthFormatter.format(nowTime).trim();

      // Verhindert Abstürze, falls der String zusätzliche Zeichen enthält (z.B. "1447 AH")
      const cleanDay = hijriDay.match(/\d+/)?.[0] || "";
      const cleanMonth = hijriMonth.match(/\d+/)?.[0] || "";

      const key = `${cleanDay}-${cleanMonth}`; // Ergibt heute am Handy & PC exakt: "10-12"

      return ISLAMIC_HOLIDAYS[key] || null;
    } catch (e) {
      console.error("Hicri bayram hesaplama hatası:", e);
      return null;
    }
  });

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
        continue;
      }

      if (prayerDate > now) {
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
      nowTime = new Date();

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
    if (!prayers.Sunrise || !prayers.Dhuhr || !prayers.Maghrib) {
      return null;
    }

    return {
      sunriseStart: prayers.Sunrise,
      sunriseEnd: addMinutes(prayers.Sunrise, 45),

      zawalStart: addMinutes(prayers.Dhuhr, -45),
      zawalEnd: prayers.Dhuhr,

      sunsetStart: addMinutes(prayers.Maghrib, -45),
      sunsetEnd: prayers.Maghrib,
    };
  }

  function isKerahatActive(startTime?: string, endTime?: string): boolean {
    if (!startTime || !endTime) return false;

    const current = nowTime;
    // Start- und Endzeit für das heutige Datum generieren
    const start = getPrayerDate(startTime);
    const end = getPrayerDate(endTime);

    if (isNaN(start.getTime()) || !end.getTime()) return false;

    // Prüfen, ob wir uns JETZT genau dazwischen befinden
    return current >= start && current <= end;
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

      <div
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
        {:else}
          {@const times = getKerahatTimes()}

          {#if times}
            {@const isGunesActive = isKerahatActive(
              times.sunriseStart,
              times.sunriseEnd,
            )}
            {@const isOgleActive = isKerahatActive(
              times.zawalStart,
              times.zawalEnd,
            )}
            {@const isAksamActive = isKerahatActive(
              times.sunsetStart,
              times.sunsetEnd,
            )}
            <div class="space-y-3 text-sm">
              <!-- 1. Güneş -->
              <div
                class="flex items-center justify-between p-2 rounded-xl transition-all duration-300 {isGunesActive
                  ? 'bg-orange-500/15 border border-orange-500/20 shadow-lg shadow-orange-500/5'
                  : ''}"
              >
                <div class="flex items-center gap-2">
                  <p class="font-medium text-white">🌅 Kerahat Güneş</p>
                  {#if isGunesActive}
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-300 animate-pulse"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-orange-400"
                      ></span>
                      Aktif
                    </span>
                  {/if}
                </div>
                <span
                  class={isGunesActive
                    ? "text-orange-300 font-semibold"
                    : "text-orange-200"}
                >
                  {times.sunriseStart} - {times.sunriseEnd}
                </span>
              </div>

              <!-- 2. Öğle -->

              <div
                class="flex items-center justify-between p-2 rounded-xl transition-all duration-300 {isOgleActive
                  ? 'bg-orange-500/15 border border-orange-500/20 shadow-lg shadow-orange-500/5'
                  : ''}"
              >
                <div class="flex items-center gap-2">
                  <p class="font-medium text-white">☀️ Kerahat Öğle</p>
                  {#if isOgleActive}
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-300 animate-pulse"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-orange-400"
                      ></span>
                      Aktif
                    </span>
                  {/if}
                </div>
                <span
                  class={isOgleActive
                    ? "text-orange-300 font-semibold"
                    : "text-orange-200"}
                >
                  {times.zawalStart} - {times.zawalEnd}
                </span>
              </div>

              <!-- 3. Akşam -->

              <div
                class="flex items-center justify-between p-2 rounded-xl transition-all duration-300 {isAksamActive
                  ? 'bg-orange-500/15 border border-orange-500/20 shadow-lg shadow-orange-500/5'
                  : ''}"
              >
                <div class="flex items-center gap-2">
                  <p class="font-medium text-white">🌇 Kerahat Akşam</p>
                  {#if isAksamActive}
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-300 animate-pulse"
                    >
                      <span class="h-1.5 w-1.5 rounded-full bg-orange-400"
                      ></span>
                      Aktif
                    </span>
                  {/if}
                </div>
                <span
                  class={isAksamActive
                    ? "text-orange-300 font-semibold"
                    : "text-orange-200"}
                >
                  {times.sunsetStart} - {times.sunsetEnd}
                </span>
              </div>
            </div>
          {:else}
            <p class="text-sm text-orange-300/70 italic text-center">
              Konum bilgisi veya vakitler yüklenemedi.
            </p>
          {/if}
        {/if}
      </div>

      <!-- Hicri Takvim & Mübarek Günler Banner -->
      <div
        class="mb-4 flex flex-col gap-3 rounded-2xl border transition-all duration-500 p-5 backdrop-blur-md
  {currentHoliday?.isBayram
          ? 'border-emerald-500/20 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
          : currentHoliday
            ? 'border-amber-500/20 bg-amber-500/10 shadow-lg shadow-amber-500/5'
            : 'border-white/5 bg-white/5'}"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">🌙</span>
            <div>
              <p
                class="text-xs font-medium text-orange-300/75 uppercase tracking-wider"
              >
                Hicrî Tarih
              </p>
              <p class="text-sm font-semibold text-white">
                {#if hijriDate}
                  {hijriDate}
                {:else}
                  Yükleniyor...
                {/if}
              </p>
            </div>
          </div>

          <span
            class="text-xs bg-white/10 text-white/60 px-2 py-1 rounded-md font-mono"
          >
            {nowTime.getFullYear()}
          </span>
        </div>

        <!-- Wenn heute ein besonderer Tag oder Feiertag ist -->
        {#if currentHoliday}
          <div
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium border animate-pulse
      {currentHoliday.isBayram
              ? 'bg-emerald-500/20 border-emerald-400/35 text-emerald-200'
              : 'bg-amber-500/20 border-amber-400/35 text-amber-200'}"
          >
            <span class="text-sm">{currentHoliday.icon}</span>
            <div>
              <span class="block text-[10px] uppercase opacity-75">
                {currentHoliday.isBayram
                  ? "Mübarek Bayram"
                  : "Mübarek Gece / Gün"}
              </span>
              <span class="text-sm font-bold">{currentHoliday.name}</span>
            </div>
          </div>
        {/if}
      </div>

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
