
import { json } from "@sveltejs/kit";
import { diyanetGet } from "$lib/server/diyanet";
import { supabase } from "$lib/server/supabase";

type LocationType = "country" | "state" | "city";

type DiyanetLocation = {
  id: number;
  name: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de");
}

function getLocationConfig(type: string | null, url: URL) {
  switch (type) {
    case "countries":
      return {
        locationType: "country" as LocationType,
        path: "/api/Place/Countries",
        parentId: null,
      };

    case "states": {
      const countryId = Number(url.searchParams.get("countryId"));

      if (!Number.isInteger(countryId) || countryId <= 0) {
        throw new Error("Invalid countryId");
      }

      return {
        locationType: "state" as LocationType,
        path: `/api/Place/States/${countryId}`,
        parentId: countryId,
      };
    }

    case "cities": {
      const stateId = Number(url.searchParams.get("stateId"));

      if (!Number.isInteger(stateId) || stateId <= 0) {
        throw new Error("Invalid stateId");
      }

      return {
        locationType: "city" as LocationType,
        path: `/api/Place/Cities/${stateId}`,
        parentId: stateId,
      };
    }

    default:
      throw new Error("Invalid type");
  }
}

export async function GET({ url }) {
  const type = url.searchParams.get("type");

  let config: ReturnType<typeof getLocationConfig>;

  try {
    config = getLocationConfig(type, url);
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Invalid parameters",
      },
      { status: 400 },
    );
  }

  try {
    // 1. Zuerst Supabase-Cache abfragen
    let query = supabase
      .from("location_cache")
      .select("location_id, name")
      .eq("location_type", config.locationType);

    if (config.parentId === null) {
      query = query.is("parent_id", null);
    } else {
      query = query.eq("parent_id", config.parentId);
    }

    const { data: cachedLocations, error: cacheError } = await query;

    if (cacheError) {
      throw new Error(`Supabase cache read failed: ${cacheError.message}`);
    }

    let locations: { id: number; name: string }[];

    if (cachedLocations && cachedLocations.length > 0) {
      // 2. Cache-Treffer: Diyanet nicht aufrufen
      locations = cachedLocations.map((item) => ({
        id: item.location_id,
        name: item.name,
      }));
    } else {
      // 3. Cache leer: Diyanet einmal abrufen
      const result = await diyanetGet(config.path);

      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error("Diyanet returned an invalid location list");
      }

      locations = (result.data as DiyanetLocation[]).map((item) => ({
        id: item.id,
        name: item.name,
      }));

      if (locations.length === 0) {
        throw new Error("Diyanet returned an empty location list");
      }

      // 4. Ergebnisse in Supabase speichern
      const rows = locations.map((item) => ({
        location_type: config.locationType,
        location_id: item.id,
        parent_id: config.parentId,
        name: item.name,
      }));

      const { error: insertError } = await supabase
        .from("location_cache")
        .upsert(rows, {
          onConflict: "location_type,location_id",
        });

      if (insertError) {
        throw new Error(`Supabase cache write failed: ${insertError.message}`);
      }
    }

    // 5. Suche lokal durchführen
    const search = url.searchParams.get("search")?.trim();

    if (search) {
      locations = locations.filter((item) =>
        normalize(item.name).includes(normalize(search)),
      );
    }

    return json(locations);
  } catch (error) {
    console.error("Location search failed:", error);

    return json(
      {
        error: "Location search failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
