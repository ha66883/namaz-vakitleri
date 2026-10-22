
// import { json } from "@sveltejs/kit";
// import { diyanetGet } from "$lib/server/diyanet";

// const GERMANY_ID = 13;
// const NRW_ID = 859;

// export async function GET({ url }) {
//   const city = url.searchParams.get("city")?.trim() ?? "";

//   if (!city) {
//     return json([]);
//   }

//   try {
//     const result = await diyanetGet(
//       `/api/Place/Cities/${NRW_ID}`,
//     );

//     if (!result?.success || !Array.isArray(result.data)) {
//       throw new Error("Diyanet returned an invalid city list");
//     }

//     const normalizedCity = city
//       .normalize("NFD")
//       .replace(/[\u0300-\u036f]/g, "")
//       .toLocaleLowerCase("de");

//     const locations = result.data
//       .filter((item: { name?: string }) =>
//         item.name
//           ?.normalize("NFD")
//           .replace(/[\u0300-\u036f]/g, "")
//           .toLocaleLowerCase("de")
//           .includes(normalizedCity),
//       )
//       .map((item: { id: number; name: string }) => ({
//         id: item.id,
//         region: item.name,
//       }));

//     return json(locations);
//   } catch (error) {
//     console.error("Diyanet location search failed:", error);

//     return json(
//       { error: "Location search failed" },
//       { status: 500 },
//     );
//   }
// }



import { json } from "@sveltejs/kit";
import { diyanetGet } from "$lib/server/diyanet";

export async function GET({ url }) {
  const type = url.searchParams.get("type");

  try {
    let path: string;

    switch (type) {
      case "countries":
        path = "/api/Place/Countries";
        break;

      case "states": {
        const countryId = Number(url.searchParams.get("countryId"));

        if (!Number.isInteger(countryId) || countryId <= 0) {
          return json({ error: "Invalid countryId" }, { status: 400 });
        }

        path = `/api/Place/States/${countryId}`;
        break;
      }

      case "cities": {
        const stateId = Number(url.searchParams.get("stateId"));

        if (!Number.isInteger(stateId) || stateId <= 0) {
          return json({ error: "Invalid stateId" }, { status: 400 });
        }

        path = `/api/Place/Cities/${stateId}`;
        break;
      }

      default:
        return json(
          { error: "Invalid type. Use countries, states or cities." },
          { status: 400 },
        );
    }

    const result = await diyanetGet(path);

    if (!result?.success || !Array.isArray(result.data)) {
      throw new Error("Diyanet returned an invalid location list");
    }

    const search = url.searchParams.get("search")?.trim();

    const locations = result.data
      .filter((item: { name?: string }) => {
        if (!search) return true;

        const normalize = (value: string) =>
          value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("de");

        return normalize(item.name ?? "").includes(normalize(search));
      })
      .map((item: { id: number; name: string }) => ({
        id: item.id,
        name: item.name,
      }));

    return json(locations);
  } catch (error) {
    console.error("Diyanet location search failed:", error);

    return json(
      { error: "Location search failed" },
      { status: 500 },
    );
  }
}
