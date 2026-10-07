import type { PillarId, SystemId } from "./types";

export interface Pillar {
  id: PillarId;
  name: string;
  tagline: string;
  success: string;
  color: string;
  soft: string;
}

export interface SystemDef {
  id: SystemId;
  name: string;
  short: string;
  pillar: PillarId;
  definition: string;
}

// Pillar hues validated as a categorical set (CVD + contrast) against the card surface.
export const PILLARS: Record<PillarId, Pillar> = {
  engine: {
    id: "engine",
    name: "The Engine",
    tagline: "Keeps daily life moving",
    success: "Fewer fires. Less scrambling. More capacity.",
    color: "#E0604F",
    soft: "#FCE7E3",
  },
  foundation: {
    id: "foundation",
    name: "The Foundation",
    tagline: "Manages resources so life feels lighter",
    success: "Less overwhelmed. Clear priorities. More margin.",
    color: "#3A9B78",
    soft: "#E1F0EA",
  },
  goodlife: {
    id: "goodlife",
    name: "The Good Life",
    tagline: "Creates meaning, growth, and connection",
    success: "Shared memories. Strong relationships. Continuous growth.",
    color: "#8A6FD1",
    soft: "#ECE7F8",
  },
};

export const PILLAR_ORDER: PillarId[] = ["engine", "foundation", "goodlife"];

export const SYSTEMS: SystemDef[] = [
  { id: "meals", name: "Meals", short: "Meals", pillar: "engine", definition: "Feeding the family consistently and well." },
  { id: "laundry", name: "Laundry", short: "Laundry", pillar: "engine", definition: "Ensuring clothing and linens are available when needed." },
  { id: "calendar", name: "Calendar & Logistics", short: "Calendar", pillar: "engine", definition: "Managing schedules, commitments, and transportation." },
  { id: "maintenance", name: "Maintenance", short: "Maintenance", pillar: "engine", definition: "Keeping the home, vehicles, and equipment functioning." },
  { id: "admin", name: "Household Administration", short: "Household Admin", pillar: "engine", definition: "Managing paperwork, bills, renewals, and obligations." },
  { id: "budget", name: "Budget & Financial Planning", short: "Budget", pillar: "foundation", definition: "Directing money toward current and future priorities." },
  { id: "organization", name: "Home Organization", short: "Organization", pillar: "foundation", definition: "Organizing, storing, and reducing possessions." },
  { id: "alignment", name: "Family Alignment", short: "Alignment", pillar: "foundation", definition: "Communication, planning, decision-making, and shared expectations." },
  { id: "health", name: "Health & Wellness", short: "Health & Wellness", pillar: "foundation", definition: "Building physical, mental, and emotional well-being." },
  { id: "experiences", name: "Experiences & Adventures", short: "Experiences", pillar: "goodlife", definition: "Creating memorable experiences together." },
  { id: "learning", name: "Learning & Growth", short: "Learning", pillar: "goodlife", definition: "Developing skills, knowledge, and character." },
  { id: "relationships", name: "Relationships", short: "Relationships", pillar: "goodlife", definition: "Investing in family, friendships, and community." },
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
