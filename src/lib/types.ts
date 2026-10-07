export type PillarId = "engine" | "foundation" | "goodlife";

export type SystemId =
  | "meals"
  | "laundry"
  | "calendar"
  | "maintenance"
  | "admin"
  | "budget"
  | "organization"
  | "alignment"
  | "health"
  | "experiences"
  | "learning"
  | "relationships";

export type Priority = "high" | "medium" | "low";
export type CognitiveLoad = "light" | "moderate" | "heavy";
export type ItemKind = "task" | "recurring" | "reminder" | "idea";
export type Frequency = "daily" | "weekly" | "biweekly" | "monthly";
export type Role = "admin" | "member";

/** Available minutes per weekday, index 0 = Sunday … 6 = Saturday. */
export type WeeklySchedule = [number, number, number, number, number, number, number];

export interface Member {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: Role;
  color: string;
  emoji: string;
  /** Max things on this person's My Day (3–5). */
  dailyTaskLimit: number;
  schedule: WeeklySchedule;
  preferredSystems: SystemId[];
  /** Free-text notes the AI should respect, e.g. "No driving on weekdays". */
  notes: string;
}

export interface Task {
  id: string;
  title: string;
  system: SystemId;
  kind: ItemKind;
  priority: Priority;
  cognitiveLoad: CognitiveLoad;
  estimateMinutes: number;
  /** YYYY-MM-DD in the household's timezone. */
  dueDate: string | null;
  /** Human phrasing, e.g. "By 6 PM", "This week". */
  dueLabel: string | null;
  context: string;
  frequency: Frequency | null;
  assigneeId: string | null;
  assignmentReason: string;
  status: "open" | "done";
  createdAt: string;
  createdBy: string;
  completedAt: string | null;
  completedBy: string | null;
  /** Date (YYYY-MM-DD) the task was last skipped; hidden from My Day that day. */
  skippedOn: string | null;
  skipCount: number;
  /** Groups instances of the same recurring routine. */
  seriesId: string | null;
}

/** Recorded when someone overrides the AI's suggested assignee — the system learns from it. */
export interface AssignmentSignal {
  at: string;
  system: SystemId;
  titleKey: string;
  suggestedId: string | null;
  chosenId: string;
}

export interface Household {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
  members: Member[];
  tasks: Task[];
  signals: AssignmentSignal[];
  /** Optional so households saved before Meals existed still load. */
  meals?: MealIdea[];
  mealPlan?: MealPlanEntry[];
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";

export interface MealIdea {
  id: string;
  name: string;
  url: string | null;
  type: MealType;
  submittedBy: string;
  createdAt: string;
}

/** One meal placed on one day of the plan (admin-managed). */
export interface MealPlanEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealId: string;
}

/** What the brain-dump intelligence proposes; the user reviews before it becomes Tasks. */
export interface Proposal {
  tempId: string;
  kind: ItemKind;
  title: string;
  system: SystemId;
  priority: Priority;
  cognitiveLoad: CognitiveLoad;
  estimateMinutes: number;
  dueDate: string | null;
  dueLabel: string | null;
  context: string;
  frequency: Frequency | null;
  suggestedAssigneeId: string | null;
  assignmentReason: string;
  clarifyingQuestion: string | null;
}

export interface DumpResult {
  summary: string;
  proposals: Proposal[];
  engine: "claude" | "offline";
}

export interface SessionUser {
  householdId: string;
  memberId: string;
}
