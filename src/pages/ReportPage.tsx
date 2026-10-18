import { type ReactNode, useState, useEffect } from "react";
import jsPDF from "jspdf";
import { useAsync, Loading } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import {
  fetchProperty,
  fetchRooms,
  fetchPhotos,
  fetchChecklist,
  fetchMaintenance,
  fetchMaintenanceUpdates,
  photoPublicUrl,
  computeCompleteness,
} from "@/lib/api";
import {
  PROPERTY_TYPE_LABELS,
  ROOM_TYPE_LABELS,
  DAMAGE_CATEGORY_LABELS,
  CONDITION_STAGE_LABELS,
  CHECKLIST_STATUS_LABELS,
  MAINTENANCE_STATUS_LABELS,
  AI_STATUS_LABELS,
  type MaintenanceStatus,
  type ChecklistItem,
  type MaintenanceUpdate,
} from "@/lib/types";
import { fmtDate, fmtDateTime, captureDateLabel } from "@/lib/format";
import { FileText, Download, AlertCircle } from "lucide-react";

export function ReportPage({ propertyId }: { propertyId: string }): ReactNode {
  const { data: property } = useAsync(() => fetchProperty(propertyId), [propertyId]);
  const { data: rooms } = useAsync(() => fetchRooms(propertyId), [propertyId]);
  const { data: photos } = useAsync(() => fetchPhotos(propertyId), [propertyId]);
  const { data: maint } = useAsync(() => fetchMaintenance(propertyId), [propertyId]);

  // Gather checklists and maintenance updates in one pass.
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({});
  const [updates, setUpdates] = useState<Record<string, MaintenanceUpdate[]>>({});
  const [generating, setGenerating] = useState(false);

  const roomList = rooms ?? [];
  const photoList = photos ?? [];
  const maintList = maint ?? [];

  // Load checklists lazily when rooms are available.
  useEffect(() => {
    if (roomList.length === 0) return;
    let active = true;
    Promise.all(roomList.map(async (r) => [r.id, await fetchChecklist(r.id)] as const))
      .then((entries) => { if (active) setChecklists(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [roomList]);

  useEffect(() => {
    if (maintList.length === 0) return;
    let active = true;
    Promise.all(maintList.map(async (m) => [m.id, await fetchMaintenanceUpdates(m.id)] as const))
      .then((entries) => { if (active) setUpdates(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [maintList]);

  if (!property) return <Loading />;

  const gaps = computeCompleteness({
    rooms: roomList,
    photos: photoList,
    checklist: Object.values(checklists).flat(),
    maintenance: maintList,
    property,
  });

  const generate = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = margin;

      const ensure = (h: number) => {
        if (y + h > pageH - margin) { doc.addPage(); y = margin; }
      };
      const text = (s: string, size = 10, style: "normal" | "bold" = "normal", color: [number, number, number] = [30, 41, 59]) => {
        doc.setFont("helvetica", style);
        doc.setFontSize(size);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(s, pageW - margin * 2);
        for (const line of lines) {
          ensure(size + 4);
          doc.text(line, margin, y);
          y += size + 4;
        }
      };
      const heading = (s: string) => {
        y += 8;
        text(s, 14, "bold", [13, 148, 136]);
        y += 2;
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageW - margin, y);
        y += 10;
      };

      // Title
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 70, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("DepositProof — Evidence Report", margin, 32);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, margin, 50);
      y = 90;

      text(`Property: ${property.name}`, 16, "bold");
      text(`${PROPERTY_TYPE_LABELS[property.property_type]}${property.address ? ` · ${property.address}` : ""}`, 10, "normal", [100, 116, 139]);
      text(`Move-in: ${property.move_in_date ? fmtDate(property.move_in_date) : "—"}  ·  Move-out: ${property.expected_move_out_date ? fmtDate(property.expected_move_out_date) : "—"}`, 10);
      if (property.landlord_name) text(`Landlord: ${property.landlord_name}${property.landlord_contact ? ` (${property.landlord_contact})` : ""}`, 10);

      heading("Important note");
      text("This report organizes photographic evidence, user descriptions, maintenance records, and AI-assisted observations. It is NOT a legal document and does not determine liability, deposit recovery, or fault. AI observations are suggestions reviewed by the user, not definitive findings. Capture dates marked 'unverified' could not be confirmed from image metadata.", 9, "normal", [71, 85, 105]);

      // Rooms
      heading("Rooms and inspection checklists");
      for (const r of roomList) {
        text(`${r.name} (${ROOM_TYPE_LABELS[r.room_type]})`, 12, "bold");
        const items = checklists[r.id] ?? [];
        if (items.length === 0) {
          text("  No checklist items.", 9, "normal", [100, 116, 139]);
        } else {
          for (const c of items) {
            text(`  • ${c.label}: ${CHECKLIST_STATUS_LABELS[c.status]}${c.notes ? ` — ${c.notes}` : ""}`, 9);
          }
        }
        y += 4;
      }

      // Photos
      heading("Photographs");
      for (const r of roomList) {
        const roomPhotos = photoList.filter((p) => p.room_id === r.id);
        if (roomPhotos.length === 0) continue;
        text(`${r.name}`, 12, "bold");
        for (const p of roomPhotos) {
          text(`  • [${CONDITION_STAGE_LABELS[p.condition_stage]}] ${p.description ?? "No description"}${p.damage_category ? ` — ${DAMAGE_CATEGORY_LABELS[p.damage_category]}` : ""}`, 9);
          text(`    ${captureDateLabel(p)} · Uploaded ${fmtDate(p.upload_timestamp)}`, 8, "normal", [100, 116, 139]);
          if (p.ai_status === "ok" && p.ai_result) {
            text(`    AI (user-reviewed${p.ai_user_confirmed ? " & accepted" : ""}): ${p.ai_result.description}`, 8, "normal", [13, 148, 136]);
          }
        }
        y += 4;
      }

      // Maintenance
      heading("Maintenance issues");
      if (maintList.length === 0) {
        text("No maintenance issues recorded.", 9, "normal", [100, 116, 139]);
      } else {
        for (const m of maintList) {
          text(`• ${m.title} — ${MAINTENANCE_STATUS_LABELS[m.status]}`, 10, "bold");
          text(`  Reported ${fmtDate(m.date_reported)}${m.description ? ` · ${m.description}` : ""}`, 9);
          const ups = updates[m.id] ?? [];
          for (const u of ups) {
            text(`    ${u.previous_status ?? "created"} → ${MAINTENANCE_STATUS_LABELS[u.new_status as MaintenanceStatus]} (${fmtDate(u.created_at)})${u.note ? `: ${u.note}` : ""}`, 8, "normal", [100, 116, 139]);
          }
        }
      }

      // Completeness
      heading("Evidence completeness notes");
      if (gaps.length === 0) {
        text("All key evidence appears to be documented.", 9);
      } else {
        for (const g of gaps) {
          text(`• [${g.severity}] ${g.message} — ${g.action}`, 9);
        }
      }

      text("", 8);
      text("End of report. DepositProof does not claim this document is legally conclusive.", 8, "normal", [100, 116, 139]);

      doc.save(`DepositProof-${property.name.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="PDF evidence report"
        subtitle={property.name}
        back={{ label: property.name, to: `/properties/${propertyId}` }}
        actions={
          <button className="btn-primary" onClick={generate} disabled={generating}>
            <Download size={16} /> {generating ? "Generating…" : "Download PDF"}
          </button>
        }
      />

      <div className="card mb-5 flex items-start gap-3 p-4 text-sm text-amber-700">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <p>
          This report organizes evidence but is <strong>not legally conclusive</strong>. It does
          not determine liability or deposit recovery. AI observations are clearly labeled and were
          reviewed by you before inclusion.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 text-slate-700">
          <FileText size={20} className="text-teal-600" />
          <h2 className="text-base font-semibold">Report preview</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          The PDF will include property details, room-by-room checklists, all photographs with
          descriptions and dates, maintenance history, and completeness notes.
        </p>

        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Property">{property.name}</Row>
          <Row label="Type">{PROPERTY_TYPE_LABELS[property.property_type]}</Row>
          <Row label="Rooms">{roomList.length}</Row>
          <Row label="Photos">{photoList.length}</Row>
          <Row label="Maintenance issues">{maintList.length}</Row>
          <Row label="Move-out completed">{property.move_out_completed ? "Yes" : "Not yet"}</Row>
          <Row label="Completeness gaps">{gaps.length}</Row>
        </dl>

        <div className="mt-6">
          <button className="btn-primary" onClick={generate} disabled={generating}>
            <Download size={16} /> {generating ? "Generating…" : "Generate & download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{children}</dd>
    </div>
  );
}
