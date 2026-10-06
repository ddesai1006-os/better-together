import { DayView } from "@/components/DayView";
import { publicMember, requireViewer } from "@/lib/auth";
import { memberById } from "@/lib/db";
import { formatDay, localHour } from "@/lib/dates";
import { buildMyDay } from "@/lib/intelligence/myday";

export default async function MyDayPage({ searchParams }: { searchParams: Promise<{ member?: string; more?: string }> }) {
  const { household, me, isAdmin } = await requireViewer();
  const sp = await searchParams;
  // Admins can look at anyone's day; members only see their own.
  const target = (isAdmin && memberById(household, sp.member)) || me;
  const extra = Math.min(10, Math.max(0, Number(sp.more) || 0));
  const day = buildMyDay(household, target, extra);
  const hour = localHour(household.timezone);

  return (
    <DayView
      key={target.id}
      greeting={hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}
      today={day.today}
      dateLabel={formatDay(day.today, { weekday: "long", month: "long", day: "numeric" })}
      me={publicMember(me)}
      target={publicMember(target)}
      members={household.members.map(publicMember)}
      isAdmin={isAdmin}
      focus={day.focus}
      doneToday={day.doneToday}
      more={day.more}
      extra={extra}
      capacityMinutes={day.capacityMinutes}
    />
  );
}
