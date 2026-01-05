import { DOCS_MARKDOWN } from "@/lib/docs-content";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  return new Response(DOCS_MARKDOWN, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      ...corsHeaders,
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
