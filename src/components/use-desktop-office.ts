import { useEffect, useMemo, useState } from "react";
import { createRoster } from "@/lib/office/layout";
import { workspaceRole, type Bot, type BotRole } from "@/lib/office/team";
import type { ObservedBot } from "@/lib/grok/observe";

import { suggestAvatar, type AvatarStyle } from "@/lib/office/avatar";

export type DeskChoices = { role?: BotRole; avatar?: AvatarStyle };

type DesktopOffice = {
  team: Bot[];
  activity: Map<string, string>;
  choices: ReadonlyMap<string, DeskChoices>;
  checkedAt?: Date;
  error?: string;
};

export const emptyOffice: DesktopOffice = {
  team: [],
  activity: new Map(),
  choices: new Map(),
};

export function updateOffice(
  previous: DesktopOffice,
  bots: ObservedBot[],
): DesktopOffice {
  // Grok's sidebar can bring a recently active chat to the top.
  const newBots = new Map(bots.map((bot) => [bot.id, bot]));
  const ordered: ObservedBot[] = [];
  for (const seated of previous.team) {
    const current = newBots.get(seated.id);
    if (current) {
      ordered.push(current);
      newBots.delete(seated.id);
    }
  }
  for (const bot of newBots.values()) ordered.push(bot);

  const choices = new Map<string, DeskChoices>();
  const drafts = ordered.map(({ id, name, role }) => {
    const choice = previous.choices.get(id);
    if (choice) choices.set(id, choice);
    return {
      id,
      name,
      role: choice?.role ?? workspaceRole(name, role),
      avatar: choice?.avatar ?? suggestAvatar(name),
      roleLabel: role,
    };
  });
  // Pixi only needs a new floor when the occupants or their rooms change.
  const sameFloor =
    previous.team.length === drafts.length &&
    drafts.every((bot, i) => {
      const old = previous.team[i];
      return (
        bot.id === old.id &&
        bot.name === old.name &&
        bot.role === old.role &&
        bot.roleLabel === old.roleLabel &&
        bot.avatar === old.avatar
      );
    });
  const activity = new Map<string, string>();
  for (const bot of bots) {
    const detail = [...new Set([bot.status, bot.task].filter(Boolean))].join(
      " · ",
    );
    if (detail) activity.set(bot.id, detail);
  }
  return {
    team: sameFloor ? previous.team : createRoster(drafts),
    activity,
    choices,
    checkedAt: new Date(),
  };
}

export function customizeDesk(
  office: DesktopOffice,
  id: string,
  choice: DeskChoices,
): DesktopOffice {
  const selected = office.team.find((bot) => bot.id === id);
  if (!selected) return office;
  const choices = new Map(office.choices);
  if (choice.role || choice.avatar) choices.set(id, choice);
  else choices.delete(id);
  const role = choice.role ?? workspaceRole(selected.name, selected.roleLabel);
  const avatar = choice.avatar ?? suggestAvatar(selected.name);
  const team =
    selected.role === role && selected.avatar === avatar
      ? office.team
      : createRoster(
          office.team.map((bot) =>
            bot.id === id ? { ...bot, role, avatar } : bot,
          ),
        );
  return { ...office, team, choices };
}

export function useDesktopOffice(enabled: boolean) {
  const [office, setOffice] = useState<DesktopOffice>(emptyOffice);
  const [attempt, setAttempt] = useState(0);
  const [hiddenDesks, setHiddenDesks] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!enabled) {
      setOffice(emptyOffice);
      setHiddenDesks(new Set());
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch("/api/grok/observe", {
          method: "POST",
          headers: { "X-Office-Observer": "desktop" },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.bots)) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "The desktop roster is unavailable.",
          );
        }
        if (!controller.signal.aborted)
          setOffice((old) => updateOffice(old, data.bots));
      } catch (cause) {
        if (!controller.signal.aborted)
          setOffice((previous) => ({
            ...emptyOffice,
            choices: previous.choices,
            error:
              cause instanceof Error && !(cause instanceof SyntaxError)
                ? cause.message
                : "Couldn’t read the Grok Bot desktop window.",
          }));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 6000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, attempt]);

  const team = useMemo(() => {
    if (!hiddenDesks.size) return office.team;
    const visible = office.team.filter((bot) => !hiddenDesks.has(bot.id));
    return visible.length === office.team.length
      ? office.team
      : createRoster(visible);
  }, [office.team, hiddenDesks]);
  const activity = useMemo(() => {
    if (!hiddenDesks.size) return office.activity;
    return new Map([...office.activity].filter(([id]) => !hiddenDesks.has(id)));
  }, [office.activity, hiddenDesks]);

  function setDeskVisible(id: string, visible: boolean) {
    setHiddenDesks((previous) => {
      const next = new Set(previous);
      if (visible) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return {
    ...office,
    team,
    activity,
    allDesks: office.team,
    hiddenDesks,
    setDeskVisible,
    retry: () => setAttempt((value) => value + 1),
    customize: (id: string, choice: DeskChoices) =>
      setOffice((previous) => customizeDesk(previous, id, choice)),
  };
}
