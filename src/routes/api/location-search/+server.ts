import { json } from "@sveltejs/kit";

export async function GET({ url }) {
  const city = url.searchParams.get("city");

  const response = await fetch(
    `https://prayertimes.api.abdus.dev/api/diyanet/search?q=${city}`,
  );

  const data = await response.json();

  return json(data);
}
