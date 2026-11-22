import { avatarStyles, suggestAvatar, type AvatarStyle } from "./avatar";

export const roles = [
  "Manager",
  "Copywriter",
  "Sales",
  "HR",
  "Finance",
  "Support",
  "Marketing",
  "Operations",
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
export type TeamDraft = {
  id: BotId;
  name: string;
  role: BotRole;
  roleLabel?: string;
  avatar?: AvatarStyle;
};
export type Bot = TeamDraft & {
  avatar: AvatarStyle;
  color: string;
  home: Point;
  description: string;
};

const roleDetails: Record<BotRole, Pick<Bot, "color" | "description">> = {
  Manager: {
    color: "#9d83d5",
    description:
      "A private office with a planning board and a desk for reviews.",
  },
  Copywriter: {
    color: "#67a896",
    description: "A writing desk with reference books and marked-up drafts.",
  },
  Sales: {
    color: "#ed8b76",
    description: "A sales desk with a phone and a pipeline board.",
  },
  HR: {
    color: "#bb87a3",
    description: "Handles hiring, onboarding, and questions from the team.",
  },
  Finance: {
    color: "#78aa90",
    description: "Keeps the books and tracks budgets and payments.",
  },
  Support: {
    color: "#7fa6c4",
    description:
      "Works through customer questions and follows up on open tickets.",
  },
  Marketing: {
    color: "#de9b69",
    description: "Plans campaigns and keeps the launch calendar up to date.",
  },
  Operations: {
    color: "#a2a56e",
    description: "Organises schedules, supplies, and the day-to-day work.",
  },
  Coordinator: {
    color: "#9d83d5",
    description:
      "Keeps the brief, sets priorities, and brings the team's work together.",
  },
  Researcher: {
    color: "#58bdb5",
    description:
      "Investigates the brief, identifies unknowns, and shares findings.",
  },
  Outreach: {
    color: "#ed8b76",
    description:
      "Turns the team's findings into clear messages for other people.",
  },
  Librarian: {
    color: "#8aaf5e",
    description:
      "Organises supplied material and checks what the team can support.",
  },
  Engineer: {
    color: "#719fd5",
    description:
      "Works out the practical steps, constraints, and implementation approach.",
  },
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
    description: "A shared office desk with a monitor and a set of notebooks.",
  },
};

export const team: readonly Bot[] = [
  botFromDraft({ id: "marg", name: "Manager Marg", role: "Manager" }),
  botFromDraft({ id: "cathy", name: "Copywriting Cathy", role: "Copywriter" }),
  botFromDraft({ id: "sam", name: "Sales Sam", role: "Sales" }),
];

type WorkspacePattern = readonly [BotRole, RegExp];

const departments: WorkspacePattern[] = [
  [
    "HR",
    /\b(hr|human resources|people (ops|operations)|talent acquisition|recruit(er|ing|ment))\b/,
  ],
  [
    "Finance",
    /\b(finance|financial|account(ant|ing)|accounts (payable|receivable)|bookkeep(er|ing)|payroll|treasury|cfo)\b/,
  ],
  ["Support", /\b(support|help ?desk|customer (care|service|success))\b/],
  ["Copywriter", /\b(copy ?writ(er|ing)|writer|writing|editor|editorial)\b/],
  ["Researcher", /\bresearch(er)?\b/],
  ["Librarian", /\b(librarian|library|archivist|knowledge management)\b/],
  [
    "Engineer",
    /\b(engineer(ing)?|developer|programmer|software development|dev ?ops|cto)\b/,
  ],
  ["Designer", /\b(design(er)?|illustrat(or|ion)|ux|ui)\b/],
  [
    "Operations",
    /\b(operations|ops|logistics|procurement|supply chain|administrat(or|ion)|coo)\b/,
  ],
  [
    "Sales",
    /\b(sales|account (executive|manager)|business development|lead generation|bdr|sdr)\b/,
  ],
  [
    "Marketing",
    /\b(marketing|marketer|social media|brand|seo|advertising|cmo)\b/,
  ],
  ["Outreach", /\b(outreach|public relations|communications|partnerships)\b/],
  ["Analyst", /\b(analyst|analysis|analytics|data scien(ce|tist))\b/],
];

const generalTitles: WorkspacePattern[] = [
  ["Manager", /\b(manager|management|director|team lead|ceo)\b/],
  ["Coordinator", /\b(coordinator|coordination)\b/],
];

function titleWords(value: string): string {
  return value
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\s-]+/g, " ")
    .toLowerCase();
}

function matchTitle(
  patterns: WorkspacePattern[],
  text: string,
): BotRole | undefined {
  return patterns.find(([, pattern]) => pattern.test(text))?.[0];
}

/** A department takes precedence over titles such as "manager" or "coordinator". */
export function workspaceRole(name: string, role = ""): BotRole {
  const title = titleWords(role);
  const nameWords = titleWords(name);
  return (
    matchTitle(departments, title) ??
    matchTitle(departments, nameWords) ??
    matchTitle(generalTitles, title) ??
    matchTitle(generalTitles, nameWords) ??
    "Generalist"
  );
}

export function hasPrivateOffice(role: BotRole): boolean {
  return role === "Manager" || role === "Coordinator";
}

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
  return {
    ...draft,
    avatar: draft.avatar ?? suggestAvatar(draft.name),
    ...roleDetails[draft.role],
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
      !roles.includes(item.role) ||
      (item.avatar !== undefined && !avatarStyles.includes(item.avatar))
    )
      return null;
    ids.add(item.id);
    result.push({
      id: item.id,
      name: item.name.trim(),
      role: item.role,
      ...(item.avatar === undefined ? {} : { avatar: item.avatar }),
    });
  }
  return result.filter((bot) => bot.role === "Coordinator").length > 1
    ? null
    : result;
}

export function executionOrder(roster: readonly Bot[]): Bot[] {
  const priority: BotRole[] = [
    "Manager",
    "Coordinator",
    "Researcher",
    "Librarian",
    "Analyst",
    "Engineer",
    "Designer",
    "Copywriter",
    "HR",
    "Finance",
    "Support",
    "Marketing",
    "Operations",
    "Sales",
    "Outreach",
    "Generalist",
  ];
  const ordered = [...roster].sort(
    (a, b) => priority.indexOf(a.role) - priority.indexOf(b.role),
  );
  return ordered.length > 1 && hasPrivateOffice(ordered[0].role)
    ? [...ordered, ordered[0]]
    : ordered;
}

export type OfficeCanvasProps = {
  roster: readonly Bot[];
  activity?: ReadonlyMap<string, string>;
  handoff: Handoff | null;
  paused: boolean;
  speed: number;
  selected: BotId | null;
  onSelect: (id: BotId) => void;
  onDelivered: (id: string) => void;
  onSettled: (id: string) => void;
};
