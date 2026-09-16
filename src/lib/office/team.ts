export const team = [
  { id: "atlas", name: "Atlas", role: "Coordinator", color: "#9d83d5", home: { x: 3.4, y: 5 }, description: "Keeps the brief, sets priorities, and brings the team's work together." },
  { id: "mira", name: "Mira", role: "Researcher", color: "#58bdb5", home: { x: 8.8, y: 5 }, description: "Investigates the brief, identifies unknowns, and shares findings." },
  { id: "reed", name: "Reed", role: "Outreach", color: "#ed8b76", home: { x: 15, y: 5 }, description: "Turns the team's findings into clear messages for other people." },
  { id: "fern", name: "Fern", role: "Librarian", color: "#8aaf5e", home: { x: 4.6, y: 12.7 }, description: "Organises supplied material and checks what the team can support." },
  { id: "kit", name: "Kit", role: "Engineer", color: "#719fd5", home: { x: 14.5, y: 13 }, description: "Works out the practical steps, constraints, and implementation approach." },
] as const;

export type BotId = (typeof team)[number]["id"];
export type Point = { x: number; y: number };
export type Handoff = { id: string; from: BotId; to: BotId; message: string; source: "demo" | "grok" };
export const botById = (id: BotId) => team.find((bot) => bot.id === id)!;
export const isBotId = (value: unknown): value is BotId => team.some((bot) => bot.id === value);

export type OfficeCanvasProps = {
  handoff: Handoff | null;
  paused: boolean;
  speed: number;
  selected: BotId | null;
  onSelect: (id: BotId) => void;
  onDelivered: (id: string) => void;
  onSettled: (id: string) => void;
};
