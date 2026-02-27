"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { Header } from "@/components/layout/Header";
import { ReviewCard } from "@/components/hitl/ReviewCard";
import { ComingSoonBadge, ComingSoonPanel } from "@/components/layout/ComingSoonBadge";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";
import type { HITLReview, WSEvent } from "@/lib/types";

export default function HITLPage() {
  const [reviews, setReviews] = useState<HITLReview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.hitl.queue();
      setReviews(data);
    } catch {
      toast.error("Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleWSEvent = useCallback(
    (event: WSEvent) => {
      if (event.event === "hitl_decision" && event.data?.review_id) {
        setReviews((prev) => prev.filter((r) => r.review_id !== event.data!.review_id));
      }
      if (event.event === "hitl_required") {
        fetchQueue();
        toast(`New review request from ${event.agent_id}`, { icon: "⚠️" });
      }
    },
    [fetchQueue]
  );

  const { connected } = useWebSocket(handleWSEvent);

  const handleDecide = async (id: string, approved: boolean, notes: string) => {
    try {
      await api.hitl.decide(id, { approved, reviewer_notes: notes });
      setReviews((prev) => prev.filter((r) => r.review_id !== id));
      toast.success(approved ? "Action approved." : "Action rejected.");
    } catch {
      toast.error("Failed to process decision.");
    }
  };

  const pendingCount = reviews.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="HITL Console"
        subtitle="Human-in-the-Loop Review Queue"
        connected={connected}
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-800/50 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">{pendingCount} pending</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              Bulk approve / reject <ComingSoonBadge />
            </div>
            <button
              onClick={fetchQueue}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-surface-border rounded-lg hover:border-slate-500 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-32 text-slate-500">Loading queue...</div>
        )}

        {!loading && reviews.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 space-y-3">
            <ShieldCheck className="w-10 h-10 text-emerald-500/50" />
            <p className="text-slate-500 text-sm">All clear — no pending reviews.</p>
          </div>
        )}

        <div className="space-y-4 max-w-2xl">
          {reviews.map((review) => (
            <ReviewCard key={review.review_id} review={review} onDecide={handleDecide} />
          ))}
          {reviews.length === 0 && !loading && (
            <ComingSoonPanel
              title="HITL Audit Log"
              description="History of all past human decisions with reviewer notes and timestamps."
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
}
