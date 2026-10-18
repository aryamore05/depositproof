import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { navigate } from "@/lib/router";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: { label: string; to: string };
}): ReactNode {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {back && (
          <button
            onClick={() => navigate(back.to)}
            className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            <ChevronRight size={12} className="rotate-180" />
            {back.label}
          </button>
        )}
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
