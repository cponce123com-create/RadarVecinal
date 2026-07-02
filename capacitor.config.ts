import { type CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "pe.miradar.vecinal",
  appName: "Radar Vecinal",
  webDir: "artifacts/radar-vecinal/dist/public",
  server: {
    androidScheme: "https",
  },
  plugins: {
    // Configuración inicial — se expandirá en Fase 3 con push nativas
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
