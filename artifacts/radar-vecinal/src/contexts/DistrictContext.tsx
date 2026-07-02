import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// M-11: District ahora se obtiene del API, no hardcodeado
export interface DistrictInfo {
  id: number;
  slug: string;
  name: string;
  province: string;
  department: string;
  centerLat?: number | null;
  centerLng?: number | null;
  defaultZoom?: number | null;
  isActive: boolean;
}

interface DistrictContextValue {
  currentDistrictId: number | null;
  currentDistrict: string;
  province: string;
  department: string;
  districtInfo: DistrictInfo | null;
  districts: DistrictInfo[];
  setDistrict: (slug: string) => void;
}

const DistrictContext = createContext<DistrictContextValue | null>(null);

const DEFAULT_DISTRICT_INFO: DistrictInfo = {
  id: 0,
  slug: "",
  name: "San Ramón",
  province: "Chanchamayo",
  department: "Junín",
  isActive: true,
};

export function DistrictProvider({ children }: { children: ReactNode }) {
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);
  const [districtInfo, setDistrictInfo] = useState<DistrictInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Cargar lista de distritos desde el API
  useEffect(() => {
    fetch("/api/districts")
      .then(res => res.json())
      .then(data => {
        const list: DistrictInfo[] = data.districts ?? [];
        setDistricts(list);
        if (list.length > 0) {
          // Intentar recuperar el último distrito seleccionado
          const saved = localStorage.getItem("radarvecinal_district_slug");
          const initial = saved ? list.find(d => d.slug === saved) : null;
          setDistrictInfo(initial ?? list[0]);
        } else {
          // Fallback si el API no devuelve distritos
          setDistrictInfo(DEFAULT_DISTRICT_INFO);
        }
        setLoaded(true);
      })
      .catch(() => {
        // Fallback offline
        setDistricts([]);
        setDistrictInfo(DEFAULT_DISTRICT_INFO);
        setLoaded(true);
      });
  }, []);

  // Persistir la selección en localStorage
  const setDistrict = (slug: string) => {
    const found = districts.find(d => d.slug === slug);
    if (found) {
      setDistrictInfo(found);
      localStorage.setItem("radarvecinal_district_slug", slug);
    }
  };

  return (
    <DistrictContext.Provider
      value={{
        currentDistrictId: districtInfo?.id ?? null,
        currentDistrict: districtInfo?.name ?? "",
        province: districtInfo?.province ?? "",
        department: districtInfo?.department ?? "",
        districtInfo,
        districts,
        setDistrict,
      }}
    >
      {children}
    </DistrictContext.Provider>
  );
}

export function useDistrict() {
  const ctx = useContext(DistrictContext);
  if (!ctx) throw new Error("useDistrict must be used inside DistrictProvider");
  return ctx;
}
