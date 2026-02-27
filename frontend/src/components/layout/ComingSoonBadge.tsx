"use client";

import { clsx } from "clsx";
import { Sparkles } from "lucide-react";

interface ComingSoonBadgeProps {
  label?: string;
  className?: string;
}

export function ComingSoonBadge({ label = "Coming Soon", className }: ComingSoonBadgeProps) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
      "bg-brand-900/40 text-brand-400 border border-brand-700/40",
      className
    )}>
      <Sparkles className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

interface ComingSoonOverlayProps {
  title: string;
  description?: string;
  className?: string;
}

export function ComingSoonPanel({ title, description, className }: ComingSoonOverlayProps) {
  return (
    <div className={clsx(
      "relative rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6",
      "flex flex-col items-center justify-center text-center gap-2 min-h-[120px]",
      className
    )}>
      <div className="flex items-center gap-2 text-slate-400 font-medium text-sm">
        <Sparkles className="w-4 h-4 text-brand-400" />
        {title}
      </div>
      {description && (
        <p className="text-slate-600 text-xs max-w-xs">{description}</p>
      )}
      <ComingSoonBadge />
    </div>
  );
}
