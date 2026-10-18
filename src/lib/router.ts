import { useEffect, useState } from "react";

// Lightweight hash-based router. Supports params via the route pattern.
// Routes:
//   #/                 dashboard
//   #/properties       properties list
//   #/properties/new   create property
//   #/properties/:id   property overview
//   #/properties/:id/rooms/:roomId  room inspection
//   #/properties/:id/move-out       move-out inspection
//   #/properties/:id/maintenance    maintenance log
//   #/properties/:id/report         PDF report
//   #/properties/:id/timeline       timeline
//   #/inspections      inspections list
//   #/maintenance      maintenance overview
//   #/reports          reports list
//   #/settings         settings + AI status + about

export interface RouteMatch {
  path: string;
  params: Record<string, string>;
}

function currentHash(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h || "/";
}

export function navigate(path: string): void {
  window.location.hash = path;
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export function useRoute(): RouteMatch {
  const [hash, setHash] = useState(currentHash());
  useEffect(() => {
    const onChange = () => setHash(currentHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return { path: hash, params: {} };
}

export function matchRoute(path: string): { name: string; params: Record<string, string> } {
  const segments = path.split("/").filter(Boolean);
  const [a, b, c, d, e] = segments;

  if (!a) return { name: "dashboard", params: {} };
  if (a === "properties" && !b) return { name: "properties", params: {} };
  if (a === "properties" && b === "new") return { name: "property-new", params: {} };
  if (a === "properties" && b && c === "rooms" && d)
    return { name: "room", params: { propertyId: b, roomId: d } };
  if (a === "properties" && b && c === "move-out")
    return { name: "move-out", params: { propertyId: b } };
  if (a === "properties" && b && c === "maintenance")
    return { name: "maintenance", params: { propertyId: b } };
  if (a === "properties" && b && c === "report")
    return { name: "report", params: { propertyId: b } };
  if (a === "properties" && b && c === "timeline")
    return { name: "timeline", params: { propertyId: b } };
  if (a === "properties" && b)
    return { name: "property", params: { propertyId: b } };
  if (a === "inspections") return { name: "inspections", params: {} };
  if (a === "maintenance") return { name: "maintenance-overview", params: {} };
  if (a === "reports") return { name: "reports", params: {} };
  if (a === "settings") return { name: "settings", params: {} };
  return { name: "not-found", params: {} };
}
