"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Header } from "@/components/layout/Header";
import { AgentDAGView } from "@/components/dashboard/AgentDAGView";
import { AgentStatusCard } from "@/components/dashboard/AgentStatusCard";
import { LiveEventFeed } from "@/components/dashboard/LiveEventFeed";
import { TaskSubmitForm } from "@/components/command/TaskSubmitForm";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTasks } from "@/hooks/useTasks";
import { api } from "@/lib/api";
import { ComingSoonPanel } from "@/components/layout/ComingSoonBadge";
import type { DAGEdge, DAGNode, Task, TaskCreate, WSEvent } from "@/lib/types";

export default function DashboardPage() {
  const { createTask, updateTaskFromEvent } = useTasks();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dagNodes, setDagNodes] = useState<DAGNode[]>([]);
  const [dagEdges, setDagEdges] = useState<DAGEdge[]>([]);

  // On mount: find the most recent active task and restore its DAG
  useEffect(() => {
    api.tasks.list(5, 0).then((tasks) => {
      const active = tasks.find((t) =>
        ["pending", "planning", "running", "waiting_hitl"].includes(t.status)
      );
      if (active) {
        setActiveTask(active);
        setDagNodes(active.dag_nodes ?? []);
        setDagEdges(active.dag_edges ?? []);
      }
    });
  }, []);

  const applyDag = useCallback((dag: { nodes: DAGNode[]; edges: DAGEdge[] }) => {
    setDagNodes(dag.nodes);
    setDagEdges(dag.edges);
  }, []);

  const handleWSEvent = useCallback(
    (event: WSEvent) => {
      if (event.event === "dag_initialized" && event.dag) {
        applyDag(event.dag);
      }
      if (event.event === "dag_updated" && event.dag) {
        applyDag(event.dag);
      }
      if (event.event === "agent_state_update" && event.agent_id) {
        setDagNodes((prev) =>
          prev.map((n) =>
            n.id === event.agent_id
              ? {
                  ...n,
                  status: (event.status as DAGNode["status"]) ?? n.status,
                  message: event.message ?? n.message,
                  confidence: event.confidence ?? n.confidence,
                }
              : n
          )
        );
      }
      if (event.task_id) {
        updateTaskFromEvent(event.task_id, {
          status: (event.status as Task["status"]) ?? undefined,
        });
      }
      if (event.event === "task_completed") {
        const label = event.status === "completed" ? "Task tamamlandı." : "Task başarısız oldu.";
        event.status === "completed" ? toast.success(label) : toast.error(label);
        // Refresh DAG from API after completion
        if (event.task_id) {
          api.tasks.get(event.task_id).then((t) => {
            setDagNodes(t.dag_nodes ?? []);
            setDagEdges(t.dag_edges ?? []);
            setActiveTask(t);
          });
        }
      }
      if (event.event === "hitl_required") {
        toast(`${event.agent_id} için insan onayı gerekiyor`, { icon: "⚠️" });
      }
    },
    [updateTaskFromEvent, applyDag]
  );

  const { connected, events } = useWebSocket(handleWSEvent);

  const handleSubmit = async (data: TaskCreate) => {
    try {
      const task = await createTask(data);
      setActiveTask(task);
      setDagNodes([]);
      setDagEdges([]);
      toast.success("Task gönderildi — planlama başlıyor...");
    } catch {
      toast.error("Task gönderilemedi.");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Dashboard"
        subtitle={
          activeTask
            ? `${activeTask.status.toUpperCase()} — ${activeTask.objective.slice(0, 60)}${activeTask.objective.length > 60 ? "…" : ""}`
            : "Aktif task yok"
        }
        connected={connected}
      />
      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-3 gap-5">
        {/* Sol kolon */}
        <div className="col-span-1 space-y-5">
          <TaskSubmitForm onSubmit={handleSubmit} />

          {dagNodes.length > 0 && (
            <div className="bg-surface-card rounded-xl border border-surface-border p-4 space-y-3">
              <h3 className="text-white text-sm font-semibold">Agent Durumları</h3>
              <div className="space-y-2">
                {dagNodes.map((node) => (
                  <AgentStatusCard key={node.id} node={node} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sağ kolonlar */}
        <div className="col-span-2 space-y-5">
          <AgentDAGView
            nodes={dagNodes}
            edges={dagEdges}
            className="min-h-[360px]"
          />
          <LiveEventFeed events={events} />
          <div className="grid grid-cols-2 gap-4">
            <ComingSoonPanel
              title="Agent Performance Metrics"
              description="Average runtime, success rate and confidence scores per agent type."
            />
            <ComingSoonPanel
              title="Task Analytics"
              description="Token usage, cost estimation and throughput over time."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
