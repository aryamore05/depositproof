import { type ReactNode } from "react";
import { useAsync } from "@/components/ui";
import { fetchProperties, fetchMaintenance } from "@/lib/api";
import { navigate } from "@/lib/router";
import { PageHeader } from "@/components/PageHeader";
import { AiStatusBadge, useAiConnection } from "@/components/AiStatus";
import {
  Home,
  ClipboardCheck,
  Camera,
  AlertTriangle,
  Wrench,
  Plus,
  ArrowRight,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { fmtRelative } from "@/lib/format";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: typeof Home;
  accent: string;
}): ReactNode {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
}

export function Dashboard(): ReactNode {
  const { data: properties, loading, reload } = useAsync(() => fetchProperties(), []);
  const ai = useAiConnection();

  // Aggregate maintenance across all properties.
  const propertyIds = (properties ?? []).map((p) => p.id);
  const { data: maintByProp } = useAsync(
    () => Promise.all(propertyIds.map((id) => fetchMaintenance(id))).then((arrs) => arrs.flat()),
    [propertyIds.length],
  );

  const props = properties ?? [];
  const maint = maintByProp ?? [];
  const openMaint = maint.filter((m) => m.status !== "resolved");

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview of your rental evidence." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-28 animate-pulse bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (props.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview of your rental evidence." />
        <div className="card overflow-hidden">
          <div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white">
              <ShieldCheck size={26} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Welcome to DepositProof</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Document the condition of your rental property before you move in, track
                maintenance, and generate a clean evidence report when you move out. Your
                photos, descriptions, and AI-assisted observations stay organized and dated.
              </p>
            </div>
            <button className="btn-primary" onClick={() => navigate("/properties/new")}>
              <Plus size={16} /> Create your first property record
            </button>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <AiStatusBadge state={ai.state} />
              <span>·</span>
              <button className="hover:text-slate-600" onClick={() => navigate("/settings")}>
                Configure AI in Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalRooms = 0; // not fetched at dashboard level; show properties instead
  void totalRooms;

  const recent = [...props]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your rental evidence."
        actions={
          <>
            <AiStatusBadge state={ai.state} />
            <button className="btn-primary" onClick={() => navigate("/properties/new")}>
              <Plus size={16} /> Create Property Record
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total properties" value={props.length} icon={Home} accent="bg-teal-50 text-teal-600" />
        <StatCard
          label="Active rental records"
          value={props.filter((p) => !p.move_out_completed).length}
          icon={ClipboardCheck}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Existing damage records"
          value="See properties"
          icon={Camera}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Open maintenance issues"
          value={openMaint.length}
          icon={Wrench}
          accent="bg-orange-50 text-orange-600"
        />
        <StatCard
          label="Move-out completed"
          value={props.filter((p) => p.move_out_completed).length}
          icon={ShieldCheck}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Unresolved issues"
          value={maint.filter((m) => m.status === "unresolved").length}
          icon={AlertTriangle}
          accent="bg-red-50 text-red-600"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-800">Recent properties</h2>
            <button
              className="text-xs font-medium text-teal-600 hover:text-teal-700"
              onClick={() => navigate("/properties")}
            >
              View all
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {recent.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => navigate(`/properties/${p.id}`)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Updated {fmtRelative(p.updated_at)}
                      {p.address ? ` · ${p.address}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.move_out_completed ? (
                      <span className="badge bg-emerald-50 text-emerald-700">Move-out done</span>
                    ) : (
                      <span className="badge bg-blue-50 text-blue-700">Active</span>
                    )}
                    <ArrowRight size={16} className="text-slate-300" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Activity size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-800">Recent activity</h2>
          </div>
          <ul className="space-y-3 px-5 py-4 text-sm">
            {openMaint.slice(0, 5).map((m) => (
              <li key={m.id} className="flex items-start gap-2">
                <Wrench size={14} className="mt-0.5 text-orange-400" />
                <div className="min-w-0">
                  <p className="truncate text-slate-700">{m.title}</p>
                  <p className="text-xs text-slate-400">
                    {m.status} · {fmtRelative(m.date_reported)}
                  </p>
                </div>
              </li>
            ))}
            {openMaint.length === 0 && (
              <li className="py-8 text-center text-sm text-slate-400">
                No open maintenance issues. Nice.
              </li>
            )}
          </ul>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        DepositProof never claims guaranteed deposit recovery or legal liability. AI observations
        are suggestions to review, not definitive findings.{" "}
        <button className="underline" onClick={reload}>Refresh</button>
      </p>
    </div>
  );
}
