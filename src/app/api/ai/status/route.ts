import { geminiConfig } from "@/features/ai/gemini.server";

export async function GET() {
  const config = geminiConfig();
  return Response.json(
    { provider: config ? "gemini" : "heuristic", model: config?.model ?? null, configured: Boolean(config) },
    { headers: { "cache-control": "no-store" } }
  );
}
