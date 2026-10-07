import { headers } from "next/headers";
import { SiriSetup } from "@/components/SiriSetup";
import { requireViewer } from "@/lib/auth";

export default async function SiriPage() {
  const { me } = await requireViewer();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return <SiriSetup endpoint={`${proto}://${host}/api/inbox`} hasKey={Boolean(me.apiKeyHash)} keyCreatedAt={me.apiKeyCreatedAt ?? null} />;
}
