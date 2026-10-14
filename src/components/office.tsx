"use client";

import dynamic from "next/dynamic";
import { Dialog, Select, Tabs, Tooltip } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { botById, team, type BotId, type Handoff } from "@/lib/office/team";
import { demoHandoff } from "@/lib/office/demo";
import { consumeEvents } from "@/lib/grok/protocol";
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

export default function Office() {
  const [queue, setQueue] = useState<Handoff[]>([]);
  const [history, setHistory] = useState<Handoff[]>([]);
  const [selected, setSelected] = useState<BotId | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [mode, setMode] = useState<"demo" | "grok">("demo");
  const [running, setRunning] = useState(false);
  const [working, setWorking] = useState<BotId | null>(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [connection, setConnection] = useState<{
    configured: boolean;
    model: string;
  } | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [briefMode, setBriefMode] = useState("demo");
  const [message, setMessage] = useState<Handoff | null>(null);
  const demoIndex = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const current = queue[0] ?? null;
  const inspected = selected ? botById(selected) : null;
  const inTransit = current && !history.some((h) => h.id === current.id);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (mode !== "demo" || queue.length || paused) return;
    const timer = setTimeout(() => {
      const next = demoHandoff(demoIndex.current++);
      setQueue((items) => (items.length ? items : [next]));
    }, 900);
    return () => clearTimeout(timer);
  }, [mode, queue.length, paused]);

  const delivered = useCallback(
    (id: string) => {
      const item = queue.find((h) => h.id === id);
      if (item)
        setHistory((previous) =>
          previous.some((h) => h.id === id)
            ? previous
            : [...previous, item].slice(-60),
        );
    },
    [queue],
  );
  const settled = useCallback(
    (id: string) => setQueue((items) => items.filter((h) => h.id !== id)),
    [],
  );

  function restartDemo() {
    controller.current?.abort();
    controller.current = null;
    setRunning(false);
    setWorking(null);
    setMode("demo");
    setPaused(false);
    setQueue([]);
    setHistory([]);
    setSummary("");
    setError("");
    demoIndex.current = 0;
  }

  async function checkConnection() {
    setConnectOpen(true);
    setTokenDraft(token);
    try {
      const response = await fetch("/api/grok/status", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setConnection(await response.json());
    } catch {
      setError("Couldn't check Grok configuration. Please try again.");
    }
  }

  async function startBrief(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      brief.trim().length < 10 ||
      running ||
      (briefMode === "grok" && !token.trim())
    )
      return;
    setBriefOpen(false);
    setQueue([]);
    setHistory([]);
    setSummary("");
    setError("");
    setPaused(false);
    if (briefMode === "demo") {
      demoIndex.current = 1;
      setMode("demo");
      setQueue([
        {
          ...demoHandoff(0),
          message: `Demo brief: ${brief.trim()}\n\nThis is a simulated handoff. Connect Grok to have the team work on the brief.`,
        },
      ]);
      return;
    }
    setMode("grok");
    setRunning(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/grok/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ brief: brief.trim() }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Couldn't start the Grok team",
        );
      }
      if (!response.body) throw new Error("The team connection didn't open");
      await consumeEvents(response.body, (update) => {
        if (abort.signal.aborted) return;
        switch (update.type) {
          case "working":
            setWorking(update.bot);
            break;
          case "handoff":
            setQueue((items) => [...items, update.handoff]);
            break;
          case "complete":
            setSummary(update.summary);
            break;
          case "error":
            setError(update.message);
            break;
        }
      });
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The connection to Grok failed",
        );
    } finally {
      if (controller.current === abort) {
        setRunning(false);
        setWorking(null);
        controller.current = null;
      }
    }
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
        <button className={styles.connect} onClick={checkConnection}>
          <Icon name="plug" />
          {token ? "Grok settings" : "Connect Grok"}
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.heading} aria-labelledby="office-title">
          <div>
            <div className={styles.eyebrow}>
              <span
                className={`${styles.dot} ${mode === "grok" ? styles.grokDot : ""}`}
              />
              {mode === "demo"
                ? "Demo office · simulated activity"
                : running
                  ? "Grok team · working on your brief"
                  : "Grok team · session"}
            </div>
            <h1 id="office-title">
              A little world.
              <br className={styles.mobileBreak} /> A working team.
            </h1>
            <p>Follow the work, one desk visit at a time.</p>
          </div>
          <button
            className={styles.primary}
            disabled={running}
            onClick={() => {
              setBriefMode(token ? "grok" : "demo");
              setBriefOpen(true);
            }}
          >
            <Icon name="plus" />
            Give the team a brief
          </button>
        </section>

        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <Icon name="close" />
            </button>
          </div>
        )}

        <div className={styles.officeGrid}>
          <section className={styles.worldPanel} aria-label="Office floor">
            <div className={styles.floorHeading}>
              <span>
                <span className={styles.tinyGrid} aria-hidden="true">
                  ▦
                </span>{" "}
                The main office
              </span>
              <span>
                {team.length} desks <span className={styles.divider}>/</span>{" "}
                plenty of ideas
              </span>
            </div>
            <div className={styles.canvasArea} data-testid="office-world">
              <OfficeCanvas
                handoff={current}
                paused={paused}
                speed={Number(speed)}
                selected={selected}
                onSelect={setSelected}
                onDelivered={delivered}
                onSettled={settled}
              />
            </div>
            <div className={styles.worldToolbar}>
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
              <span className={styles.sceneHint}>
                {paused
                  ? "Office paused"
                  : "Select a teammate to see their work"}
              </span>
            </div>
          </section>

          <aside className={styles.sidebar} aria-label="Team and activity">
            <Tabs.Root defaultValue="team" className={styles.tabs}>
              <Tabs.List
                className={styles.tabList}
                aria-label="Office information"
              >
                <Tabs.Trigger className={styles.tab} value="team">
                  On the floor <span>{team.length}</span>
                </Tabs.Trigger>
                <Tabs.Trigger className={styles.tab} value="activity">
                  Activity <span>{history.length}</span>
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="team" className={styles.tabContent}>
                <div className={styles.teamList}>
                  {team.map((bot) => {
                    const walking = current?.from === bot.id;
                    const status = walking
                      ? inTransit
                        ? `Walking to ${botById(current.to).name}`
                        : "Returning to desk"
                      : working === bot.id
                        ? "Working on the brief"
                        : "At their desk";
                    return (
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
                          style={
                            { "--bot-color": bot.color } as React.CSSProperties
                          }
                        >
                          <span className={styles.avatarHead} />
                          <span className={styles.avatarBody} />
                        </span>
                        <span className={styles.botInfo}>
                          <span className={styles.botName}>
                            {bot.name}
                            <span className={styles.role}>{bot.role}</span>
                          </span>
                          <span
                            className={
                              walking ? styles.walking : styles.botStatus
                            }
                          >
                            {status}
                          </span>
                        </span>
                        <span className={styles.rowArrow} aria-hidden="true">
                          ›
                        </span>
                      </button>
                    );
                  })}
                </div>
                {inspected ? (
                  <div className={styles.inspector}>
                    <div className={styles.inspectorHeader}>
                      <h2>{inspected.name}&apos;s desk</h2>
                      <button
                        className={styles.iconButton}
                        aria-label="Close teammate details"
                        onClick={() => setSelected(null)}
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                    <p>{inspected.description}</p>
                    <span className={styles.meta}>
                      {history.filter((h) => h.from === inspected.id).length}{" "}
                      handoffs delivered
                    </span>
                    <div className={styles.relatedMessages}>
                      {history
                        .filter(
                          (h) =>
                            h.from === inspected.id || h.to === inspected.id,
                        )
                        .slice(-2)
                        .reverse()
                        .map((h) => (
                          <button key={h.id} onClick={() => setMessage(h)}>
                            {botById(h.from).name} → {botById(h.to).name}
                            <span>{h.message}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.teamNote}>
                    <span className={styles.smallRule} />
                    <h2>A desk for every kind of work</h2>
                    <p>
                      Books for the librarian. A microscope for the researcher.
                      A little room for the next idea.
                    </p>
                  </div>
                )}
              </Tabs.Content>
              <Tabs.Content value="activity" className={styles.tabContent}>
                <div className={styles.activityList}>
                  {history.length ? (
                    [...history].reverse().map((h) => (
                      <button
                        className={styles.activityItem}
                        key={h.id}
                        onClick={() => setMessage(h)}
                      >
                        <span className={styles.meta}>
                          {h.source === "demo" ? "Demo" : "Grok"} · Delivered
                        </span>
                        <strong>
                          {botById(h.from).name}{" "}
                          <span aria-hidden="true">→</span> {botById(h.to).name}
                        </strong>
                        <span className={styles.excerpt}>{h.message}</span>
                      </button>
                    ))
                  ) : (
                    <div className={styles.empty}>
                      <h2>The first handoff is on its way</h2>
                      <p>
                        Messages appear here when a teammate reaches the other
                        desk.
                      </p>
                    </div>
                  )}
                </div>
              </Tabs.Content>
            </Tabs.Root>
            <div className={styles.transit} aria-live="polite">
              <span className={styles.meta}>
                {current
                  ? inTransit
                    ? "In transit"
                    : "Delivered · heading home"
                  : working
                    ? "At work"
                    : "Between handoffs"}
              </span>
              {current ? (
                <>
                  <strong>
                    {botById(current.from).name} <Icon name="arrow" />{" "}
                    {botById(current.to).name}
                  </strong>
                  <button onClick={() => setMessage(current)}>
                    {inTransit ? "A message is on its way" : "Read the handoff"}
                    <span aria-hidden="true">↗</span>
                  </button>
                </>
              ) : (
                <>
                  <strong>
                    {working
                      ? `${botById(working).name} is thinking`
                      : "A moment at the desk"}
                  </strong>
                  <p>Good work starts with a conversation</p>
                </>
              )}
              {queue.length > 1 && (
                <span className={styles.queueCount}>
                  {queue.length - 1} more handoffs queued
                </span>
              )}
            </div>
          </aside>
        </div>

        <section className={styles.belowFloor} aria-label="Session information">
          <div>
            <span className={styles.dot} />
            <span>
              {mode === "demo"
                ? "A sample team, getting things done"
                : running
                  ? "Grok is working; desk visits play in order"
                  : "Grok session"}
            </span>
          </div>
          <span>
            {history.length} delivered <span className={styles.divider}>/</span>{" "}
            {paused ? "Paused" : `${speed}× playback`}
          </span>
        </section>
        {summary && (
          <section className={styles.summary}>
            <span className={styles.meta}>Atlas · Final response</span>
            <h2>The team&apos;s take</h2>
            <p>{summary}</p>
            {queue.length > 0 && (
              <span className={styles.meta}>
                The answer is ready. Remaining desk visits are still playing.
              </span>
            )}
          </section>
        )}
        <footer className={styles.footer}>
          <span>Made for watching the work happen</span>
          <span>
            Grok / Office <span className={styles.divider}>·</span> Floor 01
          </span>
        </footer>
      </main>

      <Dialog.Root open={connectOpen} onOpenChange={setConnectOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.dialog}>
            <CloseButton />
            <span className={styles.dialogKicker}>Bring the team online</span>
            <Dialog.Title>Connect Grok</Dialog.Title>
            <Dialog.Description>
              Grok runs on the server. Your xAI API key never belongs in this
              browser.
            </Dialog.Description>
            <div className={styles.connectionState}>
              <span className={styles.dot} />
              <span>
                {connection
                  ? connection.configured
                    ? `Server configured · ${connection.model}`
                    : "Server needs an xAI key and office access token"
                  : "Checking server configuration…"}
              </span>
            </div>
            <p className={styles.help}>
              Set up the server using the repository&apos;s README, then enter
              its office access token here. The token stays in this tab&apos;s
              memory.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setToken(tokenDraft.trim());
                setConnectOpen(false);
              }}
            >
              <label htmlFor="office-token">Office access token</label>
              <input
                id="office-token"
                type="password"
                autoComplete="off"
                value={tokenDraft}
                onChange={(event) => setTokenDraft(event.target.value)}
                placeholder="Your office token"
                maxLength={256}
              />
              <div className={styles.dialogActions}>
                <Dialog.Close className={styles.secondary}>Cancel</Dialog.Close>
                <button
                  className={styles.primary}
                  disabled={!tokenDraft.trim()}
                >
                  Use this token
                </button>
              </div>
            </form>
            <p className={styles.help}>
              A token is checked when you run a brief. Each run makes up to six
              xAI API calls and uses your account credits.
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={briefOpen} onOpenChange={setBriefOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.dialog}>
            <CloseButton />
            <span className={styles.dialogKicker}>Something to work on</span>
            <Dialog.Title>Give the team a brief</Dialog.Title>
            <Dialog.Description>
              Tell the team what you want to figure out. They&apos;ll pass the
              work from desk to desk.
            </Dialog.Description>
            <form onSubmit={startBrief}>
              <Tabs.Root value={briefMode} onValueChange={setBriefMode}>
                <Tabs.List className={styles.modeTabs} aria-label="Run mode">
                  <Tabs.Trigger value="demo" className={styles.modeTab}>
                    Demo rehearsal
                  </Tabs.Trigger>
                  <Tabs.Trigger value="grok" className={styles.modeTab}>
                    Real Grok team
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>
              <p className={styles.help}>
                {briefMode === "demo"
                  ? "Sample messages rehearse the desk visits. Connect Grok to get real answers to your brief."
                  : "Six role-specific Grok calls work on your brief. No browsing, code execution, or external messages."}
              </p>
              <label htmlFor="brief">The brief</label>
              <textarea
                id="brief"
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                minLength={10}
                maxLength={2000}
                required
                placeholder="Help me plan a small community book exchange…"
                rows={5}
              />
              <span className={styles.characterCount}>
                {brief.length} / 2,000
              </span>
              {briefMode === "grok" && !token && (
                <p className={styles.help}>
                  Connect Grok and enter your office token before running a real
                  brief.
                </p>
              )}
              <div className={styles.dialogActions}>
                <Dialog.Close className={styles.secondary}>Cancel</Dialog.Close>
                <button
                  className={styles.primary}
                  disabled={
                    brief.trim().length < 10 || (briefMode === "grok" && !token)
                  }
                >
                  {briefMode === "demo"
                    ? "Rehearse the handoffs"
                    : "Run Grok · up to 6 calls"}
                  <Icon name="arrow" />
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={Boolean(message)}
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
              {message?.source === "demo"
                ? "Simulated conversation"
                : "Grok conversation"}
            </span>
            <Dialog.Title>
              {message
                ? `${botById(message.from).name} → ${botById(message.to).name}`
                : "Handoff"}
            </Dialog.Title>
            <Dialog.Description>
              {message && history.some((h) => h.id === message.id)
                ? "Delivered at the desk"
                : "In transit to the desk"}
            </Dialog.Description>
            <p className={styles.messageBody}>{message?.message}</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Tooltip.Provider>
  );
}
