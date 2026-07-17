import { useState } from "react";
import { Shield, Siren, FileText, Users as UsersIcon, Megaphone, Search, BarChart3, FileDown, Crown, Truck, Volume2 } from "lucide-react";
import { useGetReports, useGetUsers } from "@workspace/api-client-react";
import { useGetStats } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDistrict } from "@/contexts/DistrictContext";
import { type Tab } from "./constants";
import KpiCards from "./KpiCards";
import ReportsTab from "./ReportsTab";
import UsersTab from "./UsersTab";
import AdSlotsTab from "./AdSlotsTab";
import DistrictSwitcher from "./DistrictSwitcher";
import AnalyticsTab from "./AnalyticsTab";
import SuperAdminTab from "./SuperAdminTab";
import AlertsTab from "./AlertsTab";
import DevicesTab from "./DevicesTab";
import AudioClipsTab from "./AudioClipsTab";
export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("reports");
  const [search, setSearch] = useState("");

  const { currentDistrictId } = useDistrict();
  const { user, isSuperAdmin } = useAuth();
  const { data: reportsData, refetch } = useGetReports({ districtId: currentDistrictId ?? undefined });
  const { data: usersData } = useGetUsers();
  const { data: stats } = useGetStats();

  const tabs = [
    { id: "reports" as Tab, label: "Reportes",   icon: FileText },
    { id: "analytics" as Tab, label: "Analítica", icon: BarChart3 },
    { id: "alerts" as Tab,  label: "Alertas",    icon: Siren },
    { id: "users" as Tab,   label: "Usuarios",   icon: UsersIcon },
    { id: "devices" as Tab, label: "Recolector", icon: Truck },
    { id: "audios" as Tab,  label: "Audios",     icon: Volume2 },
    { id: "ads" as Tab,     label: "Publicidad", icon: Megaphone },
  ];

  // Super admin tab solo visible para super_admin
  if (isSuperAdmin) {
    tabs.push({ id: "superadmin" as Tab, label: "Super Admin", icon: Crown });
  }

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Centro de Control</h2>
            <p className="text-sm text-muted-foreground">Gestión de incidentes, usuarios y moderación</p>
          </div>
        </div>

        {/* DistrictSwitcher: dropdown para super_admin, badge fijo para admin municipal */}
        <DistrictSwitcher isSuperAdmin={isSuperAdmin} />

        {tab === "reports" && (
          <a href={`/api/reports/export/pdf?districtId=${currentDistrictId}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </a>
        )}

      </div>

      {/* KPI Cards */}
      <KpiCards stats={stats} usersCount={usersData?.users?.length} />

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-0 border border-white/8 rounded-xl overflow-hidden p-0.5 bg-card w-fit">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSearch(""); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab !== "ads" && tab !== "analytics" && tab !== "devices" && tab !== "audios" && (
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === "reports" ? "Buscar reportes..." : "Buscar usuarios..."}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Tab content */}
      {tab === "reports" && <ReportsTab reports={reportsData?.reports ?? []} search={search} onRefetch={refetch} />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "alerts" && <AlertsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "devices" && <DevicesTab />}
      {tab === "audios" && <AudioClipsTab />}
      {tab === "ads" && <AdSlotsTab />}
      {tab === "superadmin" && <SuperAdminTab />}
    </div>
  );
}
