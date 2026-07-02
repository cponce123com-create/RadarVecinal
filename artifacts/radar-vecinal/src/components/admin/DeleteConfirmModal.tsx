import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";

interface Props {
  deleteId: string | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  isPending: boolean;
}

export default function DeleteConfirmModal({ deleteId, onClose, onConfirm, isPending }: Props) {
  return (
    <AnimatePresence>
      {deleteId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#0f1219] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-white">Eliminar reporte</h3>
                <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              ¿Estás seguro de que deseas eliminar este reporte permanentemente?
            </p>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-muted-foreground hover:text-white hover:border-white/20 transition-all">
                Cancelar
              </button>
              <button onClick={() => onConfirm(deleteId)} disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-sm font-bold text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50">
                {isPending
                  ? <span className="flex items-center justify-center gap-1.5"><div className="w-3.5 h-3.5 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" /> Eliminando...</span>
                  : "Sí, eliminar"
                }
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
