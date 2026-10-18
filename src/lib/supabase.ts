import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Supabase environment variables are not configured.");
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export const PHOTO_BUCKET = "property-photos";

export function photoPublicUrl(storagePath: string): string {
  return `${url}/storage/v1/object/public/${PHOTO_BUCKET}/${storagePath}`;
}
