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

  let hadithSource = $state("");
  let city = $state("Konum alınıyor...");

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

  async function fetchPrayerTimes(lat: number, lon: number) {
    const response = await fetch(
      `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=13&tune=0,0,0,0,0,0,0,0,0`,
    );

    const data = await response.json();

    prayers = {
      Imsak: data.data.timings.Imsak,
      Sunrise: data.data.timings.Sunrise,
      Dhuhr: data.data.timings.Dhuhr,
      Asr: data.data.timings.Asr,
      Maghrib: data.data.timings.Maghrib,
      Isha: data.data.timings.Isha,
    };

    calculateNextPrayer();
  }

  function fetchHadith() {
    const today = new Date().getDate();

    const selected = hadiths[today % hadiths.length];

    hadith = selected.text;
    hadithSource = selected.source;
  }

  onMount(() => {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      await fetchPrayerTimes(lat, lon);

      fetchHadith();
    });
  });
</script>

<div class="min-h-screen bg-black px-6 py-10 text-white">
  <div class="mx-auto max-w-md">
    <img src={logo} alt="Logo" class="mx-auto mb-8 w-40 opacity-90" />

    <div
      class="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
    >
      <p class="text-sm text-white/60">Sonraki Namaz</p>

      <h1 class="mt-2 text-4xl font-light">
        {nextPrayer}
      </h1>

      <p class="mt-4 text-5xl font-bold tracking-wider">
        {countdown}
      </p>
    </div>

    <div
      class="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
    >
      <h2 class="mb-4 text-xl font-semibold">Namaz Vakitleri</h2>

      <div class="space-y-3">
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
    </div>

    <div
      class="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
    >
      <h2 class="mb-5 text-xl font-semibold">Günün Hadisi</h2>

      <p class="text-lg leading-9 text-white/90 italic">
        “{hadith}”
      </p>

      <div class="mt-6 flex items-center gap-2">
        <div class="h-px flex-1 bg-white/10"></div>

        <p class="text-sm tracking-wide text-white/50">
          {hadithSource}
        </p>
      </div>
    </div>
  </div>
</div>
