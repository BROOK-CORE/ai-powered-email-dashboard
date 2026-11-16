# ROADMAP.md — Inboxly Frontend Redesign

**Status:** Active  
**Spec:** [.gsd/SPEC.md](./SPEC.md) (`FINALIZED`)

---

## Phase 1: Image-First Design Reference Generation & Deep Visual Analysis (`image-to-code`)
- Generate standalone high-resolution UI design reference images for:
  1. Landing & Workspace Entry (`/login` hero, live triage `app-frame`, tagline reveal, architecture diagram)
  2. Assistant Command Center (`/assistant` 3-pane layout, KPI strip, AI insights, composer)
  3. Executive Decision Portal (`/client` calm single-column decision cards, one-tap chips, voice brief)
- Inspect each image with `read_file` and extract typography, spacing, surface hierarchy, and component specs.

## Phase 2: Design System Foundation (`index.html`, `index.css`, `ui.jsx`)
- Replace `Inter` / `Plus Jakarta Sans` with `Geist` and `Geist Mono` in `client/index.html`.
- Implement all 27 named text styles (`heading-1`..`caption-5`), flat surface tokens (`#FFFFFF`, `#FAFAFA`, `#F4F4F5`, `#171717`, `#0E3030`), `cubic-bezier(0.22, 1, 0.36, 1)` motion curve, hero text gradient, and reduced-motion rules in `client/src/index.css`.
- Upgrade `client/src/components/ui.jsx`:
  - Full-color authentic SVG marks for Gmail, Outlook, and API bridge (`ProviderMark`).
  - Non-violet semantic responsibility badges (`Cobalt #0070F3` Assistant, `Amber #D97706` Client, `Stone #52525B` No reply).
  - Compliant button system (`8px` vertical / `12px` horizontal padding, `active:scale-[0.98]`), accessible modals, drawers, skeletons, and toasts.

## Phase 3: High-Converting Landing & Authentication Experience (`Login.jsx`, `Onboarding.jsx`, `App.jsx`)
- Redesign `Login.jsx` following `landing-page-design` + `design-taste-frontend` + `awesome-design` (Vercel/Superhuman):
  - Skip-to-content link + floating translucent compact navbar.
  - Above-the-fold Hero (`max-w-[680px]` `#000000 -> #666666` text-gradient headline, outcome copy with zero hyphens, 1-click Demo Assistant / Demo Client + Email Sign-In/Register workspace card, live interactive `app-frame` triage preview).
  - Mandatory **B11 Word-by-Word Scroll Tagline Reveal Section** (`IntersectionObserver`).
  - Interactive SVG Hub-and-Lanes Triage Diagram (`data-diagram`) + 3 outcome-driven Benefit cards.
  - 3-Step How It Works + 6-Question FAQ + Superhuman Deep-Teal (`#0E3030`) Final CTA band + Footer with Privacy/Terms modal.
- Redesign `Onboarding.jsx` and `ConnectWizard.jsx` (nested radius compliance, non-violet tokens, hyphen-free copy).
- Add branded 404 NotFound view in `App.jsx`.

## Phase 4: Assistant Command Center, Executive Client Portal & Mailbox Manager (`Assistant.jsx`, `ThreadList.jsx`, `ThreadDetail.jsx`, `CopilotDrawer.jsx`, `SimulateModal.jsx`, `NotificationBell.jsx`, `Client.jsx`, `Accounts.jsx`)
- Redesign `/assistant` 3-pane command center and child components (`ThreadList`, `ThreadDetail`, `CopilotDrawer`, `SimulateModal`, `NotificationBell`) with Vercel/Linear hairline borders (`#EBEBEB`), `Geist Mono` tabular KPIs, full-border cards, and hyphen-free copy.
- Redesign `/client` executive portal (`Client.jsx`) and `/accounts` (`Accounts.jsx`) with Superhuman calm editorial warmth, nested radius formula, `.animate-pulse-ring` voice dictation, and `-2px` hover micro-interactions.

## Phase 5: Empirical Verification, GitHub Push & Live Render Deployment
- Verify `0` inline `style=` attributes, `0` `font-extrabold`/`font-black`/`italic` classes, `26/26` Vitest tests, and clean Vite production build.
- Run real browser verification (`web-design-guidelines` + `playwright-cli` / browser subagent at `1440px` and `390px` mobile widths) with screenshots.
- Commit, push to `origin/master`, deploy to Render (`srv-dbst3poae00c7390mg2g`), and verify live production with `0` messages preserved.
