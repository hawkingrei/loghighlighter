import { NextResponse } from "next/server";

const URL_PARAM = "url";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get(URL_PARAM);

  if (!target) {
    return NextResponse.json({ error: "Missing url parameter." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch (error) {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (!isHttpProtocol(parsed.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs are allowed." }, { status: 400 });
  }

  try {
    const response = await fetch(parsed.toString(), { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: 502 }
      );
    }

    const body = await response.text();
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch upstream URL." }, { status: 502 });
  }
}

function isHttpProtocol(protocol) {
  return protocol === "http:" || protocol === "https:";
}
