import { FileText, Users as UsersIcon } from "lucide-react";
import { ROLE_META } from "./constants";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  sector: string;
  reportsCount: number;
}

interface Props {
  users: AppUser[];
  search: string;
}

export default function UsersTab({ users, search }: Props) {
  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl bg-card border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Usuario</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Sector</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Rol</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Reportes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground text-sm">No se encontraron usuarios</td>
                </tr>
              ) : filtered.map(u => {
                const role = ROLE_META[u.role ?? "user"] ?? ROLE_META.user;
                return (
                  <tr key={u.id} className="hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground/60 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{u.sector}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ color: role.color, background: `${role.color}20` }}>
                        {role.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-white font-semibold">{u.reportsCount ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-card border border-white/5 text-muted-foreground text-sm">No se encontraron usuarios</div>
        ) : filtered.map(u => {
          const role = ROLE_META[u.role ?? "user"] ?? ROLE_META.user;
          return (
            <div key={u.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-white/5">
              <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{u.name}</p>
                <p className="text-[10px] text-muted-foreground/60 truncate">{u.email}</p>
                <p className="text-[10px] text-muted-foreground/40">{u.sector}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: role.color, background: `${role.color}20` }}>
                  {role.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{u.reportsCount ?? 0} rep.</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
