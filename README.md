# Better Together

A household operating system that lifts the mental load of running a home. Get things out of your head with a **Brain Dump** (text, photo, or voice); Claude turns it into clear, prioritized tasks mapped onto the Home Operating System framework and suggests who should take each one — weighing preferences, history, and everyone's real bandwidth so "fair" doesn't mean 50/50.

## What's inside

| Screen | What it does |
| --- | --- |
| **Brain Dump** (`/`, first screen after login) | Type, snap a photo, or dictate. Claude interprets it into tasks, routines, reminders, or ideas with system, priority, time, cognitive load, due date, context and a suggested assignee + reason. You review and tweak, answer any clarifying questions, then send to the household. |
| **My Day** (`/day`) | 3–5 things to focus on today, chosen by urgency and capped by the member's daily limit and available minutes (max two brain-heavy tasks). Done / Skip / Hand off. Admins can view anyone's day. |
| **This Week** (`/week`) | Shared progress ring, streak, completions per day by member, where time went across the three pillars, each member's % complete and share of the work, the remaining list ("I'll take it"), and a wins wall. |
| **Household Rhythms** (`/rhythms`) | Last 6 weeks: plain-language insights, a typical week, fair-share check (work vs. available time vs. mental load), time by system and who leads each, routines and their usual owners, week-over-week trend. |
| **Household Setup** (`/setup`, admin only) | Household name/timezone, members, roles, logins, daily task limits, typical weekly schedule (minutes per day), preferred systems, and notes for assignment. |

### The intelligence

`src/lib/intelligence/`

- **`context.ts`** builds a snapshot of the household: each member's weekly capacity, open minutes over the next 7 days, systems they lead, recurring routines and their usual owners, and assignments people have overridden.
- **`brain-dump.ts`** sends the dump (plus any photos) and that context to Claude (`claude-opus-5-5`, structured outputs via Zod, server-side refusal fallback). Claude classifies, de-duplicates, estimates effort and cognitive load, resolves dates, asks a clarifying question only when it matters, and recommends an assignee with a short, transparent reason. If no API key is set, a keyword-based offline engine takes over so the app still works.
- **`assign.ts`** is a deterministic assignment engine used offline and as a safety net: learned overrides → routine owner (if they have room) → best mix of preference, history, and spare time.
- **Learning:** when someone overrides a suggested assignee (at review or via hand-off), it's recorded and reused next time. Recurring tasks spawn their next instance for whoever actually did them, so routines settle naturally with their owners.
- **`myday.ts`** picks today's focus list.

## Running locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for the full experience
npm run dev
```

Open http://localhost:3000. A demo household is seeded on first sign-in with ~6 weeks of history:

| Username | Role | Password |
| --- | --- | --- |
| `maya` | Admin | `together` |
| `sam` | Member | `together` |
| `leo` | Member (15 y/o) | `together` |

Admins can **Reset demo data** from Setup to re-seed relative to today. You can also create a fresh household from the login screen.

## Deploying (GitHub + Vercel)

1. Push this repo to GitHub and import it in Vercel (framework preset: Next.js).
2. In the Vercel project: **Storage → Marketplace → Upstash for Redis** and connect it (this sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`). Without it, data lives in ephemeral `/tmp` and resets.
3. Add environment variables `ANTHROPIC_API_KEY` and `SESSION_SECRET`.
4. Deploy.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Anthropic TypeScript SDK · Upstash Redis · jose (JWT sessions) · bcryptjs

## Notes & simplifications

- Each household is stored as a single JSON document (simple, fine for family-sized data; not built for concurrent heavy writes).
- Dictation uses the browser's Web Speech API (Chrome, Safari, Edge).
- Brand colors and type follow the Better Together brand guide (Avenir Next, falling back to Nunito Sans). The guide lists Sage as `#84498C`, which is a purple, so the app uses a sage green matching the swatch. Chart colors are validated for color-blind separation.
