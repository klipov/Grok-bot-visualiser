export const roles = [
  "Coordinator",
  "Researcher",
  "Librarian",
  "Engineer",
  "Outreach",
  "Designer",
  "Analyst",
  "Generalist",
] as const;
export type BotRole = (typeof roles)[number];
export type BotId = string;
export type Point = { x: number; y: number };
export type TeamDraft = { id: BotId; name: string; role: BotRole };
export type Bot = TeamDraft & {
  color: string;
  home: Point;
  description: string;
};

export const team: readonly Bot[] = [
  {
    id: "atlas",
    name: "Atlas",
    role: "Coordinator",
    color: "#9d83d5",
    home: { x: 3.4, y: 5 },
    description:
      "Keeps the brief, sets priorities, and brings the team's work together.",
  },
  {
    id: "mira",
    name: "Mira",
    role: "Researcher",
    color: "#58bdb5",
    home: { x: 8.8, y: 5 },
    description:
      "Investigates the brief, identifies unknowns, and shares findings.",
  },
  {
    id: "reed",
    name: "Reed",
    role: "Outreach",
    color: "#ed8b76",
    home: { x: 15, y: 5 },
    description:
      "Turns the team's findings into clear messages for other people.",
  },
  {
    id: "fern",
    name: "Fern",
    role: "Librarian",
    color: "#8aaf5e",
    home: { x: 4.6, y: 12.7 },
    description:
      "Organises supplied material and checks what the team can support.",
  },
  {
    id: "kit",
    name: "Kit",
    role: "Engineer",
    color: "#719fd5",
    home: { x: 14.5, y: 13 },
    description:
      "Works out the practical steps, constraints, and implementation approach.",
  },
];

export type Handoff = {
  id: string;
  from: BotId;
  to: BotId;
  message: string;
  source: "demo" | "grok";
};
export const botById = (id: BotId, roster: readonly Bot[] = team) =>
  roster.find((bot) => bot.id === id)!;
export const isBotId = (
  value: unknown,
  roster: readonly Bot[] = team,
): value is BotId => roster.some((bot) => bot.id === value);

export function botFromDraft(draft: TeamDraft): Bot {
  const preset = team.find((bot) => bot.role === draft.role);
  const extra = {
    Designer: {
      color: "#d69bb9",
      description: "Shapes the visual direction and explains design choices.",
    },
    Analyst: {
      color: "#d3ad57",
      description: "Compares the options and checks what the numbers support.",
    },
    Generalist: {
      color: "#82a7a0",
      description:
        "Works through the brief and helps wherever the team needs a hand.",
    },
  };
  const details = preset ?? extra[draft.role as keyof typeof extra];
  return {
    ...draft,
    color: details.color,
    description: details.description,
    home: { x: 0, y: 0 },
  };
}

export function parseTeamDrafts(value: unknown): TeamDraft[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12)
    return null;
  const result: TeamDraft[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 24 ||
      !roles.includes(item.role)
    )
      return null;
    ids.add(item.id);
    result.push({ id: item.id, name: item.name.trim(), role: item.role });
  }
  return result.filter((bot) => bot.role === "Coordinator").length > 1
    ? null
    : result;
}

export function executionOrder(roster: readonly Bot[]): Bot[] {
  const priority: BotRole[] = [
    "Coordinator",
    "Researcher",
    "Librarian",
    "Analyst",
    "Engineer",
    "Designer",
    "Outreach",
    "Generalist",
  ];
  const ordered = [...roster].sort(
    (a, b) => priority.indexOf(a.role) - priority.indexOf(b.role),
  );
  return ordered.length > 1 && ordered[0].role === "Coordinator"
    ? [...ordered, ordered[0]]
    : ordered;
}

export type OfficeCanvasProps = {
  roster: readonly Bot[];
  handoff: Handoff | null;
  paused: boolean;
  speed: number;
  selected: BotId | null;
  onSelect: (id: BotId) => void;
  onDelivered: (id: string) => void;
  onSettled: (id: string) => void;
};
