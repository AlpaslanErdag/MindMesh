"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Check, X, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { HITLReview } from "@/lib/types";

interface ReviewCardProps {
  review: HITLReview;
  onDecide: (id: string, approved: boolean, notes: string) => Promise<void>;
}

export function ReviewCard({ review, onDecide }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (approved: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      await onDecide(review.review_id, approved, notes);
    } finally {
      setLoading(false);
    }
  };

  const confidencePct = Math.round(review.confidence * 100);

  return (
    <div className="bg-surface-card rounded-xl border border-amber-800/50 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">{review.action}</p>
              <p className="text-slate-400 text-xs">Agent: {review.agent_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={clsx(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                confidencePct < 50
                  ? "bg-red-900/40 text-red-400"
                  : "bg-amber-900/40 text-amber-400"
              )}
            >
              {confidencePct}% confidence
            </span>
            <span className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        <p className="text-slate-400 text-xs">{review.reason}</p>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-slate-500 text-xs hover:text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide payload" : "Show payload"}
        </button>

        {expanded && (
          <pre className="bg-surface rounded-lg border border-surface-border text-xs text-slate-300 p-3 overflow-x-auto font-mono max-h-48">
            {JSON.stringify(review.payload, null, 2)}
          </pre>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional reviewer notes..."
          rows={2}
          className="w-full bg-surface rounded-lg border border-surface-border text-white text-xs placeholder-slate-600 px-3 py-2 resize-none focus:outline-none focus:border-brand-500 transition-colors"
        />

        <div className="flex gap-2">
          <button
            onClick={() => handle(false)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm font-medium hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={() => handle(true)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 text-sm font-medium hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
