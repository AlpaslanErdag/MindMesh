"use client";

import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import type { WSEvent } from "@/lib/types";

const eventColors: Record<string, string> = {
  task_started: "text-blue-400",
  task_completed: "text-emerald-400",
  dag_initialized: "text-violet-400",
  dag_updated: "text-sky-400",
  agent_state_update: "text-slate-300",
  hitl_required: "text-amber-400",
  hitl_decision: "text-orange-400",
  connected: "text-emerald-400",
};

interface LiveEventFeedProps {
  events: WSEvent[];
}

export function LiveEventFeed({ events }: LiveEventFeedProps) {
  return (
    <div className="bg-surface-card rounded-xl border border-surface-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border">
        <h3 className="text-white text-sm font-semibold">Live Event Feed</h3>
      </div>
      <div className="flex-1 overflow-y-auto max-h-96 divide-y divide-surface-border">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            Awaiting events...
          </div>
        ) : (
          events.map((event, idx) => (
            <div key={idx} className="px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span
                    className={clsx(
                      "text-xs font-mono font-medium",
                      eventColors[event.event] ?? "text-slate-400"
                    )}
                  >
                    {event.event}
                  </span>
                  {event.agent_type && (
                    <span className="ml-2 text-xs text-slate-500">
                      [{event.agent_type}]
                    </span>
                  )}
                  {event.message && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{event.message}</p>
                  )}
                </div>
                {event.timestamp && (
                  <span className="text-xs text-slate-600 flex-shrink-0">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
