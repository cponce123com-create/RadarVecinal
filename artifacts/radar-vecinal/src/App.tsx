import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DistrictProvider } from "@/contexts/DistrictContext";
import { usePanicAlertStream } from "@/lib/usePanicAlertStream";

import { Layout } from "@/components/Layout";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// Ensure dark class is always on html
if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");
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
        {() => <Layout><Home /></Layout>}
      </Route>
      <Route path="/mapa">
        {() => <Layout><MapPage /></Layout>}
      </Route>
      <Route path="/reportar">
        {() => <Layout><ReportForm /></Layout>}
      </Route>
      <Route path="/alertas">
        {() => <Layout><Alerts /></Layout>}
      </Route>
      <Route path="/historial">
        {() => <Layout><History /></Layout>}
      </Route>
      <Route path="/estadisticas">
        {() => <Layout><Stats /></Layout>}
      </Route>
      <Route path="/perfil">
        {() => <Layout><Profile /></Layout>}
      </Route>
      <Route path="/menor-perdido">
        {() => <Layout><MissingPerson /></Layout>}
      </Route>
      <Route path="/admin">
        {() => <Layout><Admin /></Layout>}
      </Route>
      <Route path="/notificaciones">
        {() => <Layout><Notifications /></Layout>}
      </Route>
      <Route path="/configuracion">
        {() => <Layout><Settings /></Layout>}
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
