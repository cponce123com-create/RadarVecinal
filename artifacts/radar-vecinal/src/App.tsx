import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DistrictProvider } from "@/contexts/DistrictContext";
import { usePanicAlertStream } from "@/lib/usePanicAlertStream";
import { useProximityVoice } from "@/hooks/useProximityVoice";
import { initApiBaseUrl } from "@/lib/apiConfig";

// Inicializar URL base de la API (detecta Capacitor vs web automáticamente)
initApiBaseUrl();

import { lazy, Suspense } from "react";
import { Layout } from "@/components/Layout";
import BrandingWrapper from "@/components/BrandingWrapper";
import Home from "@/pages/Home";
import ReportForm from "@/pages/ReportForm";
import Alerts from "@/pages/Alerts";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";
import Settings from "@/pages/Settings";
import Emergencias from "@/pages/Emergencias";

// Lazy-loaded heavy pages (code splitting)
const MapPage = lazy(() => import("@/pages/MapPage"));
const History = lazy(() => import("@/pages/History"));
const Stats = lazy(() => import("@/pages/Stats"));
const MissingPerson = lazy(() => import("@/pages/MissingPerson"));
const Admin = lazy(() => import("@/pages/Admin"));
const LiveBroadcast = lazy(() => import("@/pages/LiveBroadcast"));
const LiveHistory = lazy(() => import("@/pages/LiveHistory"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    }>
      {children}
    </Suspense>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Apply theme from localStorage (defaults to dark)
if (typeof document !== "undefined") {
  const savedTheme = localStorage.getItem("radar_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme ? savedTheme === "dark" : prefersDark !== false;
  document.documentElement.classList.toggle("dark", isDark);
}

// A simple landing redirector 
function Landing() {
  if (typeof window !== 'undefined') {
    window.location.replace('/home');
  }
  return null;
}

// F-07: Global panic alert SSE listener — renders nothing, just subscribes for toasts + F-09 sounds
function GlobalPanicStream() {
  usePanicAlertStream();
  return null;
}

// Aviso por voz cuando un servicio en vivo se acerca a tu casa (app abierta).
function ProximityVoiceWatcher() {
  useProximityVoice();
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      
      {/* App Routes wrapped in Layout */}
      <Route path="/home">
        {() => <Layout><BrandingWrapper><Home /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/mapa">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><MapPage /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      <Route path="/reportar">
        {() => <Layout><BrandingWrapper><ReportForm /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/alertas">
        {() => <Layout><BrandingWrapper><Alerts /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/historial">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><History /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      <Route path="/estadisticas">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><Stats /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      <Route path="/perfil">
        {() => <Layout><BrandingWrapper><Profile /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/menor-perdido">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><MissingPerson /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      <Route path="/en-vivo">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><LiveBroadcast /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      <Route path="/rutas">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><LiveHistory /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      <Route path="/admin">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><Admin /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      <Route path="/notificaciones">
        {() => <Layout><BrandingWrapper><Notifications /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/configuracion">
        {() => <Layout><BrandingWrapper><Settings /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/emergencias">
        {() => <Layout><BrandingWrapper><Emergencias /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/privacidad">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><Privacy /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      <Route path="/terminos">
        {() => <Layout><BrandingWrapper><SuspenseWrapper><Terms /></SuspenseWrapper></BrandingWrapper></Layout>}
      </Route>
      
      <Route>{() => <SuspenseWrapper><NotFound /></SuspenseWrapper>}</Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <DistrictProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <GlobalPanicStream />
            <ProximityVoiceWatcher />
            <Toaster />
          </DistrictProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
