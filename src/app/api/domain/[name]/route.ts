import { NextRequest, NextResponse } from "next/server";

const LINERA_NODE_SERVICE_URL =
  process.env.LINERA_NODE_SERVICE_URL ||
  process.env.NEXT_PUBLIC_LINERA_NODE_SERVICE_URL ||
  "http://localhost:8080";

const APPLICATION_ID = process.env.NEXT_PUBLIC_LINERA_APPLICATION_ID || "";
const REGISTRY_CHAIN_ID =
  process.env.NEXT_PUBLIC_LINERA_REGISTRY_CHAIN_ID || "";

interface DomainInfo {
  name: string;
  owner: string;
  ownerChainId: string;
  expiration: number;
  isExpired: boolean;
  price: string;
  isForSale: boolean;
  value: string;
}

interface GraphQLResponse {
  data?: {
    domain?: DomainInfo;
    registryChainId?: string;
  };
  errors?: Array<{ message: string }>;
}

async function getRegistryChainId(): Promise<string | null> {
  if (REGISTRY_CHAIN_ID) {
    return REGISTRY_CHAIN_ID;
  }

  // If not configured, try to fetch it from the application
  // This requires knowing at least one chain ID, so we'll return null
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params;

    if (!name) {
      return NextResponse.json(
        { error: "Domain name is required" },
        { status: 400 },
      );
    }

    // Normalize domain name (remove .linera suffix if present)
    let normalizedName = name.trim().toLowerCase();
    if (normalizedName.endsWith(".linera")) {
      normalizedName = normalizedName.slice(0, -7);
    }

    if (!APPLICATION_ID) {
      return NextResponse.json(
        { error: "Application ID not configured" },
        { status: 500 },
      );
    }

    const registryChainId = await getRegistryChainId();
    if (!registryChainId) {
      return NextResponse.json(
        { error: "Registry chain ID not configured" },
        { status: 500 },
      );
    }

    const url = `${LINERA_NODE_SERVICE_URL}/chains/${registryChainId}/applications/${APPLICATION_ID}`;

    const query = `query {
      domain(name: "${normalizedName}") {
        name
        owner
        ownerChainId
        expiration
        isExpired
        price
        isForSale
        value
      }
    }`;

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

    const result: GraphQLResponse = await response.json();

    if (result.errors?.length) {
      return NextResponse.json(
        {
          error: "GraphQL error",
          details: result.errors[0].message,
        },
        { status: 400 },
      );
    }

    if (!result.data?.domain) {
      return NextResponse.json(
        {
          error: "Domain not found",
          name: normalizedName,
          available: true,
        },
        { status: 404 },
      );
    }

    // Return the domain data directly
    return NextResponse.json({
      success: true,
      domain: {
        ...result.data.domain,
        fullName: `${result.data.domain.name}.linera`,
      },
    });
  } catch (error) {
    console.error("Domain lookup error:", error);
    return NextResponse.json(
      {
        error: "Failed to lookup domain",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
