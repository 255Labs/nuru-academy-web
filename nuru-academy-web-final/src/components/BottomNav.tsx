"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Trophy, Swords, User } from "lucide-react";
import { useT } from "@/lib/i18n";

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();

  const ITEMS = [
    { href: "/",       labelKey: "nav.home",    icon: Home },
    { href: "/courses", labelKey: "nav.courses", icon: BookOpen },
  ];
  const ITEMS2 = [
    { href: "/arena",    labelKey: "nav.arena",    icon: Swords },
    { href: "/settings", labelKey: "nav.settings", icon: User },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-nuru-card border-t border-nuru-line px-6 py-2.5 flex items-center justify-between z-30">
      {ITEMS.map(({ href, labelKey, icon: Icon }) => (
        <NavItem key={href} href={href} label={t(labelKey)} Icon={Icon} active={pathname === href} />
      ))}
      <Link
        href="/achievements"
        className="w-12 h-12 -mt-6 rounded-full bg-nuru-purple text-white grid place-items-center shadow-pop"
      >
        <Trophy size={22} />
      </Link>
      {ITEMS2.map(({ href, labelKey, icon: Icon }) => (
        <NavItem key={href} href={href} label={t(labelKey)} Icon={Icon} active={pathname === href} />
      ))}
    </div>
  );
}

function NavItem({
  href, label, Icon, active,
}: { href: string; label: string; Icon: typeof Home; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-0.5 ${active ? "text-nuru-purple" : "text-nuru-muted"}`}>
      <Icon size={20} />
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}
