"use client";

import { BarChart3, CalendarCheck, LogOut, Settings, Sparkles, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, cx, type MemberLite } from "./ui";

const LINKS = [
  { href: "/", label: "Brain Dump", short: "Dump", Icon: Sparkles },
  { href: "/day", label: "My Day", short: "My Day", Icon: CalendarCheck },
  { href: "/meals", label: "Meals", short: "Meals", Icon: UtensilsCrossed },
  { href: "/week", label: "This Week", short: "Week", Icon: BarChart3 },
];

export function AppNav({ me, householdName }: { me: MemberLite; householdName: string }) {
  const path = usePathname();
  const router = useRouter();
  const links = me.role === "admin" ? [...LINKS, { href: "/setup", label: "Household", short: "Setup", Icon: Settings }] : LINKS;
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/week" && path.startsWith("/rhythms"));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-offwhite/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Better Together home">
            <Image src="/logo.png" alt="Better Together" width={122} height={38} priority className="mix-blend-multiply" />
          </Link>
          <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
            {links.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={cx(
                  "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition",
                  active(href) ? "bg-coral text-white" : "text-ink-2 hover:bg-sand",
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-right text-xs leading-tight text-ink-2 sm:block">
              <span className="block font-bold text-charcoal">{me.name}</span>
              {householdName}
            </span>
            <Avatar m={me} size={34} />
            <button onClick={logout} className="rounded-full p-2 text-ink-3 hover:bg-sand hover:text-charcoal" title="Sign out" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md justify-around">
          {links.map(({ href, short, Icon }) => (
            <Link key={href} href={href} className={cx("flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", active(href) ? "text-coral-deep" : "text-ink-2")}>
              <Icon size={22} strokeWidth={active(href) ? 2.4 : 1.8} />
              {short}
              <span className={cx("h-1 w-1 rounded-full", active(href) ? "bg-coral" : "bg-transparent")} />
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
