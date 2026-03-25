import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// A simple landing redirector 
function Landing() {
  if (typeof window !== 'undefined') {
    window.location.replace('/home');
  }
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
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
