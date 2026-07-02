import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DistrictProvider } from "@/contexts/DistrictContext";
import { usePanicAlertStream } from "@/lib/usePanicAlertStream";

import { Layout } from "@/components/Layout";
import BrandingWrapper from "@/components/BrandingWrapper";
import Home from "@/pages/Home";
import MapPage from "@/pages/MapPage";
import ReportForm from "@/pages/ReportForm";
import Alerts from "@/pages/Alerts";
import History from "@/pages/History";
import Stats from "@/pages/Stats";
import Profile from "@/pages/Profile";
import MissingPerson from "@/pages/MissingPerson";
import Admin from "@/pages/Admin";
import Notifications from "@/pages/Notifications";
import Settings from "@/pages/Settings";
import Emergencias from "@/pages/Emergencias";
import NotFound from "@/pages/not-found";

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
  const savedTheme = localStorage.getItem("rvs_theme");
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      
      {/* App Routes wrapped in Layout */}
      <Route path="/home">
        {() => <Layout><BrandingWrapper><Home /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/mapa">
        {() => <Layout><BrandingWrapper><MapPage /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/reportar">
        {() => <Layout><BrandingWrapper><ReportForm /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/alertas">
        {() => <Layout><BrandingWrapper><Alerts /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/historial">
        {() => <Layout><BrandingWrapper><History /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/estadisticas">
        {() => <Layout><BrandingWrapper><Stats /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/perfil">
        {() => <Layout><BrandingWrapper><Profile /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/menor-perdido">
        {() => <Layout><BrandingWrapper><MissingPerson /></BrandingWrapper></Layout>}
      </Route>
      <Route path="/admin">
        {() => <Layout><BrandingWrapper><Admin /></BrandingWrapper></Layout>}
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
      
      <Route component={NotFound} />
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
            <Toaster />
          </DistrictProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
