import { type ReactNode } from "react";
import { useAsync, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import { fetchProperties, fetchMaintenance } from "@/lib/api";
import { MAINTENANCE_STATUS_LABELS, type MaintenanceStatus } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { Wrench, ArrowRight } from "lucide-react";

const STATUS_STYLE: Record<MaintenanceStatus, string> = {
  reported: "bg-slate-100 text-slate-700",
  acknowledged: "bg-blue-50 text-blue-700",
  "in-progress": "bg-amber-50 text-amber-700",
  resolved: "bg-emerald-50 text-emerald-700",
  unresolved: "bg-red-50 text-red-600",
};

export function MaintenanceOverview(): ReactNode {
  const { data: properties, loading } = useAsync(() => fetchProperties(), []);
  const props = properties ?? [];

  const { data: allIssues } = useAsync(
    () => Promise.all(props.map((p) => fetchMaintenance(p.id).then((issues) => issues.map((i) => ({ ...i, propertyName: p.name, propertyId: p.id }))))).then((a) => a.flat()),
    [props.length],
  );

  const issues = (allIssues ?? []).sort((a, b) => new Date(b.date_reported).getTime() - new Date(a.date_reported).getTime());

  if (loading) return <PageHeader title="Maintenance Log" subtitle="All maintenance issues across your properties." />;

  if (props.length === 0) {
    return (
      <div>
        <PageHeader title="Maintenance Log" subtitle="All maintenance issues across your properties." />
        <EmptyState
          icon={<Wrench size={36} />}
          title="No properties yet"
          description="Create a property record to start logging maintenance issues."
          action={<button className="btn-primary" onClick={() => navigate("/properties/new")}>Create property record</button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Maintenance Log" subtitle="All maintenance issues across your properties." />
      {issues.length === 0 ? (
        <EmptyState
          icon={<Wrench size={36} />}
          title="No maintenance issues"
          description="Issues you report for any property will appear here in chronological order."
        />
      ) : (
        <div className="space-y-3">
          {issues.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/properties/${m.propertyId}/maintenance`)}
              className="card flex w-full items-center justify-between gap-3 p-4 text-left hover:shadow-md"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-800">{m.title}</p>
                  <span className={`badge ${STATUS_STYLE[m.status]}`}>{MAINTENANCE_STATUS_LABELS[m.status]}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{m.propertyName} · Reported {fmtDate(m.date_reported)}</p>
              </div>
              <ArrowRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
