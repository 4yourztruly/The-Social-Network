# The Social Network

**[Play it here](https://4yourztruly.github.io/The-Social-Network/)**

A web-based social-media life sim: you play a professional footballer with a
Twitter/X-style profile, living inside a feed of NPCs (teammates, fans,
journalists, rivals, a transfer insider, a tabloid). Fully playable offline,
no backend, no account, no cost. See [`PROJECT_SPEC.md`](./PROJECT_SPEC.md)
for the full design.

The world (club, players, media personas) is entirely fictional and
data-driven — see `src/content/`.

## Stack

React 19 + TypeScript (strict) + Vite, Zustand, Dexie (IndexedDB), Tailwind
CSS v4, TanStack Virtual, zod, vite-plugin-pwa, Vitest.

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build      # typecheck + production build
npm run preview    # preview the production build locally
npm run test       # run the Vitest suite once
npm run test:watch # run Vitest in watch mode
npm run lint        # oxlint
```

## Project status

Building milestone by milestone per the spec (section 14). Current state:

- [x] **Milestone 1 — Skeleton:** player profile, NPC profiles, virtualized
      feed with seeded NPC posts, follow/unfollow, IndexedDB persistence,
      save export/import, PWA manifest + service worker, light/dark/system
      theme.
- [x] **Milestone 2 — Composer and comments:** structured composer, keyword
      tagger, deterministic seeded-RNG reaction engine, template pools with
      anti-repetition, staggered comments, likes/reposts/follower growth,
      post threads with player replies, outcome banner with stat deltas.
- [x] **Milestone 3 — Game clock, scheduler, stories, media personas:**
      stories row with 24h expiry, a scheduler tick, media personas
      (tabloid/insider/match reporter) that can leak coverage of risky
      activities and events.
- [x] **Milestone 4 — DMs:** inbox, deterministic + AI-backed replies,
      typing indicator, relationship effects.
- [x] **Milestone 5 — Event scenes:** player-authored Activities (a scene
      with one or more people you follow, choices, an AI-narrated or
      templated outcome) and the Event button (a quick random encounter
      with variable outcomes).
- [x] **Milestone 6 — AI layer:** bring-your-own free-tier key (Settings),
      client-side budget limiter, AI-backed DM replies, post comments,
      Activity narration and media coverage — every AI path has a
      deterministic template fallback, so the game is always fully
      playable with AI off.
- [ ] Milestone 7 — Polish, perf pass, deploy docs

Only providers with a genuine free tier are ever offered — no billing, no
credit card, no paid usage. See spec section 8 for the full policy.

## Save data

The game autosaves to IndexedDB in your browser (debounced ~800ms after any
change). Settings → Export save downloads a JSON snapshot (API keys are
always stripped from exports); Import save restores from one. Settings →
Reset world wipes the current save and reseeds a fresh world.

## Deployment

Static build, no backend required.

```bash
npm run build
```

### GitHub Pages (current setup)

`.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages
automatically on every push to `main`. One-time setup on GitHub: Settings →
Pages → Source → **GitHub Actions**. Note this requires the repo to be
public (or a paid GitHub plan) — GitHub Pages isn't available for private
repos on the free tier.

`vite.config.ts` serves the production build from `/The-Social-Network/`
(a GitHub Pages project site's URL, `https://<user>.github.io/<repo>/`) —
`npm run dev` is unaffected and still serves from `/`.

### Alternative: Cloudflare Pages

Works the same way for a private repo, if you'd rather keep this one
private. From this GitHub repo:

1. In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect
   to Git → select this repo.
2. Build command: `npm run build`. Build output directory: `dist`.
3. Deploy. Every push to `main` redeploys automatically.
4. Change `vite.config.ts`'s `base` back to `/` for a Cloudflare Pages/custom-domain deploy (it isn't served from a `/<repo-name>/` subpath).

The deployed site is public by default either way — that's fine, it
contains no secrets and can't incur any cost on its own.

## PWA / installing on iPhone

The app ships a manifest and service worker (via `vite-plugin-pwa`), so it
can be added to the iPhone Home Screen from Safari (Share → Add to Home
Screen) and played offline. Installed web apps are not subject to Safari's
periodic storage cleanup for inactive sites, which regular tabs are.
