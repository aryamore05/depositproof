import { type ReactNode } from "react";
import { useAsync, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { fetchProperties, deleteProperty } from "@/lib/api";
import { navigate } from "@/lib/router";
import { PROPERTY_TYPE_LABELS } from "@/lib/types";
import { fmtDate, fmtRelative } from "@/lib/format";
import { Plus, Home, MapPin, Calendar, Trash2, ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui";

export function PropertiesList(): ReactNode {
  const { data, loading, error, reload } = useAsync(() => fetchProperties(), []);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const props = data ?? [];

  return (
    <div>
      <PageHeader
        title="My Properties"
        subtitle="Rental records you have documented."
        actions={
          <button className="btn-primary" onClick={() => navigate("/properties/new")}>
            <Plus size={16} /> New property
          </button>
        }
      />

      {loading && <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-40 animate-pulse bg-slate-100" />)}</div>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && props.length === 0 && (
        <EmptyState
          icon={<Home size={40} />}
          title="No properties yet"
          description="Create your first property record to start documenting rooms, photos, and maintenance."
          action={<button className="btn-primary" onClick={() => navigate("/properties/new")}><Plus size={16} /> Create property record</button>}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {props.map((p) => (
          <div key={p.id} className="card group flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => navigate(`/properties/${p.id}`)} className="min-w-0 flex-1 text-left">
                <h3 className="truncate text-base font-semibold text-slate-800 group-hover:text-teal-700">{p.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{PROPERTY_TYPE_LABELS[p.property_type]}</p>
              </button>
              {p.move_out_completed ? (
                <span className="badge bg-emerald-50 text-emerald-700"><ShieldCheck size={12} /> Move-out done</span>
              ) : (
                <span className="badge bg-blue-50 text-blue-700">Active</span>
              )}
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-slate-500">
              {p.address && (
                <p className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400" /> {p.address}</p>
              )}
              <p className="flex items-center gap-1.5">
                <Calendar size={12} className="text-slate-400" />
                Move-in {p.move_in_date ? fmtDate(p.move_in_date) : "—"}
                {p.expected_move_out_date ? ` · out ${fmtDate(p.expected_move_out_date)}` : ""}
              </p>
              <p className="text-slate-400">Updated {fmtRelative(p.updated_at)}</p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                className="text-xs text-red-500 hover:text-red-700"
                onClick={() => setToDelete({ id: p.id, name: p.name })}
              >
                <span className="inline-flex items-center gap-1"><Trash2 size={12} /> Delete</span>
              </button>
              <button
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
                onClick={() => navigate(`/properties/${p.id}`)}
              >
                Open <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete property?"
        message={`"${toDelete?.name}" and all its rooms, photos, and maintenance records will be permanently removed.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteProperty(toDelete.id);
          setToDelete(null);
          reload();
        }}
      />
    </div>
  );
}
