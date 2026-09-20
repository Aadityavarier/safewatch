# SENTINEL

**Community-Driven Early-Warning System for Public Space Safety**

> *"The Warning Sign Everyone Walked Past" — CodeX 2026, Problem Statement CX1001*

[![Status](https://img.shields.io/badge/status-prototype-orange)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Built with](https://img.shields.io/badge/stack-Next.js%20%7C%20Supabase%20%7C%20Vercel-black)]()

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Core Concept](#3-core-concept)
4. [Key Features](#4-key-features)
5. [System Architecture](#5-system-architecture)
6. [Tech Stack](#6-tech-stack)
7. [Data Model](#7-data-model)
8. [Anonymous Identity Design](#8-anonymous-identity-design)
9. [Anti-Gaming Detection Engine](#9-anti-gaming-detection-engine)
10. [Application Structure](#10-application-structure)
11. [Getting Started](#11-getting-started)
12. [Environment Variables](#12-environment-variables)
13. [API & Edge Functions](#13-api--edge-functions)
14. [Privacy & Safety Design](#14-privacy--safety-design)
15. [Development Roadmap](#15-development-roadmap)
16. [Team](#16-team)
17. [Feasibility Notes](#17-feasibility-notes)
18. [Known Limitations](#18-known-limitations)
19. [References & Disclosure](#19-references--disclosure)
20. [License](#20-license)

---

## 1. Overview

**SENTINEL** is a community-driven public safety platform that captures minor, individually
"too small to report" unsafe incidents (catcalling, loitering, following, and similar) at
specific locations, and converts scattered anonymous reports into **verified, statistically
confident early-warning signals** for local authorities — before those incidents escalate
into something serious.

The system combines three functions that today exist only in separate, disconnected tools:

- **Anonymous, low-friction reporting** (tap-to-flag, under 10 seconds, no login)
- **Community-visible incident awareness** (a public, location-tied feed, Reddit-style)
- **Statistically robust pattern detection** that is resistant to being gamed as a
  harassment tool in its own right

SENTINEL was designed and built for **CodeX 2026**, hosted by the Maharashtra University
Students Association (MUSA), under the domain **Women Safety & Social Impact**.

---

## 2. Problem Statement

**PS Code:** CX1001 — *"The Warning Sign Everyone Walked Past"*

Public spaces — markets, station forecourts, university corridors — routinely see a slow
build-up of harassment incidents over weeks: repeated catcalling, someone loitering near the
same spot, each individually "too minor" to formally report. Because no single incident
crosses the threshold for police action, nothing gets escalated — until a serious incident
finally occurs. In hindsight, the pattern was there all along; it was simply never surfaced.

**The core failure mode:**

| Existing solution | Limitation |
|---|---|
| Formal police complaint (FIR) | High friction — no one files paperwork for a "minor" incident |
| SOS / panic-button apps | Only activate *during* an active emergency, not before |
| Helplines (call-based reporting) | Depend on someone judging the incident "serious enough" to call |

None of these aggregate scattered minor incidents into a **spatial-temporal pattern** that
authorities can act on early.

---

## 3. Core Concept

SENTINEL closes this gap with a single operating principle:

> **Timing over severity.** The system does not wait for a severe incident to trigger
> action — it detects the *rising pattern* of minor incidents and acts on the trend itself.

The system in one line:

```
Report / Post (anonymous) → Detect (verified pattern) → Alert + Community Awareness
```

A second, equally important principle governs how the detection engine works:

> **Diversity over volume.** A location's risk score is never a function of raw report
> count. It is a function of how many *distinct* people reported it, how *spread out in
> time* those reports are, and how *varied* the reported incident categories are. This is
> what prevents the platform from being weaponized — a coordinated group flooding a
> location with fake reports barely moves the score.

---

## 4. Key Features

### 4.1 Tap & Flag
- Report an unsafe moment at a specific location in under 10 seconds
- No login, no form — pick a category, confirm the zone, submit
- Categories: Catcalling · Loitering / Staring · Following · Any Unsafe Moment

### 4.2 Post & Discuss (Community Feed)
- Write an anonymous incident post (text + optional photo)
- Other users can confirm ("this happened to me too") or comment
- Reddit-style, but every post is tied to a real, zone-snapped location
- Gives new users and passersby **area-awareness before entering a space**

### 4.3 Live Risk Map
- Interactive map of zones, color-coded by current risk level
  (Normal → Watch → Rising → High)
- Tap any zone to view its flags, posts, comments, and photos in one place

### 4.4 Verified "Rising Pattern" Alerts
- A scheduled backend job scores every zone on a rolling window
- When a zone's score crosses a threshold, an **aggregated, place-only alert**
  (never raw individual data, never names) is pushed to the relevant local authority
  dashboard

### 4.5 Anti-Gaming Protection (built-in, not bolted on)
- Risk scoring rewards **distinct reporters**, **temporal spread**, and
  **category diversity** — not raw report volume
- A flood of reports from one device/identity barely moves the score
- Organic reports from many distinct people, spread across days, drive the score up

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      CLIENT (PWA)                          │
│   Next.js + Tailwind — Feed / Map / Report / Zone Detail   │
└───────────────┬────────────────────────┬───────────────────┘
                │                        │
        Supabase Client SDK       Mapbox / Leaflet SDK
                │                        │
┌───────────────▼────────────────────────▼───────────────────┐
│                         SUPABASE                             │
│  ┌─────────────┐   ┌───────────────┐   ┌──────────────────┐ │
│  │  Postgres   │   │ Auth (anon)   │   │  Storage          │ │
│  │  (data)     │   │ device hash   │   │  (photos)         │ │
│  └─────────────┘   └───────────────┘   └──────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Edge Functions (Deno)                                   │ │
│  │  • scoreZones()   — cron, every 15 min                   │ │
│  │  • onNewFlag()    — trigger, updates zone stats           │ │
│  │  • onNewPost()    — moderation check                      │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────┬───────────────────────────────────────────────┘
                │
          Vercel (hosting + CI/CD)
                │
┌───────────────▼───────────────────────┐
│   Authority Dashboard (/admin route)    │
│   Aggregated, zone-level alerts only    │
└──────────────────────────────────────────┘
```

**Design rationale:** Supabase (Postgres + Auth + Storage + Edge Functions) covers the
entire backend surface area without a separate application server, keeping the system fast
to build, deploy, and scale on free-tier infrastructure.

### 5.1 Request Flow (Tap → Alert)

| Step | Component | Responsibility |
|---|---|---|
| 1 — Tap & Report | Reporting PWA | One tap, no login; category selection; anonymous token generation; GPS snapped to nearest predefined zone |
| 2 — Ingest API | Secure Backend | Validates the report, blocks spam/bot patterns, hashes the device ID, writes to the database |
| 3 — Detect | Pattern Engine | Groups reports by zone + time window; scores reporter diversity; filters coordinated floods; produces a confidence-weighted risk score |
| 4 — Alert | Authority Dashboard | Displays rising-risk zones on a map; shows zone + time trend; never displays names or individual report identities |

---

## 6. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | **Next.js 14** (App Router) + **Tailwind CSS** | Installable PWA, fast iteration, SSR where needed |
| Mapping | **Mapbox GL JS** (or Leaflet + OpenStreetMap as free fallback) | Live risk map, zone rendering |
| Backend / Database | **Supabase** (PostgreSQL) | Primary data store |
| Auth | **Supabase Anonymous Auth** / self-rolled hashed device ID | Stable, non-identifying reporter tracking |
| File Storage | **Supabase Storage** | Photo uploads for incident posts |
| Serverless Compute | **Supabase Edge Functions** (Deno runtime) | Scoring engine, moderation checks |
| Scheduling | **pg_cron** / Supabase Scheduled Functions | Runs the anti-misuse scoring job every 15 minutes |
| Hosting / CI-CD | **Vercel** | Frontend deployment |
| PWA Shell | `next-pwa` or manual manifest + service worker | Add-to-homescreen, offline shell |

---

## 7. Data Model

```sql
-- Zones: predefined lane/spot segments, never raw GPS points
create table zones (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  lat          float,
  lng          float,
  radius_m     int default 50,
  risk_score   float default 0,
  risk_level   text default 'normal',   -- normal | watch | rising | high
  created_at   timestamptz default now()
);

-- Flags: the "tap" — lightweight, anonymous, feeds the scoring engine
create table flags (
  id             uuid primary key default gen_random_uuid(),
  zone_id        uuid references zones(id),
  category       text,        -- catcalling | loitering | following | other
  reporter_hash  text,        -- hashed anonymous device id (see Section 8)
  created_at     timestamptz default now()
);

-- Posts: the community incident write-up
create table posts (
  id             uuid primary key default gen_random_uuid(),
  zone_id        uuid references zones(id),
  reporter_hash  text,
  body           text,
  photo_url      text,
  upvotes        int default 0,
  created_at     timestamptz default now()
);

-- Comments / confirmations on posts
create table comments (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid references posts(id),
  reporter_hash  text,
  body           text,
  created_at     timestamptz default now()
);

-- Alerts: aggregated, place-only output of the scoring engine
create table alerts (
  id                 uuid primary key default gen_random_uuid(),
  zone_id            uuid references zones(id),
  distinct_reporters int,
  time_spread_days   float,
  category_diversity float,
  risk_score         float,
  risk_level         text,
  created_at         timestamptz default now()
);
```

**Key design choice:** there is no `users` table with identity. `reporter_hash` is the only
per-person reference anywhere in the schema, and it is a rotating, non-reversible hash
(see Section 8) — not a foreign key to any identifiable record.

---

## 8. Anonymous Identity Design

```
1. First app open  → client generates crypto.randomUUID()
2. Store locally    → localStorage / device storage, persists across sessions
3. Before any write → reporter_hash = SHA256(uuid + weekly_salt)
4. weekly_salt       → rotates server-side every 7 days
```

**Why this matters:**

- Same device → same `reporter_hash` **within a given week**, which allows the system to
  count *distinct reporters* accurately without accounts or logins.
- The hash is **not reversible** to the original device UUID server-side.
- The rotating salt means the hash **cannot be used to build a long-term profile** of a
  single reporter across weeks.
- A **cooldown window** (24–48 hrs) prevents a single `reporter_hash` from repeatedly
  flagging the same zone and inflating `distinct_reporters` artificially.

---

## 9. Anti-Gaming Detection Engine

This is the centerpiece of SENTINEL's design and the direct answer to the problem
statement's twist requirement: *the system must resist being gamed as a harassment tool
against an individual.*

### 9.1 What is scored

For every zone, over a rolling 14-day window:

| Metric | Definition | Why it matters |
|---|---|---|
| `distinct_taggers` | Count of unique `reporter_hash` values | The primary anti-flood signal — raw report count is *never* used directly |
| `time_spread_factor` | Normalized variance of report timestamps (0–1) | Distinguishes an organic pattern building over days from a coordinated burst in minutes |
| `category_diversity` | Distinct categories reported ÷ total possible categories | Repeated identical reports are a weaker signal than varied, independently-worded incidents |
| `total_flags` | Raw report count | Tracked and displayed for transparency, but **excluded from the scoring formula entirely** |

### 9.2 Scoring formula

```
risk_score = (distinct_taggers ^ 1.5)
           × time_spread_factor
           × (0.5 + 0.5 × category_diversity)
```

- Raising `distinct_taggers` to a power > 1 rewards breadth of reporters over volume —
  20 reports from 3 people barely moves the score; 8 reports from 8 distinct people does.
- `time_spread_factor` suppresses coordinated bursts (many reports in a 10-minute window)
  relative to naturally occurring reports spread across days.
- `category_diversity` gives partial, not full, weight to category variety, so a genuine
  single-category pattern (e.g. repeated catcalling) is still detectable, just weighted
  slightly lower than a multi-category pattern.

### 9.3 Alert thresholds

```
risk_score > 15  → risk_level = 'high'
risk_score >  8  → risk_level = 'rising'
risk_score >  3  → risk_level = 'watch'
else             → risk_level = 'normal'
```

When a zone crosses into `rising` or `high`, an `alerts` row is created. The authority
dashboard only ever reads from the `alerts` table — it never has direct access to raw,
individual `flags` or `posts` data.

### 9.4 Explicit design boundary

The system **does not claim to fully prevent** determined abuse using multiple devices or
identities. This is a deliberate, stated trade-off: SENTINEL preserves genuine anonymity
(no login, no ID verification) rather than sacrificing it for a marginal gain in fraud
resistance. Soft signals (IP subnet, coarse device fingerprint) are used only as an
additional deterrent layer, never as a hard block.

---

## 10. Application Structure

```
/app
  /feed              → Community page: chronological / trending posts across all zones
  /map               → Live risk map, zones colored by risk_level
  /zone/[id]         → Zone detail: posts, flags, photos, comments for that spot
  /report            → Tap-to-flag flow (category → zone confirm → submit)
  /post/new          → Write an anonymous incident post (text + optional photo)
  /admin             → Authority-only dashboard (protected route, separate auth)

/supabase
  /functions
    scoreZones.ts    → Scheduled scoring engine (runs every 15 min via pg_cron)
    onNewFlag.ts     → Trigger: updates zone-level aggregate stats on new flag
    onNewPost.ts     → Trigger: basic content moderation check on new posts
  /migrations        → SQL schema migrations (see Section 7)
```

---

## 11. Getting Started

### 11.1 Prerequisites

- Node.js ≥ 18
- A Supabase project (free tier is sufficient)
- A Vercel account (for deployment)
- A Mapbox or OpenStreetMap access token (for the map view)

### 11.2 Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/<org>/sentinel.git
cd sentinel

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# fill in the values described in Section 12

# 4. Apply database migrations
npx supabase db push

# 5. Deploy Edge Functions
npx supabase functions deploy scoreZones
npx supabase functions deploy onNewFlag
npx supabase functions deploy onNewPost

# 6. Run the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### 11.3 Deployment

```bash
# Deploy to Vercel
vercel --prod
```

Ensure all environment variables from `.env.local` are also set in the Vercel project
settings before deploying.

---

## 12. Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — used only in Edge Functions, never exposed client-side |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox access token for the live risk map |
| `HASH_SALT_ROTATION_DAYS` | Number of days before the weekly reporter-hash salt rotates (default: `7`) |
| `REPORT_COOLDOWN_HOURS` | Cooldown window before the same device can re-flag a zone (default: `24`) |

---

## 13. API & Edge Functions

### 13.1 `scoreZones` (scheduled, every 15 minutes)

Recomputes `risk_score` and `risk_level` for every zone with activity in the trailing
14-day window, using the formula in Section 9.2. Writes an `alerts` row for any zone that
crosses a threshold for the first time in the current cycle.

### 13.2 `onNewFlag` (database trigger)

Fires on every insert into `flags`. Updates the zone's live `total_flags` counter and
`distinct_taggers` estimate for immediate UI feedback, ahead of the next full scoring cycle.

### 13.3 `onNewPost` (database trigger)

Runs a lightweight moderation check on new posts — keyword filtering to catch content that
names or describes an identifiable individual rather than a place, per the privacy design
in Section 14. Flags such posts for manual review rather than auto-publishing them.

---

## 14. Privacy & Safety Design

| Principle | Implementation |
|---|---|
| No accounts, no PII | No email, phone, or name is ever collected |
| Non-reversible identity | `reporter_hash` cannot be traced back to a device UUID server-side |
| Rotating hash | Weekly salt rotation prevents long-term reporter profiling |
| Place, not people | Every flag, post, and alert is tied to a `zone_id`, never a person |
| No raw data to authorities | The `/admin` dashboard only reads aggregated `alerts` rows |
| Moderation boundary | Posts describing or naming an identifiable individual are flagged for review, not published automatically |

---

## 15. Development Roadmap

| Phase | Scope | Owner |
|---|---|---|
| **Phase 1 — Research & Design** | Map local zones, define incident categories, design app screens | Prathamesh Gaikar, Ninad Veer |
| **Phase 2 — Reporting PWA** | One-tap, no-login report screen; Feed and Map UI | Ninad Veer |
| **Phase 3 — Backend & Database** | Ingestion API, zone geo-snapping, secure storage, photo uploads | Aayush Parab |
| **Phase 4 — Detection Engine** | Rolling-window scoring, reporter diversity weighting, flood filtering | Aaditya Varier |
| **Phase 5 — Authority Dashboard** | Rising-pattern zone map, aggregated place-only alerts | Aaditya Varier, Aayush Parab |
| **Phase 6 — Testing & Demo** | Simulated flood-attack scenario, UI polish, documentation | Prathamesh Gaikar, Aayush Parab |

**Future scope:** campus/station pilot deployment, regional language support, formal
tie-ups with local police and municipal safety bodies.

---

## 16. Team

**Team SENTINEL — CodeX 2026**

| Name | Role |
|---|---|
| Aaditya Varier | Team Leader & AI/ML Developer — detection engine, scoring logic |
| Ninad Veer | Frontend & UI/UX Developer — reporting PWA, Feed and Map UI |
| Prathamesh Gaikar | Documentation & Research |
| Aayush Parab | Backend, Database & Testing |

---

## 17. Feasibility Notes

- **Technical:** Entirely free-tier stack (Supabase, Vercel) — no custom infrastructure,
  fast to build and iterate within hackathon timelines.
- **Social:** Zero login means zero barrier to reporting — matches exactly how people
  already under-report minor incidents today.
- **Scalability:** Zone-based architecture generalizes to any public space — a new campus,
  station, or market is a data/configuration change, not a system redesign.

---

## 18. Known Limitations

- The anti-gaming model **reduces, but does not eliminate**, abuse via multiple devices or
  identities — this is a deliberate trade-off in favor of preserving true anonymity.
- Zone geo-snapping requires an initial manual definition of zone boundaries per deployment
  site; it is not fully automatic on first use in a new location.
- Photo moderation on posts currently relies on keyword-level filtering; it does not yet
  perform image-content moderation.

---

## 19. References & Disclosure

**Existing work studied (not incorporated as code):**

- **Safetipin** — rates how safe a place feels based on lighting, crowd density, etc.
- **bSafe / Himmat Plus (Delhi Police) / 112 India** — SOS apps for active emergencies
- **1091 Women Helpline** — call-based reporting

**References:**

- NCRB *"Crime in India"* reports — data on crimes against women
- Open-source tools as listed in Section 6 (Tech Stack)

**Disclosure statement:** Existing tools studied above only assist during an active
emergency or provide static place ratings. SENTINEL's early-warning scoring engine,
anti-gaming protection design, and place-only alerting model are original work, built for
CodeX 2026. No code was copied from any existing product; all open-source libraries and
platforms used are credited above.

---

## 20. License

This project is released under the **MIT License** for the purposes of CodeX 2026.
See `LICENSE` for full terms.

---

<p align="center">
<i>"Safer public spaces, and greater public trust in reporting."</i><br>
Built by Team SENTINEL for CodeX 2026 — MUSA
</p>
