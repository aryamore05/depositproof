import { supabase, PHOTO_BUCKET, photoPublicUrl } from "./supabase";
import {
  DEFAULT_CHECKLIST,
  type AppSetting,
  type ChecklistItem,
  type ChecklistStatus,
  type ConditionStage,
  type DamageCategory,
  type MaintenanceIssue,
  type MaintenanceStatus,
  type MaintenanceUpdate,
  type Photo,
  type Property,
  type PropertyType,
  type Room,
  type RoomType,
  type TimelineEvent,
} from "./types";

// ---------- Properties ----------

export async function fetchProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProperty(id: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface PropertyInput {
  name: string;
  address?: string;
  property_type: PropertyType;
  move_in_date?: string;
  expected_move_out_date?: string;
  landlord_name?: string;
  landlord_contact?: string;
  notes?: string;
}

export async function createProperty(input: PropertyInput): Promise<Property> {
  const { data, error } = await supabase
    .from("properties")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProperty(id: string, patch: Partial<PropertyInput> & { move_out_completed?: boolean }): Promise<void> {
  const { error } = await supabase.from("properties").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProperty(id: string): Promise<void> {
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Rooms ----------

export async function fetchRooms(propertyId: string): Promise<Room[]> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createRoom(propertyId: string, name: string, roomType: RoomType): Promise<Room> {
  const { data: existing } = await supabase
    .from("rooms")
    .select("id")
    .eq("property_id", propertyId);
  const sortOrder = (existing?.length ?? 0) + 1;

  const { data, error } = await supabase
    .from("rooms")
    .insert({ property_id: propertyId, name, room_type: roomType, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;

  // Seed the default checklist for this room.
  const items = DEFAULT_CHECKLIST.map((c, i) => ({
    room_id: data.id,
    label: c.label,
    sort_order: i,
  }));
  await supabase.from("checklist_items").insert(items);

  return data;
}

export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) throw error;
}

// ---------- Photos ----------

export async function fetchPhotos(propertyId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("property_id", propertyId)
    .order("upload_timestamp", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPhotosByRoom(roomId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("room_id", roomId)
    .order("upload_timestamp", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Extract capture date from EXIF when available, honestly marking reliability.
async function extractCaptureDate(file: File): Promise<{ date: string | null; reliable: boolean }> {
  // Browser EXIF parsing is limited; use the file's lastModified as a
  // best-effort capture date and mark it unreliable because lastModified
  // is filesystem-derived, not a true EXIF capture timestamp.
  if (file.lastModified) {
    return { date: new Date(file.lastModified).toISOString(), reliable: false };
  }
  return { date: null, reliable: false };
}

export async function uploadPhoto(
  file: File,
  propertyId: string,
  roomId: string,
  stage: ConditionStage,
  onProgress?: (frac: number) => void,
): Promise<Photo> {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowed.includes(file.type)) throw new Error("Only JPEG, PNG, or WebP images are allowed.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image must be under 15 MB.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safePath = `${propertyId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(safePath, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  onProgress?.(1);

  const { date, reliable } = await extractCaptureDate(file);

  const { data, error } = await supabase
    .from("photos")
    .insert({
      room_id: roomId,
      property_id: propertyId,
      storage_path: safePath,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      condition_stage: stage,
      capture_date: date,
      capture_date_reliable: reliable,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePhoto(
  id: string,
  patch: Partial<Pick<Photo, "description" | "damage_category" | "notes" | "condition_stage" | "ai_result" | "ai_status" | "ai_user_confirmed" | "ai_user_edited">>,
): Promise<void> {
  const { error } = await supabase.from("photos").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePhoto(photo: Photo): Promise<void> {
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  const { error } = await supabase.from("photos").delete().eq("id", photo.id);
  if (error) throw error;
}

export { photoPublicUrl };

// ---------- Checklist ----------

export async function fetchChecklist(roomId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function setChecklistStatus(
  id: string,
  status: ChecklistStatus,
  notes?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (notes !== undefined) patch.notes = notes;
  const { error } = await supabase.from("checklist_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function attachPhotosToChecklist(id: string, photoIds: string[]): Promise<void> {
  const { error } = await supabase
    .from("checklist_items")
    .update({ photo_ids: photoIds, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Maintenance ----------

export async function fetchMaintenance(propertyId: string): Promise<MaintenanceIssue[]> {
  const { data, error } = await supabase
    .from("maintenance_issues")
    .select("*")
    .eq("property_id", propertyId)
    .order("date_reported", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMaintenanceUpdates(issueId: string): Promise<MaintenanceUpdate[]> {
  const { data, error } = await supabase
    .from("maintenance_updates")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface MaintenanceInput {
  property_id: string;
  room_id?: string | null;
  title: string;
  description?: string;
  date_reported?: string;
}

export async function createMaintenanceIssue(input: MaintenanceInput): Promise<MaintenanceIssue> {
  const { data, error } = await supabase
    .from("maintenance_issues")
    .insert({
      property_id: input.property_id,
      room_id: input.room_id ?? null,
      title: input.title,
      description: input.description ?? null,
      date_reported: input.date_reported ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMaintenanceIssue(
  id: string,
  patch: Partial<Pick<MaintenanceIssue, "status" | "landlord_response" | "resolution_notes" | "resolution_photos" | "title" | "description">>,
  note?: string,
): Promise<void> {
  const current = await supabase.from("maintenance_issues").select("status").eq("id", id).maybeSingle();
  const prev = current.data?.status ?? null;

  const { error } = await supabase
    .from("maintenance_issues")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  if (patch.status && patch.status !== prev) {
    await supabase.from("maintenance_updates").insert({
      issue_id: id,
      previous_status: prev as MaintenanceStatus | null,
      new_status: patch.status,
      note: note ?? null,
    });
  }
}

export async function deleteMaintenanceIssue(id: string): Promise<void> {
  const { error } = await supabase.from("maintenance_issues").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Timeline ----------

export async function fetchTimeline(propertyId: string): Promise<TimelineEvent[]> {
  const [prop, rooms, photos, checklist, maint] = await Promise.all([
    supabase.from("properties").select("id, created_at, updated_at, name, move_out_completed").eq("id", propertyId).maybeSingle(),
    supabase.from("rooms").select("id, property_id, name, created_at").eq("property_id", propertyId),
    supabase.from("photos").select("id, room_id, property_id, condition_stage, damage_category, upload_timestamp, created_at").eq("property_id", propertyId),
    supabase.from("checklist_items").select("id, room_id, status, label, updated_at"),
    supabase.from("maintenance_issues").select("id, property_id, room_id, title, status, date_reported, updated_at").eq("property_id", propertyId),
  ]);

  const roomMap = new Map((rooms.data ?? []).map((r) => [r.id, r.name]));
  const roomIds = new Set((rooms.data ?? []).map((r) => r.id));
  const events: TimelineEvent[] = [];

  if (prop.data) {
    events.push({
      id: `prop-${prop.data.id}`,
      type: "property-created",
      label: "Property record created",
      description: `Property "${prop.data.name}" was added.`,
      timestamp: prop.data.created_at,
      room_id: null,
      room_name: null,
      category: null,
    });
    if (prop.data.move_out_completed) {
      events.push({
        id: `mout-${prop.data.id}`,
        type: "move-out-completed",
        label: "Move-out inspection completed",
        description: "The move-out inspection was marked complete.",
        timestamp: prop.data.updated_at ?? prop.data.created_at,
        room_id: null,
        room_name: null,
        category: null,
      });
    }
  }

  for (const r of rooms.data ?? []) {
    events.push({
      id: `room-${r.id}`,
      type: "room-added",
      label: "Room added",
      description: `Room "${r.name}" was added.`,
      timestamp: r.created_at,
      room_id: r.id,
      room_name: r.name,
      category: null,
    });
  }

  for (const p of photos.data ?? []) {
    events.push({
      id: `photo-${p.id}`,
      type: "photo-added",
      label: `${p.condition_stage} photo added`,
      description: p.damage_category
        ? `Photo added${p.room_id ? ` in ${roomMap.get(p.room_id) ?? "a room"}` : ""} — ${p.damage_category}.`
        : `Photo added${p.room_id ? ` in ${roomMap.get(p.room_id) ?? "a room"}` : ""}.`,
      timestamp: p.upload_timestamp ?? p.created_at,
      room_id: p.room_id,
      room_name: p.room_id ? roomMap.get(p.room_id) ?? null : null,
      category: p.damage_category,
    });
  }

  for (const c of checklist.data ?? []) {
    if (roomIds.has(c.room_id) && c.status !== "not-inspected") {
      events.push({
        id: `chk-${c.id}`,
        type: "checklist-updated",
        label: "Checklist updated",
        description: `"${c.label}" marked as ${c.status}${c.room_id ? ` in ${roomMap.get(c.room_id) ?? "a room"}` : ""}.`,
        timestamp: c.updated_at,
        room_id: c.room_id,
        room_name: c.room_id ? roomMap.get(c.room_id) ?? null : null,
        category: c.status,
      });
    }
  }

  for (const m of maint.data ?? []) {
    events.push({
      id: `maint-${m.id}`,
      type: "maintenance-reported",
      label: "Maintenance issue reported",
      description: `"${m.title}" — ${m.status}.`,
      timestamp: m.date_reported ?? m.updated_at,
      room_id: m.room_id,
      room_name: m.room_id ? roomMap.get(m.room_id) ?? null : null,
      category: m.status,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

// ---------- Settings ----------

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as AppSetting[]) map[r.key] = r.value;
  return map;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---------- AI analysis ----------

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-photo`;

export async function analyzePhoto(photo: Photo): Promise<{
  status: "ok" | "ai_unavailable" | "ai_disabled" | "ai_error";
  message?: string;
  result?: import("./types").AiResult;
  model?: string;
}> {
  const imageUrl = photoPublicUrl(photo.storage_path);
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, description: photo.description ?? undefined }),
  });
  const json = (await resp.json()) as { status: string; result?: import("./types").AiResult; model?: string; message?: string };
  if (json.status === "ok" && json.result) {
    return { status: "ok", result: json.result, model: json.model };
  }
  return { status: json.status as "ai_unavailable" | "ai_disabled" | "ai_error", message: json.message };
}

export async function checkAiConnection(): Promise<{ connected: boolean; message: string; backendUrl: string }> {
  const settings = await fetchSettings();
  const backendUrl = settings.ai_backend_url ?? "";
  if (!backendUrl) {
    return { connected: false, message: "No AI backend URL configured.", backendUrl: "" };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${backendUrl.replace(/\/$/, "")}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { connected: false, message: `Backend responded ${r.status}.`, backendUrl };
    const data = (await r.json()) as { models?: { name: string }[] };
    const model = settings.ai_model ?? "llava:7b";
    const has = (data.models ?? []).some((m) => m.name === model || m.name.startsWith(model.split(":")[0]));
    return {
      connected: true,
      message: has
        ? `Connected — model ${model} available.`
        : `Connected, but model "${model}" not found. Pull it with: ollama pull ${model}`,
      backendUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    return { connected: false, message: `Cannot reach backend: ${msg}`, backendUrl };
  }
}

// ---------- Completeness ----------

export interface CompletenessGap {
  severity: "high" | "medium" | "low";
  message: string;
  action: string;
}

export function computeCompleteness(opts: {
  rooms: Room[];
  photos: Photo[];
  checklist: ChecklistItem[];
  maintenance: MaintenanceIssue[];
  property: Property;
}): CompletenessGap[] {
  const gaps: CompletenessGap[] = [];
  const { rooms, photos, checklist, maintenance, property } = opts;
  const photosByRoom = new Map<string, Photo[]>();
  for (const p of photos) {
    const arr = photosByRoom.get(p.room_id) ?? [];
    arr.push(p);
    photosByRoom.set(p.room_id, arr);
  }

  if (rooms.length === 0) {
    gaps.push({ severity: "high", message: "No rooms have been added yet.", action: "Add at least one room to start documenting." });
  }

  for (const r of rooms) {
    const roomPhotos = photosByRoom.get(r.id) ?? [];
    if (roomPhotos.length === 0) {
      gaps.push({ severity: "high", message: `Room "${r.name}" has no photographs.`, action: "Upload at least one photo for this room." });
    }
    const roomChecklist = checklist.filter((c) => c.room_id === r.id);
    const uninspected = roomChecklist.filter((c) => c.status === "not-inspected");
    if (roomChecklist.length > 0 && uninspected.length === roomChecklist.length) {
      gaps.push({ severity: "medium", message: `Room "${r.name}" checklist is entirely uninspected.`, action: "Complete the inspection checklist." });
    }
  }

  const moveInPhotos = photos.filter((p) => p.condition_stage === "move-in");
  const photosWithoutDescription = moveInPhotos.filter((p) => !p.description || p.description.trim() === "");
  if (photosWithoutDescription.length > 0) {
    gaps.push({
      severity: "medium",
      message: `${photosWithoutDescription.length} move-in photo(s) have no description.`,
      action: "Add descriptions to document existing conditions.",
    });
  }

  const damagePhotos = photos.filter((p) => p.damage_category);
  const damageNoDesc = damagePhotos.filter((p) => !p.description || p.description.trim() === "");
  if (damageNoDesc.length > 0) {
    gaps.push({
      severity: "medium",
      message: `${damageNoDesc.length} damage photo(s) lack a description.`,
      action: "Describe the damage so it is clear what was documented.",
    });
  }

  const staleIssues = maintenance.filter((m) => m.status === "reported" || m.status === "acknowledged");
  if (staleIssues.length > 0) {
    gaps.push({
      severity: "medium",
      message: `${staleIssues.length} maintenance issue(s) have no progress update.`,
      action: "Update the status to in-progress or resolved.",
    });
  }

  if (!property.move_out_completed) {
    gaps.push({
      severity: "low",
      message: "Move-out inspection has not been completed.",
      action: "When you move out, run the move-out inspection for this property.",
    });
  }

  return gaps;
}
