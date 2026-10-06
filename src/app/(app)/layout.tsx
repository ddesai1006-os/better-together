import { AppNav } from "@/components/AppNav";
import { publicMember, requireViewer } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, household } = await requireViewer();
  return (
    <>
      <AppNav me={publicMember(me)} householdName={household.name} />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 md:pb-16">{children}</main>
    </>
  );
}
