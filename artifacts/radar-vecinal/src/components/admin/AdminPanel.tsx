import { useState } from "react";
import { Shield, Database, FileText, Users as UsersIcon, Megaphone, Search } from "lucide-react";
import { useGetReports, useGetUsers } from "@workspace/api-client-react";
import { useGetStats } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDistrict } from "@/contexts/DistrictContext";
import { type Tab, seedDemoData } from "./constants";
import KpiCards from "./KpiCards";
import ReportsTab from "./ReportsTab";
import UsersTab from "./UsersTab";
import AdSlotsTab from "./AdSlotsTab";
import DistrictSwitcher from "./DistrictSwitcher";

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("reports");
  const [search, setSearch] = useState("");
  const [seeding, setSeeding] = useState(false);

  const { currentDistrictId } = useDistrict();
  const { user, isSuperAdmin } = useAuth();
  const { data: reportsData, refetch } = useGetReports({ districtId: currentDistrictId ?? undefined });
  const { data: usersData } = useGetUsers();
  const { data: stats } = useGetStats();

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await seedDemoData();
      refetch();
    } catch {
      // toast handled by seedDemoData
    } finally {
      setSeeding(false);
    }
  };

  const tabs = [
    { id: "reports" as Tab, label: "Reportes",   icon: FileText },
    { id: "users" as Tab,   label: "Usuarios",   icon: UsersIcon },
    { id: "ads" as Tab,     label: "Publicidad", icon: Megaphone },
  ];

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

        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-all disabled:opacity-50"
        >
          {seeding
            ? <><div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /> Cargando...</>
            : <><Database className="w-4 h-4" /> Cargar datos demo</>
          }
        </button>
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

        {tab !== "ads" && (
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
      {tab === "users" && <UsersTab users={usersData?.users ?? []} search={search} />}
      {tab === "ads" && <AdSlotsTab />}
    </div>
  );
}
