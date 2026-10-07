

import { json } from "@sveltejs/kit";

const GERMANY_ID = 13;

export async function GET({ url }) {
  const city = url.searchParams.get("city")?.trim() ?? "";

  if (!city) {
    return json([]);
  }

  try {
    // 1. Nordrhein-Westfalen suchen
    const stateResponse = await fetch(
      `https://ezanvakti.imsakiyem.com/api/locations/search/states?countryId=${GERMANY_ID}&q=Nordrhein`,
    );

    if (!stateResponse.ok) {
      throw new Error(`State search failed: ${stateResponse.status}`);
    }

    const stateResult = await stateResponse.json();
    const state = stateResult?.data?.[0];

    if (!state) {
      throw new Error("Nordrhein-Westfalen could not be found");
    }

    // 2. Stadt innerhalb von NRW suchen
    const districtResponse = await fetch(
      `https://ezanvakti.imsakiyem.com/api/locations/search/districts?stateId=${state._id}&q=${encodeURIComponent(city)}`,
    );

    if (!districtResponse.ok) {
      throw new Error(`District search failed: ${districtResponse.status}`);
    }

    const districtResult = await districtResponse.json();

    // Format passend zu deiner bestehenden +page.svelte
    const locations = (districtResult?.data ?? []).map((district: any) => ({
      id: Number(district._id),
      region: district.name,
    }));

    return json(locations);
  } catch (error) {
    console.error("Location search failed:", error);

    return json({ error: "Location search failed" }, { status: 500 });
  }
}
