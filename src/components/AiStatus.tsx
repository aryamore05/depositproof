import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";
import { checkAiConnection } from "@/lib/api";

export type AiConnection = "connected" | "disconnected" | "checking" | "unavailable";

export function useAiConnection() {
  const [state, setState] = useState<AiConnection>("checking");
  const [message, setMessage] = useState("");
  const [backendUrl, setBackendUrl] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  const reload = () => setReloadNonce((n) => n + 1);

  useEffect(() => {
    let active = true;
    setState("checking");
    checkAiConnection()
      .then((r) => {
        if (!active) return;
        setBackendUrl(r.backendUrl);
        setMessage(r.message);
        setState(r.connected ? "connected" : "unavailable");
      })
      .catch(() => {
        if (!active) return;
        setState("unavailable");
        setMessage("Could not check AI connection.");
      });
    return () => {
      active = false;
    };
  }, [reloadNonce]);

  return { state, message, backendUrl, reload };
}

export function AiStatusBadge({ state, compact = false }: { state: AiConnection; compact?: boolean }) {
  const map = {
    connected: { icon: Wifi, text: "AI connected", cls: "bg-emerald-50 text-emerald-700" },
    disconnected: { icon: WifiOff, text: "AI disconnected", cls: "bg-slate-100 text-slate-600" },
    checking: { icon: Loader2, text: "Checking AI…", cls: "bg-amber-50 text-amber-700" },
    unavailable: { icon: AlertTriangle, text: "AI unavailable", cls: "bg-red-50 text-red-600" },
  } as const;
  const { icon: Icon, text, cls } = map[state];
  return (
    <span className={`badge ${cls}`}>
      <Icon size={12} className={state === "checking" ? "dp-spin" : ""} />
      {!compact && text}
    </span>
  );
}
