import { NextRequest, NextResponse } from "next/server";

const LINERA_NODE_SERVICE_URL =
  process.env.LINERA_NODE_SERVICE_URL ||
  process.env.NEXT_PUBLIC_LINERA_NODE_SERVICE_URL ||
  "http://localhost:8080";

const APPLICATION_ID =
  process.env.NEXT_PUBLIC_LINERA_APPLICATION_ID ||
  "8870c972d06cc98f59ede8ecae28804acb66446ef3638bcded797fa789435d78";

const REGISTRY_CHAIN_ID =
  process.env.NEXT_PUBLIC_LINERA_REGISTRY_CHAIN_ID || "";

// Default bootstrap chain ID - used to query registryChainId if env var not set
// This is a known chain where the application is deployed
const BOOTSTRAP_CHAIN_ID =
  process.env.LINERA_BOOTSTRAP_CHAIN_ID ||
  "e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65";

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

// Cache the registry chain ID to avoid repeated queries
let cachedRegistryChainId: string | null = null;

async function getRegistryChainId(): Promise<string | null> {
  // First, check environment variable
  if (REGISTRY_CHAIN_ID) {
    return REGISTRY_CHAIN_ID;
  }

  // Return cached value if available
  if (cachedRegistryChainId) {
    return cachedRegistryChainId;
  }

  // Try to fetch registryChainId from the application using bootstrap chain
  try {
    const url = `${LINERA_NODE_SERVICE_URL}/chains/${BOOTSTRAP_CHAIN_ID}/applications/${APPLICATION_ID}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "query { registryChainId }" }),
    });

    if (response.ok) {
      const result: GraphQLResponse = await response.json();
      if (result.data?.registryChainId) {
        cachedRegistryChainId = result.data.registryChainId;
        console.log(
          "Fetched registryChainId from application:",
          cachedRegistryChainId,
        );
        return cachedRegistryChainId;
      }
    }
  } catch (error) {
    console.error("Failed to fetch registryChainId from application:", error);
  }

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
