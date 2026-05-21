<script lang="ts">
  import { onMount } from "svelte";
  import logo from "$lib/assets/logo-gold.png";
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

  let deferredPrompt: any = null;

  let showInstallButton = $state(false);

  async function installApp() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      showInstallButton = false;
    }

    deferredPrompt = null;
  }

  function getPrayerDate(time: string) {
    const [hours, minutes] = time.split(":").map(Number);

    const date = new Date();

    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);

    return date;
  }

  function calculateNextPrayer() {
    const now = new Date();

    const prayerList = [
      { name: "İmsak", time: prayers.Imsak },
      { name: "Güneş", time: prayers.Sunrise },
      { name: "Öğle", time: prayers.Dhuhr },
      { name: "İkindi", time: prayers.Asr },
      { name: "Akşam", time: prayers.Maghrib },
      { name: "Yatsı", time: prayers.Isha },
    ];

    for (const prayer of prayerList) {
      const prayerDate = getPrayerDate(prayer.time);

      if (prayerDate > now) {
        nextPrayer = prayer.name;

        updateCountdown(prayerDate);

        return;
      }
    }

    const tomorrowFajr = getPrayerDate(prayers.Imsak);

    tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);

    nextPrayer = "İmsak";

    updateCountdown(tomorrowFajr);
  }

  function updateCountdown(target: Date) {
    setInterval(() => {
      const now = new Date();

      const diff = target.getTime() - now.getTime();

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
    const response = await fetch("/api/prayer-times");

    const data = await response.json();

    const date = new Date();
    const today =
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, "0")}-` +
      `${String(date.getDate()).padStart(2, "0")}T00:00:00`;

    const timings = data.find((item: any) => {
      return item.date === today;
    });

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

    return data.address.city || data.address.town || data.address.village;
  }

  onMount(async () => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallButton = true;
    });
    const cachedLocationId = localStorage.getItem("location-id");

    if (cachedLocationId) {
      await fetchPrayerTimes(Number(cachedLocationId));

      fetchHadith();

      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;

      const lon = position.coords.longitude;

      const city = await getCity(lat, lon);

      const searchResponse = await fetch(`/api/location-search?city=${city}`);

      const locations = await searchResponse.json();

      const locationId = locations[0].id;

      localStorage.setItem("location-id", locationId.toString());

      await fetchPrayerTimes(locationId);

      fetchHadith();
    });
  });

  async function refreshLocation() {
    localStorage.removeItem("location-id");

    location.reload();
  }
</script>

<div class="min-h-screen bg-black px-5 py-8 text-white">
  <div class="mx-auto max-w-md">
    <div
      class="mb-5 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
    >
      <p class="text-sm tracking-wide text-white/50">Sonraki Namaz</p>

      {#if loading}
        <div class="mt-3 h-10 w-32 animate-pulse rounded-xl bg-white/10"></div>

        <div class="mt-5 h-14 w-48 animate-pulse rounded-2xl bg-white/10"></div>
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
      onclick={refreshLocation}
      class="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70"
    >
      📍 Konumu Güncelle
    </button>

    {#if showInstallButton}
      <button
        onclick={installApp}
        class="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 rounded-2xl bg-yellow-500 px-5 py-4 text-lg font-semibold text-black shadow-2xl"
      >
        📲 Uygulamayı Yükle
      </button>
    {/if}

    <div class="mb-8 flex justify-center">
      <img src={logo} alt="Logo" class="w-28 opacity-95" />
    </div>
  </div>
</div>
