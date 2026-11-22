export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      configured: Boolean(
        process.env.XAI_API_KEY && process.env.OFFICE_ACCESS_TOKEN,
      ),
      model: process.env.XAI_MODEL || "grok-4.7",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
