import { hasAnthropic, MODEL } from "@/lib/server";

export const dynamic = "force-dynamic";

// Tells the app which services are switched on, so it can label demo parts
// honestly. Never returns key values.
export async function GET() {
  return Response.json({
    ai: hasAnthropic(),
    model: hasAnthropic() ? MODEL : null,
    maps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    mapEmbed: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY),
    voice: Boolean(process.env.ELEVENLABS_API_KEY || process.env.MOTZO_VOICE_URL),
    accessCode: Boolean(process.env.MOTZO_ACCESS_CODE),
    accounts: Boolean(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
        (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY),
    ),
  });
}
