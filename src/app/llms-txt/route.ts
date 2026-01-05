import { DOCS_MARKDOWN } from "@/lib/docs-content";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  return new Response(DOCS_MARKDOWN, {
    headers: {
      // Use text/plain for maximum compatibility with LLM crawlers
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'inline; filename="llms.txt"',
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
