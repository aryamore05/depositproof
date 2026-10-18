import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";

export function fmtDate(iso: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!iso) return "Unavailable";
  try {
    return format(parseISO(iso), pattern);
  } catch {
    try {
      return format(new Date(iso), pattern);
    } catch {
      return "Unavailable";
    }
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "Unavailable";
  return fmtDate(iso, "d MMM yyyy, h:mm a");
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Unavailable";
  try {
    const d = parseISO(iso);
    if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
    if (isYesterday(d)) return `Yesterday, ${format(d, "h:mm a")}`;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "Unavailable";
  }
}

export function fmtBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Honestly distinguishes capture date reliability.
export function captureDateLabel(photo: { capture_date: string | null; capture_date_reliable: boolean }): string {
  if (!photo.capture_date) return "Capture date unavailable";
  if (photo.capture_date_reliable) return `Captured ${fmtDate(photo.capture_date)}`;
  return `Approx. captured ${fmtDate(photo.capture_date)} (unverified)`;
}
