import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// F-04: Available districts with province and department hierarchy
export interface DistrictInfo {
  name: string;
  province: string;
  department: string;
  center: { lat: number; lng: number };
}

export const DISTRICTS: DistrictInfo[] = [
  { name: "San Ramón",    province: "Chanchamayo", department: "Junín", center: { lat: -11.1223, lng: -75.3560 } },
  { name: "La Merced",    province: "Chanchamayo", department: "Junín", center: { lat: -11.0557, lng: -75.3329 } },
  { name: "Pichanaki",    province: "Chanchamayo", department: "Junín", center: { lat: -10.9290, lng: -75.0606 } },
  { name: "San Luis de Shuaro", province: "Chanchamayo", department: "Junín", center: { lat: -10.8900, lng: -75.2700 } },
  { name: "Vitoc",        province: "Chanchamayo", department: "Junín", center: { lat: -11.2100, lng: -75.3200 } },
  { name: "Perené",       province: "Chanchamayo", department: "Junín", center: { lat: -10.9500, lng: -75.2200 } },
];

const DISTRICT_KEY = "radar_district";

interface DistrictContextValue {
  district:     string;
  province:     string;
  department:   string;
  districtInfo: DistrictInfo | undefined;
  setDistrict: (d: string) => void;
}

const DistrictContext = createContext<DistrictContextValue>({
  district:     "San Ramón",
  province:     "Chanchamayo",
  department:   "Junín",
  districtInfo: DISTRICTS[0],
  setDistrict:  () => {},
});

export function DistrictProvider({ children }: { children: ReactNode }) {
  const [districtName, setDistrictState] = useState<string>(
    () => localStorage.getItem(DISTRICT_KEY) ?? "San Ramón"
  );

  const setDistrict = (d: string) => {
    localStorage.setItem(DISTRICT_KEY, d);
    setDistrictState(d);
  };

  const info = DISTRICTS.find(d => d.name === districtName);

  return (
    <DistrictContext.Provider
      value={{
        district: districtName,
        province: info?.province ?? "Chanchamayo",
        department: info?.department ?? "Junín",
        districtInfo: info,
        setDistrict,
      }}
    >
      {children}
    </DistrictContext.Provider>
  );
}

export function useDistrict() {
  return useContext(DistrictContext);
}
