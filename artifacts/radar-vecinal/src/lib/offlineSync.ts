/**
 * offlineSync.ts — Cola de sincronización offline
 * Inspirado en Tancítaro (offline mode para zonas sin cobertura)
 *
 * Guarda reportes en localStorage cuando no hay internet
 * y los sincroniza automáticamente cuando la conexión reaparece.
 */
const STORAGE_KEY = "radar_pending_reports";

export interface PendingReport {
  id: string; // uuid generado localmente
  data: Record<string, any>;
  createdAt: string;
  retries: number;
}

/**
 * Guarda un reporte en la cola offline cuando no hay internet.
 */
export function queueReport(reportData: Record<string, any>): void {
  const pending = getPending();
  pending.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    data: reportData,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

/**
 * Obtiene todos los reportes pendientes de sincronizar.
 */
export function getPending(): PendingReport[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Intenta sincronizar todos los reportes pendientes.
 * Retorna { synced: number, failed: number }.
 */
export async function syncPending(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pending = getPending();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  const remaining: PendingReport[] = [];

  for (const item of pending) {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });

      if (res.ok) {
        synced++;
      } else if (item.retries < 3) {
        item.retries++;
        remaining.push(item);
        failed++;
      } else {
        failed++; // max retries reached, drop
      }
    } catch {
      if (item.retries < 3) {
        item.retries++;
        remaining.push(item);
      }
      failed++;
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  return { synced, failed };
}
