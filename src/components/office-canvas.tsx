"use client";

import { useEffect, useRef, useState } from "react";
import type { Texture as PixiTexture } from "pixi.js";
import {
  drawOffice,
  officeMetrics,
  project,
  spriteForRole,
} from "@/lib/office/art";
import { layoutOffice } from "@/lib/office/layout";
import { advanceTrip, createTrip, type Trip } from "@/lib/office/simulation";
import { type OfficeCanvasProps } from "@/lib/office/team";
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
    const roster = props.roster;
    const layout = layoutOffice(roster);
    const { width: officeWidth, height: officeHeight } = officeMetrics(layout);
    const screenPoint = (point: { x: number; y: number }) =>
      project(point, layout);
    setStatus("Arranging the office…");
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
        width: officeWidth,
        height: officeHeight,
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
      let background: PixiTexture | undefined;
      let observer: ResizeObserver | undefined;
      cleanup = () => {
        observer?.disconnect();
        delete host.dataset.ready;
        delete host.dataset.teamSize;
        delete host.dataset.rooms;
        delete host.dataset.floorWidth;
        delete host.dataset.floorDepth;
        delete host.dataset.headOffices;
        app.destroy(true, {
          children: true,
          texture: false,
          textureSource: false,
        });
        for (const frame of ownedFrames) frame.destroy(false);
        background?.destroy(true);
      };
      const textures = await Promise.all(
        roster.map((bot) =>
          Assets.load<PixiTexture>(`/office/${spriteForRole[bot.role]}.png`),
        ),
      );
      if (cancelled) return;
      textures.forEach((texture) => {
        texture.source.scaleMode = "nearest";
      });
      const world = new Container();
      app.stage.addChild(world);
      background = Texture.from(drawOffice(roster));
      background.source.scaleMode = "nearest";
      world.addChild(new Sprite(background));
      const characters = new Container();
      characters.sortableChildren = true;
      world.addChild(characters);

      const bots = roster.map((bot, index) => {
        const container = new Container();
        const ring = new Graphics()
          .ellipse(0, 1, 12, 5)
          .stroke({ color: 0x526a70, width: 1.5 });
        container.addChild(ring);
        const frames = Array.from(
          { length: 4 },
          (_, frame) =>
            new Texture({
              source: textures[index].source,
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
        const scale = Math.min(width / officeWidth, height / officeHeight);
        world.scale.set(scale);
        world.position.set(
          (width - officeWidth * scale) / 2,
          (height - officeHeight * scale) / 2,
        );
      };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      host.appendChild(app.canvas);
      app.canvas.setAttribute("aria-hidden", "true");
      host.dataset.ready = "true";
      host.dataset.teamSize = String(roster.length);
      host.dataset.rooms = String(layout.stations.length);
      host.dataset.floorWidth = String(layout.width);
      host.dataset.floorDepth = String(layout.depth);
      host.dataset.headOffices = String(
        layout.stations.filter((station) => station.privateOffice).length,
      );
      setStatus("");

      app.ticker.add((ticker) => {
        const current = live.current;
        if (current.roster !== roster) return;
        const handoff = current.handoff;
        if ((handoff?.id ?? null) !== handoffId) {
          handoffId = handoff?.id ?? null;
          trip = handoff ? createTrip(handoff.from, handoff.to, roster) : null;
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
          const screen = screenPoint(position);
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
          const point = screenPoint(trip.position);
          bubble.position.set(
            Math.max(
              4,
              Math.min(
                officeWidth - bubble.width - 4,
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
          "The office renderer could not start. Try another browser or check its graphics settings to watch the team's desk visits.",
        );
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [props.roster]);

  return (
    <div
      className={styles.host}
      role="group"
      aria-label={`Isometric pixel office with ${props.roster.length} role-specific departments${props.roster.some((bot) => bot.role === "Coordinator") ? " and a private head office" : ""}. Teammates walk to one another's desks to deliver messages.`}
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
