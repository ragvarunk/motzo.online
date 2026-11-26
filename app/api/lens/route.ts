import { LENS_SCHEMA, LENS_SYSTEM } from "@/lib/prompt";
import { apiErrorMessage, askJson, badRequest, checkAccess, hasAnthropic } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface LensResult {
  findings: { kind: string; label: string; value: string }[];
  hint: string;
}

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { image?: string; mime?: string } | null;
  if (!body?.image) return badRequest("no_image");

  if (!hasAnthropic()) {
    return Response.json({
      demo: true,
      findings: [{ kind: "other", label: "Lens needs the AI key", value: "" }],
      hint: "Sample mode: add ANTHROPIC_API_KEY to read the camera live.",
    } satisfies LensResult & { demo: boolean });
  }

  try {
    const result = await askJson<LensResult>({
      system: LENS_SYSTEM,
      schema: LENS_SCHEMA,
      effort: "low",
      maxTokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: (body.mime as "image/jpeg") || "image/jpeg", data: body.image } },
            { type: "text", text: "What can you read in this frame?" },
          ],
        },
      ],
    });
    if (!result.ok) return Response.json({ findings: [], hint: "Couldn't read that frame. Hold steady and try again." });
    return Response.json(result.data);
  } catch (err) {
    const { message, status } = apiErrorMessage(err);
    return Response.json({ error: message }, { status });
  }
}
