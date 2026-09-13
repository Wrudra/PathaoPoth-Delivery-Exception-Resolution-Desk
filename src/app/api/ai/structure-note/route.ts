import { z } from "zod";
import type { NextRequest } from "next/server";
import { structureWithGemini } from "@/features/ai/gemini.server";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
  context: z
    .object({
      caseType: z.string().max(40).optional(),
      codAmount: z.number().min(0).max(1_000_000).optional(),
      area: z.string().max(120).optional(),
      receiverName: z.string().max(120).optional(),
      previousAttempts: z.number().int().min(0).max(20).optional()
    })
    .optional()
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const incident = await structureWithGemini(parsed.data.text, parsed.data.context ?? {}, controller.signal);
    return Response.json(incident, { headers: { "cache-control": "no-store" } });
  } finally {
    clearTimeout(timeout);
  }
}
