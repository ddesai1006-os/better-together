import { redirect } from "next/navigation";
import { SetupView } from "@/components/SetupView";
import { publicMember, requireViewer } from "@/lib/auth";
import { claudeConfigured, claudeKeyProblem } from "@/lib/intelligence/brain-dump";
import { storeKind } from "@/lib/store";

export default async function SetupPage() {
  const { household, me, isAdmin } = await requireViewer();
  if (!isAdmin) redirect("/day");
  return (
    <SetupView
      household={{ id: household.id, name: household.name, timezone: household.timezone }}
      members={household.members.map(publicMember)}
      meId={me.id}
      status={{ claude: claudeConfigured(), claudeProblem: claudeKeyProblem(), store: storeKind, learned: household.signals.length }}
    />
  );
}
