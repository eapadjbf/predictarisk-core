import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Upload from "@/pages/upload";
import Results from "@/pages/results";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Admin from "@/pages/admin";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function AuthLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!session) return <Redirect to="/login" />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <AuthLoading />;
  if (!session) return <Redirect to="/login" />;
  if (!isAdmin) return <Redirect to="/" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/results">
        <RequireAuth>
          <Results />
        </RequireAuth>
      </Route>
      <Route path="/admin">
        <RequireAdmin>
          <Admin />
        </RequireAdmin>
      </Route>
      <Route>
        <RequireAuth>
          <Layout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/upload" component={Upload} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </RequireAuth>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AppProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
