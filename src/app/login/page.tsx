import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/auth";
import { usingDurableStore } from "@/lib/store";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  // Check the household still exists, not just the cookie — otherwise a stale session
  // bounces between / and /login forever.
  if (await currentViewer()) redirect("/");
  return <LoginForm storageWarning={Boolean(process.env.VERCEL) && !usingDurableStore} />;
}
