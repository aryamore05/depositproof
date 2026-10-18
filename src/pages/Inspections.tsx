import { type ReactNode } from "react";
import { useAsync, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import { fetchProperties, fetchRooms, fetchChecklist } from "@/lib/api";
import { ClipboardCheck, ArrowRight } from "lucide-react";

export function Inspections(): ReactNode {
  const { data: properties, loading } = useAsync(() => fetchProperties(), []);
  const props = properties ?? [];

  // For each property, load rooms and checklists to compute progress.
  const { data: roomData } = useAsync(
    () => Promise.all(props.map(async (p) => {
      const rooms = await fetchRooms(p.id);
      const checks = await Promise.all(rooms.map((r) => fetchChecklist(r.id)));
      return { propertyId: p.id, rooms, checks };
    })),
    [props.length],
  );

  if (loading) return <PageHeader title="Inspections" subtitle="Room inspection progress across your properties." />;

  if (props.length === 0) {
    return (
      <div>
        <PageHeader title="Inspections" subtitle="Room inspection progress across your properties." />
        <EmptyState
          icon={<ClipboardCheck size={36} />}
          title="No properties to inspect"
          description="Create a property record first, then inspect each room."
          action={<button className="btn-primary" onClick={() => navigate("/properties/new")}>Create property record</button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Inspections" subtitle="Room inspection progress across your properties." />
      <div className="space-y-5">
        {props.map((p) => {
          const rd = (roomData ?? []).find((x) => x.propertyId === p.id);
          const rooms = rd?.rooms ?? [];
          const checks = rd?.checks ?? [];
          return (
            <div key={p.id} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <button onClick={() => navigate(`/properties/${p.id}`)} className="text-left">
                  <h3 className="text-sm font-semibold text-slate-800 hover:text-teal-700">{p.name}</h3>
                  <p className="text-xs text-slate-500">{rooms.length} room{rooms.length !== 1 ? "s" : ""}</p>
                </button>
              </div>
              {rooms.length === 0 ? (
                <p className="text-sm text-slate-400">No rooms added yet.</p>
              ) : (
                <div className="space-y-2">
                  {rooms.map((r, i) => {
                    const items = checks[i] ?? [];
                    const done = items.filter((c) => c.status !== "not-inspected").length;
                    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/properties/${p.id}/rooms/${r.id}`)}
                        className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-700">{r.name}</p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-slate-500">{done}/{items.length}</span>
                        <ArrowRight size={14} className="text-slate-300" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
