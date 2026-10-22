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
  let apiError = $state("");

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
  type LocationOption = {
    id: number;
    name: string;
  };

  let countries = $state<LocationOption[]>([]);
  let states = $state<LocationOption[]>([]);
  let cities = $state<LocationOption[]>([]);

  let selectedCountryId = $state("");
  let selectedStateId = $state("");
  let selectedCityId = $state("");

  let locationLoading = $state(false);
  let isIos = $state(false);
  let isStandalone = $state(false);
  let showIosInstallHelp = $state(false);
  let hideInstallHint = $state(false);

  async function loadCountries() {
    locationLoading = true;
    apiError = "";

    try {
      const response = await fetch("/api/location-search?type=countries");

      if (!response.ok) throw new Error("Länder konnten nicht geladen werden");

      countries = await response.json();
    } catch (error) {
      console.error("Country loading failed:", error);
      apiError = "Länder konnten nicht geladen werden.";
    } finally {
      locationLoading = false;
    }
  }

  async function loadStates(countryId: string) {
    selectedCountryId = countryId;
    selectedStateId = "";
    selectedCityId = "";

    states = [];
    cities = [];
    cityResults = [];

    if (!countryId) return;

    locationLoading = true;
    apiError = "";

    try {
      const response = await fetch(
        `/api/location-search?type=states&countryId=${countryId}`,
      );

      if (!response.ok)
        throw new Error("Regionen konnten nicht geladen werden");

      states = await response.json();
    } catch (error) {
      console.error("State loading failed:", error);
      apiError = "Regionen konnten nicht geladen werden.";
    } finally {
      locationLoading = false;
    }
  }

  async function loadCities(stateId: string) {
    selectedStateId = stateId;
    selectedCityId = "";
    cities = [];
    cityResults = [];

    if (!stateId) return;

    locationLoading = true;
    apiError = "";

    try {
      const response = await fetch(
        `/api/location-search?type=cities&stateId=${stateId}`,
      );

      if (!response.ok) throw new Error("Städte konnten nicht geladen werden");

      cities = await response.json();
    } catch (error) {
      console.error("City loading failed:", error);
      apiError = "Städte konnten nicht geladen werden.";
    } finally {
      locationLoading = false;
    }
  }

  let locationError = $state(false);

  let deferredPrompt = $state<any>(null);
  let countdownInterval: ReturnType<typeof setInterval>;

  let latitude = $state<number | null>(null);
  let longitude = $state<number | null>(null);

  const KAABA_LAT = 21.42252;
  const KAABA_LON = 39.82618;

  let liveCompassActive = $state(false);
  let deviceHeading = $state(0); // Wohin das Handy gerade schaut (0 = Nord)
  let isAligned = $state(false);
  let compassPermissionDenied = $state(false);

  let absoluteSensorSupported = $state(false);
  let absoluteSensorStarted = $state(false);
  let absoluteSensorError = $state("");
  let absoluteHeading = $state<number | null>(null);
  let debugQuaternion = $state("");
  let debugAxes = $state("");
  let absoluteCompassSensor: any = null;

  let hasCompassData = $state(false);
  let calibrationRecommended = $state(false);
  let unstableCounter = 0;
  let lastHeading = 0;
  let compassInitializing = $state(false);

  let nowTime = $state(new Date());

  let qiblaAvailable = $derived(latitude !== null && longitude !== null);
  let locationPermission = $state<"granted" | "prompt" | "denied" | null>(null);

  const ISLAMIC_MONTHS = [
    "Muharrem", // 1
    "Safer", // 2
    "Rebiülevvel", // 3
    "Rebiülahir", // 4
    "Cemaziyelevvel", // 5
    "Cemaziyelahir", // 6
    "Receb", // 7
    "Şaban", // 8
    "Ramazan", // 9
    "Şevval", // 10
    "Zilkade", // 11
    "Zilhicce", // 12
  ];

  let hijriDate = $derived.by(() => {
    try {
      // Wir holen uns Tag, Monat und Jahr als reine, plattformunabhängige Zahlen
      const dayFormatter = new Intl.DateTimeFormat(
        "en-US-u-ca-islamic-umalqura",
        { day: "numeric" },
      );
      const monthFormatter = new Intl.DateTimeFormat(
        "en-US-u-ca-islamic-umalqura",
        { month: "numeric" },
      );
      const yearFormatter = new Intl.DateTimeFormat(
        "en-US-u-ca-islamic-umalqura",
        { year: "numeric" },
      );

      const rawDay = dayFormatter.format(nowTime).trim();
      const rawMonth = monthFormatter.format(nowTime).trim();
      const rawYear = yearFormatter.format(nowTime).trim();

      // Bereinige eventuellen Text drumherum (z.B. "MÖ" oder "AH"), sodass nur die Zahlen übrig bleiben
      const cleanDay = rawDay.match(/\d+/)?.[0] || "";
      const cleanMonth = parseInt(rawMonth.match(/\d+/)?.[0] || "0", 10);
      const cleanYear = rawYear.match(/\d+/)?.[0] || "";

      if (!cleanDay || cleanMonth < 1 || cleanMonth > 12 || !cleanYear) {
        return "";
      }

      // Wir mappen die Monatszahl (z.B. 12) auf unser eigenes Array (Index 11 = "Zilhicce")
      const turkishMonthName = ISLAMIC_MONTHS[cleanMonth - 1];

      // Gibt das Datum im exakten Format aus: "10 Zilhicce 1447"
      return `${cleanDay} ${turkishMonthName} ${cleanYear}`;
    } catch (e) {
      console.error("Hicri takvim formatlama hatası:", e);
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

  // Berechnet den STATISCHEN Winkel zu Mekka basierend auf den Nutzer-Koordinaten
  let qiblaAngle = $derived.by(() => {
    if (latitude === null || longitude === null) return null;

    // Umrechnung in Bogenmaß (Radiant)
    const lat1 = (latitude * Math.PI) / 180;
    const lon1 = (longitude * Math.PI) / 180;
    const lat2 = (KAABA_LAT * Math.PI) / 180;
    const lon2 = (KAABA_LON * Math.PI) / 180;

    const dLon = lon2 - lon1;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let brng = Math.atan2(y, x);
    brng = (brng * 180) / Math.PI;
    brng = (brng + 360) % 360; // Normalisieren auf 0-360°

    return Math.round(brng);
  });

  // Berechnet den DYNAMISCHEN Rotations-Winkel für die Kompassnadel im Live-Modus
  let visualNeedleRotation = $derived.by(() => {
    if (qiblaAngle === null) return 0;
    if (!liveCompassActive) return qiblaAngle; // Im statischen Modus zeigt der Pfeil einfach den festen Winkel

    // Im Live-Modus: Ziehe die Handy-Blickrichtung vom Qibla-Winkel ab
    return (qiblaAngle - deviceHeading + 360) % 360;
  });

  async function testAbsoluteOrientationSensor() {
    absoluteSensorSupported = false;
    absoluteSensorStarted = false;
    absoluteSensorError = "";
    absoluteHeading = null;

    try {
      const Sensor = (window as any).AbsoluteOrientationSensor;

      if (!Sensor) {
        absoluteSensorError = "AbsoluteOrientationSensor nicht verfügbar";
        return;
      }

      absoluteSensorSupported = true;

      const sensor = new Sensor({
        frequency: 10,
        referenceFrame: "device",
      });

      sensor.addEventListener("reading", () => {
        const quaternion = sensor.quaternion;

        if (!quaternion || quaternion.length < 4) return;

        const [x, y, z, w] = quaternion;

        debugQuaternion = `${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}, ${w.toFixed(3)}`;

        // Quaternion auf die Geräteachsen anwenden
        function rotateVector(
          vx: number,
          vy: number,
          vz: number,
          x: number,
          y: number,
          z: number,
          w: number,
        ) {
          const ix = w * vx + y * vz - z * vy;
          const iy = w * vy + z * vx - x * vz;
          const iz = w * vz + x * vy - y * vx;
          const iw = -x * vx - y * vy - z * vz;

          return {
            x: ix * w + iw * -x + iy * -z - iz * -y,
            y: iy * w + iw * -y + iz * -x - ix * -z,
            z: iz * w + iw * -z + ix * -y - iy * -x,
          };
        }

        // Geräteachsen:
        // X = rechts
        // Y = oben
        // Z = aus dem Display heraus
        const axisX = rotateVector(1, 0, 0, x, y, z, w);
        const axisY = rotateVector(0, 1, 0, x, y, z, w);
        const axisZ = rotateVector(0, 0, 1, x, y, z, w);

        debugAxes =
          `X: ${axisX.x.toFixed(2)}, ${axisX.y.toFixed(2)}, ${axisX.z.toFixed(2)} | ` +
          `Y: ${axisY.x.toFixed(2)}, ${axisY.y.toFixed(2)}, ${axisY.z.toFixed(2)} | ` +
          `Z: ${axisZ.x.toFixed(2)}, ${axisZ.y.toFixed(2)}, ${axisZ.z.toFixed(2)}`;

        // HIER EINFÜGEN
        const heading = Math.atan2(axisY.x, axisY.y);

        let normalizedHeading = (heading * 180) / Math.PI;
        normalizedHeading = (normalizedHeading + 360) % 360;

        absoluteHeading = normalizedHeading;

        absoluteSensorStarted = true;
      });

      sensor.addEventListener("error", (event: any) => {
        absoluteSensorError =
          event?.error?.name || "Sensor konnte nicht gestartet werden";
      });

      sensor.start();
    } catch (error: any) {
      absoluteSensorError = error?.message || String(error);
    }
  }

  async function startLiveCompass() {
    compassInitializing = true;
    calibrationRecommended = false;
    unstableCounter = 0;
    lastHeading = 0;
    hasCompassData = false;
    compassPermissionDenied = false;

    if (typeof window === "undefined") return;

    isAligned = false;

    try {
      const Sensor = (window as any).AbsoluteOrientationSensor;

      if (!Sensor) {
        compassPermissionDenied = true;
        compassInitializing = false;
        return;
      }

      const sensor = new Sensor({
        frequency: 10,
        referenceFrame: "device",
      });
      absoluteCompassSensor = sensor;

      sensor.addEventListener("reading", () => {
        const quaternion = sensor.quaternion;

        if (!quaternion || quaternion.length < 4) return;

        const [x, y, z, w] = quaternion;

        // Quaternion → Geräte-Y-Achse
        const vx = 0;
        const vy = 1;
        const vz = 0;

        const ix = w * vx + y * vz - z * vy;
        const iy = w * vy + z * vx - x * vz;
        const iz = w * vz + x * vy - y * vx;
        const iw = -x * vx - y * vy - z * vz;

        const axisY = {
          x: ix * w + iw * -x + iy * -z - iz * -y,
          y: iy * w + iw * -y + iz * -x - ix * -z,
          z: iz * w + iw * -z + ix * -y - iy * -x,
        };

        // Geräte-Y-Achse → Kompassrichtung
        const heading = Math.atan2(axisY.x, axisY.y);

        let currentHeading = (heading * 180) / Math.PI;
        currentHeading = (currentHeading + 360) % 360;

        hasCompassData = true;
        compassInitializing = false;

        deviceHeading = currentHeading;

        const difference = Math.abs(currentHeading - lastHeading);
        const normalizedDifference = Math.min(difference, 360 - difference);

        if (normalizedDifference > 15) {
          unstableCounter++;
        } else {
          unstableCounter = Math.max(0, unstableCounter - 1);
        }

        if (unstableCounter > 20) {
          calibrationRecommended = true;
        }

        lastHeading = currentHeading;

        if (qiblaAngle !== null) {
          const qiblaDifference = Math.abs(currentHeading - qiblaAngle);

          const normalizedQiblaDifference = Math.min(
            qiblaDifference,
            360 - qiblaDifference,
          );

          isAligned = normalizedQiblaDifference <= 8;
        }
      });

      sensor.addEventListener("error", (event: any) => {
        console.error("AbsoluteOrientationSensor:", event);

        compassPermissionDenied = true;
        compassInitializing = false;
      });

      sensor.start();

      liveCompassActive = true;

      startCompassTimeout();
    } catch (error) {
      console.error("Kompass konnte nicht gestartet werden:", error);

      compassPermissionDenied = true;
      compassInitializing = false;
    }
  }

  function stopLiveCompass() {
    if (absoluteCompassSensor) {
      try {
        absoluteCompassSensor.stop();
      } catch (error) {
        console.error("Kompass-Sensor konnte nicht gestoppt werden:", error);
      }

      absoluteCompassSensor = null;
    }

    calibrationRecommended = false;
    unstableCounter = 0;
    lastHeading = 0;

    liveCompassActive = false;
    isAligned = false;
    deviceHeading = 0;
  }

  function startCompassTimeout() {
    setTimeout(() => {
      if (!hasCompassData) {
        stopLiveCompass();

        compassInitializing = false;
        compassPermissionDenied = true;
      }
    }, 2000);
  }

  async function checkLocationPermission() {
    if (!("permissions" in navigator)) return;

    try {
      const permission = await navigator.permissions.query({
        name: "geolocation",
      });

      locationPermission = permission.state as "granted" | "prompt" | "denied";

      permission.onchange = () => {
        locationPermission = permission.state as
          | "granted"
          | "prompt"
          | "denied";
      };
    } catch (error) {
      console.error(error);
    }
  }

  async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }

  async function selectCity(city: LocationOption) {
    currentCity = city.name;

    localStorage.setItem("city", currentCity);
    localStorage.setItem("location-id", city.id.toString());

    cityResults = [];
    showCitySelection = false;
    locationError = false;

    await fetchPrayerTimes(city.id);

    if (!apiError) {
      fetchHadith();
    }
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
    loading = true;
    apiError = "";

    try {
      const response = await fetch(
        `/api/prayer-times?locationId=${locationId}`,
      );

      if (!response.ok) {
        throw new Error(`Prayer API error: ${response.status}`);
      }

      const data = await response.json();

      if (
        !data ||
        !data.Imsak ||
        !data.Sunrise ||
        !data.Dhuhr ||
        !data.Asr ||
        !data.Maghrib ||
        !data.Isha
      ) {
        throw new Error("Incomplete prayer times response");
      }

      prayers = {
        Imsak: data.Imsak,
        Sunrise: data.Sunrise,
        Dhuhr: data.Dhuhr,
        Asr: data.Asr,
        Maghrib: data.Maghrib,
        Isha: data.Isha,
      };

      calculateNextPrayer();
    } catch (error) {
      console.error("Failed to fetch prayer times:", error);

      apiError =
        "Die Verbindung zum Gebetszeiten-Dienst ist momentan nicht möglich. Bitte versuche es später erneut.";
    } finally {
      loading = false;
    }
  }

  function fetchHadith() {
    const today = new Date().getDate();

    const selected = hadiths[today % hadiths.length];

    hadith = selected.text;

    hadithSource = selected.source;
  }

  async function getCity(
    lat: number,
    lon: number,
  ): Promise<{ city: string; region: string } | null> {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    );

    if (!response.ok) {
      throw new Error("Reverse geocoding failed");
    }

    const data = await response.json();
    const address = data.address;

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.city_district;

    const region = address.state;

    if (!city || !region) {
      return null;
    }

    return { city, region };
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
    await checkLocationPermission();
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

    const ua = navigator.userAgent;

    isIos =
      /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

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
      await loadCountries();

      fetchHadith();

      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          latitude = lat;
          longitude = lon;

          localStorage.setItem("lat", lat.toString());
          localStorage.setItem("lon", lon.toString());

          const city = await getCity(lat, lon);

          if (!city) {
            throw new Error("City could not be determined");
          }

          const normalize = (value: string) =>
            value
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLocaleLowerCase("de")
              .trim();

          const countriesResponse = await fetch(
            "/api/location-search?type=countries",
          );

          if (!countriesResponse.ok) {
            throw new Error("Countries could not be loaded");
          }

          const availableCountries = await countriesResponse.json();

          let matchedLocation: LocationOption | undefined;

          // Diyanet durchsucht Regionen und Städte innerhalb der Länder.
          // Bei einem passenden Stadtnamen verwenden wir die zugehörige Stadt-ID.
          for (const country of availableCountries) {
            const statesResponse = await fetch(
              `/api/location-search?type=states&countryId=${country.id}`,
            );

            if (!statesResponse.ok) continue;

            const availableStates = await statesResponse.json();

            for (const state of availableStates) {
              const citiesResponse = await fetch(
                `/api/location-search?type=cities&stateId=${state.id}`,
              );

              if (!citiesResponse.ok) continue;

              const availableCities: LocationOption[] =
                await citiesResponse.json();

              matchedLocation = availableCities.find(
                (item) => normalize(item.name) === normalize(city),
              );

              if (matchedLocation) break;
            }

            if (matchedLocation) break;
          }

          if (!matchedLocation) {
            currentCity = "";
            showCitySelection = true;
            await loadCountries();
            throw new Error(`No Diyanet location found for: ${city}`);
          }

          currentCity = matchedLocation.name;
          showCitySelection = false;

          localStorage.setItem("city", matchedLocation.name);
          localStorage.setItem("location-id", matchedLocation.id.toString());

          await fetchPrayerTimes(matchedLocation.id);

          if (!apiError) {
            fetchHadith();
          }
        } catch (error) {
          console.error("Location initialization failed:", error);

          apiError =
            "Die Standortsuche ist momentan nicht erreichbar. Bitte versuche es später erneut.";

          showCitySelection = false;
        } finally {
          loading = false;
        }
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
    apiError = "";

    localStorage.removeItem("location-id");
    localStorage.removeItem("city");

    currentCity = "";
    cityInput = "";
    cityResults = [];

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          latitude = lat;
          longitude = lon;

          localStorage.setItem("lat", lat.toString());
          localStorage.setItem("lon", lon.toString());

          const location = await getCity(lat, lon);

          if (!location?.city || !location?.region) {
            throw new Error("City or state could not be determined");
          }

          const normalize = (value: string) =>
            value
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLocaleLowerCase("de")
              .trim();

          // Nur die Bundesländer Deutschlands laden
          const statesResponse = await fetch(
            "/api/location-search?type=states&countryId=13",
          );

          if (!statesResponse.ok) {
            throw new Error("German states could not be loaded");
          }

          const germanStates: LocationOption[] = await statesResponse.json();

          // Passendes Bundesland anhand der GPS-Adresse finden
          const matchedState = germanStates.find(
            (state) => normalize(state.name) === normalize(location.region),
          );

          if (!matchedState) {
            throw new Error(`Diyanet region not found: ${location.region}`);
          }

          // Nur Städte aus diesem Bundesland laden
          const citiesResponse = await fetch(
            `/api/location-search?type=cities&stateId=${matchedState.id}`,
          );

          if (!citiesResponse.ok) {
            throw new Error("Cities could not be loaded");
          }

          const germanCities: LocationOption[] = await citiesResponse.json();

          const matchedLocation = germanCities.find(
            (item) => normalize(item.name) === normalize(location.city),
          );

          if (!matchedLocation) {
            throw new Error(`Diyanet city not found: ${location.city}`);
          }

          currentCity = matchedLocation.name;
          showCitySelection = false;

          localStorage.setItem("city", matchedLocation.name);
          localStorage.setItem("location-id", matchedLocation.id.toString());

          await fetchPrayerTimes(matchedLocation.id);

          if (!apiError) {
            fetchHadith();
          }
        } catch (error) {
          console.error("GPS location lookup failed:", error);

          currentCity = "";
          showCitySelection = true;

          await loadCountries();
        } finally {
          loading = false;
        }
      },
      (error) => {
        console.error("GPS location failed:", error);

        loading = false;
        currentCity = "";
        showCitySelection = true;

        if (error.code === error.PERMISSION_DENIED) {
          locationPermission = "denied";
        }

        void loadCountries();
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  async function shareApp() {
    const shareData = {
      title: "Namaz Vakitleri",
      text: "Namaz vakitlerine ve kıble yönüne kolayca ulaş.",
      url: window.location.origin,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        alert("Bağlantı kopyalandı!");
      } else {
        window.prompt("Bağlantıyı kopyala:", shareData.url);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Paylaşma başarısız:", error);
      }
    }
  }
</script>

{#if currentCity}
  <div class="min-h-screen bg-black px-5 py-8 text-white">
    <div class="mx-auto max-w-md">
      <div
        class="mb-5 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm tracking-wide text-white/50">Sonraki Namaz</p>

          <button
            type="button"
            onclick={shareApp}
            aria-label="Uygulamayı paylaş"
            class="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-orange-300 transition hover:bg-white/5 active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.7 10.7 6.6-4.4" />
              <path d="m8.7 13.3 6.6 4.4" />
            </svg>
          </button>
        </div>

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
        {#if apiError}
          <div
            role="alert"
            class="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
          >
            <p class="font-semibold">
              ⚠️ Gebetszeiten momentan nicht verfügbar
            </p>

            <p class="mt-2 text-red-200/80">
              {apiError}
            </p>
          </div>
        {/if}

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
        class="mb-5 rounded-[32px] border border-orange-400/10 bg-orange-400/5 p-6 shadow-2xl backdrop-blur-xl"
      >
        <!-- Header-Bereich -->
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-xl font-semibold text-orange-100">Kıble Yönü</h2>
          {#if qiblaAngle !== null}
            <span
              class="text-xs bg-orange-500/20 text-orange-300 font-mono px-2.5 py-1 rounded-md border border-orange-500/20"
            >
              Pusula Derecesi: {qiblaAngle}°
            </span>
          {/if}
        </div>

        {#if loading}
          <!-- Lade-Zustand (Skelett) -->
          <div class="flex flex-col items-center py-6 space-y-4">
            <div class="h-24 w-24 animate-pulse rounded-full bg-white/10"></div>
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center space-y-6">
            <!-- 1. Der visuelle Kompass-Kreis -->
            <div
              class="relative w-36 h-36 rounded-full border-2 border-dashed flex items-center justify-center bg-white/5 shadow-inner transition-all duration-300
        {isAligned
                ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                : 'border-white/20'}"
            >
              <!-- Himmelsrichtungen zur Orientierung -->
              <span
                class="absolute top-1 text-[10px] font-bold font-mono transition-colors {isAligned
                  ? 'text-emerald-300'
                  : 'text-white/40'}">K</span
              >
              <span
                class="absolute bottom-1 text-[10px] font-bold font-mono text-white/20"
                >G</span
              >
              <span
                class="absolute right-1 text-[10px] font-bold font-mono text-white/20"
                >D</span
              >
              <span
                class="absolute left-1 text-[10px] font-bold font-mono text-white/20"
                >B</span
              >

              <!-- Die rotierende Kompassnadel -->
              <div
                class="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div
                  class="relative w-2 h-28 flex flex-col justify-between items-center transition-transform duration-200 ease-out origin-center"
                  style={`transform: rotate(${visualNeedleRotation}deg);`}
                >
                  <!-- Pfeilspitze -->
                  <div
                    class={`w-0 h-0 border-l-[8px] border-r-[8px] border-b-[24px]
        border-l-transparent border-r-transparent
        transition-colors duration-300
        ${
          isAligned
            ? "border-b-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            : "border-b-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]"
        }`}
                  ></div>

                  <!-- Kaaba bleibt an der Spitze der Nadel -->
                  <span class="absolute -top-6 text-sm">🕋</span>

                  <!-- Unteres Ende der Nadel -->
                  <div
                    class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[18px]
        border-l-transparent border-r-transparent border-t-white/30"
                  ></div>
                </div>
              </div>

              <!-- Zentraler Achsen-Pin -->
              <div
                class="absolute w-3 h-3 bg-white rounded-full border shadow-md transition-colors {isAligned
                  ? 'border-emerald-500'
                  : 'border-orange-500'}"
              ></div>

              <!-- Zentraler Achsen-Pin -->
              <div
                class="absolute w-3 h-3 bg-white rounded-full border shadow-md transition-colors {isAligned
                  ? 'border-emerald-500'
                  : 'border-orange-500'}"
              ></div>
            </div>

            <!-- 2. Dynamischer Informationsbereich für ALLE Endgeräte -->
            <div class="w-full text-center space-y-4">
              <!-- Statische Info-Karten für PC-Nutzer & Schnelles Ablesen -->
              <div class="grid grid-cols-2 gap-2 text-left">
                <div class="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span
                    class="text-[10px] uppercase text-orange-200/50 block tracking-wider"
                    >Kıble Açısı</span
                  >
                  <!-- 
                  <p class="text-sm text-white/50">
                    Kompass: {Math.round(deviceHeading)}°
                  </p>

                  <p class="text-sm text-white/50">
                    Kıble: {qiblaAngle}°
                  </p> -->

                  <!-- <button
                    onclick={testAbsoluteOrientationSensor}
                    class="mt-3 w-full rounded-xl bg-blue-500/20 px-3 py-2 text-xs text-blue-200"
                  >
                    Absolute Sensor testen
                  </button>

                  {#if absoluteSensorSupported}
                    <p class="text-xs text-blue-300">API: verfügbar</p>
                  {:else}
                    <p class="text-xs text-yellow-300">API: nicht verfügbar</p>
                  {/if}

                  {#if absoluteSensorStarted}
                    <p class="text-xs text-emerald-300">Sensor: gestartet</p>
                  {/if}
                  <p class="text-xs text-blue-300 break-all">
                    Quaternion: {debugQuaternion}
                  </p>

                  {#if absoluteSensorError}
                    <p class="text-xs text-red-300">
                      Fehler: {absoluteSensorError}
                    </p>
                  {/if}

                  {#if absoluteHeading !== null}
                    <p class="text-xs text-blue-300">
                      Absolute Heading: {Math.round(absoluteHeading)}°
                    </p>
                  {/if}
                  <p class="text-xs text-blue-300 break-all">
                    Achsen: {debugAxes}
                  </p> -->

                  {#if qiblaAvailable && qiblaAngle !== null}
                    <span class="text-sm font-bold text-white font-mono">
                      {qiblaAngle}°
                    </span>
                  {:else if locationPermission === "denied"}
                    <div
                      class="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"
                    >
                      📍 Konum izni engellenmiş.

                      <div class="mt-2 text-red-200">
                        Tarayıcı ayarlarından konum iznini etkinleştirin.
                      </div>
                      <div class="mt-2 text-[11px] text-red-200">
                        Chrome → Site Ayarları → Konum → İzin Ver
                      </div>
                    </div>
                  {:else if locationPermission === "prompt"}
                    <div
                      class="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-200"
                    >
                      📍 Kıble yönünü gösterebilmek için konum erişimi
                      gereklidir.

                      <button
                        onclick={refreshLocation}
                        class="mt-3 w-full rounded-lg bg-yellow-500/20 px-3 py-2 text-yellow-100"
                      >
                        Konum İznini İste
                      </button>
                    </div>
                  {:else}
                    <div
                      class="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70"
                    >
                      📍 Konum bilgisi bekleniyor...
                    </div>
                  {/if}
                </div>
                <div class="bg-white/5 rounded-xl p-3 border border-white/5">
                  <span
                    class="text-[10px] uppercase text-orange-200/50 block tracking-wider"
                    >Yön Tarifi</span
                  >
                  <span class="text-xs font-semibold text-orange-100"
                    >Kuzeyden Doğuya</span
                  >
                </div>
              </div>

              <!-- Kontextabhängige Anweisungen -->

              {#if compassPermissionDenied}
                <div
                  class="text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-left"
                >
                  ⚠️ <strong>Pusula Kullanılamıyor:</strong>
                  Cihazınızda yön sensörü bulunmuyor veya tarayıcı pusula erişimine
                  izin vermedi. Kıble yönünü yukarıdaki {qiblaAngle}° derecesine
                  göre belirleyebilirsiniz.
                </div>
              {:else if compassInitializing}
                <div
                  class="inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-4 py-2 text-sm text-orange-300 border border-orange-500/30"
                >
                  🧭 Sensör kontrol ediliyor...
                </div>
              {:else if liveCompassActive && hasCompassData}
                <div
                  class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 animate-pulse border border-emerald-500/30"
                >
                  <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
                  Canlı Pusula Aktif
                </div>

                {#if calibrationRecommended}
                  <div
                    class="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-center text-xs text-yellow-200"
                  >
                    <div class="mb-2 text-2xl font-bold">∞</div>

                    <div class="font-semibold mb-1">
                      Pusula hassasiyeti düşük olabilir
                    </div>

                    <div>
                      Daha doğru sonuçlar için telefonunuzu havada birkaç kez 8
                      şeklinde hareket ettirin.
                    </div>
                  </div>
                {/if}

                <p
                  class="text-xs text-emerald-200/80 max-w-[250px] mx-auto leading-relaxed"
                >
                  Telefonunuzu yere paralel tutun. 🕋 İkonu ve pusula
                  <span class="text-emerald-300 font-bold">K (Kuzey)</span>
                  harfi tam yukarı geldiğinde kıbleye yönelmiş olursunuz.
                </p>

                <button
                  onclick={stopLiveCompass}
                  class="w-full py-2 px-4 bg-white/10 hover:bg-white/15 text-white/90 text-xs font-medium rounded-xl border border-white/10 transition-all"
                >
                  Canlı Modu Kapat
                </button>
              {:else}
                <p
                  class="text-xs text-orange-200/70 max-w-[260px] mx-auto leading-relaxed"
                >
                  Pusulanızın kuzey (N) yönünü referans alarak saat yönünde
                  <span class="text-orange-300 font-bold font-mono">
                    {qiblaAngle}°
                  </span>
                  dereceye dönerek kıbleyi bulabilirsiniz.
                </p>

                {#if qiblaAvailable}
                  <button
                    onclick={startLiveCompass}
                    class="w-full py-2.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium text-sm rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    🧭 Canlı Kıble Pusulası
                  </button>
                {:else}
                  <button
                    disabled
                    class="w-full py-2.5 px-4 bg-white/10 text-white/50 rounded-xl cursor-not-allowed"
                  >
                    📍 Önce Konum İzni Verin
                  </button>
                {/if}
              {/if}
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

      {#if !isStandalone && !hideInstallHint && (deferredPrompt || isIos)}
        <div
          class="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
        >
          <div
            class="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#171717]/95 px-4 py-3 shadow-xl backdrop-blur-xl"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-white">Namaz Vakitleri</p>
              <p class="mt-1 text-xs text-white/50">
                Ana ekranına ekle, kolayca ulaş.
              </p>
            </div>

            {#if deferredPrompt}
              <button
                type="button"
                onclick={installApp}
                class="shrink-0 rounded-xl border border-orange-400/30 px-3 py-2 text-sm font-medium text-orange-300 transition hover:bg-orange-400/10"
              >
                Ekle ↗
              </button>
            {:else if isIos}
              <button
                type="button"
                onclick={() => (showIosInstallHelp = true)}
                class="shrink-0 rounded-xl border border-orange-400/30 px-3 py-2 text-sm font-medium text-orange-300 transition hover:bg-orange-400/10"
              >
                Ekle ↗
              </button>
            {/if}

            <button
              type="button"
              onclick={() => (hideInstallHint = true)}
              class="shrink-0 p-1 text-lg leading-none text-white/40 transition hover:text-white/80"
              aria-label="Installationshinweis schließen"
            >
              ×
            </button>
          </div>
        </div>
      {/if}

      {#if showIosInstallHelp}
        <div
          class="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onclick={(event) => {
            if (event.target === event.currentTarget) {
              showIosInstallHelp = false;
            }
          }}
        >
          <div
            class="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171717] p-6 text-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 id="ios-install-title" class="text-lg font-semibold">
                Ana ekrana ekle
              </h2>
              <button
                type="button"
                onclick={() => (showIosInstallHelp = false)}
                class="rounded-full px-3 py-2 text-white/60 hover:bg-white/10"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <p class="mb-5 text-sm leading-relaxed text-white/60">
              Namaz Vakitleri uygulamasını ana ekranına eklemek için:
            </p>

            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-400/10 font-semibold text-orange-300"
                >
                  1
                </span>
                <p class="pt-1 text-sm">
                  Safari'de <strong>Paylaş</strong> simgesine dokun.
                </p>
              </div>

              <div class="flex items-start gap-3">
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-400/10 font-semibold text-orange-300"
                >
                  2
                </span>
                <p class="pt-1 text-sm">
                  Menüden <strong>Ana Ekrana Ekle</strong> seçeneğini seç.
                </p>
              </div>

              <div class="flex items-start gap-3">
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-400/10 font-semibold text-orange-300"
                >
                  3
                </span>
                <p class="pt-1 text-sm">
                  <strong>Ekle</strong> seçeneğine dokun.
                </p>
              </div>
            </div>

            <button
              type="button"
              onclick={() => (showIosInstallHelp = false)}
              class="mt-6 w-full rounded-2xl bg-orange-400 px-4 py-3 font-semibold text-black"
            >
              Anladım
            </button>
          </div>
        </div>
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

        <div class="space-y-3">
          <label class="block text-sm text-white/70">
            Ülke
            <select
              value={selectedCountryId}
              onchange={(event) => loadStates(event.currentTarget.value)}
              class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white"
            >
              <option value="">Ülke seçin</option>
              {#each countries as country}
                <option value={String(country.id)}>{country.name}</option>
              {/each}
            </select>
          </label>

          <label class="block text-sm text-white/70">
            Bölge
            <select
              value={selectedStateId}
              onchange={(event) => loadCities(event.currentTarget.value)}
              disabled={!selectedCountryId || locationLoading}
              class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white disabled:opacity-40"
            >
              <option value="">Bölge seçin</option>
              {#each states as state}
                <option value={String(state.id)}>{state.name}</option>
              {/each}
            </select>
          </label>

          <label class="block text-sm text-white/70">
            Şehir
            <select
              value={selectedCityId}
              onchange={(event) => {
                selectedCityId = event.currentTarget.value;
                const city = cities.find(
                  (item) => String(item.id) === selectedCityId,
                );
                if (city) selectCity(city);
              }}
              disabled={!selectedStateId || locationLoading}
              class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white disabled:opacity-40"
            >
              <option value="">Şehir seçin</option>
              {#each cities as city}
                <option value={String(city.id)}>{city.name}</option>
              {/each}
            </select>
          </label>

          {#if locationLoading}
            <p class="text-sm text-white/50">Şehirler yükleniyor …</p>
          {/if}

          {#if apiError}
            <p class="text-sm text-red-300">{apiError}</p>
          {/if}
        </div>
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
