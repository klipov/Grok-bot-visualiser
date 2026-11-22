"use client";

import dynamic from "next/dynamic";
import { Dialog, Select, Tabs, Tooltip } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  roles,
  parseTeamDrafts,
  workspaceRole,
  type Bot,
  type BotRole,
  type TeamDraft,
  type Handoff,
} from "@/lib/office/team";
import { createRoster } from "@/lib/office/layout";
import { demoHandoff } from "@/lib/office/demo";
import { readLocalValue, writeLocalValue } from "@/lib/office/desk-preferences";
import {
  readSampleTeam,
  saveSampleTeam,
  starterDesks,
  type SampleMember,
} from "@/lib/office/sample-preferences";
import {
  avatarStyles,
  avatarSpriteUrl,
  suggestAvatar,
  type AvatarStyle,
} from "@/lib/office/avatar";
import { useDesktopOffice, type DeskChoices } from "./use-desktop-office";
import styles from "./office.module.css";

const OfficeCanvas = dynamic(() => import("./office-canvas"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Opening the office…</div>,
});

function Icon({
  name,
}: {
  name: "play" | "pause" | "reset" | "arrow" | "close" | "plug" | "plus";
}) {
  const paths = {
    play: "m7 4 11 8-11 8V4Z",
    pause: "M8 5v14M16 5v14",
    reset: "M4 10a8 8 0 1 1 1 8M4 4v6h6",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    close: "m6 6 12 12M6 18 18 6",
    plug: "M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0V8Zm6 10v4",
    plus: "M12 5v14M5 12h14",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function CloseButton() {
  return (
    <Dialog.Close className={styles.close} aria-label="Close dialog">
      <Icon name="close" />
    </Dialog.Close>
  );
}

function sampleDraft(member: SampleMember): TeamDraft {
  return { ...member, role: member.role ?? workspaceRole(member.name) };
}

const avatarLabels: Record<AvatarStyle, string> = {
  feminine: "Female",
  masculine: "Male",
  neutral: "Neutral",
};

function DeskSettings({
  name,
  jobTitle,
  choice = {},
  onChange,
}: {
  name: string;
  jobTitle?: string;
  choice?: DeskChoices;
  onChange: (choice: DeskChoices) => void;
}) {
  return (
    <>
      <label className={styles.deskPicker}>
        Department
        <select
          value={choice.role ?? "auto"}
          onChange={(event) =>
            onChange({
              ...choice,
              role:
                event.target.value === "auto"
                  ? undefined
                  : (event.target.value as BotRole),
            })
          }
        >
          <option value="auto">
            Automatic · {workspaceRole(name, jobTitle)}
          </option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.deskPicker}>
        Avatar gender
        <select
          value={choice.avatar ?? "auto"}
          onChange={(event) =>
            onChange({
              ...choice,
              avatar:
                event.target.value === "auto"
                  ? undefined
                  : (event.target.value as AvatarStyle),
            })
          }
        >
          <option value="auto">
            Automatic · {avatarLabels[suggestAvatar(name)]}
          </option>
          {avatarStyles.map((style) => (
            <option key={style} value={style}>
              {avatarLabels[style]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

const resumeDesktopKey = "grok-bot-office.resume-desktop.v1";
type OfficeView = "opening" | "sample" | "joining" | "desktop";

export default function Office() {
  const [view, setView] = useState<OfficeView>("opening");
  const watching = view === "joining" || view === "desktop";
  const [viewSaveFailed, setViewSaveFailed] = useState(false);
  const desktop = useDesktopOffice(watching);
  const [connectOpen, setConnectOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [demoDrafts, setDemoDrafts] = useState<SampleMember[]>(starterDesks);
  const [sampleStorageUnavailable, setSampleStorageUnavailable] =
    useState(false);
  const pendingSampleWrites = useRef(new Map<string, unknown>());
  useEffect(() => {
    setDemoDrafts(readSampleTeam());
    setView(readLocalValue(resumeDesktopKey) === true ? "desktop" : "sample");
  }, []);
  useEffect(() => {
    if (view === "joining" && desktop.checkedAt) {
      setViewSaveFailed(!writeLocalValue(resumeDesktopKey, true));
      setView("desktop");
    }
  }, [view, desktop.checkedAt]);

  function disconnect() {
    setViewSaveFailed(!writeLocalValue(resumeDesktopKey, undefined));
    setView("sample");
  }
  const demoTeam = useMemo(
    () => createRoster(demoDrafts.map(sampleDraft)),
    [demoDrafts],
  );
  const demoChoices = useMemo(
    () =>
      new Map(demoDrafts.map(({ id, role, avatar }) => [id, { role, avatar }])),
    [demoDrafts],
  );
  function applySampleChanges(members: SampleMember[]) {
    const saved = saveSampleTeam(
      demoDrafts,
      members,
      pendingSampleWrites.current,
    );
    setDemoDrafts(members);
    setSampleStorageUnavailable(!saved);
  }
  function customizeDemo(id: string, choice: DeskChoices) {
    applySampleChanges(
      demoDrafts.map((member) =>
        member.id === id ? { id, name: member.name, ...choice } : member,
      ),
    );
  }
  const [revision, setRevision] = useState(0);
  const [editorDrafts, setEditorDrafts] = useState<SampleMember[]>([]);
  const [teamError, setTeamError] = useState("");
  const team = watching ? desktop.team : demoTeam;
  const source = !watching
    ? "Demo office · simulated activity"
    : desktop.checkedAt
      ? "Connected · Grok Bot desktop"
      : desktop.error
        ? "Desktop unavailable"
        : "Connecting to Grok Bot…";

  function applyTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseTeamDrafts(editorDrafts.map(sampleDraft));
    if (!parsed) {
      setTeamError("Check the names and roles on your sample team.");
      return;
    }
    applySampleChanges(
      editorDrafts.map((member) => ({ ...member, name: member.name.trim() })),
    );
    setRevision((old) => old + 1);
    setTeamOpen(false);
  }

  if (view === "opening") {
    return (
      <main className={styles.main}>
        <p className={styles.loading} role="status">
          Opening the office…
        </p>
      </main>
    );
  }

  return (
    <Tooltip.Provider delayDuration={250}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Grok Office home">
          <span className={styles.brandMark} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Grok / Office
        </a>
        <span className={styles.workspace}>
          Team workspace <span className={styles.divider}>/</span> Floor 01
        </span>
        {watching ? (
          desktop.allDesks.length > 0 && (
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <button className={styles.teamSetup}>Choose desks</button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={styles.overlay} />
                <Dialog.Content className={styles.dialog}>
                  <CloseButton />
                  <Dialog.Title>Choose desks</Dialog.Title>
                  <Dialog.Description>
                    Grok can show group chats alongside bots in its sidebar.
                    Choose which entries get a desk for this connection.
                  </Dialog.Description>
                  <div className={styles.deskChoices}>
                    {desktop.allDesks.map((bot) => (
                      <label key={bot.id}>
                        <input
                          type="checkbox"
                          checked={!desktop.hiddenDesks.has(bot.id)}
                          onChange={(event) =>
                            desktop.setDeskVisible(bot.id, event.target.checked)
                          }
                        />
                        {bot.name}
                      </label>
                    ))}
                  </div>
                  <div className={styles.dialogActions}>
                    <Dialog.Close className={styles.primary}>Done</Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )
        ) : (
          <button
            className={styles.teamSetup}
            onClick={() => {
              setEditorDrafts(demoDrafts.map((bot) => ({ ...bot })));
              setTeamError("");
              setTeamOpen(true);
            }}
          >
            Edit sample team <span>{team.length}</span>
          </button>
        )}
      </header>

      <main className={styles.main}>
        <section className={styles.heading} aria-labelledby="office-title">
          <div>
            <div className={styles.eyebrow} role="status">
              <span
                className={`${styles.dot} ${watching && desktop.checkedAt ? styles.grokDot : ""}`}
              />
              {source}
            </div>
            <h1 id="office-title">
              {watching ? "Your team’s office" : "Inside the sample office"}
            </h1>
            <p>
              {watching
                ? "Select a teammate to see their latest visible activity."
                : "Explore the sample team or connect to Grok Bot on Windows."}
            </p>
          </div>
          {watching ? (
            <button className={styles.secondary} onClick={disconnect}>
              Disconnect
            </button>
          ) : (
            <button
              className={styles.primary}
              onClick={() => setConnectOpen(true)}
            >
              <Icon name="plug" />
              Connect Grok Bot
            </button>
          )}
        </section>
        {(viewSaveFailed ||
          (watching
            ? desktop.storageUnavailable
            : sampleStorageUnavailable)) && (
          <p className={styles.error} role="status">
            The browser couldn’t save your latest settings. They’re available in
            this tab.
          </p>
        )}
        {desktop.error && watching && (
          <div className={styles.error} role="alert">
            <span>{desktop.error}</span>
            <button onClick={desktop.retry}>Retry now</button>
          </div>
        )}
        <OfficeFloor
          key={watching ? "desktop" : `demo-${revision}`}
          team={team}
          activity={watching ? desktop.activity : undefined}
          choices={watching ? desktop.choices : demoChoices}
          onCustomize={watching ? desktop.customize : customizeDemo}
          checkedAt={watching ? desktop.checkedAt : undefined}
          unavailable={Boolean(desktop.error)}
          allDesksHidden={
            watching && !team.length && desktop.allDesks.length > 0
          }
        />
      </main>

      <Dialog.Root open={connectOpen} onOpenChange={setConnectOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.dialog}>
            <CloseButton />
            <Dialog.Title>Watch your Grok Bot team</Dialog.Title>
            <Dialog.Description>
              On a Mac, you can use the sample office. Live activity requires
              Windows. Open Grok Bot on the same Windows PC, sign in, and expand
              the Bots sidebar. To see a task title, open the bot’s Activity
              panel in Conversation details.
            </Dialog.Description>
            <p className={styles.help}>
              This browser will reopen your team until you choose Disconnect.
              Watching uses no xAI API credits.
            </p>
            <div className={styles.dialogActions}>
              <Dialog.Close className={styles.secondary}>Cancel</Dialog.Close>
              <button
                className={styles.primary}
                onClick={() => {
                  setConnectOpen(false);
                  setView("joining");
                }}
              >
                Watch desktop team
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={teamOpen} onOpenChange={setTeamOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={`${styles.dialog} ${styles.teamDialog}`}>
            <CloseButton />
            <span className={styles.dialogKicker}>Demo office</span>
            <Dialog.Title>Edit the sample team</Dialog.Title>
            <Dialog.Description>
              Choose the teammates and rooms for this preview.
            </Dialog.Description>
            <form onSubmit={applyTeam}>
              <div className={styles.editorRows}>
                {editorDrafts.map((draft, index) => (
                  <div className={styles.editorRow} key={draft.id}>
                    <div>
                      <label htmlFor={`name-${draft.id}`}>
                        Teammate {index + 1}
                      </label>
                      <input
                        id={`name-${draft.id}`}
                        value={draft.name}
                        maxLength={24}
                        required
                        onChange={(event) =>
                          setEditorDrafts((items) =>
                            items.map((item) =>
                              item.id === draft.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <DeskSettings
                      name={draft.name}
                      choice={{ role: draft.role, avatar: draft.avatar }}
                      onChange={(choice) =>
                        setEditorDrafts((items) =>
                          items.map((item) =>
                            item.id === draft.id
                              ? { id: item.id, name: item.name, ...choice }
                              : item,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className={styles.removeBot}
                      disabled={editorDrafts.length <= 1}
                      aria-label={`Remove teammate ${index + 1}`}
                      onClick={() =>
                        setEditorDrafts((items) =>
                          items.filter((item) => item.id !== draft.id),
                        )
                      }
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={styles.addBot}
                disabled={editorDrafts.length >= 12}
                onClick={() =>
                  setEditorDrafts((items) => [
                    ...items,
                    {
                      id: `bot-${crypto.randomUUID()}`,
                      name: `Teammate ${items.length + 1}`,
                    },
                  ])
                }
              >
                <Icon name="plus" />
                Add teammate <span>{editorDrafts.length} / 12</span>
              </button>
              <p className={styles.help}>
                This browser remembers your sample teammates and their desk
                settings.
              </p>
              {teamError && (
                <p role="alert" className={styles.teamError}>
                  {teamError}
                </p>
              )}
              <div className={styles.dialogActions}>
                <Dialog.Close className={styles.secondary}>Cancel</Dialog.Close>
                <button className={styles.primary}>Apply team</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Tooltip.Provider>
  );
}

function OfficeFloor({
  team,
  activity,
  choices,
  onCustomize,
  checkedAt,
  unavailable,
  allDesksHidden,
}: {
  team: readonly Bot[];
  activity?: ReadonlyMap<string, string>;
  choices: ReadonlyMap<string, DeskChoices>;
  onCustomize: (id: string, choice: DeskChoices) => void;
  checkedAt?: Date;
  unavailable: boolean;
  allDesksHidden: boolean;
}) {
  const demo = activity === undefined;
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("team");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [current, setCurrent] = useState<Handoff | null>(null);
  const [history, setHistory] = useState<Handoff[]>([]);
  const [message, setMessage] = useState<Handoff | null>(null);
  const index = useRef(0);
  const inspected = team.find((bot) => bot.id === selected);
  const nameOf = (id: string) => team.find((bot) => bot.id === id)?.name;
  const inTransit = current && !history.some((item) => item.id === current.id);

  useEffect(() => {
    if (!demo || paused || current || team.length < 2) return;
    const timer = setTimeout(
      () => setCurrent(demoHandoff(index.current++, team)),
      900,
    );
    return () => clearTimeout(timer);
  }, [demo, paused, current, team]);

  const delivered = useCallback(
    (id: string) => {
      if (current && current.id === id)
        setHistory((items) =>
          items.some((item) => item.id === id)
            ? items
            : [...items, current].slice(-60),
        );
    },
    [current],
  );
  const settled = useCallback((id: string) => {
    setCurrent((item) => (item?.id === id ? null : item));
  }, []);
  function restartDemo() {
    setCurrent(null);
    setHistory([]);
    setMessage(null);
    setPaused(false);
    index.current = 0;
  }

  function statusOf(bot: Bot) {
    if (activity) return activity.get(bot.id) || "No activity shown";
    if (current?.from === bot.id)
      return inTransit
        ? `Walking to ${nameOf(current.to)}`
        : "Returning to desk";
    return "At their desk";
  }

  return (
    <>
      <div className={styles.officeGrid}>
        <section className={styles.worldPanel} aria-label="Office floor">
          <div className={styles.floorHeading}>
            <span>
              <span className={styles.tinyGrid} aria-hidden="true">
                ▦
              </span>{" "}
              {demo ? "Sample floor" : "Desktop team"}
            </span>
            <span>
              {team.length} {team.length === 1 ? "desk" : "desks"}
            </span>
          </div>
          <div className={styles.canvasArea} data-testid="office-world">
            {team.length > 0 ? (
              <OfficeCanvas
                roster={team}
                handoff={current}
                activity={activity}
                paused={paused}
                speed={Number(speed)}
                selected={inspected?.id ?? null}
                onSelect={(id) => {
                  setSelected(id);
                  setTab("team");
                }}
                onDelivered={delivered}
                onSettled={settled}
              />
            ) : (
              <div className={styles.loading}>
                {allDesksHidden
                  ? "Choose desks to show teammates on this floor."
                  : checkedAt
                    ? "No bots visible on this floor"
                    : unavailable
                      ? "Waiting for the Grok Bot sidebar"
                      : "Looking for your team…"}
              </div>
            )}
          </div>
          <div className={styles.worldToolbar}>
            {demo ? (
              <div className={styles.playback}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      className={styles.iconButton}
                      onClick={() => setPaused(!paused)}
                      aria-label={paused ? "Resume office" : "Pause office"}
                    >
                      <Icon name={paused ? "play" : "pause"} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className={styles.tooltip}>
                      {paused ? "Resume" : "Pause"} animation
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <button
                  className={styles.iconButton}
                  onClick={restartDemo}
                  aria-label="Restart demo"
                  title="Restart demo"
                >
                  <Icon name="reset" />
                </button>
                <span className={styles.controlDivider} />
                <Select.Root value={speed} onValueChange={setSpeed}>
                  <Select.Trigger
                    className={styles.speed}
                    aria-label="Playback speed"
                  >
                    <Select.Value /> <span aria-hidden="true">⌄</span>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      className={styles.selectContent}
                      position="popper"
                      sideOffset={8}
                    >
                      <Select.Viewport>
                        {["1", "2", "4"].map((value) => (
                          <Select.Item
                            key={value}
                            value={value}
                            className={styles.selectItem}
                          >
                            <Select.ItemText>{value}× speed</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            ) : (
              <span className={styles.liveStatus}>
                {checkedAt
                  ? `Last checked ${checkedAt.toLocaleTimeString()}`
                  : "Waiting for desktop activity"}
              </span>
            )}
            <span className={styles.sceneHint}>
              {paused ? "Office paused" : "Select a desk to inspect"}
            </span>
          </div>
        </section>
        <aside className={styles.sidebar} aria-label="Team and activity">
          <Tabs.Root value={tab} onValueChange={setTab} className={styles.tabs}>
            <Tabs.List
              className={styles.tabList}
              aria-label="Office information"
            >
              <Tabs.Trigger className={styles.tab} value="team">
                On the floor <span>{team.length}</span>
              </Tabs.Trigger>
              <Tabs.Trigger className={styles.tab} value="activity">
                Activity <span>{demo ? history.length : activity?.size}</span>
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="team" className={styles.tabContent}>
              <div className={styles.teamList}>
                {team.map((bot) => (
                  <button
                    key={bot.id}
                    className={`${styles.botRow} ${selected === bot.id ? styles.botSelected : ""}`}
                    onClick={() =>
                      setSelected(selected === bot.id ? null : bot.id)
                    }
                    aria-pressed={selected === bot.id}
                  >
                    <span
                      className={styles.avatar}
                      aria-hidden="true"
                      data-avatar={bot.avatar}
                      style={{
                        backgroundImage: `url(${avatarSpriteUrl(bot.avatar)})`,
                      }}
                    />
                    <span className={styles.botInfo}>
                      <span className={styles.botName}>
                        {bot.name}
                        <span className={styles.role}>{bot.role}</span>
                      </span>
                      <span className={styles.botStatus}>{statusOf(bot)}</span>
                    </span>
                    <span className={styles.rowArrow} aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
              </div>
              {inspected && (
                <div className={styles.inspector}>
                  <div className={styles.inspectorHeader}>
                    <h2>{inspected.name}’s desk</h2>
                    <button
                      className={styles.iconButton}
                      aria-label="Close teammate details"
                      onClick={() => setSelected(null)}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                  <p>{demo ? inspected.description : statusOf(inspected)}</p>
                  {inspected.roleLabel && (
                    <p className={styles.meta}>
                      Grok title · {inspected.roleLabel}
                    </p>
                  )}
                  <DeskSettings
                    name={inspected.name}
                    jobTitle={inspected.roleLabel}
                    choice={choices.get(inspected.id)}
                    onChange={(choice) => onCustomize(inspected.id, choice)}
                  />
                </div>
              )}
            </Tabs.Content>
            <Tabs.Content value="activity" className={styles.tabContent}>
              <div className={styles.activityList}>
                {demo ? (
                  history.length ? (
                    history
                      .slice()
                      .reverse()
                      .map((h) => (
                        <button
                          className={styles.activityItem}
                          key={h.id}
                          onClick={() => setMessage(h)}
                        >
                          <span className={styles.meta}>Demo · Delivered</span>
                          <strong>
                            {nameOf(h.from)} → {nameOf(h.to)}
                          </strong>
                          <span className={styles.excerpt}>{h.message}</span>
                        </button>
                      ))
                  ) : (
                    <div className={styles.empty}>
                      <h2>No handoffs yet</h2>
                    </div>
                  )
                ) : activity?.size ? (
                  team
                    .filter((bot) => activity.has(bot.id))
                    .map((bot) => (
                      <button
                        className={styles.activityItem}
                        key={bot.id}
                        onClick={() => {
                          setSelected(bot.id);
                          setTab("team");
                        }}
                      >
                        <strong>{bot.name}</strong>
                        <span className={styles.excerpt}>
                          {activity.get(bot.id)}
                        </span>
                      </button>
                    ))
                ) : (
                  <div className={styles.empty}>
                    <h2>No activity reported</h2>
                    <p>
                      Visible task details appear here as Grok Bot shares them.
                    </p>
                  </div>
                )}
              </div>
            </Tabs.Content>
          </Tabs.Root>
          {demo && current && (
            <div className={styles.transit}>
              <span className={styles.meta}>
                {inTransit ? "In transit" : "Delivered · heading home"}
              </span>
              <strong>
                {nameOf(current.from)} <Icon name="arrow" />{" "}
                {nameOf(current.to)}
              </strong>
              <button onClick={() => setMessage(current)}>
                Read the sample handoff <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}
        </aside>
      </div>
      <section className={styles.belowFloor} aria-label="Session information">
        <div>
          <span className={styles.dot} />
          {demo ? "Simulated desk visits" : "Read-only desktop view"}
        </div>
        {demo && <span>{paused ? "Paused" : `${speed}× playback`}</span>}
      </section>
      {message && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) setMessage(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay} />
            <Dialog.Content
              className={`${styles.dialog} ${styles.messageDialog}`}
            >
              <CloseButton />
              <span className={styles.dialogKicker}>
                Simulated conversation
              </span>
              <Dialog.Title>
                {nameOf(message.from)} → {nameOf(message.to)}
              </Dialog.Title>
              <Dialog.Description>
                {history.some((h) => h.id === message.id)
                  ? "Delivered at the desk"
                  : "In transit to the desk"}
              </Dialog.Description>
              <p className={styles.messageBody}>{message.message}</p>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
