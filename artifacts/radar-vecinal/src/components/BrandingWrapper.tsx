import { ReactNode } from "react";
import useBranding from "@/hooks/useBranding";

export default function BrandingWrapper({ children }: { children: ReactNode }) {
  useBranding();
  return <>{children}</>;
}
