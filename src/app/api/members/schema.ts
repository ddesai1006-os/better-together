import { z } from "zod";
import { SYSTEM_IDS } from "@/lib/systems";

export const MemberFields = z.object({
  name: z.string().trim().min(1, "Add a name").max(40),
  role: z.enum(["admin", "member"]),
  emoji: z.string().max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  dailyTaskLimit: z.number().int().min(3).max(5),
  schedule: z.array(z.number().int().min(0).max(960)).length(7),
  preferredSystems: z.array(z.enum(SYSTEM_IDS)).max(12),
  notes: z.string().max(400),
});

export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,24}$/, "Usernames are 3–24 letters, numbers, . _ or -");
export const Password = z.string().min(8, "Passwords need at least 8 characters");
