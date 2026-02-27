"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DAGNode, DAGEdge } from "@/lib/types";
import { clsx } from "clsx";

const statusBg: Record<string, string> = {
  pending: "#1e293b",
  running: "#1e3a5f",
  completed: "#14532d",
  failed: "#450a0a",
  waiting_hitl: "#451a03",
};

const statusBorder: Record<string, string> = {
  pending: "#475569",
  running: "#3b82f6",
  completed: "#22c55e",
  failed: "#ef4444",
  waiting_hitl: "#f59e0b",
};

interface AgentDAGViewProps {
  nodes: DAGNode[];
  edges: DAGEdge[];
  className?: string;
}

export function AgentDAGView({ nodes, edges, className }: AgentDAGViewProps) {
  const flowNodes: Node[] = useMemo(() => {
    const cols: Record<string, number> = {};
    return nodes.map((node, idx) => {
      const col = cols[node.type] ?? 0;
      cols[node.type] = col + 1;
      const typeIndex = ["planner", "researcher", "coder", "critic", "summarizer"].indexOf(node.type);

      return {
        id: node.id,
        position: { x: (typeIndex >= 0 ? typeIndex : idx) * 220, y: col * 120 },
        data: { label: node.label, status: node.status, type: node.type },
        style: {
          background: statusBg[node.status] ?? "#1e293b",
          border: `2px solid ${statusBorder[node.status] ?? "#475569"}`,
          borderRadius: "10px",
          padding: "10px 14px",
          minWidth: "160px",
          color: "#f1f5f9",
          fontSize: "12px",
          fontFamily: "inherit",
        },
      };
    });
  }, [nodes]);

  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 2 },
      })),
    [edges]
  );

  if (nodes.length === 0) {
    return (
      <div className={clsx("flex items-center justify-center bg-surface-card rounded-xl border border-surface-border text-slate-500 text-sm", className)}>
        No active DAG. Submit a task to begin.
      </div>
    );
  }

  return (
    <div className={clsx("bg-surface-card rounded-xl border border-surface-border overflow-hidden flex flex-col", className)}>
      <div className="px-4 py-3 border-b border-surface-border flex-shrink-0">
        <h3 className="text-white text-sm font-semibold">Task Execution DAG</h3>
      </div>
      <div style={{ height: 340, width: "100%" }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: "#0f172a" }}
        >
          <Background color="#1e293b" gap={24} />
          <Controls
            style={{ background: "#1e293b", border: "1px solid #334155" }}
            showInteractive={false}
          />
          <MiniMap
            nodeColor={(n) => statusBorder[n.data?.status as string] ?? "#475569"}
            style={{ background: "#1e293b" }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
