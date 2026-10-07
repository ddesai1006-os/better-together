import { MealsView } from "@/components/MealsView";
import { publicMember, requireViewer } from "@/lib/auth";
import { addDays, todayIn, weekStart } from "@/lib/dates";

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { household, me, isAdmin } = await requireViewer();
  const offset = Math.min(4, Math.max(-4, Number((await searchParams).w) || 0));
  const today = todayIn(household.timezone);
  const start = addDays(weekStart(today), offset * 7);
  const end = addDays(start, 6);
  const admin = household.members.find((m) => m.role === "admin");

  return (
    <MealsView
      key={offset}
      offset={offset}
      today={today}
      days={Array.from({ length: 7 }, (_, i) => addDays(start, i))}
      ideas={[...(household.meals ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
      plan={(household.mealPlan ?? []).filter((e) => e.date >= start && e.date <= end)}
      members={household.members.map(publicMember)}
      meId={me.id}
      isAdmin={isAdmin}
      adminName={admin?.name ?? "The admin"}
    />
  );
}
