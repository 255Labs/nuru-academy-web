"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, BookOpen, Award, Trophy,
  DollarSign, Globe, UserCheck, Settings, LogOut,
  ChevronLeft, ChevronRight, Sparkles, Bell,
  ShieldCheck, Menu, X, Monitor, Tag, Building2,
} from "lucide-react";

const NAV = [
  { group: "Overview",
    items: [
      { href: "/nrx-ctrl-9f4a",              icon: LayoutDashboard, label: "Dashboard"      },
    ]
  },
  { group: "People",
    items: [
      { href: "/nrx-ctrl-9f4a/learners",     icon: Users,           label: "Learners"       },
      { href: "/nrx-ctrl-9f4a/certificates", icon: Award,           label: "Certificates"   },
      { href: "/nrx-ctrl-9f4a/mentors",      icon: UserCheck,       label: "Mentors"        },
    ]
  },
  { group: "Content",
    items: [
      { href: "/nrx-ctrl-9f4a/cms",          icon: BookOpen,        label: "Curriculum"     },
      { href: "/nrx-ctrl-9f4a/competitions", icon: Trophy,          label: "Competitions"   },
    ]
  },
  { group: "Business",
    items: [
      { href: "/nrx-ctrl-9f4a/revenue",      icon: DollarSign,      label: "Revenue"        },
      { href: "/nrx-ctrl-9f4a/pricing",      icon: Tag,             label: "Pricing"        },
      { href: "/nrx-ctrl-9f4a/orgs",         icon: Building2,       label: "Organizations"  },
      { href: "/nrx-ctrl-9f4a/analytics",    icon: Globe,           label: "Analytics"      },
    ]
  },
  { group: "System",
    items: [
      { href: "/nrx-ctrl-9f4a/sessions",     icon: Monitor,         label: "Sessions"       },
      { href: "/nrx-ctrl-9f4a/settings",     icon: Settings,        label: "Settings"       },
    ]
  },
];

interface AdminShellProps {
  children: React.ReactNode;
  adminName: string;
  adminEmail: string;
}

export function AdminShell({ children, adminName, adminEmail }: AdminShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/nrx-ctrl-9f4a") return pathname === "/nrx-ctrl-9f4a";
    return pathname.startsWith(href);
  }

  async function signOut() {
    await fetch("/nrx-ctrl-9f4a/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  const sidebar = (
    <aside className={`flex flex-col h-screen bg-[#0F0F14] border-r border-white/[0.06] transition-all duration-200 ${collapsed ? "w-[60px]" : "w-[220px]"} shrink-0`}>

      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
              style={{ background: "linear-gradient(135deg, #6B4EFF, #3E2A9E)" }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold text-sm leading-none">Nuru</div>
              <div className="text-white/30 text-[10px] mt-0.5">Admin Console</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg grid place-items-center mx-auto"
            style={{ background: "linear-gradient(135deg, #6B4EFF, #3E2A9E)" }}>
            <Sparkles size={13} className="text-white" />
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)}
            className="text-white/20 hover:text-white/60 transition-colors p-1">
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            {!collapsed && (
              <div className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-2 mb-1.5">
                {group}
              </div>
            )}
            <div className="space-y-0.5">
              {items.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all group relative ${
                      active
                        ? "bg-[#6B4EFF]/20 text-[#9B7FFF]"
                        : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                    }`}>
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#6B4EFF] rounded-r" />
                    )}
                    <Icon size={15} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                    {!collapsed && (
                      <span className="font-medium">{label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + collapse toggle */}
      <div className="border-t border-white/[0.06] p-3 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-white/[0.03] mb-2">
            <div className="w-7 h-7 rounded-full grid place-items-center text-white text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #6B4EFF, #F5B942)" }}>
              {adminName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white/80 text-xs font-semibold truncate">{adminName}</div>
              <div className="text-white/25 text-[10px] truncate">{adminEmail}</div>
            </div>
          </div>
        )}
        <button onClick={signOut}
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/8 transition-all text-sm ${collapsed ? "justify-center" : ""}`}>
          <LogOut size={14} />
          {!collapsed && <span className="font-medium">Sign out</span>}
        </button>
        {collapsed && (
          <button onClick={() => setCollapsed(false)}
            className="flex items-center justify-center w-full py-2 text-white/20 hover:text-white/60 transition-colors">
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "#0F0F14" }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">{sidebar}</div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 flex">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen" style={{ background: "#13131A" }}>

        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-5 border-b border-white/[0.06] shrink-0 sticky top-0 z-10"
          style={{ background: "#13131A" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="lg:hidden text-white/40 hover:text-white/80 p-1">
              <Menu size={18} />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs">
              <ShieldCheck size={13} className="text-[#6B4EFF]" />
              <span className="text-white/25">Admin</span>
              <span className="text-white/15">/</span>
              <span className="text-white/60 font-medium capitalize">
                {pathname === "/nrx-ctrl-9f4a" ? "Dashboard" : pathname.split("/nrx-ctrl-9f4a/")[1]?.split("/")[0] ?? ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-8 h-8 rounded-lg grid place-items-center text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-all">
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
            </button>
            <Link href="/" className="text-xs text-white/25 hover:text-white/60 transition-colors">
              ← Back to site
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
