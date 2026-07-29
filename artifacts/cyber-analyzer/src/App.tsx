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
import AnalystDashboard from "@/pages/analyst";
import CISODashboard from "@/pages/ciso";
import ExecutiveDashboard from "@/pages/executive";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function AuthLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function ProfileErrorScreen({ message }: { message: string }) {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-6">
      <div className="max-w-lg w-full border border-destructive/50 bg-card rounded-md p-6 space-y-4">
        <h1 className="text-primary text-lg font-semibold">Unable to load your profile</h1>
        <p className="text-sm text-muted-foreground">
          You are signed in, but your account profile could not be read from the
          database. This usually means the Supabase security policies have not been
          applied yet. Run{" "}
          <code className="text-foreground">supabase-setup.sql</code> in your
          Supabase project's SQL Editor, then reload this page.
        </p>
        <pre className="text-xs bg-secondary text-muted-foreground rounded p-3 overflow-x-auto whitespace-pre-wrap">
          {message}
        </pre>
        <button
          onClick={() => signOut()}
          className="text-sm text-primary hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, profileError } = useAuth();
  if (loading) return <AuthLoading />;
  if (!session) return <Redirect to="/login" />;
  if (profileError) return <ProfileErrorScreen message={profileError} />;
  return <>{children}</>;
}

function RoleRedirect({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <AuthLoading />;
  const roleRoutes: Record<string, string> = {
    analyst: "/analyst",
    ciso: "/ciso",
    executive: "/executive",
    admin: "/admin",
  };
  if (profile?.role && roleRoutes[profile.role]) {
    return <Redirect to={roleRoutes[profile.role]} />;
  }
  return <>{children}</>;
}

function RequireRole({ children, role }: { children: ReactNode; role: string }) {
  const { session, loading, profile, profileError } = useAuth();
  if (loading) return <AuthLoading />;
  if (!session) return <Redirect to="/login" />;
  if (profileError) return <ProfileErrorScreen message={profileError} />;
  if (profile?.role !== role) return <Redirect to="/" />;
  return <>{children}</>;
}
function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, loading, isAdmin, profileError } = useAuth();
  if (loading) return <AuthLoading />;
  if (!session) return <Redirect to="/login" />;
  if (profileError) return <ProfileErrorScreen message={profileError} />;
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
      <Route path="/analyst">
        <RequireRole role="analyst">
          <AnalystDashboard />
        </RequireRole>
      </Route>
      <Route path="/ciso">
        <RequireRole role="ciso">
          <CISODashboard />
        </RequireRole>
      </Route>
      <Route path="/executive">
        <RequireRole role="executive">
          <ExecutiveDashboard />
        </RequireRole>
      </Route>
      <Route path="/admin">
        <RequireAdmin>
          <Admin />
        </RequireAdmin>
      </Route>
      <Route>
        <RequireAuth>
          <RoleRedirect>
            <Layout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/upload" component={Upload} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </RoleRedirect>
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
