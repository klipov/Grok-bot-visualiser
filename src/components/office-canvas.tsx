"use client";

import { useEffect, useRef, useState } from "react";
import type { Texture as PixiTexture } from "pixi.js";
import { OFFICE_HEIGHT, OFFICE_WIDTH, project } from "@/lib/office/art";
import { advanceTrip, createTrip, type Trip } from "@/lib/office/simulation";
import { team, type OfficeCanvasProps } from "@/lib/office/team";
import styles from "./office-canvas.module.css";

export default function OfficeCanvas(props: OfficeCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  const [status, setStatus] = useState("Loading the office…");

  useEffect(() => {
    live.current = props;
  }, [props]);

  useEffect(() => {
    const host = hostRef.current!;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const dispose = () => {
      const teardown = cleanup;
      cleanup = undefined;
      teardown?.();
    };

    async function initialize() {
      const {
        Application,
        Assets,
        Container,
        Graphics,
        Rectangle,
        Sprite,
        Text,
        Texture,
      } = await import("pixi.js");
      if (cancelled) return;
      const app = new Application();
      await app.init({
        width: OFFICE_WIDTH,
        height: OFFICE_HEIGHT,
        antialias: false,
        background: "#bfe8ef",
        resolution: 1,
        roundPixels: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      const ownedFrames: PixiTexture[] = [];
      let observer: ResizeObserver | undefined;
      cleanup = () => {
        observer?.disconnect();
        delete host.dataset.ready;
        app.destroy(true, {
          children: true,
          texture: false,
          textureSource: false,
        });
        for (const frame of ownedFrames) frame.destroy(false);
      };
      const textures = await Promise.all([
        Assets.load<PixiTexture>("/office/office.png"),
        ...team.map((bot) => Assets.load<PixiTexture>(`/office/${bot.id}.png`)),
      ]);
      if (cancelled) return;
      textures.forEach((texture) => {
        texture.source.scaleMode = "nearest";
      });
      const world = new Container();
      app.stage.addChild(world);
      world.addChild(new Sprite(textures[0]));
      const characters = new Container();
      characters.sortableChildren = true;
      world.addChild(characters);

      const bots = team.map((bot, index) => {
        const container = new Container();
        const ring = new Graphics()
          .ellipse(0, 1, 12, 5)
          .stroke({ color: 0x526a70, width: 1.5 });
        container.addChild(ring);
        const frames = Array.from(
          { length: 4 },
          (_, frame) =>
            new Texture({
              source: textures[index + 1].source,
              frame: new Rectangle(frame * 32, 0, 32, 40),
            }),
        );
        ownedFrames.push(...frames);
        const sprite = new Sprite(frames[0]);
        sprite.anchor.set(15 / 32, 35 / 40);
        container.addChild(sprite);
        const name = new Text({
          text: bot.name,
          style: {
            fontFamily: "monospace",
            fontSize: 8,
            fontWeight: "600",
            fill: 0x344c5a,
          },
          resolution: 2,
        });
        name.anchor.set(0.5, 0);
        name.position.set(0, 8);
        const namePlate = new Graphics()
          .roundRect(-name.width / 2 - 4, 6, name.width + 8, 13, 2)
          .fill({ color: 0xfff8df, alpha: 0.94 });
        container.addChild(namePlate, name);
        container.eventMode = "static";
        container.cursor = "pointer";
        container.hitArea = new Rectangle(-14, -35, 28, 54);
        container.on("pointertap", () => live.current.onSelect(bot.id));
        characters.addChild(container);
        return { bot, container, sprite, frames, ring, namePlate };
      });

      const bubble = new Container();
      const bubblePanel = new Graphics();
      const bubbleText = new Text({
        text: "",
        style: {
          fontFamily: "monospace",
          fontSize: 8,
          fill: 0x344c5a,
          wordWrap: true,
          wordWrapWidth: 142,
          lineHeight: 11,
        },
        resolution: 2,
      });
      bubbleText.position.set(7, 5);
      bubble.addChild(bubblePanel, bubbleText);
      bubble.visible = false;
      world.addChild(bubble);

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      let trip: Trip | null = null;
      let handoffId: string | null = null;
      let elapsed = 0;
      const resize = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        app.renderer.resize(width, height);
        const scale = Math.min(width / OFFICE_WIDTH, height / OFFICE_HEIGHT);
        world.scale.set(scale);
        world.position.set(
          (width - OFFICE_WIDTH * scale) / 2,
          (height - OFFICE_HEIGHT * scale) / 2,
        );
      };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      host.appendChild(app.canvas);
      app.canvas.setAttribute("aria-hidden", "true");
      host.dataset.ready = "true";
      setStatus("");

      app.ticker.add((ticker) => {
        const current = live.current;
        const handoff = current.handoff;
        if ((handoff?.id ?? null) !== handoffId) {
          handoffId = handoff?.id ?? null;
          trip = handoff ? createTrip(handoff.from, handoff.to) : null;
        }
        const delta = ticker.deltaMS * current.speed;
        if (!current.paused) elapsed += delta;
        const events = trip ? advanceTrip(trip, delta, current.paused) : [];
        const phase = trip?.phase ?? "idle";
        if (host.dataset.phase !== phase) host.dataset.phase = phase;
        for (const {
          bot,
          container,
          sprite,
          frames,
          ring,
          namePlate,
        } of bots) {
          const isSender = handoff?.from === bot.id && trip !== null;
          const position = isSender ? trip!.position : bot.home;
          const screen = project(position);
          container.position.set(Math.round(screen.x), Math.round(screen.y));
          container.zIndex = position.x + position.y;
          const walking =
            isSender &&
            (trip!.phase === "outbound" || trip!.phase === "returning");
          sprite.texture =
            frames[
              walking && !reducedMotion ? Math.floor(elapsed / 150) % 4 : 0
            ];
          ring.visible = current.selected === bot.id;
          namePlate.alpha = current.selected === bot.id ? 1 : 0.86;
        }
        bubble.visible = !!handoff && trip?.phase === "visiting";
        if (bubble.visible && handoff && trip) {
          const message = handoff.message.replace(/\s+/g, " ").trim();
          const preview =
            message.length > 70 ? `${message.slice(0, 67)}…` : message;
          if (bubbleText.text !== preview) {
            bubbleText.text = preview;
            const height = bubbleText.height + 10;
            const width = Math.max(70, bubbleText.width + 14);
            bubblePanel
              .clear()
              .roundRect(0, 0, width, height, 3)
              .fill(0xfff8df)
              .stroke({ color: 0xb5a27d, width: 1 });
            bubblePanel
              .poly([
                width / 2 - 3,
                height,
                width / 2 + 3,
                height,
                width / 2,
                height + 5,
              ])
              .fill(0xfff8df);
          }
          const point = project(trip.position);
          bubble.position.set(
            Math.max(
              4,
              Math.min(
                OFFICE_WIDTH - bubble.width - 4,
                point.x - bubble.width / 2,
              ),
            ),
            point.y - 41 - bubble.height,
          );
        }
        if (handoff) {
          for (const event of events) {
            if (event === "delivered") current.onDelivered(handoff.id);
            if (event === "settled") current.onSettled(handoff.id);
          }
        }
      });
    }

    void initialize().catch(() => {
      dispose();
      if (!cancelled)
        setStatus(
          "The office renderer could not start. Try reloading in a browser with WebGL enabled; the team and messages are still available below.",
        );
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return (
    <div
      className={styles.host}
      role="img"
      aria-label="Isometric pixel office. Five Grok teammates walk to one another's desks to deliver messages."
    >
      <div ref={hostRef} className={styles.surface} />
      {status ? (
        <p className={styles.notice} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
