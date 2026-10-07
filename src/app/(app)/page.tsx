import { BrainDump } from "@/components/BrainDump";
import { publicMember, requireViewer } from "@/lib/auth";
import { localHour } from "@/lib/dates";
import { claudeConfigured } from "@/lib/intelligence/brain-dump";
import { buildMyDay } from "@/lib/intelligence/myday";

export default async function BrainDumpPage() {
  const { household, me } = await requireViewer();
  const day = buildMyDay(household, me);
  const hour = localHour(household.timezone);
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const ideas = household.tasks
    .filter((t) => t.kind === "idea" && t.status === "open")
    .map((t) => ({ id: t.id, title: t.title, system: t.system, context: t.context }));

  return (
    <BrainDump
      greeting={`${greeting}, ${me.name}`}
      me={publicMember(me)}
      members={household.members.map(publicMember)}
      todayCount={day.focus.length}
      todayMinutes={day.focus.reduce((s, t) => s + t.estimateMinutes, 0)}
      ideas={ideas}
      aiReady={claudeConfigured()}
      inbox={{
        pending: (household.inbox ?? []).filter((i) => i.status === "new").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        recent: (household.inbox ?? [])
          .filter((i) => i.status === "reviewed")
          .sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""))
          .slice(0, 8),
      }}
    />
  );
}
