import { NextRequest, NextResponse } from "next/server";

const LINERA_NODE_SERVICE_URL =
  process.env.LINERA_NODE_SERVICE_URL ||
  process.env.NEXT_PUBLIC_LINERA_NODE_SERVICE_URL ||
  "http://localhost:8080";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, applicationId, query } = body;

    if (!chainId || !applicationId || !query) {
      return NextResponse.json(
        { error: "Missing required fields: chainId, applicationId, query" },
        { status: 400 },
      );
    }

    const url = `${LINERA_NODE_SERVICE_URL}/chains/${chainId}/applications/${applicationId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `Linera service error: ${response.status} ${response.statusText}`,
          details: errorText,
        },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Linera proxy error:", error);
    return NextResponse.json(
      {
        error: "Failed to proxy request to Linera service",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
