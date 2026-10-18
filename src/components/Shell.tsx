import { type ReactNode } from "react";
import {
  LayoutDashboard,
  Home,
  ClipboardCheck,
  Wrench,
  FileText,
  Settings,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { navigate, useRoute, matchRoute } from "@/lib/router";

interface NavItem {
  label: string;
  icon: typeof Home;
  route: string;
  match: string[];
}

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, route: "/", match: ["dashboard"] },
  { label: "My Properties", icon: Home, route: "/properties", match: ["properties", "property", "property-new", "room", "move-out"] },
  { label: "Inspections", icon: ClipboardCheck, route: "/inspections", match: ["inspections"] },
  { label: "Maintenance Log", icon: Wrench, route: "/maintenance", match: ["maintenance", "maintenance-overview"] },
  { label: "Reports", icon: FileText, route: "/reports", match: ["reports", "report"] },
  { label: "Settings", icon: Settings, route: "/settings", match: ["settings"] },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const route = useRoute();
  const active = matchRoute(route.path).name;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
              <ShieldCheck size={18} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">DepositProof</span>
              <span className="block text-xs text-slate-400">Document it before. Prove it later.</span>
            </span>
          </button>
          <button className="btn-ghost !p-1.5 lg:hidden" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.match.includes(active);
            return (
              <button
                key={item.route}
                onClick={() => {
                  navigate(item.route);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal-50 text-teal-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={18} className={isActive ? "text-teal-600" : "text-slate-400"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600">Local-first privacy</p>
            <p className="mt-1">Photos stay in your project storage. AI runs on your own Ollama.</p>
          </div>
        </div>
      </aside>
    </>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }): ReactNode {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
      <button className="btn-ghost !p-1.5 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <div className="flex-1" />
      <button
        onClick={() => navigate("/settings")}
        className="text-xs text-slate-500 hover:text-slate-700"
      >
        AI connection status
      </button>
    </header>
  );
}
