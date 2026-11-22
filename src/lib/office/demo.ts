import { team, executionOrder, type Bot, type Handoff } from "./team";

const notes = {
  Manager:
    "The spring catalogue is due on Friday. Could you draft the opening page?",
  Copywriter:
    "The opening page has two headlines. The shorter one leaves more room for the product photos.",
  Sales:
    "Customers keep asking about delivery dates. Let's include those on the opening page before it goes to print.",
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
  HR: "Two interview slots are open on Tuesday. Which one works for your team?",
  Finance:
    "The print quote fits the budget if we use the smaller run. Can you confirm the quantity?",
  Support:
    "Three customers asked the same delivery question today. Can we add the answer to the order page?",
  Marketing:
    "The launch email is ready. Which product photo should go above the headline?",
  Operations:
    "The cartons arrive on Thursday. I'll need the final packing list before then.",
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
