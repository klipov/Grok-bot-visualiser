---
title: Grok pixel office - Plan
date: 2026-11-22
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Grok pixel office - Plan

## Goal Capsule

Users can watch a Grok team work in a colourful isometric office and follow messages as physical desk visits.
The current task authorizes implementation and local verification, then delivery to the provided GitHub repository.
One feature branch and one PR carry the app; an empty repository needs a minimal base branch first.

## Product Contract

### Summary

Build the approved bright pixel office with five role-specific workspaces, a team inspector, a handoff log, and playable message delivery.
Provide a usable demo and a server-side Grok connection for a user-supplied brief.

### Problem Frame

Text-only agent activity is hard to follow at a glance.
The office gives each role a visible place and makes communication observable.

### Requirements

**Office**

- R1. Match the approved higher-detail, slightly saturated isometric scene, including exaggerated role props and the librarian's book stacks.
- R2. Sending a message makes its sender walk through the open aisle to the receiver's desk, deliver it, and return home.
- R3. Users can inspect bots, read delivered messages, pause the scene, and change playback speed.
- R4. The demo works without credentials and is clearly labelled as simulated activity.

**Grok**

- R5. A brief can run through role-specific server-side Grok calls, producing the same handoff events as the demo.
- R6. Provider keys stay on the server; paid requests require an office access token and validated inputs.
- R7. Connection failures and partial runs are visible; the UI never represents demo output as real Grok output.

### Key Decisions

- Bright isometric pixel art follows the approved preview. Governs R1 (session-settled: user-approved — chosen over the muted, lower-detail first preview).
- Physical desk visits express communication. Governs R2 (session-settled: user-directed — chosen over communication shown only as text).

### Acceptance Examples

- AE1. Covers R2: Mira sends Atlas findings; the message remains in transit until Mira reaches Atlas, then appears delivered while Mira returns home.
- AE2. Covers R6: a request without a valid office token never calls xAI.
- AE3. Covers R7: an upstream failure leaves completed handoffs readable and displays an error rather than substituting a demo answer.

### Scope Boundaries

This version is a single office with a fixed five-person team and an application-owned sequential Grok workflow.
It does not observe existing consumer Grok chats, perform external outreach, execute code, or claim to browse sources.
Saved accounts, durable background runs, custom floor editors, and multiplayer offices are deferred.

## Planning Contract

- KTD1. Use Next.js, React, TypeScript, PixiJS, Radix, and CSS Modules as requested; Pixi lives only in a client component.
- KTD2. Keep the simulation independent of the renderer so routing, queueing, and delivery can be tested without WebGL.
- KTD3. Use xAI's Responses API from a Next.js route and stream typed NDJSON events to the browser. See [xAI text generation](https://docs.x.ai/developers/model-capabilities/text-generation).
- KTD4. Orchestrate a bounded sequence of role-specific calls, passing prior outputs as context and emitting explicit handoffs; visual travel is presentation timing and does not delay backend execution.
- KTD5. Require a server-configured office access token for paid calls, compare it in constant time, cap request sizes and output tokens, and cancel upstream requests when the client disconnects.
- KTD6. Keep messages in browser memory and bound the visible history. No database is needed for the first working office.

### Sources

The approved preview is machine-local and best effort at `C:/Users/Johnny/.codex/visualizations/2026/11/22/01a200fc-8fac-7071-bb4b-432344c01ee5/office-preview-v3.png`.
Its rendering source is `office_preview_v2.py` in that directory; missing preview files do not block implementation and these requirements govern disagreements.
PixiJS initialization and ticker follow [the Application guide](https://pixijs.com/8.x/guides/components/application).
Radix supplies accessible dialog, tabs, and selection controls with project styles.

## Implementation Units

### U1. Establish the application and shared simulation

**Goal:** a runnable Next.js workspace with a tested message lifecycle.
**Requirements:** R2, R3, R4.
**Files:** package files, TypeScript config, `src/lib/office/team.ts`, `src/lib/office/simulation.ts`, `tests/simulation.test.ts`.
**Approach:** define the fixed team and a renderer-neutral walking state machine.
**Patterns:** native TypeScript and Node test assertions.
**Test scenarios:** route avoids furniture; arrival delivers once; pause preserves position; queued handoffs settle before starting another.
**Verification:** unit tests and typecheck pass.

### U2. Render and control the pixel office

**Goal:** the approved office runs in Pixi with selectable walking bots.
**Requirements:** R1, R2, R3, R4.
**Dependencies:** U1.
**Files:** `src/components/office-canvas.tsx`, `src/lib/office/art.ts`, `scripts/draw-office.py`, `public/office/`, `src/app/`, `src/components/office.tsx`, CSS Modules, browser tests.
**Approach:** bake original static office art reproducibly and render animated sprites in Pixi over it; React owns the queue and inspector.
**Patterns:** async Pixi initialization with unmount cleanup, Radix controls, responsive CSS.
**Test scenarios:** scene loads; bot selection opens details; delivery updates the log; pause and speed affect travel; mobile has no page overflow.
**Verification:** desktop and mobile browser checks with a real rendered scene.

### U3. Connect Grok and document operation

**Goal:** authenticated briefs produce real role-specific Grok handoffs.
**Requirements:** R5, R6, R7.
**Dependencies:** U1, U2.
**Files:** `src/app/api/`, `src/lib/grok/`, provider tests, `.env.example`, README, CI.
**Approach:** implement KTD3–KTD6, expose configuration status without secrets, and document the exact boundary of the integration.
**Patterns:** platform fetch, Web Streams, server-only environment variables.
**Test scenarios:** missing key; missing or incorrect token; invalid brief; mocked Responses success; partial upstream error; cancellation; UI consumes a mocked stream into walking events.
**Verification:** deterministic provider tests and browser integration pass; real paid provider calls require credentials and are reported separately.

## Verification Contract

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
Browser checks cover 1440px desktop and 390px mobile, delivery timing, controls, accessible dialogs, and mocked Grok streaming.
Do not call the paid provider without supplied credentials.

## Definition of Done

All requirements are implemented, the required checks pass, and the repo contains setup and Grok connection instructions.
Remove abandoned approaches and report any live-provider verification gap.
No secrets or generated build output enter Git.
