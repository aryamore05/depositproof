import { type ReactNode, useState } from "react";
import { useAsync, Loading, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { fetchProperty, fetchTimeline } from "@/lib/api";
import { navigate } from "@/lib/router";
import { fmtDateTime } from "@/lib/format";
import {
  Home,
  Camera,
  ClipboardCheck,
  Wrench,
  ShieldCheck,
  Activity,
  Filter,
} from "lucide-react";
import type { TimelineEvent } from "@/lib/types";

const TYPE_ICON: Record<TimelineEvent["type"], typeof Home> = {
  "property-created": Home,
  "room-added": Home,
  "photo-added": Camera,
  "checklist-updated": ClipboardCheck,
  "maintenance-reported": Wrench,
  "maintenance-updated": Wrench,
  "move-out-started": ShieldCheck,
  "move-out-completed": ShieldCheck,
};

const TYPE_COLOR: Record<TimelineEvent["type"], string> = {
  "property-created": "bg-teal-50 text-teal-600",
  "room-added": "bg-blue-50 text-blue-600",
  "photo-added": "bg-slate-100 text-slate-600",
  "checklist-updated": "bg-emerald-50 text-emerald-600",
  "maintenance-reported": "bg-orange-50 text-orange-600",
  "maintenance-updated": "bg-amber-50 text-amber-600",
  "move-out-started": "bg-purple-50 text-purple-600",
  "move-out-completed": "bg-emerald-50 text-emerald-600",
};

export function TimelinePage({ propertyId }: { propertyId: string }): ReactNode {
  const { data: property } = useAsync(() => fetchProperty(propertyId), [propertyId]);
  const { data: events, loading } = useAsync(() => fetchTimeline(propertyId), [propertyId]);
  const [filter, setFilter] = useState<string>("all");

  if (!property) return <Loading />;
  const all = events ?? [];
  const types = Array.from(new Set(all.map((e) => e.type)));
  const filtered = filter === "all" ? all : all.filter((e) => e.type === filter);

  return (
    <div>
      <PageHeader
        title="Evidence timeline"
        subtitle={property.name}
        back={{ label: property.name, to: `/properties/${propertyId}` }}
      />

      <div className="mb-5 flex items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        <select className="input !w-auto !py-1.5 !text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All events</option>
          {types.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Activity size={36} />} title="No events yet" description="Activity will appear here as you document rooms, photos, and maintenance." />
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-6">
          {filtered.map((e) => {
            const Icon = TYPE_ICON[e.type] ?? Home;
            return (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${TYPE_COLOR[e.type]}`}>
                  <Icon size={12} />
                </span>
                <div className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{e.label}</p>
                    <time className="text-xs text-slate-400">{fmtDateTime(e.timestamp)}</time>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{e.description}</p>
                  {e.room_name && (
                    <button
                      className="mt-1 text-xs text-teal-600 hover:text-teal-700"
                      onClick={() => navigate(`/properties/${propertyId}/rooms/${(events ?? []).find((ev) => ev.room_id === e.room_id)?.room_id ?? ""}`)}
                    >
                      {e.room_name} →
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
