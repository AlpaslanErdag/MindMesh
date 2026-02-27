"use client";

import { clsx } from "clsx";
import type { DAGNode } from "@/lib/types";

const statusConfig: Record<string, { label: string; style: string; dot: string }> = {
  pending:      { label: "Bekliyor",    style: "text-slate-400 bg-slate-800",    dot: "bg-slate-500" },
  running:      { label: "Çalışıyor",   style: "text-blue-400 bg-blue-900/40",   dot: "bg-blue-400 animate-pulse" },
  completed:    { label: "Tamamlandı",  style: "text-emerald-400 bg-emerald-900/40", dot: "bg-emerald-400" },
  failed:       { label: "Başarısız",   style: "text-red-400 bg-red-900/40",     dot: "bg-red-400" },
  waiting_hitl: { label: "Onay Bekliyor", style: "text-amber-400 bg-amber-900/40", dot: "bg-amber-400 animate-pulse" },
};

const typeBorder: Record<string, string> = {
  planner:    "border-violet-500",
  researcher: "border-sky-500",
  coder:      "border-emerald-500",
  critic:     "border-amber-500",
  summarizer: "border-pink-500",
};

const typeLabel: Record<string, string> = {
  planner:    "Planner",
  researcher: "Researcher",
  coder:      "Coder",
  critic:     "Critic",
  summarizer: "Summarizer",
};

interface AgentStatusCardProps {
  node: DAGNode;
}

export function AgentStatusCard({ node }: AgentStatusCardProps) {
  const status = statusConfig[node.status] ?? statusConfig.pending;
  const taskText = node.label.includes(": ") ? node.label.split(": ").slice(1).join(": ") : node.label;

  return (
    <div className={clsx("rounded-lg border-l-4 bg-surface-card p-3.5 space-y-2.5", typeBorder[node.type] ?? "border-slate-500")}>

      {/* Başlık satırı */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", status.dot)} />
          <span className="text-white text-sm font-semibold">
            {typeLabel[node.type] ?? node.type}
          </span>
          <span className="text-slate-600 text-xs font-mono">{node.id}</span>
        </div>
        <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", status.style)}>
          {status.label}
        </span>
      </div>

      {/* Görev açıklaması */}
      <p className="text-slate-300 text-xs leading-relaxed">{taskText}</p>

      {/* Anlık mesaj (running / hitl) */}
      {node.message && node.status !== "pending" && (
        <p className="text-slate-500 text-xs italic">{node.message}</p>
      )}

      {/* Güven çubuğu */}
      {node.confidence !== undefined && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs">Güven</span>
            <span className={clsx(
              "text-xs font-medium",
              node.confidence >= 0.75 ? "text-emerald-400" :
              node.confidence >= 0.5  ? "text-amber-400" : "text-red-400"
            )}>
              {(node.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-500",
                node.confidence >= 0.75 ? "bg-emerald-500" :
                node.confidence >= 0.5  ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${node.confidence * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
