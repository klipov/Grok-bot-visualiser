import { avatarStyles, type AvatarStyle } from "./avatar";
import { roles, type BotRole } from "./team";

export type DeskChoices = { role?: BotRole; avatar?: AvatarStyle };

export function readChoices(value: unknown): DeskChoices {
  if (!value || typeof value !== "object") return {};
  const { role, avatar } = value as Record<string, unknown>;
  return {
    role: roles.find((option) => option === role),
    avatar: avatarStyles.find((option) => option === avatar),
  };
}

export function readLocalValue(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeLocalValue(key: string, value: unknown): boolean {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
