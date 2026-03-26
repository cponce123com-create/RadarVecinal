import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// B-05: Available districts in Chanchamayo region
export const DISTRICTS = [
  "San Ramón",
  "La Merced",
  "Pichanaki",
  "San Luis de Shuaro",
  "Vitoc",
  "Perené",
];

const DISTRICT_KEY = "radar_district";

interface DistrictContextValue {
  district:    string;
  setDistrict: (d: string) => void;
}

const DistrictContext = createContext<DistrictContextValue>({
  district:    "San Ramón",
  setDistrict: () => {},
});

export function DistrictProvider({ children }: { children: ReactNode }) {
  const [district, setDistrictState] = useState<string>(
    () => localStorage.getItem(DISTRICT_KEY) ?? "San Ramón"
  );

  const setDistrict = (d: string) => {
    localStorage.setItem(DISTRICT_KEY, d);
    setDistrictState(d);
  };

  return (
    <DistrictContext.Provider value={{ district, setDistrict }}>
      {children}
    </DistrictContext.Provider>
  );
}

export function useDistrict() {
  return useContext(DistrictContext);
}
