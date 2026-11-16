# SPEC.md — Inboxly Frontend Redesign (UI/UX Extensions & Design System Compliance)

**Status: FINALIZED**  
**Date:** 2026-11-16  
**Project:** Inboxly — AI-Powered Email Dashboard (`F:\Ai powered email dashboard`)

---

## 1. Objective

Redesign the entire React 18 + Tailwind CSS v4 frontend (`client/src/`) of Inboxly by strictly applying every installed UI/UX and engineering extension:
1. **`image-to-code` (`web-design-playwright-suite`)**: Image-first workflow (generate standalone section/view design reference images first, deeply analyze them, extract tokens, then implement).
2. **`awesome-design` (`web-design-playwright-suite`)**: Synthesize **Vercel** (`Geist` + `Geist Mono`, `#171717` / `#FFFFFF` / `#FAFAFA` / `#EBEBEB` hairline precision), **Superhuman** (`#FAF9F6` warm editorial calm, `#0E3030` deep-teal closing band), and **Linear/Resend** (surface hierarchy, zero decorative clutter).
3. **`design-taste-frontend` (`tasteskill 2.5.1`)**:
   - Zero violet or lavender (`indigo-*` / `violet-*` removed completely).
   - Real full-color SVG brand icons for Gmail, Microsoft Outlook, and API bridge (`ProviderMark`).
   - Pulsing hub-and-lanes SVG triage diagram (`data-diagram`).
   - Hover micro-interactions (`-2px` card lift, button press `scale(0.98)`, `data-enter` hero entrance).
4. **`landing-page-design` (`ai-design-skills`)**:
   - **B1 Typography:** `Geist` + `Geist Mono` only (remove `Inter` and `Plus Jakarta Sans`), zero italics (`not-italic`), zero ultra-bold (`font-extrabold` / `800` / `900` banned; cap at `600` Semibold / `700` Bold), named text style classes (`heading-1`..`heading-6`, `title-1`..`title-5`, `body-1`..`body-6`, `button-lg`..`button-xsm`, `caption-1`..`caption-5`), `text-balance` on headings, `text-pretty` on body copy, and **zero hyphens (`-` / `—`) in prose, headings, or labels**.
   - **B2 Spacing:** Strictly from the spacing token scale (`0, 2px, 4px, 8px, 12px, 16px, 24px, 32px, 40px, 48px, 64px, 80px, 96px`); main buttons use `8px` vertical / `12px` horizontal padding.
   - **B3 Nested Radius:** `inner radius = outer radius - gap` when gap `< 32px`.
   - **B4 Borders & Backgrounds:** Full all-around borders on cards (never single-sided `border-l` on cards), flat backgrounds only (zero background gradients).
   - **B5 Hero Section:** Left-to-right text gradient on the Hero heading (`#000000` -> `#666666`), heading and subheading capped at `max-w-[680px]` with intentional line breaks.
   - **B6 Icons:** Custom Phosphor/Solar-style clean stroke icons + authentic full-color provider marks.
   - **B7 Motion & Navigation:** `cubic-bezier(0.22, 1, 0.36, 1)` deceleration curve (`500ms` layout, `300ms` color/opacity), floating translucent top navbar, `IntersectionObserver` scroll reveals, `prefers-reduced-motion` compliance.
   - **B10 & B11 Ship Requirements:** Mandatory **Word-by-Word Scroll Tagline Reveal Section**, 3-step How It Works, Benefits, 6-item FAQ, skip-to-content link, Privacy/Terms modal, and branded 404 route.
5. **`react-best-practices` (`vercel-plugin`)**: Hoisted static data, no inline child component definitions, parallel async fetches, passive/IntersectionObserver animations, zero inline `style=` attributes (preserving strict production CSP `style-src 'self' https://fonts.googleapis.com`).

---

## 2. Non-Negotiable Constraints

- Preserve all existing backend API contracts (`/api/auth/*`, `/api/accounts/*`, `/api/conversations/*`, `/api/ai/query`, `/api/notifications/*`) and all `26/26` passing Vitest backend/security tests.
- Maintain `0` JSX `style=` attributes across `client/src/` for strict production CSP compatibility.
- Keep live production MongoDB Atlas inbox at **`0` messages** (`All active · 0`).
- Push all commits to GitHub `origin/master` and deploy to Render (`srv-dbst3poae00c7390mg2g`).
