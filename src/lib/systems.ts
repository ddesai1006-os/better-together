import type { PillarId, SystemId } from "./types";

export interface Pillar {
  id: PillarId;
  name: string;
  tagline: string;
  success: string;
  /** Fills and marks (bars, dots, stripes). */
  color: string;
  /** Light background panel (brand "tint"). */
  soft: string;
  /** Words in this category's color (brand "text" helper — readable on white). */
  text: string;
}

export interface SystemDef {
  id: SystemId;
  name: string;
  short: string;
  pillar: PillarId;
  definition: string;
  examples: string;
}

// Category colors follow the Brand Guide (Oct 2026). Coral and sage marks use slightly deeper
// steps than the brand swatches so the three stay distinguishable for color-blind readers;
// The Good Life uses brand Mustard as-is (light, so charts always carry labels).
// Internal ids ("engine", etc.) are kept stable so existing households' data still maps.
export const PILLARS: Record<PillarId, Pillar> = {
  engine: {
    id: "engine",
    name: "Everyday Life",
    tagline: "Keeping day-to-day life running smoothly, so we're not constantly scrambling",
    success: "Fewer fires. Fewer last-minute decisions. More predictability and breathing room.",
    color: "#E0604F",
    soft: "#FBE9E5",
    text: "#B0503F",
  },
  foundation: {
    id: "foundation",
    name: "The Foundation",
    tagline: "Managing our money, space, belongings, and plans so life feels lighter, more intentional, and aligned to our goals and priorities",
    success: "Less overwhelm. Clearer priorities. A home and life that are easier to manage.",
    color: "#3A9B78",
    soft: "#E7EFE8",
    text: "#4E7360",
  },
  goodlife: {
    id: "goodlife",
    name: "The Good Life",
    tagline: "Investing in our health, relationships, experiences, and growth so we can live well together",
    success: "Stronger connections to people we love. Shared memories. Healthier habits. A sense that we're growing.",
    color: "#F0C464",
    soft: "#FCF1D8",
    text: "#8A6310",
  },
};

export const PILLAR_ORDER: PillarId[] = ["engine", "foundation", "goodlife"];

/**
 * Systems from the Home Operating System Framework (Oct 2026). `definition` is the framework's
 * description; `examples` helps Claude (and the offline rules) file tasks in the right place.
 */
export const SYSTEMS: SystemDef[] = [
  // Everyday Life
  { id: "meals", name: "Meals", short: "Meals", pillar: "engine", definition: "Planning, purchasing, and preparing food so everyone eats well without stress.", examples: "meal planning, groceries, cooking, packing lunches, snacks" },
  { id: "reset", name: "Home Reset & Household Supplies", short: "Home Reset", pillar: "engine", definition: "Keeping our home clean, tidy, stocked, and comfortable through regular cleaning and daily resets.", examples: "cleaning bathrooms, dishes, vacuuming, tidying, taking out trash, restocking toilet paper, soap, first-aid and other supplies" },
  { id: "laundry", name: "Laundry", short: "Laundry", pillar: "engine", definition: "Making sure clean clothes are available when needed.", examples: "washing, folding, putting away clothes, sheets and towels" },
  { id: "calendar", name: "Calendar Management", short: "Calendar", pillar: "engine", definition: "Knowing who needs to be where and when, and making sure our calendar includes time to think and fill up our cup.", examples: "appointments, pick-ups and drop-offs, carpools, RSVPs, booking camps and activities, scheduling" },
  { id: "maintenance", name: "Maintenance", short: "Maintenance", pillar: "engine", definition: "Keeping the home, car, and other major belongings working so small problems don't become big ones.", examples: "repairs, car service and oil changes, HVAC filters, smoke detector batteries, yard work, fixing things" },
  // The Foundation
  { id: "alignment", name: "Strategy & Communications", short: "Strategy & Comms", pillar: "foundation", definition: "Talking and planning together so everyone is aligned.", examples: "family meetings, weekly planning together, decisions, shared expectations, screen-time rules" },
  { id: "organization", name: "Organizing", short: "Organizing", pillar: "foundation", definition: "Giving everything a clear place so it's easy to find and put away.", examples: "organizing the pantry, closets, garage or toys; labeling; storage systems" },
  { id: "admin", name: "Household Admin", short: "Household Admin", pillar: "foundation", definition: "Managing the paperwork, policies, renewals, and essential details that keep our household organized and protected.", examples: "paying bills, renewals, registrations, insurance, forms, permission slips, passports, taxes" },
  { id: "budget", name: "Budget", short: "Budget", pillar: "foundation", definition: "Managing where our money goes so it supports our priorities, both short term and long term.", examples: "budget check-ins, savings, subscriptions, college savings, big purchases" },
  { id: "purging", name: "Purging", short: "Purging", pillar: "foundation", definition: "Letting go of what we don't need so we have less to manage.", examples: "decluttering, donating, selling or tossing things, outgrown clothes and toys" },
  // The Good Life
  { id: "relationships", name: "Relationships", short: "Relationships", pillar: "goodlife", definition: "Nurturing the connections that are important to us — friendships and family.", examples: "calling family, birthdays and gifts, date nights, game nights, seeing friends, thank-you notes" },
  { id: "health", name: "Health & Wellness", short: "Health & Wellness", pillar: "goodlife", definition: "Taking care of our bodies and minds so we have energy to live well (and are healthier and more active for our kiddos).", examples: "doctor and dentist appointments, prescriptions, exercise, walks, sleep, mental health" },
  { id: "experiences", name: "Experiences & Adventures", short: "Experiences", pillar: "goodlife", definition: "Doing things together that create memories.", examples: "trips, outings, hikes, weekend plans, vacations, traditions" },
  { id: "learning", name: "Learning & Growth", short: "Learning", pillar: "goodlife", definition: "Building skills and knowledge over time.", examples: "homework, lessons, music practice, library trips, classes, reading" },
];

export const SYSTEM_IDS = SYSTEMS.map((s) => s.id) as [SystemId, ...SystemId[]];

const byId = new Map(SYSTEMS.map((s) => [s.id, s]));

export function systemOf(id: SystemId): SystemDef {
  return byId.get(id) ?? SYSTEMS[0];
}

export function pillarOf(id: SystemId): Pillar {
  return PILLARS[systemOf(id).pillar];
}

// Member hues: a fixed categorical order (validated), assigned by join order, never by rank.
export const MEMBER_COLORS = ["#E0604F", "#3A9B78", "#8A6FD1", "#C98A12", "#3F7FC4", "#C2558F"];
export const MEMBER_EMOJI = ["🌻", "🌿", "🚀", "🦊", "🐳", "🌙", "🍓", "⭐"];
