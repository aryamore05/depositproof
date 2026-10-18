import { type ReactNode, useState } from "react";
import { useAsync, Loading, EmptyState, ConfirmDialog } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import {
  fetchProperty,
  fetchRooms,
  fetchPhotosByRoom,
  fetchChecklist,
  setChecklistStatus,
  deletePhoto,
} from "@/lib/api";
import {
  CHECKLIST_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  CONDITION_STAGE_LABELS,
  type ChecklistStatus,
  type ConditionStage,
  type Photo as PhotoType,
} from "@/lib/types";
import { photoPublicUrl } from "@/lib/api";
import { fmtDateTime, captureDateLabel } from "@/lib/format";
import {
  ArrowLeft,
  Camera,
  Trash2,
  X,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  AlertTriangle,
} from "lucide-react";
import { PhotoUploader, AiAnalysisPanel } from "@/components/Photo";

const STATUSES: ChecklistStatus[] = ["good", "existing-damage", "needs-attention", "not-inspected"];

const STATUS_STYLE: Record<ChecklistStatus, { cls: string; icon: typeof CheckCircle2 }> = {
  good: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  "existing-damage": { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle },
  "needs-attention": { cls: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
  "not-inspected": { cls: "bg-slate-50 text-slate-500 border-slate-200", icon: CircleDashed },
};

export function RoomInspection({ propertyId, roomId }: { propertyId: string; roomId: string }): ReactNode {
  const { data: property } = useAsync(() => fetchProperty(propertyId), [propertyId]);
  const { data: rooms } = useAsync(() => fetchRooms(propertyId), [propertyId]);
  const { data: photos, loading: photosLoading, reload: reloadPhotos } = useAsync(() => fetchPhotosByRoom(roomId), [roomId]);
  const { data: checklist, loading: checklistLoading, reload: reloadChecklist } = useAsync(() => fetchChecklist(roomId), [roomId]);

  const [stage, setStage] = useState<ConditionStage>("move-in");
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoType | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<PhotoType | null>(null);
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});

  const room = (rooms ?? []).find((r) => r.id === roomId);
  const photoList = photos ?? [];
  const checklistList = checklist ?? [];
  const inspected = checklistList.filter((c) => c.status !== "not-inspected").length;
  const progress = checklistList.length ? Math.round((inspected / checklistList.length) * 100) : 0;

  if (!property) return <Loading />;
  if (!room) return <EmptyState title="Room not found" action={<button className="btn-primary" onClick={() => navigate(`/properties/${propertyId}`)}>Back to property</button>} />;

  const stagePhotos = photoList.filter((p) => p.condition_stage === stage);

  const saveNote = async (id: string) => {
    await setChecklistStatus(id, checklistList.find((c) => c.id === id)?.status ?? "not-inspected", activeNotes[id] ?? "");
    reloadChecklist();
  };

  return (
    <div>
      <PageHeader
        title={room.name}
        subtitle={`${ROOM_TYPE_LABELS[room.room_type]} · ${property.name}`}
        back={{ label: property.name, to: `/properties/${propertyId}` }}
        actions={
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(Object.keys(CONDITION_STAGE_LABELS) as ConditionStage[]).map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  stage === s ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {CONDITION_STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        }
      />

      {/* Progress */}
      <div className="card mb-6 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Inspection progress</span>
          <span className="font-medium text-slate-800">{inspected}/{checklistList.length} items</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Photos */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          Photos — {CONDITION_STAGE_LABELS[stage]} ({stagePhotos.length})
        </h2>
        <PhotoUploader propertyId={propertyId} roomId={roomId} stage={stage} onUploaded={reloadPhotos} />

        {photosLoading ? (
          <Loading />
        ) : stagePhotos.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-400">
            <Camera size={28} className="text-slate-300" />
            No {CONDITION_STAGE_LABELS[stage]} photos yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stagePhotos.map((p) => (
              <div key={p.id} className="card group overflow-hidden">
                <button onClick={() => setSelectedPhoto(p)} className="block aspect-video w-full overflow-hidden bg-slate-100">
                  <img src={photoPublicUrl(p.storage_path)} alt={p.description ?? ""} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </button>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm text-slate-700">{p.description || <span className="text-slate-400">No description</span>}</p>
                  <p className="mt-1 text-xs text-slate-400">{captureDateLabel(p)}</p>
                  {p.damage_category && (
                    <span className="mt-2 inline-block badge bg-amber-50 text-amber-700">{p.damage_category.replace(/-/g, " ")}</span>
                  )}
                  {p.ai_status === "ok" && (
                    <span className="mt-2 ml-1 inline-block badge bg-teal-50 text-teal-700">AI</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Checklist */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Condition checklist</h2>
        {checklistLoading ? (
          <Loading />
        ) : checklistList.length === 0 ? (
          <EmptyState title="No checklist items" description="Checklist items are added automatically when you create a room." />
        ) : (
          <div className="space-y-2">
            {checklistList.map((c) => {
              const style = STATUS_STYLE[c.status];
              const Icon = style.icon;
              return (
                <div key={c.id} className="card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{c.label}</p>
                      {c.notes && <p className="mt-1 text-xs text-slate-500">{c.notes}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUSES.map((s) => {
                        const st = STATUS_STYLE[s];
                        const SIcon = st.icon;
                        return (
                          <button
                            key={s}
                            onClick={() => setChecklistStatus(c.id, s).then(reloadChecklist)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                              c.status === s ? st.cls : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <SIcon size={12} /> {CHECKLIST_STATUS_LABELS[s]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input !py-1.5 !text-xs"
                      placeholder="Add a note for this item…"
                      defaultValue={c.notes ?? ""}
                      onChange={(e) => setActiveNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                    />
                    <button className="btn-secondary !py-1.5 !text-xs" onClick={() => saveNote(c.id)}>Save note</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Photo detail drawer */}
      {selectedPhoto && (
        <PhotoDrawer
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onUpdated={() => { reloadPhotos(); }}
          onAskDelete={(p) => { setPhotoToDelete(p); setSelectedPhoto(null); }}
        />
      )}

      <ConfirmDialog
        open={!!photoToDelete}
        title="Delete photo?"
        message="This photo and its AI analysis will be permanently removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setPhotoToDelete(null)}
        onConfirm={async () => {
          if (!photoToDelete) return;
          await deletePhoto(photoToDelete);
          setPhotoToDelete(null);
          reloadPhotos();
        }}
      />
    </div>
  );
}

function PhotoDrawer({
  photo,
  onClose,
  onUpdated,
  onAskDelete,
}: {
  photo: PhotoType;
  onClose: () => void;
  onUpdated: () => void;
  onAskDelete: (p: PhotoType) => void;
}): ReactNode {
  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/50 dp-fade-in" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Photo details</h3>
          <div className="flex items-center gap-2">
            <button className="btn-danger !py-1.5 !text-xs" onClick={() => onAskDelete(photo)}>
              <Trash2 size={14} /> Delete
            </button>
            <button className="btn-ghost !p-1.5" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <img src={photoPublicUrl(photo.storage_path)} alt={photo.description ?? ""} className="w-full rounded-lg bg-slate-100 object-contain" style={{ maxHeight: "40vh" }} />
          <p className="mt-2 text-xs text-slate-400">Uploaded {fmtDateTime(photo.upload_timestamp)} · {captureDateLabel(photo)}</p>
          <div className="mt-5">
            <AiAnalysisPanel photo={photo} onUpdated={onUpdated} />
          </div>
        </div>
      </div>
    </div>
  );
}
