import { runTeam, validAccessToken, validBrief } from "@/lib/grok/run";
import { botFromDraft, parseTeamDrafts, team } from "@/lib/office/team";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.XAI_API_KEY || !process.env.OFFICE_ACCESS_TOKEN) {
    return Response.json(
      {
        error:
          "Grok isn't configured yet. Add XAI_API_KEY and OFFICE_ACCESS_TOKEN to the server environment.",
      },
      { status: 503 },
    );
  }
  if (
    !validAccessToken(
      request.headers.get("authorization"),
      process.env.OFFICE_ACCESS_TOKEN,
    )
  ) {
    return Response.json(
      { error: "The office access token isn't correct." },
      { status: 401 },
    );
  }
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Send a JSON brief." }, { status: 415 });
  let input: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 12_000) {
          await reader.cancel();
          return Response.json(
            { error: "The brief is too large." },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json(
      { error: "Send a valid JSON brief." },
      { status: 400 },
    );
  }
  if (!validBrief(input))
    return Response.json(
      { error: "Write a brief between 10 and 2,000 characters." },
      { status: 400 },
    );
  const abort = new AbortController();
  const requestedTeam = (input as { team?: unknown }).team;
  const drafts =
    requestedTeam === undefined ? null : parseTeamDrafts(requestedTeam);
  if (requestedTeam !== undefined && !drafts)
    return Response.json(
      {
        error:
          "Choose 1–12 teammates with unique IDs and at most one coordinator.",
      },
      { status: 400 },
    );
  const roster = drafts ? drafts.map(botFromDraft) : team;
  const signal = AbortSignal.any([
    request.signal,
    abort.signal,
    AbortSignal.timeout(270_000),
  ]);
  const iterator = runTeam({
    brief: input.brief.trim(),
    key: process.env.XAI_API_KEY,
    model: process.env.XAI_MODEL || "grok-4.7",
    signal,
    roster,
  });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (error) {
        if (abort.signal.aborted) return;
        if (!request.signal.aborted) {
          const message =
            error instanceof Error && error.name !== "TimeoutError"
              ? error.message
              : "Grok took too long to respond. Completed handoffs are still available.";
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ type: "error", message })}\n`),
          );
        }
        controller.close();
      }
    },
    async cancel() {
      abort.abort();
      await iterator.return(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
