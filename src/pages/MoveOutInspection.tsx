import { type ReactNode, useState } from "react";
import { useAsync, Loading } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import {
  fetchProperty,
  fetchRooms,
  fetchPhotos,
  updateProperty,
  photoPublicUrl,
} from "@/lib/api";
import { captureDateLabel, fmtDate } from "@/lib/format";
import { CheckCircle2, ImageOff, ShieldCheck } from "lucide-react";

export function MoveOutInspection({ propertyId }: { propertyId: string }): ReactNode {
  const { data: property, reload: reloadProp } = useAsync(() => fetchProperty(propertyId), [propertyId]);
  const { data: rooms } = useAsync(() => fetchRooms(propertyId), [propertyId]);
  const { data: photos, reload: reloadPhotos } = useAsync(() => fetchPhotos(propertyId), [propertyId]);

  const [selectedRoom, setSelectedRoom] = useState<string | "all">("all");

  if (!property) return <Loading />;
  const roomList = rooms ?? [];
  const photoList = photos ?? [];

  const moveInByRoom = new Map<string, typeof photoList>();
  const moveOutByRoom = new Map<string, typeof photoList>();
  for (const p of photoList) {
    const target = p.condition_stage === "move-in" ? moveInByRoom : p.condition_stage === "move-out" ? moveOutByRoom : null;
    if (!target) continue;
    const arr = target.get(p.room_id) ?? [];
    arr.push(p);
    target.set(p.room_id, arr);
  }

  const visibleRooms = roomList.filter((r) => selectedRoom === "all" || r.id === selectedRoom);

  const completeMoveOut = async () => {
    await updateProperty(propertyId, { move_out_completed: true });
    reloadProp();
  };

  return (
    <div>
      <PageHeader
        title="Move-out inspection"
        subtitle={property.name}
        back={{ label: property.name, to: `/properties/${propertyId}` }}
        actions={
          property.move_out_completed ? (
            <span className="badge bg-emerald-50 text-emerald-700"><CheckCircle2 size={12} /> Completed</span>
          ) : (
            <button className="btn-primary" onClick={completeMoveOut}>
              <ShieldCheck size={16} /> Mark move-out complete
            </button>
          )
        }
      />

      <div className="card mb-6 p-4 text-sm text-slate-600">
        Compare move-in and move-out photos side by side. Upload move-out photos from each room's
        inspection page (switch the stage to <strong>Move-out</strong>). Different lighting, angles,
        and normal wear can produce misleading comparisons — review carefully and do not assume
        the tenant caused any visible change.
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedRoom("all")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${selectedRoom === "all" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600"}`}
        >
          All rooms
        </button>
        {roomList.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRoom(r.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${selectedRoom === r.id ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600"}`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {visibleRooms.length === 0 ? (
        <div className="card py-10 text-center text-sm text-slate-400">No rooms to compare.</div>
      ) : (
        <div className="space-y-6">
          {visibleRooms.map((r) => {
            const inPhotos = moveInByRoom.get(r.id) ?? [];
            const outPhotos = moveOutByRoom.get(r.id) ?? [];
            return (
              <div key={r.id} className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">{r.name}</h3>
                  <button
                    className="text-xs font-medium text-teal-600 hover:text-teal-700"
                    onClick={() => navigate(`/properties/${propertyId}/rooms/${r.id}`)}
                  >
                    Open room inspection →
                  </button>
                </div>

                {inPhotos.length === 0 && outPhotos.length === 0 ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
                    <ImageOff size={16} /> No move-in or move-out photos for this room yet.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ComparisonColumn label="Move-in" photos={inPhotos} />
                    <ComparisonColumn label="Move-out" photos={outPhotos} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Move-in date: {property.move_in_date ? fmtDate(property.move_in_date) : "—"} ·
        Move-out completed: {property.move_out_completed ? "Yes" : "Not yet"}
      </p>
    </div>
  );
}

function ComparisonColumn({ label, photos }: { label: string; photos: { storage_path: string; description: string | null; capture_date: string | null; capture_date_reliable: boolean; upload_timestamp: string }[] }): ReactNode {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-500">{label} ({photos.length})</p>
      {photos.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
          No {label.toLowerCase()} photos
        </div>
      ) : (
        <div className="space-y-2">
          {photos.map((p) => (
            <div key={p.storage_path} className="overflow-hidden rounded-lg border border-slate-200">
              <img src={photoPublicUrl(p.storage_path)} alt={p.description ?? ""} className="aspect-video w-full object-cover" />
              <div className="p-2">
                <p className="text-xs text-slate-700">{p.description ?? <span className="text-slate-400">No description</span>}</p>
                <p className="mt-0.5 text-xs text-slate-400">{captureDateLabel(p)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
