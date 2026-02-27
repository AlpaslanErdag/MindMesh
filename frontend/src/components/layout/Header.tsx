"use client";

import { clsx } from "clsx";
import { Wifi, WifiOff } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  connected: boolean;
}

export function Header({ title, subtitle, connected }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-card">
      <div>
        <h1 className="text-white font-semibold text-lg">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm">{subtitle}</p>}
      </div>
      <div
        className={clsx(
          "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full",
          connected
            ? "bg-emerald-900/40 text-emerald-400"
            : "bg-red-900/40 text-red-400"
        )}
      >
        {connected ? (
          <Wifi className="w-3 h-3" />
        ) : (
          <WifiOff className="w-3 h-3" />
        )}
        {connected ? "Live" : "Disconnected"}
      </div>
    </header>
  );
}
