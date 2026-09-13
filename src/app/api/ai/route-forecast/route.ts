import { z } from "zod";
import type { NextRequest } from "next/server";
import { narrateForecast } from "@/features/ai/gemini.server";

const bodySchema = z.object({
  routeCode: z.string().max(40),
  routeLabel: z.string().max(120),
  evidence: z.array(z.string().max(300)).max(10),
  metrics: z.record(z.string(), z.union([z.number(), z.string().max(120)])),
  recommendedAction: z.string().max(60)
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const narrative = await narrateForecast(parsed.data, controller.signal);
    return Response.json(narrative, { headers: { "cache-control": "no-store" } });
  } finally {
    clearTimeout(timeout);
  }
}
