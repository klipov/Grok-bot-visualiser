import type { BotId, Handoff } from "./team";

const conversations: { from: BotId; to: BotId; message: string }[] = [
  {
    from: "atlas",
    to: "mira",
    message:
      "Can you look into the brief? Bring back the useful findings and anything we still need to check.",
  },
  {
    from: "mira",
    to: "fern",
    message:
      "I've separated the ideas from the assumptions. Could you organise the notes so the team can find what it needs?",
  },
  {
    from: "fern",
    to: "kit",
    message:
      "The notes are organised. Start with the smallest useful version; the open questions are at the top.",
  },
  {
    from: "kit",
    to: "reed",
    message:
      "The first version is taking shape. Can you put together a short explanation of what it does and who it helps?",
  },
  {
    from: "reed",
    to: "atlas",
    message:
      "The draft is ready for your review. I kept it short and left out the claims we can't support yet.",
  },
  {
    from: "atlas",
    to: "fern",
    message:
      "Thanks, team. Let's keep the decisions together so we can pick up where we left off.",
  },
];

export function demoHandoff(index: number): Handoff {
  return {
    ...conversations[index % conversations.length],
    id: `demo-${index}`,
    source: "demo",
  };
}
