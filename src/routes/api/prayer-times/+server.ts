import { json } from '@sveltejs/kit';

export async function GET() {
	const response = await fetch(
		'https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=10014'
	);

	const data = await response.json();

	return json(data);
}
