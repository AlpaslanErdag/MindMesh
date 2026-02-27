"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Bot, LayoutDashboard, ListTodo, ShieldAlert, Activity, Cpu, Plug, Sparkles } from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/tasks", icon: ListTodo, label: "Tasks" },
  { href: "/hitl", icon: ShieldAlert, label: "HITL Console" },
  { href: "/agents", icon: Cpu, label: "Agent Management" },
];

const comingSoonItems = [
  { icon: Plug, label: "Integrations" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 bg-surface-card border-r border-surface-border flex flex-col">
      <div className="p-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Multi-Agent</p>
            <p className="text-slate-400 text-xs">Platform v1.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-brand-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-surface-border"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

        <div className="pt-3 pb-1">
          <p className="text-slate-600 text-xs font-medium px-3 uppercase tracking-wider">Coming Soon</p>
        </div>

        {comingSoonItems.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-600 cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <Sparkles className="w-3 h-3 text-brand-600" />
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-surface-border">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="w-3 h-3" />
          <span>System Active</span>
        </div>
      </div>
    </aside>
  );
}
