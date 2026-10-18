import { type ReactNode, useState } from "react";
import { useAsync, EmptyState, Loading, ConfirmDialog } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import {
  fetchProperty,
  fetchRooms,
  fetchPhotos,
  fetchChecklist,
  fetchMaintenance,
  createRoom,
  deleteRoom,
  computeCompleteness,
} from "@/lib/api";
import {
  PROPERTY_TYPE_LABELS,
  ROOM_TYPE_LABELS,
  type RoomType,
} from "@/lib/types";
import { fmtDate, fmtRelative } from "@/lib/format";
import {
  Plus,
  Home,
  Camera,
  ClipboardCheck,
  Wrench,
  FileText,
  Calendar,
  MapPin,
  User,
  Trash2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";

const ROOM_TYPES: RoomType[] = ["bedroom", "bathroom", "kitchen", "living-room", "balcony", "other"];

export function PropertyOverview({ propertyId }: { propertyId: string }): ReactNode {
  const { data: property, loading: propLoading } = useAsync(() => fetchProperty(propertyId), [propertyId]);
  const { data: rooms, loading: roomsLoading, reload: reloadRooms } = useAsync(() => fetchRooms(propertyId), [propertyId]);
  const { data: photos, reload: reloadPhotos } = useAsync(() => fetchPhotos(propertyId), [propertyId]);
  const { data: maint } = useAsync(() => fetchMaintenance(propertyId), [propertyId]);

  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<RoomType>("bedroom");
  const [adding, setAdding] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<{ id: string; name: string } | null>(null);

  if (propLoading) return <Loading />;
  if (!property) {
    return (
      <EmptyState
        icon={<Home size={40} />}
        title="Property not found"
        description="This property may have been deleted."
        action={<button className="btn-primary" onClick={() => navigate("/properties")}>Back to properties</button>}
      />
    );
  }

  const allChecklist = rooms
    ? Promise.all(rooms.map((r) => fetchChecklist(r.id)))
    : Promise.resolve([]);
  // Fetch checklist synchronously via a second pass — simpler: fetch in an effect-like manner.
  // To keep this page self-contained, we compute progress inline from photos + maint already loaded.
  void allChecklist;

  const photoList = photos ?? [];
  const roomList = rooms ?? [];
  const maintList = maint ?? [];

  const photosByRoom = new Map<string, number>();
  for (const p of photoList) photosByRoom.set(p.room_id, (photosByRoom.get(p.room_id) ?? 0) + 1);

  // Gaps computed from what we have. Checklist fetch is deferred to room page.
  const gaps = computeCompleteness({
    rooms: roomList,
    photos: photoList,
    checklist: [],
    maintenance: maintList,
    property,
  });

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setAdding(true);
    try {
      await createRoom(propertyId, newRoomName.trim(), newRoomType);
      setNewRoomName("");
      setNewRoomType("bedroom");
      setShowAddRoom(false);
      reloadRooms();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={property.name}
        subtitle={PROPERTY_TYPE_LABELS[property.property_type]}
        back={{ label: "Properties", to: "/properties" }}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate(`/properties/${propertyId}/timeline`)}>
              <Clock size={16} /> Timeline
            </button>
            <button className="btn-secondary" onClick={() => navigate(`/properties/${propertyId}/maintenance`)}>
              <Wrench size={16} /> Maintenance
            </button>
            <button className="btn-primary" onClick={() => navigate(`/properties/${propertyId}/report`)}>
              <FileText size={16} /> Report
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile label="Address" value={property.address || "—"} icon={MapPin} />
        <InfoTile label="Move-in" value={property.move_in_date ? fmtDate(property.move_in_date) : "—"} icon={Calendar} />
        <InfoTile label="Expected move-out" value={property.expected_move_out_date ? fmtDate(property.expected_move_out_date) : "—"} icon={Calendar} />
        <InfoTile label="Landlord" value={property.landlord_name || "—"} icon={User} />
      </div>

      {/* Action cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ActionCard
          icon={ClipboardCheck}
          title="Move-out inspection"
          desc={property.move_out_completed ? "Completed" : "Compare move-in vs move-out photos"}
          onClick={() => navigate(`/properties/${propertyId}/move-out`)}
          done={property.move_out_completed}
        />
        <ActionCard
          icon={Wrench}
          title="Maintenance log"
          desc={`${maintList.length} issue(s) recorded`}
          onClick={() => navigate(`/properties/${propertyId}/maintenance`)}
        />
        <ActionCard
          icon={FileText}
          title="PDF evidence report"
          desc="Download a printable report"
          onClick={() => navigate(`/properties/${propertyId}/report`)}
        />
      </div>

      {/* Rooms */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Rooms ({roomList.length})</h2>
          <button className="btn-secondary" onClick={() => setShowAddRoom((s) => !s)}>
            <Plus size={16} /> Add room
          </button>
        </div>

        {showAddRoom && (
          <form onSubmit={addRoom} className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="label" htmlFor="rn">Room name</label>
              <input id="rn" className="input" placeholder="e.g. Master bedroom" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} autoFocus />
            </div>
            <div className="sm:w-48">
              <label className="label" htmlFor="rt">Room type</label>
              <select id="rt" className="input" value={newRoomType} onChange={(e) => setNewRoomType(e.target.value as RoomType)}>
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowAddRoom(false)}><X size={16} /></button>
              <button type="submit" className="btn-primary" disabled={adding}>{adding ? "Adding…" : "Add"}</button>
            </div>
          </form>
        )}

        {roomsLoading ? (
          <Loading />
        ) : roomList.length === 0 ? (
          <EmptyState
            icon={<Home size={36} />}
            title="No rooms yet"
            description="Add rooms to this property to start documenting their condition."
            action={<button className="btn-primary" onClick={() => setShowAddRoom(true)}><Plus size={16} /> Add a room</button>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roomList.map((r) => {
              const count = photosByRoom.get(r.id) ?? 0;
              return (
                <div key={r.id} className="card group p-4">
                  <div className="flex items-start justify-between">
                    <button onClick={() => navigate(`/properties/${propertyId}/rooms/${r.id}`)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-teal-700">{r.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{ROOM_TYPE_LABELS[r.room_type]}</p>
                    </button>
                    <button
                      className="text-slate-300 hover:text-red-500"
                      onClick={() => setRoomToDelete({ id: r.id, name: r.name })}
                      aria-label="Delete room"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Camera size={12} /> {count} photo{count !== 1 ? "s" : ""}</span>
                    <span className="inline-flex items-center gap-1 text-teal-600">
                      Inspect <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completeness */}
      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Evidence completeness</h2>
        {gaps.length === 0 ? (
          <div className="card flex items-center gap-3 p-5 text-sm text-emerald-700">
            <CheckCircle2 size={18} /> All key evidence is documented for this property.
          </div>
        ) : (
          <ul className="space-y-2">
            {gaps.map((g, i) => (
              <li key={i} className="card flex items-start gap-3 p-4">
                <AlertCircle size={16} className={`mt-0.5 ${g.severity === "high" ? "text-red-500" : g.severity === "medium" ? "text-amber-500" : "text-slate-400"}`} />
                <div>
                  <p className="text-sm text-slate-700">{g.message}</p>
                  <p className="text-xs text-slate-500">{g.action}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-400">
          This is a helpful checklist, not a legal evidence-strength score.
        </p>
      </div>

      <p className="mt-6 text-xs text-slate-400">Created {fmtRelative(property.created_at)}</p>

      <ConfirmDialog
        open={!!roomToDelete}
        title="Delete room?"
        message={`"${roomToDelete?.name}" and all its photos and checklist items will be removed.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setRoomToDelete(null)}
        onConfirm={async () => {
          if (!roomToDelete) return;
          await deleteRoom(roomToDelete.id);
          setRoomToDelete(null);
          reloadRooms();
          reloadPhotos();
        }}
      />
    </div>
  );
}

function InfoTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof MapPin }): ReactNode {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon size={12} /> {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

function ActionCard({ icon: Icon, title, desc, onClick, done }: { icon: typeof Home; title: string; desc: string; onClick: () => void; done?: boolean }): ReactNode {
  return (
    <button onClick={onClick} className="card group flex items-center gap-4 p-5 text-left transition-shadow hover:shadow-md">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${done ? "bg-emerald-50 text-emerald-600" : "bg-teal-50 text-teal-600"}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="truncate text-xs text-slate-500">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-slate-300 group-hover:text-teal-600" />
    </button>
  );
}
