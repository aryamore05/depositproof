import { type ReactNode, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { navigate } from "@/lib/router";
import { createProperty } from "@/lib/api";
import { PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

const TYPES: PropertyType[] = ["bedroom", "pg", "shared-apartment", "flat", "house"];

export function PropertyNew(): ReactNode {
  const [form, setForm] = useState({
    name: "",
    address: "",
    property_type: "flat" as PropertyType,
    move_in_date: "",
    expected_move_out_date: "",
    landlord_name: "",
    landlord_contact: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Please give the property a name.");
      return;
    }
    setSaving(true);
    try {
      const p = await createProperty({
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        property_type: form.property_type,
        move_in_date: form.move_in_date || undefined,
        expected_move_out_date: form.expected_move_out_date || undefined,
        landlord_name: form.landlord_name.trim() || undefined,
        landlord_contact: form.landlord_contact.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      navigate(`/properties/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the property.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Create property record"
        subtitle="Start documenting a rental. You can add rooms and photos next."
        back={{ label: "Properties", to: "/properties" }}
      />

      <form onSubmit={submit} className="card space-y-5 p-6">
        <div>
          <label className="label" htmlFor="name">Property name *</label>
          <input id="name" className="input" placeholder="e.g. 2B Riverside Flat" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>

        <div>
          <label className="label" htmlFor="address">Address (optional)</label>
          <input id="address" className="input" placeholder="Street, city" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>

        <div>
          <label className="label">Property type</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("property_type", t)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  form.property_type === t
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {PROPERTY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="move_in">Move-in date</label>
            <input id="move_in" type="date" className="input" value={form.move_in_date} onChange={(e) => set("move_in_date", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="move_out">Expected move-out date</label>
            <input id="move_out" type="date" className="input" value={form.expected_move_out_date} onChange={(e) => set("expected_move_out_date", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ll_name">Landlord / manager name (optional)</label>
            <input id="ll_name" className="input" placeholder="Name" value={form.landlord_name} onChange={(e) => set("landlord_name", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ll_contact">Landlord contact (optional)</label>
            <input id="ll_contact" className="input" placeholder="Phone or email" value={form.landlord_contact} onChange={(e) => set("landlord_contact", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">Notes (optional)</label>
          <textarea id="notes" className="input min-h-20" placeholder="Anything else worth noting about this rental." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn-ghost" onClick={() => navigate("/properties")}>
            <ArrowLeft size={16} /> Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Create property"}
          </button>
        </div>
      </form>
    </div>
  );
}
