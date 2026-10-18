import { type ReactNode } from "react";
import { useAsync, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import { fetchProperties } from "@/lib/api";
import { PROPERTY_TYPE_LABELS } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { FileText, ArrowRight, Download } from "lucide-react";

export function ReportsList(): ReactNode {
  const { data: properties, loading } = useAsync(() => fetchProperties(), []);
  const props = properties ?? [];

  if (loading) return <PageHeader title="Reports" subtitle="Generate downloadable PDF evidence reports." />;

  if (props.length === 0) {
    return (
      <div>
        <PageHeader title="Reports" subtitle="Generate downloadable PDF evidence reports." />
        <EmptyState
          icon={<FileText size={36} />}
          title="No properties yet"
          description="Create a property record first, then generate a PDF evidence report."
          action={<button className="btn-primary" onClick={() => navigate("/properties/new")}>Create property record</button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate downloadable PDF evidence reports." />
      <div className="space-y-3">
        {props.map((p) => (
          <div key={p.id} className="card flex items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-800">{p.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {PROPERTY_TYPE_LABELS[p.property_type]}
                {p.move_in_date ? ` · Move-in ${fmtDate(p.move_in_date)}` : ""}
                {p.move_out_completed ? " · Move-out completed" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => navigate(`/properties/${p.id}/report`)}>
                <FileText size={16} /> Preview
              </button>
              <button className="btn-primary" onClick={() => navigate(`/properties/${p.id}/report`)}>
                <Download size={16} /> Generate
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-400">
        PDF reports include property details, room checklists, photos with descriptions and dates,
        maintenance history, and completeness notes. Reports are not legally conclusive.
      </p>
    </div>
  );
}
