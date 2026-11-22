import { team, executionOrder, type Bot, type Handoff } from "./team";

const notes = {
  Coordinator:
    "I've broken the brief into a small plan. Can you work through your part and bring back anything the team needs to know?",
  Researcher:
    "I've separated useful ideas from assumptions. Please check the notes and flag anything that still needs a source.",
  Librarian:
    "The notes are organised. Start with the smallest useful version; the open questions are at the top.",
  Engineer:
    "The practical plan is ready. Can you check the details before we bring it back to the team?",
  Outreach:
    "The draft is ready for review. I kept it short and left out the claims we can't support yet.",
  Designer:
    "The visual direction is sketched out. Let's check that the layout fits the people using it.",
  Analyst:
    "I've compared the options. Here's what looks promising and what we still need to measure.",
  Generalist:
    "I've worked through my part of the brief. These notes should help with the next step.",
};

export function demoHandoff(index: number): Handoff;
export function demoHandoff(
  index: number,
  roster: readonly Bot[],
): Handoff | null;
export function demoHandoff(
  index: number,
  roster: readonly Bot[] = team,
): Handoff | null {
  if (roster.length < 2) return null;
  const cycle = executionOrder(roster);
  if (cycle[0].id === cycle.at(-1)?.id) cycle.pop();
  const from = cycle[index % cycle.length];
  const to = cycle[(index + 1) % cycle.length];
  return {
    id: `demo-${crypto.randomUUID()}`,
    from: from.id,
    to: to.id,
    message: notes[from.role],
    source: "demo",
  };
}
