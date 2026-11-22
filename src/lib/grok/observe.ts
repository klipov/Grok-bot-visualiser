import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

export type ObservedBot = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  task?: string;
};

type DesktopResult = { bots: ObservedBot[] } | { error: string };

export function parseDesktopResult(output: string): DesktopResult {
  const result = JSON.parse(output.trim());
  if (result && typeof result.error === "string" && result.error.trim())
    return { error: result.error };
  if (!Array.isArray(result?.bots)) throw new Error("Invalid roster");
  const ids = new Set<string>();
  const bots = result.bots.map((item: Record<string, unknown>): ObservedBot => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !item.id.trim() ||
      ids.has(item.id) ||
      typeof item.name !== "string" ||
      !item.name.trim()
    ) {
      throw new Error("Invalid bot");
    }
    ids.add(item.id);
    const bot: ObservedBot = { id: item.id, name: item.name };
    for (const key of ["role", "status", "task"] as const) {
      const value = item[key];
      if (value === undefined) continue;
      if (typeof value !== "string") throw new Error("Invalid bot details");
      bot[key] = value;
    }
    return bot;
  });
  return { bots };
}

const exec = promisify(execFile);
let pending: Promise<DesktopResult> | undefined;

export function readDesktop(): Promise<DesktopResult> {
  if (!pending) {
    const powershell = resolve(
      process.env.SystemRoot || "C:\\Windows",
      "System32/WindowsPowerShell/v1.0/powershell.exe",
    );
    const script = resolve(process.cwd(), "scripts/read-grok-office.ps1");
    pending = exec(
      powershell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
      ],
      {
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 512 * 1024,
        encoding: "utf8",
      },
    )
      .then(({ stdout }) => parseDesktopResult(stdout))
      .finally(() => {
        pending = undefined;
      });
  }
  return pending;
}
