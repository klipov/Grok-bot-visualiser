import {
  isBotId,
  team,
  type Bot,
  type BotId,
  type Handoff,
} from "../office/team";

export type RunEvent =
  | { type: "working"; bot: BotId }
  | { type: "handoff"; handoff: Handoff }
  | { type: "complete"; summary: string }
  | { type: "error"; message: string };

function parseEvent(line: string, roster: readonly Bot[]): RunEvent {
  const value: unknown = JSON.parse(line);
  if (!value || typeof value !== "object" || !("type" in value))
    throw new Error("Invalid team update");
  const v = value as Record<string, unknown>;
  if (v.type === "working" && isBotId(v.bot, roster))
    return { type: "working", bot: v.bot };
  if (v.type === "complete" && typeof v.summary === "string")
    return { type: "complete", summary: v.summary };
  if (v.type === "error" && typeof v.message === "string")
    return { type: "error", message: v.message };
  if (v.type === "handoff" && v.handoff && typeof v.handoff === "object") {
    const h = v.handoff as Record<string, unknown>;
    if (
      typeof h.id === "string" &&
      isBotId(h.from, roster) &&
      isBotId(h.to, roster) &&
      h.from !== h.to &&
      typeof h.message === "string" &&
      h.source === "grok"
    ) {
      return {
        type: "handoff",
        handoff: {
          id: h.id,
          from: h.from,
          to: h.to,
          message: h.message,
          source: "grok",
        },
      };
    }
  }
  throw new Error("Invalid team update");
}

export async function consumeEvents(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: RunEvent) => void,
  roster: readonly Bot[] = team,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 128_000) throw new Error("Team update was too large");
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = parseEvent(line, roster);
        onEvent(event);
        if (event.type === "complete" || event.type === "error")
          terminal = true;
      }
      if (done) break;
    }
    if (!terminal)
      throw new Error(
        "The connection ended before the team finished. You can still read completed handoffs.",
      );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
