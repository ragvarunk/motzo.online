export const dynamic = "force-dynamic";

// The sign-in project's address and its public (anon / publishable) key. Both
// are meant to be public: the database only lets each signed-in owner reach
// their own rows (see supabase/setup.sql). Never returns the service key.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    null;
  return Response.json({ url: url && key ? url.replace(/\/+$/, "") : null, key: url && key ? key : null }, { headers: { "Cache-Control": "no-store" } });
}
