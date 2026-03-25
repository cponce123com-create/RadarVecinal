import { useState } from "react";
import { useGetReports, useUpdateReport, ReportStatus, useGetUsers } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Shield, CheckCircle, Trash, XCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [tab, setTab] = useState<'reports' | 'users'>('reports');
  const { data: reportsData, refetch: refetchReports } = useGetReports();
  const { data: usersData } = useGetUsers();
  const updateReport = useUpdateReport();
  const { toast } = useToast();

  const handleStatusChange = (id: string, newStatus: ReportStatus) => {
    updateReport.mutate({
      id,
      data: { status: newStatus }
    }, {
      onSuccess: () => {
        toast({ title: "Estado actualizado" });
        refetchReports();
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-accent" />
          Centro de Control
        </h2>
        <p className="text-muted-foreground">Gestión de incidentes y usuarios de la red.</p>
      </div>

      <div className="flex gap-4 border-b border-border mb-8">
        <button 
          onClick={() => setTab('reports')}
          className={`pb-4 px-2 font-medium transition-colors ${tab === 'reports' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
        >
          Moderación de Reportes
        </button>
        <button 
          onClick={() => setTab('users')}
          className={`pb-4 px-2 font-medium transition-colors ${tab === 'users' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
        >
          Directorio de Usuarios
        </button>
      </div>

      {tab === 'reports' && (
        <div className="bg-card border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-background/50 text-xs uppercase text-white/50 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Incidente</th>
                  <th className="px-6 py-4">Ubicación</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Estado Actual</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reportsData?.reports.map(report => (
                  <tr key={report.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white max-w-[200px] truncate">
                      {report.title}
                    </td>
                    <td className="px-6 py-4">{report.sector}</td>
                    <td className="px-6 py-4">{formatDistanceToNow(new Date(report.createdAt), { locale: es })}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded text-xs font-medium border ${
                        report.status === 'active' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        report.status === 'resolved' ? 'bg-success/10 text-success border-success/20' :
                        'bg-warning/10 text-warning border-warning/20'
                      }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.status !== 'resolved' && (
                          <button 
                            onClick={() => handleStatusChange(report.id, ReportStatus.resolved)}
                            className="p-2 text-success hover:bg-success/20 rounded-lg transition-colors"
                            title="Marcar como resuelto"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {report.status !== 'archived' && (
                          <button 
                            onClick={() => handleStatusChange(report.id, ReportStatus.archived)}
                            className="p-2 text-muted-foreground hover:bg-white/10 rounded-lg transition-colors"
                            title="Archivar"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-card border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-background/50 text-xs uppercase text-white/50 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Sector</th>
                  <th className="px-6 py-4">Reportes</th>
                  <th className="px-6 py-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usersData?.users.map(user => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{user.name}</div>
                      <div className="text-xs text-muted-foreground/70">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 capitalize">{user.role}</td>
                    <td className="px-6 py-4">{user.sector}</td>
                    <td className="px-6 py-4">{user.reportsCount}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2.5 py-1 rounded text-xs font-medium border ${user.isActive ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                        {user.isActive ? 'Activo' : 'Bloqueado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
