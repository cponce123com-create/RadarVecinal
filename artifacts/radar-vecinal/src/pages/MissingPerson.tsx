import { useState } from "react";
import { UserX, Upload, Phone, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useGetMissingPersons, useCreateMissingPerson, MissingPersonStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function MissingPerson() {
  const { data, isLoading } = useGetMissingPersons({ active: true });
  const createMissing = useCreateMissingPerson();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    clothing: "",
    lastSeenAddress: "",
    contactInfo: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMissing.mutate({
      data: {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        clothing: formData.clothing,
        lastSeenAddress: formData.lastSeenAddress,
        contactInfo: formData.contactInfo,
        lastSeenLatitude: -12.07,
        lastSeenLongitude: -77.09,
        lastSeenAt: new Date().toISOString(),
        reportedBy: "Usuario Local"
      }
    }, {
      onSuccess: () => {
        toast({ title: "Alerta creada", description: "Se ha notificado a la red." });
        setShowForm(false);
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-display font-bold text-amber-500 flex items-center gap-3 mb-2">
            <UserX className="w-8 h-8" />
            Personas Desaparecidas
          </h2>
          <p className="text-muted-foreground">Red de búsqueda comunitaria activa. Cada minuto cuenta.</p>
        </div>
        
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="px-6 py-3 rounded-xl bg-amber-500 text-amber-950 font-bold hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            Reportar Desaparición
          </button>
        )}
      </div>

      {showForm ? (
        <div className="p-6 md:p-8 rounded-2xl bg-card border border-amber-500/20 shadow-2xl relative overflow-hidden mb-8">
          <div className="absolute top-0 right-0 w-full h-2 bg-amber-500" />
          <h3 className="text-xl font-bold text-white mb-6">Nueva Alerta de Búsqueda</h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Nombre completo</label>
                <input required type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Edad aproximada</label>
                <input type="number" value={formData.age} onChange={e=>setFormData({...formData, age: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white mb-2">Descripción de vestimenta y características</label>
                <textarea required rows={3} value={formData.clothing} onChange={e=>setFormData({...formData, clothing: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none resize-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white mb-2">Última vez visto en (Dirección/Referencia)</label>
                <input required type="text" value={formData.lastSeenAddress} onChange={e=>setFormData({...formData, lastSeenAddress: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white mb-2">Teléfono de contacto</label>
                <input required type="text" value={formData.contactInfo} onChange={e=>setFormData({...formData, contactInfo: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" />
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl font-medium text-white hover:bg-white/5 transition-colors">Cancelar</button>
              <button type="submit" disabled={createMissing.isPending} className="px-8 py-3 rounded-xl bg-amber-500 text-amber-950 font-bold hover:bg-amber-400 transition-all ml-auto disabled:opacity-50">
                {createMissing.isPending ? "Publicando..." : "Publicar Alerta"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-80 rounded-2xl bg-card animate-pulse border border-white/5" />)
        ) : data?.alerts.length === 0 ? (
          <div className="col-span-full p-12 text-center text-muted-foreground bg-card rounded-2xl border border-white/5">
            No hay alertas de búsqueda activas.
          </div>
        ) : (
          data?.alerts.map(person => (
            <div key={person.id} className="rounded-2xl bg-card border border-amber-500/20 overflow-hidden group">
              <div className="h-48 bg-neutral-900 relative flex items-center justify-center border-b border-white/5">
                {person.photoUrl ? (
                  <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <UserX className="w-16 h-16 text-white/10" />
                )}
                <div className="absolute top-4 left-4 px-3 py-1 bg-amber-500 text-amber-950 text-xs font-bold rounded shadow-lg animate-pulse">
                  BUSCADO
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-bold text-white mb-1">{person.name} {person.age ? `(${person.age} años)` : ''}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{person.clothing}</p>
                
                <div className="space-y-2 text-sm text-white/80 mb-6">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <span>Última vez visto en {person.lastSeenAddress}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{person.contactInfo}</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center border-t border-white/5 pt-4">
                  Reportado {formatDistanceToNow(new Date(person.createdAt), { addSuffix: true, locale: es })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
