# Grok bot visualiser

A small pixel office where Grok teammates take their messages to each other's desks.
Built with Next.js, TypeScript, React, PixiJS, Radix Primitives, and CSS Modules.

## Run it

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The demo needs no account or API key.
Pixi uses the available WebGL, WebGPU, or Canvas renderer; the app displays an error if the graphics cannot start.
For a production build, run `npm run build` then `npm start`.
The local scripts bind to `127.0.0.1`; a hosting platform can use `next start --hostname 0.0.0.0` when it needs an external bind address.

The starter team is Atlas (coordinator), Mira (researcher), Fern (librarian), Kit (engineer), and Reed (outreach).
Open **Team setup** to name and configure 1–12 teammates. Adding or removing members rebuilds the floor to fit them.
Each role has its own department furniture: books and shelves, research equipment, a phone station, engineering monitors, a design studio, an analyst's charts, or a general workspace.
A coordinator is optional and gets a separate, clearly enclosed head office when present. There is no empty head office when the team has no lead.
Team setup stays in this tab until refresh. Applying changes starts a fresh demo and disconnects an active Grok run.
Click a character or a team row to inspect them.
Pause and playback speed control the visual desk visits.
The activity log records a handoff when its sender reaches the other desk, then the sender walks home.

## Connect Grok

1. Create an API key in the [xAI console](https://console.x.ai/).
2. Copy `.env.example` to `.env.local`.
3. Set `XAI_API_KEY`, `XAI_MODEL`, and `OFFICE_ACCESS_TOKEN` on the server.
4. Restart Next.js, open **Connect Grok**, and enter the office access token.
5. Choose **Give the team a brief**, select **Real Grok team**, and run it.

Generate an office token with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`XAI_MODEL` defaults to `grok-4.7`, as listed in the provider documentation when the integration was written.
Set it to a Responses-compatible text model available to your account.
Never use a `NEXT_PUBLIC_` variable for either secret.
The browser holds the office token only in memory until the tab is reloaded; it never receives the xAI key.
The token is checked on every paid request, rather than merely hidden behind a button.

### How the team connects

This app orchestrates its own team through [xAI's Responses API](https://docs.x.ai/developers/tools/function-calling).
It does not inspect conversations or an existing team inside the consumer Grok website.
Each role is a separate call with its own instructions and the previous roles' notes as context.
The server uses the selected team, ordering its roles through planning, research, organisation, analysis, implementation, design, and outreach as applicable.
If a coordinator exists, they open and close the workflow; otherwise the last selected specialist provides the final answer.
The starter sequence is Atlas → Mira → Fern → Kit → Reed → Atlas.
A run makes one call per selected teammate, plus one closing coordinator call when there are colleagues: at most 13 calls, with a 900-output-token limit per call and a 2,000-character brief limit.
The brief dialog shows the actual call limit for the current team before submission.
API use is charged to your xAI account.

The Next.js route emits newline-delimited JSON as work progresses:

```ts
{ type: "working", bot: "mira" }
{ type: "handoff", handoff: { id: "run-1", from: "mira", to: "fern", message: "...", source: "grok" } }
{ type: "complete", summary: "..." }
```

React queues the handoffs and PixiJS animates them in order.
Model execution continues while the desk visits play; pausing the office pauses animation, not provider billing or the backend run.
**Restart demo** disconnects the current run and clears the session.
Upstream calls receive an abort signal when the request is cancelled, but work already processed by xAI may still be billed.
The final response can arrive before all queued visits finish.
Provider errors appear in the interface and already delivered messages stay readable.

The first integration reasons over the brief and supplied team notes.
It has no web search, filesystem, code execution, email, or external outreach tools.
Role names describe their prompts, not independent persistent agents or tool permissions.
Adding actual tools would use the Responses function-calling loop on the server and emit handoff events at the same boundary.

## Data and hosting

The browser keeps the latest 60 delivered handoffs in memory.
Refreshing clears them; there is no database, account system, or shared live session.
The API sends the brief and team notes to xAI with `store: false`; consult your provider agreement for its data handling terms.
Grok runs are request-bound, not durable jobs, so a deploy or a hosting timeout can interrupt them.
The route asks for a 300-second runtime and enforces a shorter overall timeout, but your hosting plan may impose a lower limit.
Use HTTPS when hosting the app and keep the office token private.
This shared-token version is suitable for a private office; public multi-user hosting needs individual authentication and per-user quotas first.

## Development checks

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Node tests cover the walking lifecycle, cancellation, request authentication, size limits, Responses extraction, partial errors, and streaming decoding.
Browser tests render the real Pixi canvas at desktop and mobile sizes, exercise controls and dialogs, and turn a mocked Grok stream into a delivered message.
They make no paid provider calls.
Live provider verification requires an xAI key, account credits, and a supported model.

## Artwork

The office is assembled from original code-drawn rooms at runtime, using the selected roster and roles.
Character sprites are committed under `public/office/`.
They render locally without an image service.
To regenerate them, install Pillow and run:

```sh
python -m pip install Pillow
python scripts/draw-office.py
```

The saturated isometric art uses larger sprites and more prop detail rather than a hardware “bit” limit.
Room geometry and furniture are drawn once for each roster into a scene texture; moving characters remain separate Pixi sprites.
Visual direction was refined using [unslop by Damir Sokolovsky](https://heydamir.design/unslop), licensed under CC BY 4.0.
