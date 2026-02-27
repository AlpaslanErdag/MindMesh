"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Send, Loader2, Plus, X } from "lucide-react";
import type { TaskCreate, TaskPriority } from "@/lib/types";

interface TaskSubmitFormProps {
  onSubmit: (data: TaskCreate) => Promise<void>;
}

const priorities: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-slate-400" },
  { value: "medium", label: "Medium", color: "text-blue-400" },
  { value: "high", label: "High", color: "text-amber-400" },
  { value: "critical", label: "Critical", color: "text-red-400" },
];

export function TaskSubmitForm({ onSubmit }: TaskSubmitFormProps) {
  const [objective, setObjective] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit({ objective: objective.trim(), priority, tags, context: {} });
      setObjective("");
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface-card rounded-xl border border-surface-border p-5 space-y-4">
      <h2 className="text-white font-semibold text-base">New Task</h2>

      <div>
        <label className="block text-slate-400 text-xs font-medium mb-1.5">Objective</label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Describe the high-level goal for the agents..."
          rows={3}
          className="w-full bg-surface rounded-lg border border-surface-border text-white text-sm placeholder-slate-600 px-3 py-2.5 resize-none focus:outline-none focus:border-brand-500 transition-colors"
          required
          minLength={10}
          maxLength={2000}
        />
        <p className="text-slate-600 text-xs mt-1 text-right">{objective.length}/2000</p>
      </div>

      <div>
        <label className="block text-slate-400 text-xs font-medium mb-1.5">Priority</label>
        <div className="flex gap-2">
          {priorities.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={clsx(
                "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                priority === p.value
                  ? "border-brand-500 bg-brand-900/30 text-white"
                  : "border-surface-border text-slate-500 hover:border-slate-500"
              )}
            >
              <span className={p.color}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-slate-400 text-xs font-medium mb-1.5">Tags</label>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Add a tag..."
            className="flex-1 bg-surface rounded-lg border border-surface-border text-white text-sm placeholder-slate-600 px-3 py-2 focus:outline-none focus:border-brand-500 transition-colors"
          />
          <button
            type="button"
            onClick={addTag}
            className="p-2 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:border-slate-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 bg-brand-900/40 text-brand-300 text-xs px-2 py-0.5 rounded-full"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || objective.trim().length < 10}
        className={clsx(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors",
          loading || objective.trim().length < 10
            ? "bg-slate-700 text-slate-500 cursor-not-allowed"
            : "bg-brand-600 hover:bg-brand-700 text-white"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit Task
          </>
        )}
      </button>
    </form>
  );
}
