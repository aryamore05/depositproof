import { type ReactNode, useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Loading } from "@/components/ui";
import { AiStatusBadge, useAiConnection } from "@/components/AiStatus";
import { fetchSettings, saveSetting, checkAiConnection } from "@/lib/api";
import {
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  Save,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Cpu,
  ExternalLink,
  Info,
} from "lucide-react";

export function SettingsPage(): ReactNode {
  const ai = useAiConnection();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [form, setForm] = useState({ backendUrl: "", model: "llava:7b", enabled: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      setForm({
        backendUrl: s.ai_backend_url ?? "",
        model: s.ai_model ?? "llava:7b",
        enabled: s.ai_enabled !== "false",
      });
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await saveSetting("ai_backend_url", form.backendUrl.trim());
      await saveSetting("ai_model", form.model.trim() || "llava:7b");
      await saveSetting("ai_enabled", form.enabled ? "true" : "false");
      setSaved(true);
      ai.reload();
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await checkAiConnection();
      setTestResult(r.connected ? `Connected — ${r.message}` : `Not connected — ${r.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (!settings) return <Loading />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="AI connection, privacy, and about DepositProof." />

      <div className="space-y-6">
        {/* AI connection status */}
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-teal-600" />
              <h2 className="text-base font-semibold text-slate-800">AI connection status</h2>
            </div>
            <AiStatusBadge state={ai.state} />
          </div>
          <p className="mt-3 text-sm text-slate-600">{ai.message || "Checking connection…"}</p>
          {ai.backendUrl && (
            <p className="mt-1 text-xs text-slate-400">Backend: {ai.backendUrl}</p>
          )}
          <button className="btn-secondary mt-4" onClick={ai.reload}>
            <RefreshCw size={14} /> Recheck connection
          </button>
        </section>

        {/* AI configuration */}
        <section className="card p-6">
          <h2 className="text-base font-semibold text-slate-800">AI backend configuration</h2>
          <p className="mt-1 text-sm text-slate-500">
            Point DepositProof at your own Ollama instance. Photos are sent only to the URL you
            configure — never to a third-party AI provider.
          </p>

          <form onSubmit={save} className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="url">Ollama backend URL</label>
              <input
                id="url"
                className="input"
                placeholder="http://localhost:11434"
                value={form.backendUrl}
                onChange={(e) => setForm((f) => ({ ...f, backendUrl: e.target.value }))}
              />
              <p className="mt-1 text-xs text-slate-400">
                If the frontend runs in a hosted preview, it cannot reach your computer's localhost.
                Use a URL both the browser and the backend can reach, and ensure Ollama has
                <code className="mx-1 rounded bg-slate-100 px-1">OLLAMA_ORIGINS=*</code> set.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="model">Vision model name</label>
              <input
                id="model"
                className="input"
                placeholder="llava:7b"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
              <p className="mt-1 text-xs text-slate-400">
                Default: llava:7b. Pull with <code className="rounded bg-slate-100 px-1">ollama pull llava:7b</code>.
                Any Ollama-compatible vision model works (e.g. llama3.2-vision, moondream).
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-teal-600"
              />
              Enable AI analysis buttons
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save size={16} /> {saving ? "Saving…" : "Save settings"}
              </button>
              <button type="button" className="btn-secondary" onClick={test} disabled={testing}>
                {testing ? <Loader2 size={14} className="dp-spin" /> : <Wifi size={14} />} Test connection
              </button>
              {saved && <span className="text-sm text-emerald-600">Saved.</span>}
              {testResult && <span className="text-sm text-slate-600">{testResult}</span>}
            </div>
          </form>
        </section>

        {/* About / open-source AI */}
        <section className="card p-6">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-teal-600" />
            <h2 className="text-base font-semibold text-slate-800">About open-source AI in DepositProof</h2>
          </div>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <p>
              DepositProof uses an open-source vision-language model running through{" "}
              <a href="https://ollama.com" target="_blank" rel="noreferrer" className="font-medium text-teal-600 hover:underline">
                Ollama <ExternalLink size={11} className="inline" />
              </a>{" "}
              to describe property photos and suggest possible damage categories. The model runs on
              your own machine — your photos are not sent to a paid external AI API.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Run inference locally with <code className="rounded bg-slate-100 px-1">ollama pull llava:7b</code></li>
              <li>Swap the model for any Ollama-compatible vision model in Settings above.</li>
              <li>Local inference reduces dependence on paid external AI APIs.</li>
              <li>If Ollama is unavailable, manual documentation works fully — no fabricated results.</li>
            </ul>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <Info size={12} className="mb-0.5 mr-1 inline" />
              AI limitations: the model cannot determine the age or cause of damage, identify who
              caused it, verify legal responsibility, or certify image authenticity. Its observations
              are suggestions to review, not definitive findings. Blurry, dark, or angled images may
              produce inaccurate descriptions.
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="card p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-teal-600" />
            <h2 className="text-base font-semibold text-slate-800">Privacy &amp; storage</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>• Photos are stored in this project's Supabase storage bucket, not a third-party image host.</li>
            <li>• AI analysis sends an image only to the Ollama URL you configure. No other external AI provider is called.</li>
            <li>• File types are validated (JPEG, PNG, WebP) and size is capped at 15 MB.</li>
            <li>• Files are stored under server-generated UUID paths, never user-supplied filenames.</li>
            <li>• This MVP is single-tenant (no sign-in). Do not store sensitive photos in a shared deployment.</li>
          </ul>
        </section>

        <p className="pb-4 text-center text-xs text-slate-400">
          DepositProof · Document it before. Prove it later. · Not legal advice.
        </p>
      </div>
    </div>
  );
}
