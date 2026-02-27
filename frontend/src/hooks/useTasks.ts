"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Task, TaskCreate } from "@/lib/types";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.tasks.list();
      setTasks(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = async (payload: TaskCreate): Promise<Task> => {
    const task = await api.tasks.create(payload);
    setTasks((prev) => [task, ...prev]);
    return task;
  };

  const cancelTask = async (id: string): Promise<void> => {
    await api.tasks.cancel(id);
    setTasks((prev) =>
      prev.map((t) => (t.task_id === id ? { ...t, status: "cancelled" } : t))
    );
  };

  const updateTaskFromEvent = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.task_id === taskId ? { ...t, ...updates } : t))
    );
  }, []);

  return { tasks, loading, error, fetchTasks, createTask, cancelTask, updateTaskFromEvent };
}
