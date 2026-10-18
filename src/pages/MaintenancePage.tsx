import { type ReactNode, useState } from "react";
import { useAsync, Loading, EmptyState, ConfirmDialog } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import {
  fetchProperty,
  fetchRooms,
  fetchMaintenance,
  fetchMaintenanceUpdates,
  createMaintenanceIssue,
  updateMaintenanceIssue,
  deleteMaintenanceIssue,
} from "@/lib/api";
import {
  MAINTENANCE_STATUS_LABELS,
  type MaintenanceStatus,
} from "@/lib/types";
import { fmtDateTime, fmtDate } from "@/lib/format";
import {
  Plus,
  Wrench,
  Trash2,
  X,
  ChevronRight,
  Clock,
} from "lucide-react";

const STATUSES: MaintenanceStatus[] = ["reported", "acknowledged", "in-progress", "resolved", "unresolved"];

const STATUS_STYLE: Record<MaintenanceStatus, string> = {
  reported: "bg-slate-100 text-slate-700",
  acknowledged: "bg-blue-50 text-blue-700",
  "in-progress": "bg-amber-50 text-amber-700",
  resolved: "bg-emerald-50 text-emerald-700",
  unresolved: "bg-red-50 text-red-600",
};

export function MaintenancePage({ propertyId }: { propertyId: string }): ReactNode {
  const { data: property } = useAsync(() => fetchProperty(propertyId), [propertyId]);
  const { data: rooms } = useAsync(() => fetchRooms(propertyId), [propertyId]);
  const { data: issues, loading, reload } = useAsync(() => fetchMaintenance(propertyId), [propertyId]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", room_id: "", date_reported: "" });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Record<string, Awaited<ReturnType<typeof fetchMaintenanceUpdates>>>>({});
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { status: MaintenanceStatus; note: string }>>({});

  if (!property) return <Loading />;
  const roomMap = new Map((rooms ?? []).map((r) => [r.id, r.name]));
  const issueList = issues ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await createMaintenanceIssue({
        property_id: propertyId,
        room_id: form.room_id || null,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        date_reported: form.date_reported ? new Date(form.date_reported).toISOString() : undefined,
      });
      setForm({ title: "", description: "", room_id: "", date_reported: "" });
      setShowForm(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!updates[id]) {
      const u = await fetchMaintenanceUpdates(id);
      setUpdates((s) => ({ ...s, [id]: u }));
    }
  };

  const applyUpdate = async (id: string) => {
    const ed = editing[id];
    if (!ed) return;
    await updateMaintenanceIssue(id, { status: ed.status }, ed.note || undefined);
    setEditing((e) => { const n = { ...e }; delete n[id]; return n; });
    reload();
    const u = await fetchMaintenanceUpdates(id);
    setUpdates((s) => ({ ...s, [id]: u }));
  };

  return (
    <div>
      <PageHeader
        title="Maintenance log"
        subtitle={property.name}
        back={{ label: property.name, to: `/properties/${propertyId}` }}
        actions={<button className="btn-primary" onClick={() => setShowForm((s) => !s)}><Plus size={16} /> Report issue</button>}
      />

      {showForm && (
        <form onSubmit={submit} className="card mb-5 space-y-4 p-5">
          <div>
            <label className="label" htmlFor="title">Issue title *</label>
            <input id="title" className="input" placeholder="e.g. Leaking bathroom tap" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="room">Room</label>
              <select id="room" className="input" value={form.room_id} onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value }))}>
                <option value="">— General / whole property —</option>
                {(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="reported">Date reported</label>
              <input id="reported" type="date" className="input" value={form.date_reported} onChange={(e) => setForm((f) => ({ ...f, date_reported: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="desc">Description</label>
            <textarea id="desc" className="input min-h-20" placeholder="Describe the problem" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}><X size={16} /> Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Add issue"}</button>
          </div>
        </form>
      )}

      {loading ? (
        <Loading />
      ) : issueList.length === 0 ? (
        <EmptyState
          icon={<Wrench size={36} />}
          title="No maintenance issues"
          description="Record problems and repair requests to keep a dated history."
          action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Report an issue</button>}
        />
      ) : (
        <div className="space-y-3">
          {issueList.map((m) => (
            <div key={m.id} className="card">
              <div className="flex items-start justify-between gap-3 p-4">
                <button onClick={() => toggle(m.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-800">{m.title}</h3>
                    <span className={`badge ${STATUS_STYLE[m.status]}`}>{MAINTENANCE_STATUS_LABELS[m.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {m.room_id ? `${roomMap.get(m.room_id) ?? "Room"} · ` : ""}Reported {fmtDate(m.date_reported)}
                  </p>
                  {m.description && <p className="mt-2 text-sm text-slate-600">{m.description}</p>}
                </button>
                <div className="flex items-center gap-1">
                  <button className="text-slate-300 hover:text-slate-600" onClick={() => toggle(m.id)}>
                    <ChevronRight size={16} className={expanded === m.id ? "rotate-90 transition-transform" : "transition-transform"} />
                  </button>
                  <button className="text-slate-300 hover:text-red-500" onClick={() => setToDelete(m.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expanded === m.id && (
                <div className="border-t border-slate-100 p-4">
                  {/* History */}
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium text-slate-500">Status history</p>
                    {(updates[m.id] ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400">No status changes yet.</p>
                    ) : (
                      <ol className="space-y-2">
                        {(updates[m.id] ?? []).map((u) => (
                          <li key={u.id} className="flex items-start gap-2 text-xs">
                            <Clock size={12} className="mt-0.5 text-slate-400" />
                            <div>
                              <span className="text-slate-700">
                                {u.previous_status ? MAINTENANCE_STATUS_LABELS[u.previous_status] : "Created"} → {MAINTENANCE_STATUS_LABELS[u.new_status]}
                              </span>
                              <span className="ml-1 text-slate-400">{fmtDateTime(u.created_at)}</span>
                              {u.note && <p className="text-slate-500">{u.note}</p>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* Update form */}
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-medium text-slate-600">Update status</p>
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="input !w-auto !py-1.5 !text-xs"
                        value={editing[m.id]?.status ?? m.status}
                        onChange={(e) => setEditing((ed) => ({ ...ed, [m.id]: { status: e.target.value as MaintenanceStatus, note: ed[m.id]?.note ?? "" } }))}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{MAINTENANCE_STATUS_LABELS[s]}</option>)}
                      </select>
                      <input
                        className="input flex-1 !py-1.5 !text-xs"
                        placeholder="Optional note for this change"
                        value={editing[m.id]?.note ?? ""}
                        onChange={(e) => setEditing((ed) => ({ ...ed, [m.id]: { status: ed[m.id]?.status ?? m.status, note: e.target.value } }))}
                      />
                      <button className="btn-primary !py-1.5 !text-xs" onClick={() => applyUpdate(m.id)}>Save update</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete issue?"
        message="This maintenance issue and its history will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteMaintenanceIssue(toDelete);
          setToDelete(null);
          reload();
        }}
      />
    </div>
  );
}
