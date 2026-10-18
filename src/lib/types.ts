// Domain types for DepositProof. Mirror the database schema in
// supabase/migrations/0001_initial_schema.sql. Keep these hand-written
// rather than generated so the frontend stays decoupled from Supabase
// internals and the AI edge-function response shape is explicit.

export type PropertyType = "bedroom" | "pg" | "shared-apartment" | "flat" | "house";
export type RoomType = "bedroom" | "bathroom" | "kitchen" | "living-room" | "balcony" | "other";
export type ConditionStage = "move-in" | "maintenance" | "move-out";
export type DamageCategory =
  | "wall-cracks-marks"
  | "paint-peeling"
  | "broken-fixtures"
  | "water-damage-stains"
  | "damaged-furniture"
  | "electrical-plumbing"
  | "scratches-floor-damage"
  | "other";
export type ChecklistStatus = "good" | "existing-damage" | "needs-attention" | "not-inspected";
export type MaintenanceStatus =
  | "reported"
  | "acknowledged"
  | "in-progress"
  | "resolved"
  | "unresolved";
export type AiStatus = "pending" | "ok" | "skipped" | "unavailable" | "error";
export type AiConfidence = "low" | "medium" | "high" | "unknown";

export interface AiResult {
  description: string;
  suggested_category: DamageCategory | null;
  observations: string[];
  confidence: AiConfidence;
  uncertainty: string[];
}

export interface Property {
  id: string;
  name: string;
  address: string | null;
  property_type: PropertyType;
  move_in_date: string | null;
  expected_move_out_date: string | null;
  landlord_name: string | null;
  landlord_contact: string | null;
  move_out_completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  property_id: string;
  name: string;
  room_type: RoomType;
  sort_order: number;
  created_at: string;
}

export interface Photo {
  id: string;
  room_id: string;
  property_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  description: string | null;
  damage_category: DamageCategory | null;
  condition_stage: ConditionStage;
  notes: string | null;
  upload_timestamp: string;
  capture_date: string | null;
  capture_date_reliable: boolean;
  ai_status: AiStatus;
  ai_result: AiResult | null;
  ai_user_confirmed: boolean;
  ai_user_edited: boolean;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  room_id: string;
  label: string;
  status: ChecklistStatus;
  notes: string | null;
  photo_ids: string[];
  sort_order: number;
  updated_at: string;
}

export interface MaintenanceIssue {
  id: string;
  property_id: string;
  room_id: string | null;
  title: string;
  description: string | null;
  status: MaintenanceStatus;
  date_reported: string;
  landlord_response: string | null;
  resolution_notes: string | null;
  resolution_photos: string[];
  created_at: string;
  updated_at: string;
}

export interface MaintenanceUpdate {
  id: string;
  issue_id: string;
  previous_status: MaintenanceStatus | null;
  new_status: MaintenanceStatus;
  note: string | null;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface TimelineEvent {
  id: string;
  type:
    | "property-created"
    | "room-added"
    | "photo-added"
    | "checklist-updated"
    | "maintenance-reported"
    | "maintenance-updated"
    | "move-out-started"
    | "move-out-completed";
  label: string;
  description: string;
  timestamp: string;
  room_id: string | null;
  room_name: string | null;
  category: string | null;
}

// AI edge-function response shapes
export type AnalyzePhotoResponse =
  | { status: "ok"; model: string; result: AiResult }
  | { status: "ai_unavailable" | "ai_disabled" | "ai_error"; message: string; backend_url?: string; raw?: string }
  | { status: string; message?: string; [k: string]: unknown };

// Display labels
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  bedroom: "Bedroom",
  pg: "PG / Hostel",
  "shared-apartment": "Shared Apartment",
  flat: "Flat",
  house: "House",
};

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  kitchen: "Kitchen",
  "living-room": "Living Room",
  balcony: "Balcony",
  other: "Other",
};

export const DAMAGE_CATEGORY_LABELS: Record<DamageCategory, string> = {
  "wall-cracks-marks": "Wall cracks or marks",
  "paint-peeling": "Paint peeling",
  "broken-fixtures": "Broken fixtures",
  "water-damage-stains": "Water damage or stains",
  "damaged-furniture": "Damaged furniture",
  "electrical-plumbing": "Electrical or plumbing",
  "scratches-floor-damage": "Scratches and floor damage",
  other: "Other",
};

export const CONDITION_STAGE_LABELS: Record<ConditionStage, string> = {
  "move-in": "Move-in",
  maintenance: "Maintenance",
  "move-out": "Move-out",
};

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  good: "Good condition",
  "existing-damage": "Existing damage",
  "needs-attention": "Needs attention",
  "not-inspected": "Not inspected",
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  reported: "Reported",
  acknowledged: "Acknowledged",
  "in-progress": "In progress",
  resolved: "Resolved",
  unresolved: "Unresolved",
};

export const AI_STATUS_LABELS: Record<AiStatus, string> = {
  pending: "Not analyzed",
  ok: "AI analyzed",
  skipped: "Skipped",
  unavailable: "AI unavailable",
  error: "Analysis failed",
};

export const DEFAULT_CHECKLIST: { label: string }[] = [
  { label: "Walls and paint" },
  { label: "Doors and locks" },
  { label: "Windows and glass" },
  { label: "Floor and tiles" },
  { label: "Lights and electrical fittings" },
  { label: "Furniture and fixtures" },
  { label: "Water leakage" },
  { label: "Cleanliness" },
];
