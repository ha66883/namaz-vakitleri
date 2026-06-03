import { json } from "@sveltejs/kit";

export async function GET({ url }) {
  const city = url.searchParams.get("city") ?? "";
  const normalizedCity = normalizeTurkish(city);

  // const response = await fetch(
  //   `https://prayertimes.api.abdus.dev/api/diyanet/search?q=${city}`,
  // );

  const response = await fetch(
    `https://prayertimes.api.abdus.dev/api/diyanet/search?q=${encodeURIComponent(normalizedCity)}`,
  );

  const data = await response.json();

  return json(data);
}

function normalizeTurkish(text: string) {
  return text
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U");
}
