import {
  botFromDraft,
  hasPrivateOffice,
  team,
  type Bot,
  type BotId,
  type Point,
  type TeamDraft,
} from "./team";

export const ROOM_WIDTH = 6;
export const ROW_HEIGHT = 7;
export type Station = {
  bot: Bot;
  x: number;
  y: number;
  width: number;
  depth: number;
  aisleY: number;
  privateOffice: boolean;
};
export type OfficeLayout = {
  width: number;
  depth: number;
  columns: number;
  rows: number;
  spineX: number;
  stations: Station[];
};

function dimensions(count: number) {
  const columns = count === 4 ? 2 : Math.min(3, Math.max(1, count));
  return { columns, rows: Math.ceil(count / columns) };
}

export function createRoster(drafts: readonly TeamDraft[]): Bot[] {
  const ordered = [...drafts].sort(
    (a, b) =>
      Number(hasPrivateOffice(b.role)) - Number(hasPrivateOffice(a.role)),
  );
  const { columns } = dimensions(ordered.length);
  return ordered.map((draft, index) => ({
    ...botFromDraft(draft),
    home: {
      x: 1 + (index % columns) * ROOM_WIDTH + 2.5,
      y: 1 + Math.floor(index / columns) * ROW_HEIGHT + 4.5,
    },
  }));
}

export function layoutOffice(
  roster: readonly Bot[] = createRoster(team),
): OfficeLayout {
  const { columns, rows } = dimensions(roster.length);
  return {
    width: columns * ROOM_WIDTH + 2,
    depth: rows * ROW_HEIGHT + 1,
    columns,
    rows,
    spineX: columns * ROOM_WIDTH + 1.25,
    stations: roster.map((bot, index) => ({
      bot,
      x: 1 + (index % columns) * ROOM_WIDTH,
      y: 1 + Math.floor(index / columns) * ROW_HEIGHT,
      width: 5.5,
      depth: 5.1,
      aisleY: 1 + Math.floor(index / columns) * ROW_HEIGHT + 5.9,
      privateOffice: hasPrivateOffice(bot.role),
    })),
  };
}

export function walkingRoute(
  from: BotId,
  to: BotId,
  roster: readonly Bot[] = createRoster(team),
): Point[] {
  const layout = layoutOffice(roster);
  const sender = layout.stations.find((station) => station.bot.id === from);
  const receiver = layout.stations.find((station) => station.bot.id === to);
  if (!sender || !receiver)
    throw new Error("A handoff must connect two teammates in this office");
  const start = sender.bot.home;
  const destination = { x: receiver.bot.home.x + 0.8, y: receiver.bot.home.y };
  const route = [
    { ...start },
    { x: start.x, y: sender.aisleY },
    { x: layout.spineX, y: sender.aisleY },
    { x: layout.spineX, y: receiver.aisleY },
    { x: destination.x, y: receiver.aisleY },
    destination,
  ];
  if (sender.aisleY === receiver.aisleY) route.splice(2, 2);
  return route.filter(
    (point, index) =>
      index === 0 ||
      point.x !== route[index - 1].x ||
      point.y !== route[index - 1].y,
  );
}
