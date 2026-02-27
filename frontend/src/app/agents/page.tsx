"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Plus, Trash2, ChevronDown, ChevronUp, Bot, Cpu, Info } from "lucide-react";
import toast from "react-hot-toast";
import { Header } from "@/components/layout/Header";
import { ComingSoonPanel } from "@/components/layout/ComingSoonBadge";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";

interface CustomAgent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  color: string;
  created_at: string;
}

const BUILT_IN_AGENTS = [
  { name: "planner",    desc: "Breaks the objective into steps and produces a DAG execution plan.",  color: "violet" },
  { name: "researcher", desc: "Searches the web, gathers information and synthesizes findings.",      color: "sky" },
  { name: "coder",      desc: "Writes Python code and executes it inside a Docker sandbox.",          color: "emerald" },
  { name: "critic",     desc: "Reviews other agents' outputs, scores quality and gives feedback.",    color: "amber" },
  { name: "summarizer", desc: "Synthesizes all prior outputs into a clean final answer for the user.", color: "pink" },
];

const colorBorder: Record<string, string> = {
  violet: "border-violet-500", sky: "border-sky-500", emerald: "border-emerald-500",
  amber: "border-amber-500",   pink: "border-pink-500", slate: "border-slate-500",
  blue: "border-blue-500",     rose: "border-rose-500", teal: "border-teal-500",
};
const colorText: Record<string, string> = {
  violet: "text-violet-400", sky: "text-sky-400", emerald: "text-emerald-400",
  amber: "text-amber-400",   pink: "text-pink-400", slate: "text-slate-400",
  blue: "text-blue-400",     rose: "text-rose-400", teal: "text-teal-400",
};

const COLOR_OPTIONS = ["slate","blue","violet","sky","emerald","teal","amber","pink","rose"];

const PROMPT_TEMPLATES = [
  {
    label: "Translator",
    name: "translator",
    description: "Translates the given text into a specified target language.",
    prompt: `You are a Translator agent. Translate the given text to the target language specified in the task.

Respond ONLY with a JSON object:
{
  "translated_text": "The full translation here",
  "source_language": "detected source language",
  "target_language": "target language",
  "confidence": 0.9
}`,
    color: "teal",
  },
  {
    label: "Data Analyst",
    name: "data_analyst",
    description: "Analyzes numerical data or dataset descriptions to extract insights.",
    prompt: `You are a Data Analyst agent. Analyze the provided data or dataset description and extract meaningful insights.

Respond ONLY with a JSON object:
{
  "key_metrics": ["metric1", "metric2"],
  "insights": ["insight1", "insight2"],
  "recommendations": ["rec1"],
  "confidence": 0.85
}`,
    color: "blue",
  },
  {
    label: "SEO Expert",
    name: "seo_expert",
    description: "Provides actionable SEO recommendations and keyword analysis for content.",
    prompt: `You are an SEO Expert agent. Analyze the given content or topic and provide actionable SEO recommendations.

Respond ONLY with a JSON object:
{
  "primary_keywords": ["kw1", "kw2"],
  "secondary_keywords": ["kw3"],
  "title_suggestions": ["title1"],
  "meta_description": "suggested meta description",
  "recommendations": ["rec1"],
  "confidence": 0.88
}`,
    color: "rose",
  },
];

function BuiltInCard({ agent }: { agent: typeof BUILT_IN_AGENTS[0] }) {
  return (
    <div className={clsx("rounded-lg border-l-4 bg-surface-card p-4", colorBorder[agent.color])}>
      <div className="flex items-center gap-2 mb-1">
        <Cpu className={clsx("w-4 h-4", colorText[agent.color])} />
        <span className={clsx("text-sm font-semibold capitalize", colorText[agent.color])}>{agent.name}</span>
        <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">built-in</span>
      </div>
      <p className="text-slate-400 text-xs">{agent.desc}</p>
    </div>
  );
}

function CustomAgentCard({ agent, onDelete }: { agent: CustomAgent; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={clsx("rounded-lg border-l-4 bg-surface-card overflow-hidden", colorBorder[agent.color] ?? "border-slate-500")}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className={clsx("w-4 h-4", colorText[agent.color] ?? "text-slate-400")} />
            <span className={clsx("text-sm font-semibold", colorText[agent.color] ?? "text-slate-300")}>{agent.name}</span>
            <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">custom</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setExpanded(v => !v)} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onDelete(agent.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-slate-400 text-xs mt-1">{agent.description}</p>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-surface-border">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mt-3 mb-1">System Prompt</p>
          <pre className="text-slate-300 text-xs font-mono bg-surface rounded-lg p-3 border border-surface-border overflow-x-auto whitespace-pre-wrap max-h-48">
            {agent.system_prompt}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", system_prompt: "", color: "slate" });
  const [submitting, setSubmitting] = useState(false);

  const { connected } = useWebSocket();

  const fetchAgents = useCallback(async () => {
    try {
      const data = await api.agents.custom();
      setCustomAgents(data);
    } catch {
      toast.error("Failed to load agents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const applyTemplate = (idx: number) => {
    const t = PROMPT_TEMPLATES[idx];
    setForm({ name: t.name, description: t.description, system_prompt: t.prompt, color: t.color });
    setSelectedTemplate(idx);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await api.agents.createCustom(form);
      setCustomAgents(prev => [created, ...prev]);
      setForm({ name: "", description: "", system_prompt: "", color: "slate" });
      setShowForm(false);
      setSelectedTemplate(null);
      toast.success(`Agent "${created.name}" created.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create agent.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const agent = customAgents.find(a => a.id === id);
    if (!agent) return;
    try {
      await api.agents.deleteCustom(id);
      setCustomAgents(prev => prev.filter(a => a.id !== id));
      toast.success(`Agent "${agent.name}" deleted.`);
    } catch {
      toast.error("Failed to delete agent.");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Agent Management"
        subtitle={`${BUILT_IN_AGENTS.length} built-in · ${customAgents.length} custom`}
        connected={connected}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-6 max-w-4xl mx-auto w-full">

        <div className="flex gap-3 p-4 bg-brand-900/20 border border-brand-700/30 rounded-xl">
          <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-300 text-sm">
            Custom agents are automatically discovered by the Planner at runtime. Once created,
            the Planner can include them in future task plans when appropriate.
            Agent names must be <span className="font-mono text-brand-300">snake_case</span> and unique.
          </p>
        </div>

        {/* Built-in Agents */}
        <div>
          <h2 className="text-white font-semibold text-sm mb-3">Built-in Agents</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BUILT_IN_AGENTS.map(a => <BuiltInCard key={a.name} agent={a} />)}
          </div>
        </div>

        {/* Custom Agents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm">
              Custom Agents
              {customAgents.length > 0 && (
                <span className="ml-2 text-xs text-slate-500">({customAgents.length})</span>
              )}
            </h2>
            <button
              onClick={() => { setShowForm(v => !v); setSelectedTemplate(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Agent
            </button>
          </div>

          {showForm && (
            <div className="mb-4">
              <p className="text-slate-400 text-xs mb-2">Start from a template (optional):</p>
              <div className="flex flex-wrap gap-2">
                {PROMPT_TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(i)}
                    className={clsx(
                      "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                      selectedTemplate === i
                        ? "border-brand-500 bg-brand-900/30 text-white"
                        : "border-surface-border text-slate-400 hover:border-slate-500"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="bg-surface-card rounded-xl border border-surface-border p-5 mb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">
                    Agent Name <span className="text-slate-600">(snake_case)</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))}
                    placeholder="e.g. translator"
                    required
                    className="w-full bg-surface rounded-lg border border-surface-border text-white text-sm placeholder-slate-600 px-3 py-2 focus:outline-none focus:border-brand-500 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Color</label>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, color: c }))}
                        className={clsx(
                          "w-6 h-6 rounded-full border-2 transition-transform",
                          form.color === c ? "scale-125 border-white" : "border-transparent",
                          `bg-${c}-500`
                        )}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="What does this agent do? (The Planner reads this)"
                  required
                  className="w-full bg-surface rounded-lg border border-surface-border text-white text-sm placeholder-slate-600 px-3 py-2 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">System Prompt</label>
                <textarea
                  value={form.system_prompt}
                  onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
                  placeholder={`You are a [role] agent. Your job is to...\n\nRespond ONLY with a JSON object:\n{\n  "output": "...",\n  "confidence": 0.9\n}`}
                  rows={10}
                  required
                  className="w-full bg-surface rounded-lg border border-surface-border text-white text-sm placeholder-slate-600 px-3 py-2.5 resize-y focus:outline-none focus:border-brand-500 transition-colors font-mono"
                />
                <p className="text-slate-600 text-xs mt-1">
                  Tip: Specify a JSON output format — the Task detail page will render it properly.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setSelectedTemplate(null); }}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-surface-border rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Agent"}
                </button>
              </div>
            </form>
          )}

          {loading && <p className="text-slate-500 text-sm">Loading...</p>}

          {!loading && customAgents.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
              <Bot className="w-8 h-8 text-slate-600" />
              <p className="text-slate-500 text-sm">No custom agents yet.</p>
              <p className="text-slate-600 text-xs">Click "New Agent" or start from a template.</p>
            </div>
          )}

          <div className="space-y-2">
            {customAgents.map(a => <CustomAgentCard key={a.id} agent={a} onDelete={handleDelete} />)}
          </div>
        </div>

        {/* Coming Soon section */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ComingSoonPanel
            title="Agent Performance Stats"
            description="Track task count, avg. runtime and confidence scores per agent."
          />
          <ComingSoonPanel
            title="Agent Versioning"
            description="Save and switch between different versions of a custom agent's prompt."
          />
        </div>
      </div>
    </div>
  );
}
