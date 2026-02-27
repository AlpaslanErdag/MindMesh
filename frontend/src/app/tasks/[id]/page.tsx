"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeft, RefreshCw, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { Header } from "@/components/layout/Header";
import { AgentDAGView } from "@/components/dashboard/AgentDAGView";
import { AgentStatusCard } from "@/components/dashboard/AgentStatusCard";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";
import type { DAGNode, Task, WSEvent } from "@/lib/types";

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

function ResultSection({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="bg-surface rounded-xl border border-surface-border overflow-hidden">
          <button
            onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
          >
            <span className="text-white text-sm font-medium capitalize">{key.replace(/_/g, " ")}</span>
            {expanded[key] ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expanded[key] && (
            <div className="px-4 pb-4">
              {typeof value === "string" ? (
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
              ) : Array.isArray(value) ? (
                <ul className="space-y-1">
                  {value.map((item, i) => (
                    <li key={i} className="text-slate-300 text-sm flex gap-2">
                      <span className="text-slate-600 flex-shrink-0">{i + 1}.</span>
                      <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <pre className="text-slate-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AgentOutputSection({ agentId, output }: { agentId: string; output: unknown }) {
  const [open, setOpen] = useState(true);
  const data = output as Record<string, unknown>;
  const agentType = (data?.agent_type as string) ?? agentId.split("-")[0];

  const typeColors: Record<string, string> = {
    planner:    "border-violet-500 text-violet-400",
    researcher: "border-sky-500 text-sky-400",
    coder:      "border-emerald-500 text-emerald-400",
    critic:     "border-amber-500 text-amber-400",
    summarizer: "border-pink-500 text-pink-400",
  };

  const confidence = data?.confidence as number | undefined;

  return (
    <div className={clsx("rounded-xl border-l-4 bg-surface-card overflow-hidden", typeColors[agentType]?.split(" ")[0] ?? "border-slate-500")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={clsx("text-sm font-semibold capitalize", typeColors[agentType]?.split(" ")[1] ?? "text-slate-300")}>
            {agentType}
          </span>
          <span className="text-slate-500 text-xs font-mono">{agentId}</span>
          {confidence !== undefined && (
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              {Math.round(confidence * 100)}% güven
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-surface-border">
          {/* Plan (planner) */}
          {Array.isArray(data?.plan) && (
            <div className="mt-3 space-y-2">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Plan</p>
              {(data.plan as Array<Record<string, unknown>>).map((step) => (
                <div key={String(step.step)} className="flex gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-brand-900/40 text-brand-400 text-xs flex items-center justify-center flex-shrink-0">
                    {String(step.step)}
                  </span>
                  <div>
                    <span className="text-slate-300 capitalize">[{String(step.agent_type)}]</span>{" "}
                    <span className="text-slate-400">{String(step.task)}</span>
                  </div>
                </div>
              ))}
              {data.rationale && (
                <p className="text-slate-500 text-xs mt-2 italic">{String(data.rationale)}</p>
              )}
            </div>
          )}

          {/* Summary (researcher) */}
          {data?.summary && (
            <div className="mt-3">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Özet</p>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{String(data.summary)}</p>
            </div>
          )}

          {/* Key Facts */}
          {Array.isArray(data?.key_facts) && (data.key_facts as string[]).length > 0 && (
            <div className="mt-3">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Önemli Bulgular</p>
              <ul className="space-y-1">
                {(data.key_facts as string[]).map((f, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-brand-400">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Code (coder) */}
          {data?.code && (
            <div className="mt-3">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Kod</p>
              <pre className="bg-surface rounded-lg border border-surface-border text-xs text-slate-300 p-3 overflow-x-auto font-mono max-h-64">
                {String(data.code)}
              </pre>
              {data.explanation && (
                <p className="text-slate-400 text-xs mt-1">{String(data.explanation)}</p>
              )}
              {data.execution_result && (
                <div className="mt-2">
                  <p className="text-slate-400 text-xs font-medium mb-1">Çalışma Sonucu</p>
                  <pre className="bg-surface rounded-lg border border-surface-border text-xs p-3 font-mono">
                    <span className="text-emerald-400">{String((data.execution_result as Record<string, unknown>)?.stdout ?? "")}</span>
                    <span className="text-red-400">{String((data.execution_result as Record<string, unknown>)?.stderr ?? "")}</span>
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Final Answer (summarizer) */}
          {data?.title && (
            <div className="mt-3 space-y-3">
              <p className="text-pink-400 text-sm font-semibold">{String(data.title)}</p>
              {data.summary && (
                <p className="text-slate-300 text-sm leading-relaxed">{String(data.summary)}</p>
              )}
              {Array.isArray(data?.sections) && (data.sections as Array<{heading: string; content: string}>).map((s, i) => (
                <div key={i}>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">{s.heading}</p>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{s.content}</p>
                </div>
              ))}
              {data.conclusion && (
                <div className="p-3 bg-pink-900/10 border border-pink-800/30 rounded-lg">
                  <p className="text-pink-300 text-sm">{String(data.conclusion)}</p>
                </div>
              )}
            </div>
          )}

          {/* Review (critic) */}
          {data?.verdict && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className={clsx(
                  "text-sm font-medium px-3 py-1 rounded-full",
                  data.verdict === "approved" ? "bg-emerald-900/40 text-emerald-400" :
                  data.verdict === "rejected" ? "bg-red-900/40 text-red-400" :
                  "bg-amber-900/40 text-amber-400"
                )}>
                  {String(data.verdict)} {data.score !== undefined ? `(${String(data.score)}/10)` : ""}
                </span>
              </div>
              {Array.isArray(data?.strengths) && (data.strengths as string[]).length > 0 && (
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Güçlü Yönler</p>
                  {(data.strengths as string[]).map((s, i) => (
                    <p key={i} className="text-emerald-400 text-xs">✓ {s}</p>
                  ))}
                </div>
              )}
              {Array.isArray(data?.weaknesses) && (data.weaknesses as string[]).length > 0 && (
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Zayıf Yönler</p>
                  {(data.weaknesses as string[]).map((w, i) => (
                    <p key={i} className="text-red-400 text-xs">✗ {w}</p>
                  ))}
                </div>
              )}
              {Array.isArray(data?.recommendations) && (data.recommendations as string[]).length > 0 && (
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Öneriler</p>
                  {(data.recommendations as string[]).map((r, i) => (
                    <p key={i} className="text-blue-400 text-xs">→ {r}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [dagNodes, setDagNodes] = useState<DAGNode[]>([]);

  const fetchTask = useCallback(async () => {
    try {
      const data = await api.tasks.get(taskId);
      setTask(data);
      setDagNodes(data.dag_nodes ?? []);
    } catch {
      toast.error("Task bulunamadı.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleWSEvent = useCallback(
    (event: WSEvent) => {
      if (event.task_id !== taskId) return;

      if (event.event === "dag_updated" && event.dag) {
        setDagNodes(event.dag.nodes);
        setTask((prev) =>
          prev ? { ...prev, dag_nodes: event.dag!.nodes, dag_edges: event.dag!.edges } : prev
        );
      }
      if (event.event === "agent_state_update" && event.agent_id) {
        setDagNodes((prev) =>
          prev.map((n) =>
            n.id === event.agent_id
              ? { ...n, status: (event.status as DAGNode["status"]) ?? n.status, message: event.message ?? n.message, confidence: event.confidence ?? n.confidence }
              : n
          )
        );
      }
      if (event.event === "task_completed") {
        fetchTask();
      }
    },
    [taskId, fetchTask]
  );

  const { connected } = useWebSocket(handleWSEvent);

  const handleCancel = async () => {
    if (!task) return;
    try {
      await api.tasks.cancel(task.task_id);
      setTask((prev) => prev ? { ...prev, status: "cancelled" } : prev);
      toast.success("Task iptal edildi.");
    } catch {
      toast.error("İptal başarısız.");
    }
  };

  const isActive = task && ["pending", "planning", "running", "waiting_hitl"].includes(task.status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Yükleniyor...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Task bulunamadı.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Task Detayı"
        subtitle={task.objective.slice(0, 80)}
        connected={connected}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Üst bilgi kartı */}
        <div className="bg-surface-card rounded-xl border border-surface-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium capitalize", statusColors[task.status])}>
                  {task.status.replace("_", " ")}
                </span>
                <span className={clsx("text-xs font-medium capitalize", priorityColors[task.priority])}>
                  {task.priority} öncelik
                </span>
                {task.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-white text-base font-medium leading-relaxed">{task.objective}</p>
              <div className="flex gap-4 text-xs text-slate-500">
                <span>Oluşturuldu: {format(new Date(task.created_at), "dd MMM yyyy HH:mm")}</span>
                <span>Güncellendi: {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}</span>
                <span>Task ID: <span className="font-mono">{task.task_id.slice(0, 8)}…</span></span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={fetchTask}
                className="p-2 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:border-slate-400 transition-colors"
                title="Yenile"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {isActive && (
                <button
                  onClick={handleCancel}
                  className="p-2 rounded-lg border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors"
                  title="İptal et"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Geri
              </button>
            </div>
          </div>

          {task.error && (
            <div className="mt-3 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm">
              <span className="font-medium">Hata: </span>{task.error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Agent durumları */}
          {dagNodes.length > 0 && (
            <div className="col-span-1 space-y-2">
              <h3 className="text-white text-sm font-semibold px-1">Agent'lar</h3>
              {dagNodes.map((node) => (
                <AgentStatusCard key={node.id} node={node} />
              ))}
            </div>
          )}

          {/* DAG */}
          <div className={dagNodes.length > 0 ? "col-span-2" : "col-span-3"}>
            <AgentDAGView
              nodes={task.dag_nodes}
              edges={task.dag_edges}
              className="min-h-[300px]"
            />
          </div>
        </div>

        {/* Agent çıktıları */}
        {task.result && Object.keys(task.result).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-white text-sm font-semibold">Agent Çıktıları</h3>
            {Object.entries(task.result).map(([agentId, output]) => (
              <AgentOutputSection key={agentId} agentId={agentId} output={output} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
