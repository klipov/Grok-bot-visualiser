import { readDesktop } from "@/lib/grok/observe";

export const runtime = "nodejs";

const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;
const localIps = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLocalOfficeRequest(request: Request) {
  const host = request.headers.get("host") || "";
  const { protocol, hostname } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedFor = request.headers.get("x-forwarded-for");
  return (
    localHost.test(hostname) &&
    localHost.test(host) &&
    request.headers.get("origin") === `${protocol}//${host}` &&
    request.headers.get("x-office-observer") === "desktop" &&
    (!forwardedHost || localHost.test(forwardedHost)) &&
    (!forwardedFor ||
      forwardedFor.split(",").every((ip) => localIps.has(ip.trim())))
  );
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isLocalOfficeRequest(request))
    return json(
      { error: "Open the office on localhost to connect to your desktop." },
      403,
    );
  if (process.platform !== "win32")
    return json(
      { error: "The desktop connection is available on Windows." },
      503,
    );
  if (process.env.GROK_DESKTOP_OBSERVER !== "1")
    return json(
      {
        error: "Start the local Windows office with npm run office to connect.",
      },
      503,
    );
  try {
    const result = await readDesktop();
    return json(result, "error" in result ? 503 : 200);
  } catch {
    return json(
      {
        error:
          "The office couldn't read Grok Bot. Open its Bots sidebar and try again.",
      },
      503,
    );
  }
}
