
import { json } from "@sveltejs/kit";
import { diyanetGet } from "$lib/server/diyanet";
import { supabase } from "$lib/server/supabase";

export async function GET({ url }) {
  const locationId = Number(url.searchParams.get("locationId"));

  if (!Number.isInteger(locationId) || locationId <= 0) {
    return json(
      { error: "Valid locationId is required" },
      { status: 400 },
    );
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Gemeinsame Funktion für Cache-Abfragen
  async function getCachedPrayerTimes() {
    const { data, error } = await supabase
      .from("prayer_times_cache")
      .select("imsak, sunrise, dhuhr, asr, maghrib, isha")
      .eq("city_id", locationId)
      .eq("prayer_date", today)
      .maybeSingle();

    if (error) {
      console.error("Supabase cache read failed:", error.message);
      return null;
    }

    return data;
  }

  function formatPrayerTimes(cached: {
    imsak: string;
    sunrise: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
  }) {
    return {
      Imsak: cached.imsak,
      Sunrise: cached.sunrise,
      Dhuhr: cached.dhuhr,
      Asr: cached.asr,
      Maghrib: cached.maghrib,
      Isha: cached.isha,
    };
  }

  try {
    // 1. Cache zuerst prüfen
    const cached = await getCachedPrayerTimes();

    if (cached) {
      console.log("Gebetszeiten aus Supabase-Cache:", locationId, today);
      return json(formatPrayerTimes(cached));
    }

    // 2. Wenn kein Cache existiert, Diyanet abfragen
    console.log("Gebetszeiten werden von Diyanet geladen:", locationId, today);

    const result = await diyanetGet(
      `/api/PrayerTime/Daily/${locationId}`,
    );

    const timings = result?.data?.[0];

    if (!result?.success || !timings) {
      return json(
        { error: "No prayer times found" },
        { status: 404 },
      );
    }

    const prayerTimes = {
      Imsak: timings.fajr,
      Sunrise: timings.sunrise,
      Dhuhr: timings.dhuhr,
      Asr: timings.asr,
      Maghrib: timings.maghrib,
      Isha: timings.isha,
    };

    // 3. Neue Zeiten im Cache speichern
    const { error: saveError } = await supabase
      .from("prayer_times_cache")
      .upsert({
        city_id: locationId,
        prayer_date: today,
        imsak: prayerTimes.Imsak,
        sunrise: prayerTimes.Sunrise,
        dhuhr: prayerTimes.Dhuhr,
        asr: prayerTimes.Asr,
        maghrib: prayerTimes.Maghrib,
        isha: prayerTimes.Isha,
      });

    if (saveError) {
      console.error("Supabase cache write failed:", saveError.message);
    }

    return json(prayerTimes);
  } catch (error) {
    console.error("Diyanet request failed:", error);

    // 4. Fallback: Cache erneut prüfen, falls Diyanet fehlschlägt
    const cached = await getCachedPrayerTimes();

    if (cached) {
      console.warn("Diyanet nicht erreichbar – Cache-Fallback:", locationId, today);
      return json(formatPrayerTimes(cached));
    }

    return json(
      { error: "Prayer times could not be loaded" },
      { status: 503 },
    );
  }
}
