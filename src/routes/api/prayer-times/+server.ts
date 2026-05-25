import { json } from "@sveltejs/kit";

export async function GET({ url }) {
  try {
    const locationId = url.searchParams.get("locationId");

    if (!locationId) {
      return json({
        error: "Missing locationId",
      });
    }

    const response = await fetch(
      `https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`,
    );

    if (!response.ok) {
      return json({ error: "Prayer API failed" });
    }
    const data = await response.json();


    return json(data);
  } catch (error) {
    console.error(error);

    return json({
      error: "Failed to fetch prayer times",
    });
  }
}
