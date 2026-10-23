import assert from "node:assert/strict";
import { test } from "node:test";
import { runTeam, validAccessToken, validBrief } from "../src/lib/grok/run";
import { consumeEvents, type RunEvent } from "../src/lib/grok/protocol";
import { POST } from "../src/app/api/grok/run/route";
import { botFromDraft } from "../src/lib/office/team";

const response = (text: string) =>
  Response.json({
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  });

test("office tokens and brief bounds reject invalid input", () => {
  assert.equal(validAccessToken("Bearer secret", "secret"), true);
  for (const header of [
    null,
    "secret",
    "Bearer wrong",
    "Bearer secret ",
    "Bearer ",
  ])
    assert.equal(validAccessToken(header, "secret"), false);
  assert.equal(validAccessToken("Bearer secret", undefined), false);
  for (const input of [
    null,
    {},
    { brief: "short" },
    { brief: " ".repeat(20) },
    { brief: "x".repeat(2001) },
  ])
    assert.equal(validBrief(input), false);
  assert.equal(validBrief({ brief: "Plan a book exchange" }), true);
});

test("Grok handoffs pass earlier work between roles and finish with the coordinator", async () => {
  const bodies: {
    model: string;
    input: { content: string }[];
    store: boolean;
    max_output_tokens: number;
  }[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, "https://api.x.ai/v1/responses");
    assert.equal(
      (options?.headers as Record<string, string>).Authorization,
      "Bearer server-key",
    );
    bodies.push(JSON.parse(options?.body as string));
    return response(`Answer ${bodies.length}`);
  };
  const events: RunEvent[] = [];
  for await (const event of runTeam({
    brief: "Plan a book exchange",
    key: "server-key",
    model: "test-model",
    signal: new AbortController().signal,
    fetcher,
    id: "test",
  }))
    events.push(event);
  const handoffs = events
    .filter((e) => e.type === "handoff")
    .map((e) => e.handoff);
  assert.deepEqual(
    handoffs.map((h) => [h.from, h.to]),
    [
      ["atlas", "mira"],
      ["mira", "fern"],
      ["fern", "kit"],
      ["kit", "reed"],
      ["reed", "atlas"],
    ],
  );
  assert.equal(bodies.length, 6);
  assert.ok(bodies[1].input[1].content.includes("Answer 1"));
  assert.ok(bodies[5].input[1].content.includes("Answer 5"));
  assert.ok(
    bodies.every(
      (body) =>
        body.model === "test-model" &&
        body.store === false &&
        body.max_output_tokens === 900,
    ),
  );
  assert.deepEqual(events.at(-1), { type: "complete", summary: "Answer 6" });
});

test("a failed provider stops the run without fabricating the remaining handoffs", async () => {
  let calls = 0;
  const events: RunEvent[] = [];
  await assert.rejects(async () => {
    for await (const event of runTeam({
      brief: "Plan a book exchange",
      key: "key",
      model: "test",
      signal: new AbortController().signal,
      fetcher: async () =>
        ++calls === 1
          ? response("A useful plan")
          : new Response("private account info", { status: 429 }),
    }))
      events.push(event);
  }, /rate limited or out of credits/);
  assert.equal(calls, 2);
  assert.equal(events.filter((event) => event.type === "handoff").length, 1);
  assert.equal(
    events.some((event) => event.type === "complete"),
    false,
  );
});

test("custom Grok teams call only their selected roles and do not invent a coordinator", async () => {
  const roster = [
    botFromDraft({ id: "ada", name: "Ada", role: "Designer" }),
    botFromDraft({ id: "bea", name: "Bea", role: "Analyst" }),
  ];
  let calls = 0;
  const events: RunEvent[] = [];
  for await (const event of runTeam({
    brief: "Plan a community book exchange",
    key: "key",
    model: "test",
    signal: new AbortController().signal,
    roster,
    fetcher: async () => {
      calls++;
      return response("Useful team notes");
    },
  }))
    events.push(event);
  assert.equal(calls, 2);
  assert.deepEqual(
    events
      .filter((event) => event.type === "working")
      .map((event) => event.bot),
    ["bea", "ada"],
  );
  assert.deepEqual(
    events
      .filter((event) => event.type === "handoff")
      .map((event) => [event.handoff.from, event.handoff.to]),
    [["bea", "ada"]],
  );
  assert.equal(events.at(-1)?.type, "complete");
});

test("cancelling a run prevents another provider call", async () => {
  const abort = new AbortController();
  let calls = 0;
  const iterator = runTeam({
    brief: "Plan a book exchange",
    key: "key",
    model: "test",
    signal: abort.signal,
    fetcher: async () => {
      calls++;
      return response("A plan");
    },
  });
  await iterator.next();
  abort.abort();
  await assert.rejects(iterator.next(), { name: "AbortError" });
  assert.equal(calls, 0);
});

test("NDJSON consumer handles split UTF-8 messages and detects a dropped connection", async () => {
  const bytes = new TextEncoder().encode(
    `${JSON.stringify({ type: "complete", summary: "A librarian’s notes 📚" })}\n`,
  );
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === bytes.length) controller.close();
      else controller.enqueue(bytes.slice(offset, ++offset));
    },
  });
  const events: RunEvent[] = [];
  await consumeEvents(stream, (event) => events.push(event));
  assert.deepEqual(events, [
    { type: "complete", summary: "A librarian’s notes 📚" },
  ]);
  await assert.rejects(
    consumeEvents(
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      () => {},
    ),
    /before the team finished/,
  );
});

test("API rejects unauthenticated and oversized requests before calling xAI", async () => {
  const beforeKey = process.env.XAI_API_KEY;
  const beforeToken = process.env.OFFICE_ACCESS_TOKEN;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  process.env.XAI_API_KEY = "test-key";
  process.env.OFFICE_ACCESS_TOKEN = "office-secret";
  globalThis.fetch = async () => {
    calls++;
    return response("should not run");
  };
  try {
    assert.equal(
      (
        await POST(
          new Request("http://localhost/api/grok/run", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
      401,
    );
    const headers = {
      authorization: "Bearer office-secret",
      "content-type": "application/json",
    };
    assert.equal(
      (
        await POST(
          new Request("http://localhost/api/grok/run", {
            method: "POST",
            headers: { ...headers, authorization: "Bearer office-secrex" },
            body: JSON.stringify({ brief: "Plan a community book exchange" }),
          }),
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await POST(
          new Request("http://localhost/api/grok/run", {
            method: "POST",
            headers,
            body: JSON.stringify({ brief: "small" }),
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await POST(
          new Request("http://localhost/api/grok/run", {
            method: "POST",
            headers,
            body: "x".repeat(12001),
          }),
        )
      ).status,
      413,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (beforeKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = beforeKey;
    if (beforeToken === undefined) delete process.env.OFFICE_ACCESS_TOKEN;
    else process.env.OFFICE_ACCESS_TOKEN = beforeToken;
  }
});

test("an in-flight Grok request receives cancellation", async () => {
  const abort = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const iterator = runTeam({
    brief: "Plan a community book exchange",
    key: "key",
    model: "test",
    signal: abort.signal,
    fetcher: async (_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        options!.signal!.addEventListener(
          "abort",
          () => reject(options!.signal!.reason),
          { once: true },
        );
        started();
      }),
  });
  await iterator.next();
  const pending = iterator.next();
  await ready;
  abort.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("malformed successful provider bodies are kept out of client errors", async () => {
  await assert.rejects(
    async () => {
      for await (const _event of runTeam({
        brief: "Plan a book exchange",
        key: "key",
        model: "test",
        signal: new AbortController().signal,
        fetcher: async () => new Response("FAKE sensitive provider content"),
      })) {
        /* consume the run */
      }
    },
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Grok returned an unreadable response",
  );
});

test("the overall server timeout emits a terminal error after partial work", async () => {
  const beforeKey = process.env.XAI_API_KEY;
  const beforeToken = process.env.OFFICE_ACCESS_TOKEN;
  const previousFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  let calls = 0;
  process.env.XAI_API_KEY = "test-key";
  process.env.OFFICE_ACCESS_TOKEN = "office-secret";
  AbortSignal.timeout = (milliseconds) =>
    originalTimeout(milliseconds === 270_000 ? 50 : milliseconds);
  globalThis.fetch = async (_url, options) => {
    if (++calls === 1) return response("A partial plan");
    return new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener(
        "abort",
        () => reject(options!.signal!.reason),
        { once: true },
      );
    });
  };
  // Keep Node's test process alive while the provider stub waits for the unref'ed timeout.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const result = await POST(
      new Request("http://localhost/api/grok/run", {
        method: "POST",
        headers: {
          authorization: "Bearer office-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ brief: "Plan a community book exchange" }),
      }),
    );
    const events: RunEvent[] = [];
    await consumeEvents(result.body!, (event) => events.push(event));
    assert.equal(events.filter((event) => event.type === "handoff").length, 1);
    assert.deepEqual(events.at(-1), {
      type: "error",
      message:
        "Grok took too long to respond. Completed handoffs are still available.",
    });
  } finally {
    clearInterval(keepAlive);
    AbortSignal.timeout = originalTimeout;
    globalThis.fetch = previousFetch;
    if (beforeKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = beforeKey;
    if (beforeToken === undefined) delete process.env.OFFICE_ACCESS_TOKEN;
    else process.env.OFFICE_ACCESS_TOKEN = beforeToken;
  }
});

test("the API streams real handoffs and terminates with a readable provider error", async () => {
  const beforeKey = process.env.XAI_API_KEY;
  const beforeToken = process.env.OFFICE_ACCESS_TOKEN;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  process.env.XAI_API_KEY = "test-key";
  process.env.OFFICE_ACCESS_TOKEN = "office-secret";
  globalThis.fetch = async () =>
    ++calls < 3
      ? response(`Note ${calls}`)
      : new Response("sensitive", { status: 500 });
  try {
    const result = await POST(
      new Request("http://localhost/api/grok/run", {
        method: "POST",
        headers: {
          authorization: "Bearer office-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ brief: "Plan a community book exchange" }),
      }),
    );
    assert.equal(result.status, 200);
    assert.match(result.headers.get("content-type") ?? "", /ndjson/);
    const events: RunEvent[] = [];
    await consumeEvents(result.body!, (event) => events.push(event));
    assert.equal(events.filter((event) => event.type === "handoff").length, 2);
    assert.equal(events.at(-1)?.type, "error");
    assert.equal(JSON.stringify(events).includes("sensitive"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (beforeKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = beforeKey;
    if (beforeToken === undefined) delete process.env.OFFICE_ACCESS_TOKEN;
    else process.env.OFFICE_ACCESS_TOKEN = beforeToken;
  }
});
