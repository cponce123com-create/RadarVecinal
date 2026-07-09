import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserX, Phone, MapPin, Clock, Plus, X, Camera, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useGetMissingPersons, useCreateMissingPerson, customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDistrict } from "@/contexts/DistrictContext";
import { useUpload } from "@workspace/object-storage-web";
import LocationPicker from "@/components/LocationPicker";

interface MissingRow {
  id: string;
  name: string;
  age?: number | null;
  clothing?: string;
  photoUrl?: string | null;
  lastSeenAddress?: string;
  contactInfo?: string | null;
  status?: string;
  createdAt: string;
}

const INPUT_CLASS = "w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-500/60 transition-colors";

export default function MissingPerson() {
  const { data, isLoading, refetch } = useGetMissingPersons({ active: true });
  const createMissing = useCreateMissingPerson();
  const { toast } = useToast();
  const { isAdmin, isModerator, token, user } = useAuth();
  const { districtInfo } = useDistrict();

  // ── Gestión (moderador+: editar/marcar; municipalidad+: eliminar) ──────────
  const [editing, setEditing] = useState<MissingRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", age: "", clothing: "", lastSeenAddress: "", contactInfo: "", status: "active", photoUrl: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openEdit = (p: MissingRow) => {
    setEditForm({
      name: p.name ?? "",
      age: p.age != null ? String(p.age) : "",
      clothing: p.clothing ?? "",
      lastSeenAddress: p.lastSeenAddress ?? "",
      contactInfo: p.contactInfo ?? "",
      status: p.status ?? "active",
      photoUrl: p.photoUrl ?? "",
    });
    setEditing(p);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await customFetch(`/api/missing-persons/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          age: editForm.age ? Number(editForm.age) : null,
          clothing: editForm.clothing,
          lastSeenAddress: editForm.lastSeenAddress,
          contactInfo: editForm.contactInfo,
          status: editForm.status,
          photoUrl: editForm.photoUrl || null,
        }),
      });
      toast({ title: "✓ Cambios guardados" });
      setEditing(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await customFetch(`/api/missing-persons/${deleteId}`, { method: "DELETE" });
      toast({ title: "Alerta eliminada" });
      setDeleteId(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };
  const { uploadFile, isUploading: isUploadingPhoto, error: uploadError } = useUpload({
    basePath: "/api/storage",
    getAuthToken: () => token,
    onSuccess: (response) => {
      set("imageUrl", response.objectPath);
      toast({ title: "✅ Foto subida correctamente", description: "La imagen se adjuntará al reporte." });
    },
    onError: (err) => {
      toast({ title: "Error al subir foto", description: err.message, variant: "destructive" });
    },
  });

  // Subida de foto para el modal de edición (destino distinto: editForm.photoUrl)
  const { uploadFile: uploadEditPhoto, isUploading: isUploadingEditPhoto } = useUpload({
    basePath: "/api/storage",
    getAuthToken: () => token,
    onSuccess: (response) => {
      setEditForm((f) => ({ ...f, photoUrl: response.objectPath }));
      toast({ title: "✅ Foto actualizada" });
    },
    onError: (err) => {
      toast({ title: "Error al subir foto", description: err.message, variant: "destructive" });
    },
  });
  // Centro por defecto: centro del distrito activo (o fallback razonable).
  const defaultLat = districtInfo?.centerLat ?? -12.0464;
  const defaultLng = districtInfo?.centerLng ?? -77.0428;

  const [showForm, setShowForm] = useState(false);
  const emptyForm = {
    name: "", age: "", clothing: "", lastSeenAddress: "", contactInfo: "", imageUrl: "",
    lastSeenLat: defaultLat, lastSeenLng: defaultLng,
  };
  const [formData, setFormData] = useState(emptyForm);

  const set = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const openForm = () => {
    // Sembrar la ubicación con el centro del distrito al abrir el formulario.
    setFormData(f => ({ ...f, lastSeenLat: defaultLat, lastSeenLng: defaultLng }));
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMissing.mutate({
      data: {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        clothing: formData.clothing,
        lastSeenAddress: formData.lastSeenAddress,
        contactInfo: formData.contactInfo,
        photoUrl: formData.imageUrl || null,
        lastSeenLatitude: formData.lastSeenLat,
        lastSeenLongitude: formData.lastSeenLng,
        lastSeenAt: new Date().toISOString(),
        reportedBy: user?.name || "Vecino",
      }
    }, {
      onSuccess: () => {
        toast({ title: "Alerta publicada", description: "La red vecinal ha sido notificada." });
        setShowForm(false);
        setFormData(emptyForm);
      },
      onError: () => {
        toast({ title: "Error al publicar", variant: "destructive" });
      }
    });
  };

  const alerts = data?.alerts ?? [];

  return (
    <div className="max-w-4xl mx-auto pb-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <UserX className="w-6 h-6" />
            Personas Extraviadas
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Red de búsqueda comunitaria. Cada minuto cuenta.</p>
        </div>
        {!showForm && (
          <button
            onClick={openForm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-amber-950 font-bold text-sm hover:bg-amber-400 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            <Plus className="w-4 h-4" />
            Reportar Extravío
          </button>
        )}
      </div>

      {/* New Alert Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl bg-card border border-amber-500/25 overflow-hidden shadow-2xl"
          >
            <div className="h-1 w-full bg-amber-500" />
            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white">Nueva Alerta de Búsqueda</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Nombre completo <span className="text-amber-400">*</span></label>
                    <input required type="text" value={formData.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Sebastián García" className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Edad aproximada</label>
                    <input type="number" min="0" max="120" value={formData.age} onChange={e => set("age", e.target.value)} placeholder="Ej: 9" className={INPUT_CLASS} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Descripción física y vestimenta <span className="text-amber-400">*</span></label>
                  <textarea required rows={3} value={formData.clothing} onChange={e => set("clothing", e.target.value)} placeholder="Color de ropa, características físicas, señas particulares..." className={`${INPUT_CLASS} resize-none`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Último lugar visto <span className="text-amber-400">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                    <input required type="text" value={formData.lastSeenAddress} onChange={e => set("lastSeenAddress", e.target.value)} placeholder="Av. La Marina cdra 5, frente al colegio..." className={`${INPUT_CLASS} pl-10`} />
                  </div>
                  {/* F1: ubicación real en el mapa (antes se guardaba un punto fijo). */}
                  <p className="text-[11px] text-muted-foreground/70 mt-2 mb-1.5">Ajusta el punto en el mapa o busca la dirección — así aparece en el lugar correcto.</p>
                  <LocationPicker
                    lat={formData.lastSeenLat}
                    lng={formData.lastSeenLng}
                    height={200}
                    onChange={(la, ln, address) =>
                      setFormData(prev => ({
                        ...prev,
                        lastSeenLat: la,
                        lastSeenLng: ln,
                        lastSeenAddress: address ?? prev.lastSeenAddress,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Teléfono de contacto <span className="text-amber-400">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                    <input required type="tel" value={formData.contactInfo} onChange={e => set("contactInfo", e.target.value)} placeholder="999 999 999" className={`${INPUT_CLASS} pl-10`} />
                  </div>
                </div>
                {/* B-17: Photo upload — now with file upload via presigned URLs */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Foto de la persona</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition-all cursor-pointer ${isUploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                        <Camera className="w-4 h-4" />
                        {isUploadingPhoto ? "Subiendo..." : "Seleccionar foto"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingPhoto}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              await uploadFile(file);
                            }
                          }}
                        />
                      </label>
                      {formData.imageUrl && (
                        <button
                          onClick={() => set("imageUrl", "")}
                          className="text-xs text-muted-foreground hover:text-white transition-colors"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                    {isUploadingPhoto && (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <div className="w-4 h-4 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                        Subiendo foto...
                      </div>
                    )}
                    {uploadError && (
                      <p className="text-xs text-red-400">Error: {uploadError.message}</p>
                    )}
                    {formData.imageUrl && (
                      <div className="mt-1 rounded-xl overflow-hidden h-32 bg-white/5 border border-white/8">
                        <img
                          src={formData.imageUrl}
                          alt="Vista previa"
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 pt-2 border-t border-white/5">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/6 rounded-xl transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={createMissing.isPending} className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-amber-950 text-sm font-bold hover:bg-amber-400 transition-all disabled:opacity-60">
                    {createMissing.isPending ? "Publicando..." : "Publicar Alerta"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-72 rounded-xl bg-card animate-pulse border border-white/5" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
            <UserX className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-white font-semibold mb-1">Sin extraviados activos</p>
          <p className="text-sm text-muted-foreground">Si conoces a alguien que necesite ayuda, usa el botón de arriba.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((person, i) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl bg-card border border-amber-500/20 overflow-hidden flex flex-col"
            >
              {/* Photo area */}
              <div className="relative h-40 bg-gradient-to-br from-amber-950/40 to-neutral-900 flex items-center justify-center border-b border-white/5">
                {person.photoUrl ? (
                  <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover opacity-90" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center">
                      <span className="text-2xl font-bold text-amber-400">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Sin foto disponible</span>
                  </div>
                )}
                {/* Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-amber-500 text-amber-950 text-[10px] font-bold rounded-lg shadow-lg status-blink">
                  BÚSQUEDA ACTIVA
                </div>
                {/* Controles de gestión (moderador+: editar; municipalidad+: eliminar) */}
                {isModerator && (
                  <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                    <button
                      onClick={() => openEdit(person as MissingRow)}
                      aria-label={`Editar ${person.name}`}
                      className="w-8 h-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg bg-black/55 backdrop-blur-sm border border-white/15 text-white/90 hover:bg-black/75 hover:text-white transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setDeleteId(person.id)}
                        aria-label={`Eliminar ${person.name}`}
                        className="w-8 h-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg bg-black/55 backdrop-blur-sm border border-red-500/40 text-red-300 hover:bg-red-600/80 hover:text-white transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 flex-1 flex flex-col gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {person.name}
                    {person.age ? <span className="text-sm font-normal text-muted-foreground ml-1.5">({person.age} años)</span> : null}
                  </h3>
                  {person.clothing && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{person.clothing}</p>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2 text-white/80">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{person.lastSeenAddress}</span>
                  </div>
                  {person.contactInfo && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <a href={`tel:${person.contactInfo}`} className="text-amber-300 hover:text-amber-200 transition-colors">
                        {person.contactInfo}
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(person.createdAt), { addSuffix: true, locale: es })}
                  </div>
                  {person.contactInfo ? (
                    <a
                      href={`tel:${person.contactInfo}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-colors min-h-[44px]"
                    >
                      <Phone className="w-3 h-3" />
                      Contactar
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">Contacto no disponible</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Modal de edición (moderador+) ─────────────────────────────────── */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => !savingEdit && setEditing(null)}
            role="dialog" aria-modal="true" aria-label="Editar persona extraviada"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-amber-500/25 shadow-2xl"
            >
              <div className="h-1 w-full bg-amber-500" />
              <div className="p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-white">Editar alerta</h3>
                  <button onClick={() => setEditing(null)} aria-label="Cerrar" className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/80 mb-1.5">Nombre completo</label>
                      <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={INPUT_CLASS} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/80 mb-1.5">Edad</label>
                      <input type="number" min="0" max="120" value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} className={INPUT_CLASS} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Descripción y vestimenta</label>
                    <textarea rows={3} value={editForm.clothing} onChange={e => setEditForm(f => ({ ...f, clothing: e.target.value }))} className={`${INPUT_CLASS} resize-none`} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Último lugar visto</label>
                    <input type="text" value={editForm.lastSeenAddress} onChange={e => setEditForm(f => ({ ...f, lastSeenAddress: e.target.value }))} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Teléfono de contacto</label>
                    <input type="tel" value={editForm.contactInfo} onChange={e => setEditForm(f => ({ ...f, contactInfo: e.target.value }))} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Estado</label>
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={INPUT_CLASS}>
                      <option value="active">Búsqueda activa</option>
                      <option value="found">Encontrado(a)</option>
                      <option value="archived">Archivado</option>
                    </select>
                  </div>
                  {/* Foto: subir / cambiar / quitar */}
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Foto</label>
                    <div className="flex items-center gap-3">
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition-all cursor-pointer ${isUploadingEditPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                        <Camera className="w-4 h-4" />
                        {isUploadingEditPhoto ? "Subiendo..." : editForm.photoUrl ? "Cambiar foto" : "Subir foto"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingEditPhoto}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) await uploadEditPhoto(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {editForm.photoUrl && (
                        <>
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                            <img src={editForm.photoUrl} alt="Foto" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                          <button type="button" onClick={() => setEditForm(f => ({ ...f, photoUrl: "" }))} className="text-xs text-muted-foreground hover:text-white transition-colors">
                            Quitar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 border-t border-white/5">
                    <button type="button" onClick={() => setEditing(null)} disabled={savingEdit} className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/6 rounded-xl transition-all disabled:opacity-50">
                      Cancelar
                    </button>
                    <button type="button" onClick={saveEdit} disabled={savingEdit} className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-amber-950 text-sm font-bold hover:bg-amber-400 transition-all disabled:opacity-60">
                      <CheckCircle2 className="w-4 h-4" />
                      {savingEdit ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirmación de eliminación (municipalidad+) ──────────────────── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteId(null)}
            role="dialog" aria-modal="true" aria-label="Confirmar eliminación"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0f1219] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Eliminar alerta</h3>
                  <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                ¿Seguro que deseas eliminar esta alerta de persona extraviada?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} disabled={deleting} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-muted-foreground hover:text-white hover:border-white/20 transition-all disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={confirmDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-sm font-bold text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50">
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
