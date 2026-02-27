"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, XCircle, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { Header } from "@/components/layout/Header";
import { ComingSoonBadge } from "@/components/layout/ComingSoonBadge";
import { useTasks } from "@/hooks/useTasks";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Task, WSEvent } from "@/lib/types";

const statusColors: Record<string, string> = {
  pending: "text-slate-400 bg-slate-800",
  planning: "text-violet-400 bg-violet-900/40",
  running: "text-blue-400 bg-blue-900/40",
  waiting_hitl: "text-amber-400 bg-amber-900/40",
  completed: "text-emerald-400 bg-emerald-900/40",
  failed: "text-red-400 bg-red-900/40",
  cancelled: "text-slate-500 bg-slate-800",
};

const priorityColors: Record<string, string> = {
  low: "text-slate-400",
  medium: "text-blue-400",
  high: "text-amber-400",
  critical: "text-red-400",
};

export default function TasksPage() {
  const router = useRouter();
  const { tasks, loading, error, fetchTasks, cancelTask, updateTaskFromEvent } = useTasks();

  const handleWSEvent = useCallback(
    (event: WSEvent) => {
      if (event.task_id && event.status) {
        updateTaskFromEvent(event.task_id, { status: event.status as Task["status"] });
      }
    },
    [updateTaskFromEvent]
  );

  const { connected } = useWebSocket(handleWSEvent);

  const handleCancel = async (id: string) => {
    try {
      await cancelTask(id);
      toast.success("Task cancelled.");
    } catch {
      toast.error("Failed to cancel task.");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Tasks" subtitle={`${tasks.length} tasks`} connected={connected} />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs">Filter by status</span>
            <ComingSoonBadge />
            <span className="text-slate-500 text-xs ml-2">Sort</span>
            <ComingSoonBadge />
          </div>
          <button
            onClick={fetchTasks}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-surface-border rounded-lg hover:border-slate-500 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-32 text-slate-500">Loading tasks...</div>
        )}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm">{error}</div>
        )}
        {!loading && !error && tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-slate-500">No tasks yet. Submit one from the Dashboard.</div>
        )}

        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.task_id}
              onClick={() => router.push(`/tasks/${task.task_id}`)}
              className="bg-surface-card rounded-xl border border-surface-border p-4 hover:border-slate-500 transition-colors group cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={clsx(
                        "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                        statusColors[task.status] ?? "text-slate-400 bg-slate-800"
                      )}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                    <span className={clsx("text-xs font-medium capitalize", priorityColors[task.priority])}>
                      {task.priority}
                    </span>
                    {task.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-white text-sm font-medium truncate">{task.objective}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })} •{" "}
                    {task.dag_nodes.length} agent{task.dag_nodes.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(task.status === "running" || task.status === "planning" || task.status === "pending") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancel(task.task_id); }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      title="İptal et"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
