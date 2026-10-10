# Better Together — Pilot Checklist

Goal: hand Better Together to **10–15 households** for a **4–6 week** pilot, learn whether it lightens the mental load and makes the split of household work feel fairer, and decide what to build next.

Legend: 🛠️ = build work (Claude can do it) · 👤 = needs you (accounts, decisions, people)

---

## 1. Must-fix before handing it out

- [ ] 🛠️ **Invite links for family members** — the admin sends a link ("Maya invited you to The Parker Household"); each person sets their own password. Replaces the admin creating usernames/passwords.
- [ ] 🛠️ **Password reset by email** — "Forgot password?" on the sign-in page.
  - [ ] 👤 Create an email-sending account (e.g. Resend) and add its key to Vercel. *(Also unlocks email forwarding later.)*
  - [ ] 🛠️ Add an email address to each member's profile.
- [ ] 🛠️ **Safe saving when two people edit at once** — today each household is one big record, so simultaneous changes can overwrite each other. Restructure storage so each change saves on its own.
- [ ] 🛠️ **Remove demo pieces** — demo logins on the sign-in page, "Reset demo data", and the sample household.
- [ ] 🛠️ **Basic protections** — limit repeated wrong-password attempts; cap Claude usage per household per day.
- [ ] 👤 Confirm `SESSION_SECRET` and `ANTHROPIC_API_KEY` are set correctly in Vercel (Household page shows **Claude connected**).

## 2. Trust, privacy & kids

- [ ] 👤 **Plain-language privacy note** (one page): what's collected, that brain dumps are processed by Claude (Anthropic doesn't train on API data by default), who in the household sees what, and how to delete everything.
- [ ] 🛠️ Link the privacy note from the sign-in page and Household Setup.
- [ ] 🛠️ **"Delete our household"** option for the admin (removes all data).
- [ ] 👤 **Simple pilot agreement / consent** each household accepts.
- [ ] 👤 **Kids:** for members under 13, keep accounts under a parent and get explicit parental consent. Decide whether kids get their own logins in the pilot.
- [ ] 👤 **Upgrade Supabase to the paid plan** — the free plan pauses after a quiet week and has limited backups.

## 3. Learning from the pilot

Decide what "success" means up front:

- [ ] 👤 **Usage:** do households brain dump at least weekly? Do people open My Day on most days?
- [ ] 👤 **Follow-through:** % of My Day tasks done vs. skipped.
- [ ] 👤 **Fairness:** does the split of work (minutes and mental load) shift over the pilot — and does it *feel* fairer?
- [ ] 👤 **Mental load:** 1–10 "how much are you carrying in your head?" — before, midway, after.
- [ ] 👤 Write the 3–5 questions you most want answered (e.g. Is Siri used? Do people trust auto-assignment? Is Meals used?).

Build to support it:

- [ ] 🛠️ **"Tell us" feedback button** on every screen (goes to you).
- [ ] 🛠️ **Pilot dashboard for you** — activity per household (brain dumps, tasks done, Siri use, active members) without showing anyone's task content.
- [ ] 🛠️ Short in-app surveys at the start, midpoint and end (the 1–10 mental-load question + 2–3 others).

## 4. Onboarding & support

- [ ] 👤 **15–20 min onboarding call per household** — set up members, schedules, daily limits and preferences together; walk through Brain Dump and Siri.
- [ ] 👤 **One-page "Getting started" guide** (can live in the app).
- [ ] 👤 **Known limitations list** — e.g. Siri is iPhone-only; Android / Google Home / Alexa not supported; no email forwarding yet.
- [ ] 👤 **One support channel** — a pilot group text/WhatsApp, plus how fast you'll respond.
- [ ] 👤 Schedule a **midpoint check-in** and **exit interviews**.

## 5. Running costs (rough — check current pricing)

| Item | Roughly |
| --- | --- |
| Claude API, 15 households | ~$100–150 / month on the current model (less with a cheaper model or prompt caching) |
| Supabase paid plan | ~$25 / month |
| Vercel | Free plan may be enough; Pro (~$20 / month) if the pilot counts as commercial use |
| Own domain (e.g. bettertogether.app) | ~$15 / year |
| Email service (password resets) | Free tier is likely enough |

- [ ] 👤 Set a **monthly spending limit** in the Anthropic console.
- [ ] 👤 Decide on a **custom domain** (looks more trustworthy; keeps Siri links stable).
- [ ] 🛠️ Optional: **prompt caching** to trim Claude cost per brain dump.

## 6. Suggested timeline

| When | What |
| --- | --- |
| Weeks 1–2 | Prep: section 1 must-fixes, privacy note, feedback button, pilot dashboard, domain, Supabase upgrade |
| Week 3 | Onboard **3–5 households first**; fix what breaks; then onboard the rest |
| Weeks 3–8 | Pilot runs; midpoint survey + check-ins at ~week 5 |
| Week 9 | Exit interviews; compare before/after mental-load scores; decide what's next |

## 7. Ideas parked for after the pilot

- [ ] Email forwarding into Brain Dump
- [ ] "Hey Siri, what's on my day?" read-out
- [ ] Morning notification of the day's tasks (Shortcuts automation or web push)
- [ ] Monthly Rhythms email brief to the family
- [ ] Activity calendar import + pick-up/drop-off coordination
- [ ] "Make grocery list" from the meal plan
- [ ] Native iPhone app (lock-screen widgets, built-in Siri phrase)
