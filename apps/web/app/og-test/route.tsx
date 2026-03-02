export async function GET() {
  const url = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/11.334,44.494,13,0/750x630?attribution=false&logo=false&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;

  console.log("Fetching URL:", url.replace(process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "", "***"));

  const res = await fetch(url);

  console.log(
    "Mapbox response:",
    res.status,
    res.headers.get("content-type"),
    "size:",
    res.headers.get("content-length"),
  );

  if (!res.ok) {
    const body = await res.text();
    return new Response(`Mapbox error ${res.status}: ${body}`, { status: 500 });
  }

  return new Response(
    `OK - status: ${res.status}, type: ${res.headers.get("content-type")}, size: ${res.headers.get("content-length")}`,
    { status: 200 },
  );
}
