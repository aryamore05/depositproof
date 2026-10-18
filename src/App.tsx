import { type ReactNode } from "react";
import { useRoute, matchRoute, navigate } from "@/lib/router";
import { Sidebar, TopBar } from "@/components/Shell";
import { useState } from "react";
import { Dashboard } from "@/pages/Dashboard";
import { PropertiesList } from "@/pages/PropertiesList";
import { PropertyNew } from "@/pages/PropertyNew";
import { PropertyOverview } from "@/pages/PropertyOverview";
import { RoomInspection } from "@/pages/RoomInspection";
import { MoveOutInspection } from "@/pages/MoveOutInspection";
import { MaintenancePage } from "@/pages/MaintenancePage";
import { ReportPage } from "@/pages/ReportPage";
import { TimelinePage } from "@/pages/TimelinePage";
import { Inspections } from "@/pages/Inspections";
import { MaintenanceOverview } from "@/pages/MaintenanceOverview";
import { ReportsList } from "@/pages/ReportsList";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App(): ReactNode {
  const route = useRoute();
  const match = matchRoute(route.path);
  const [menuOpen, setMenuOpen] = useState(false);

  let page: ReactNode;
  switch (match.name) {
    case "dashboard":
      page = <Dashboard />;
      break;
    case "properties":
      page = <PropertiesList />;
      break;
    case "property-new":
      page = <PropertyNew />;
      break;
    case "property":
      page = <PropertyOverview propertyId={match.params.propertyId} />;
      break;
    case "room":
      page = <RoomInspection propertyId={match.params.propertyId} roomId={match.params.roomId} />;
      break;
    case "move-out":
      page = <MoveOutInspection propertyId={match.params.propertyId} />;
      break;
    case "maintenance":
      page = <MaintenancePage propertyId={match.params.propertyId} />;
      break;
    case "report":
      page = <ReportPage propertyId={match.params.propertyId} />;
      break;
    case "timeline":
      page = <TimelinePage propertyId={match.params.propertyId} />;
      break;
    case "inspections":
      page = <Inspections />;
      break;
    case "maintenance-overview":
      page = <MaintenanceOverview />;
      break;
    case "reports":
      page = <ReportsList />;
      break;
    case "settings":
      page = <SettingsPage />;
      break;
    default:
      page = (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <h1 className="text-2xl font-semibold text-slate-800">Page not found</h1>
          <p className="text-sm text-slate-500">The page you were looking for doesn't exist.</p>
          <button className="btn-primary" onClick={() => navigate("/")}>Back to dashboard</button>
        </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl dp-fade-in">{page}</div>
        </main>
      </div>
    </div>
  );
}
