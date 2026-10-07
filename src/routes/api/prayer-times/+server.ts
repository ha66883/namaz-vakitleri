import { json } from "@sveltejs/kit";

export async function GET({ url }) {
  const locationId = url.searchParams.get("locationId");

  if (!locationId) {
    return json(
      { error: "locationId is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://ezanvakti.imsakiyem.com/api/prayer-times/${locationId}/daily`
    );

    if (!response.ok) {
      console.error(
        "Ezan Vakti API error:",
        response.status,
        response.statusText
      );

      return json(
        { error: "Prayer times could not be loaded" },
        { status: response.status }
      );
    }

    const result = await response.json();

    const timings = result?.data?.[0];

    if (!timings) {
      return json(
        { error: "No prayer times found" },
        { status: 404 }
      );
    }

    return json({
      Imsak: timings.times.imsak,
      Sunrise: timings.times.gunes,
      Dhuhr: timings.times.ogle,
      Asr: timings.times.ikindi,
      Maghrib: timings.times.aksam,
      Isha: timings.times.yatsi,
    });
  } catch (error) {
    console.error("Prayer times request failed:", error);

    return json(
      { error: "Failed to fetch prayer times" },
      { status: 500 }
    );
  }
}