import { type ReactNode, useState, useRef } from "react";
import { Upload, Loader2, Sparkles, X, Check, AlertTriangle } from "lucide-react";
import {
  uploadPhoto,
  analyzePhoto,
  updatePhoto,
  photoPublicUrl,
} from "@/lib/api";
import {
  DAMAGE_CATEGORY_LABELS,
  CONDITION_STAGE_LABELS,
  type ConditionStage,
  type DamageCategory,
  type Photo,
  type AiResult,
  type AiStatus,
} from "@/lib/types";
import { captureDateLabel, fmtDateTime } from "@/lib/format";

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  error: string | null;
  photo: Photo | null;
}

export function PhotoUploader({
  propertyId,
  roomId,
  stage,
  onUploaded,
}: {
  propertyId: string;
  roomId: string;
  stage: ConditionStage;
  onUploaded: () => void;
}): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const file of arr) {
      const id = crypto.randomUUID();
      setQueue((q) => [...q, { id, name: file.name, progress: 0, error: null, photo: null }]);
      try {
        const photo = await uploadPhoto(file, propertyId, roomId, stage, (f) =>
          setQueue((q) => q.map((u) => (u.id === id ? { ...u, progress: f } : u))),
        );
        setQueue((q) => q.map((u) => (u.id === id ? { ...u, photo, progress: 1 } : u)));
        onUploaded();
      } catch (err) {
        setQueue((q) =>
          q.map((u) => (u.id === id ? { ...u, error: err instanceof Error ? err.message : "Upload failed" } : u)),
        );
      }
    }
  };

  const clearFinished = () => setQueue((q) => q.filter((u) => !u.photo && !u.error));

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-teal-400 bg-teal-50" : "border-slate-300 bg-white"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <Upload size={22} className="mx-auto text-slate-400" />
        <p className="mt-2 text-sm text-slate-600">
          Drag photos here or{" "}
          <button type="button" className="font-medium text-teal-600 hover:text-teal-700" onClick={() => inputRef.current?.click()}>
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-slate-400">JPEG, PNG, or WebP · up to 15 MB · added as {CONDITION_STAGE_LABELS[stage]}</p>
      </div>

      {queue.length > 0 && (
        <div className="mt-4 space-y-2">
          {queue.map((u) => (
            <div key={u.id} className="card flex items-center gap-3 p-3">
              {u.photo ? (
                <img src={photoPublicUrl(u.photo.storage_path)} alt="" className="h-12 w-12 rounded object-cover" />
              ) : u.error ? (
                <span className="flex h-12 w-12 items-center justify-center rounded bg-red-50 text-red-500"><AlertTriangle size={18} /></span>
              ) : (
                <Loader2 size={18} className="dp-spin text-teal-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-700">{u.name}</p>
                {u.error && <p className="text-xs text-red-500">{u.error}</p>}
                {u.photo && <p className="text-xs text-emerald-600">Uploaded</p>}
              </div>
              {u.photo && <Check size={16} className="text-emerald-500" />}
              {u.error && <X size={16} className="cursor-pointer text-slate-400" onClick={clearFinished} />}
            </div>
          ))}
          {queue.some((u) => u.photo || u.error) && (
            <button className="btn-ghost text-xs" onClick={clearFinished}>Clear finished</button>
          )}
        </div>
      )}
    </div>
  );
}

export function AiAnalysisPanel({
  photo,
  onUpdated,
}: {
  photo: Photo;
  onUpdated: () => void;
}): ReactNode {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedDescription, setEditedDescription] = useState(photo.description ?? "");
  const [editedCategory, setEditedCategory] = useState<DamageCategory | "">(photo.damage_category ?? "");
  const [editedNotes, setEditedNotes] = useState(photo.notes ?? "");
  const [saving, setSaving] = useState(false);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await analyzePhoto(photo);
      if (res.status === "ok" && res.result) {
        await updatePhoto(photo.id, {
          ai_status: "ok",
          ai_result: res.result,
        });
        onUpdated();
      } else {
        const status: AiStatus = res.status === "ai_unavailable" ? "unavailable" : res.status === "ai_disabled" ? "unavailable" : "error";
        await updatePhoto(photo.id, { ai_status: status });
        setError(res.message ?? "AI analysis failed.");
        onUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveEdits = async () => {
    setSaving(true);
    try {
      await updatePhoto(photo.id, {
        description: editedDescription.trim() || null,
        damage_category: (editedCategory || null) as DamageCategory | null,
        notes: editedNotes.trim() || null,
        ai_user_edited: true,
      });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const confirmAi = async () => {
    const r = photo.ai_result;
    if (!r) return;
    await updatePhoto(photo.id, {
      description: r.description,
      damage_category: r.suggested_category,
      ai_user_confirmed: true,
    });
    setEditedDescription(r.description);
    setEditedCategory(r.suggested_category ?? "");
    onUpdated();
  };

  const ai = photo.ai_result;

  return (
    <div className="space-y-4">
      {/* AI panel */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Sparkles size={16} className="text-teal-600" /> AI photo analysis
          </div>
          <button
            className="btn-secondary !py-1.5 !text-xs"
            onClick={runAnalysis}
            disabled={analyzing}
          >
            {analyzing ? <><Loader2 size={14} className="dp-spin" /> Analyzing…</> : ai ? "Re-run analysis" : "Analyze with AI"}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</p>
        )}

        {photo.ai_status === "unavailable" && !error && (
          <p className="mt-3 text-xs text-slate-500">
            AI is unavailable. You can still document this photo manually below. Configure your
            Ollama backend in Settings to enable AI analysis.
          </p>
        )}

        {ai && (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-700">{ai.description}</p>
            {ai.suggested_category && (
              <p className="text-xs text-slate-500">
                Suggested category:{" "}
                <span className="font-medium text-slate-700">{DAMAGE_CATEGORY_LABELS[ai.suggested_category]}</span>
              </p>
            )}
            {ai.observations.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                {ai.observations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`badge ${
                ai.confidence === "high" ? "bg-emerald-50 text-emerald-700" :
                ai.confidence === "medium" ? "bg-amber-50 text-amber-700" :
                ai.confidence === "low" ? "bg-red-50 text-red-600" :
                "bg-slate-100 text-slate-600"
              }`}>Confidence: {ai.confidence}</span>
              {ai.uncertainty.map((u, i) => (
                <span key={i} className="badge bg-slate-100 text-slate-500">{u}</span>
              ))}
            </div>
            {!photo.ai_user_confirmed && (
              <div className="flex gap-2 pt-2">
                <button className="btn-primary !py-1.5 !text-xs" onClick={confirmAi}>
                  <Check size={14} /> Accept suggestion
                </button>
                <span className="self-center text-xs text-slate-400">or edit manually below</span>
              </div>
            )}
            {photo.ai_user_confirmed && (
              <p className="text-xs text-emerald-600">AI suggestion reviewed and accepted.</p>
            )}
            <p className="border-t border-slate-200 pt-2 text-xs text-slate-400">
              AI observations are suggestions, not definitive findings. Review before saving.
            </p>
          </div>
        )}
      </div>

      {/* Manual edit form */}
      <div className="space-y-3">
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-16" placeholder="Describe what is visible in this photo" value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Damage category</label>
            <select className="input" value={editedCategory} onChange={(e) => setEditedCategory(e.target.value as DamageCategory | "")}>
              <option value="">— None —</option>
              {(Object.keys(DAMAGE_CATEGORY_LABELS) as DamageCategory[]).map((c) => (
                <option key={c} value={c}>{DAMAGE_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Condition stage</label>
            <select
              className="input"
              value={photo.condition_stage}
              onChange={async (e) => {
                await updatePhoto(photo.id, { condition_stage: e.target.value as ConditionStage });
                onUpdated();
              }}
            >
              {(Object.keys(CONDITION_STAGE_LABELS) as ConditionStage[]).map((s) => (
                <option key={s} value={s}>{CONDITION_STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input min-h-12" placeholder="Any additional context" value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={saveEdits} disabled={saving}>
            {saving ? "Saving…" : "Save details"}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Uploaded {fmtDateTime(photo.upload_timestamp)} · {captureDateLabel(photo)}
        </p>
      </div>
    </div>
  );
}

export { type AiResult };
