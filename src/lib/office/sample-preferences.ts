import {
  readChoices,
  readLocalValue,
  writeLocalValue,
  type DeskChoices,
} from "./desk-preferences";
import { team } from "./team";

type SampleDesk = { id: string; name: string };
export type SampleMember = SampleDesk & DeskChoices;

export const starterDesks: SampleDesk[] = team.map(({ id, name }) => ({
  id,
  name,
}));

const rosterKey = "grok-bot-office.sample-roster.v1";
const choiceKey = (id: string) => `grok-bot-office.sample-desk.v1.${id}`;

function readRoster(): SampleDesk[] {
  const value = readLocalValue(rosterKey);
  if (!Array.isArray(value) || value.length < 1 || value.length > 12)
    return starterDesks;

  const desks: SampleDesk[] = [];
  for (const row of value) {
    if (
      typeof row?.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(row.id) ||
      desks.some(({ id }) => id === row.id) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.length > 24
    )
      return starterDesks;
    desks.push({ id: row.id, name: row.name.trim() });
  }
  return desks;
}

export function readSampleTeam(): SampleMember[] {
  return readRoster().map((desk) => ({
    ...desk,
    ...readChoices(readLocalValue(choiceKey(desk.id))),
  }));
}

export function saveSampleTeam(
  previous: SampleMember[],
  next: SampleMember[],
  pendingWrites: Map<string, unknown> = new Map(),
): boolean {
  const rosterChanged =
    previous.length !== next.length ||
    next.some(
      ({ id, name }, i) => id !== previous[i].id || name !== previous[i].name,
    );

  if (rosterChanged) {
    pendingWrites.set(
      rosterKey,
      next.map(({ id, name }) => ({ id, name })),
    );
    for (const { id } of previous) {
      if (!next.some((member) => member.id === id))
        pendingWrites.set(choiceKey(id), undefined);
    }
  }
  for (const { id, role, avatar } of next) {
    const old = previous.find((member) => member.id === id);
    if (old?.role === role && old?.avatar === avatar) continue;
    pendingWrites.set(
      choiceKey(id),
      role || avatar ? { role, avatar } : undefined,
    );
  }
  for (const [key, value] of pendingWrites) {
    if (!writeLocalValue(key, value)) return false;
    pendingWrites.delete(key);
  }
  return true;
}
