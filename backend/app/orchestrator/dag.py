"""DAG (Directed Acyclic Graph) engine for managing task execution graphs."""

from typing import Any

import networkx as nx

from app.models.task import AgentStatus, DAGEdge, DAGNode


class TaskDAG:
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        self._graph: nx.DiGraph = nx.DiGraph()

    def add_node(self, node: DAGNode) -> None:
        self._graph.add_node(node.id, **node.model_dump())

    def add_edge(self, edge: DAGEdge) -> None:
        if not self._graph.has_node(edge.source):
            raise ValueError(f"Source node '{edge.source}' not in DAG.")
        if not self._graph.has_node(edge.target):
            raise ValueError(f"Target node '{edge.target}' not in DAG.")
        self._graph.add_edge(edge.source, edge.target)
        if not nx.is_directed_acyclic_graph(self._graph):
            self._graph.remove_edge(edge.source, edge.target)
            raise ValueError(f"Adding edge {edge.source} -> {edge.target} would create a cycle.")

    def set_node_status(self, node_id: str, status: AgentStatus, message: str = "", confidence: float | None = None) -> None:
        if node_id not in self._graph:
            raise KeyError(f"Node '{node_id}' not found in DAG.")
        self._graph.nodes[node_id]["status"] = status
        self._graph.nodes[node_id]["message"] = message
        if confidence is not None:
            self._graph.nodes[node_id]["confidence"] = confidence

    def get_ready_nodes(self) -> list[str]:
        """Return nodes whose all predecessors have completed and that are still pending."""
        ready = []
        for node_id, data in self._graph.nodes(data=True):
            if data.get("status") != AgentStatus.pending:
                continue
            preds = list(self._graph.predecessors(node_id))
            if all(
                self._graph.nodes[p].get("status") == AgentStatus.completed
                for p in preds
            ):
                ready.append(node_id)
        return ready

    def is_complete(self) -> bool:
        return all(
            d.get("status") in (AgentStatus.completed, AgentStatus.failed)
            for _, d in self._graph.nodes(data=True)
        )

    def has_failures(self) -> bool:
        return any(
            d.get("status") == AgentStatus.failed
            for _, d in self._graph.nodes(data=True)
        )

    def to_snapshot(self) -> dict[str, Any]:
        nodes = [
            DAGNode(
                id=nid,
                type=data.get("type", "unknown"),
                label=data.get("label", nid),
                status=data.get("status", AgentStatus.pending),
                message=data.get("message", ""),
                confidence=data.get("confidence"),
            ).model_dump()
            for nid, data in self._graph.nodes(data=True)
        ]
        edges = [
            DAGEdge(source=u, target=v).model_dump()
            for u, v in self._graph.edges()
        ]
        return {"nodes": nodes, "edges": edges}

    @classmethod
    def from_plan(cls, task_id: str, plan: list[dict[str, Any]]) -> "TaskDAG":
        dag = cls(task_id)
        step_to_node_id: dict[int, str] = {}

        for step in plan:
            step_num = int(step["step"])
            agent_type = step["agent_type"]
            node_id = f"{agent_type}-{step_num}"
            step_to_node_id[step_num] = node_id

            dag.add_node(
                DAGNode(
                    id=node_id,
                    type=agent_type,
                    label=f"{agent_type.capitalize()}: {step['task'][:80]}",
                    status=AgentStatus.pending,
                )
            )

        for step in plan:
            node_id = step_to_node_id[int(step["step"])]
            for dep in step.get("depends_on", []):
                dep_int = int(dep)
                if dep_int in step_to_node_id:
                    dag.add_edge(DAGEdge(source=step_to_node_id[dep_int], target=node_id))

        return dag
