import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await readSession()) redirect("/");
  return <LoginForm />;
}
