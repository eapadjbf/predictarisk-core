import { ShieldAlert, LogOut } from "lucide-react";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-mono selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="flex h-14 items-center px-6 gap-3">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span className="text-primary font-bold tracking-widest text-sm uppercase">CYBERGUARD.SYS</span>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="tracking-widest uppercase">System Online</span>
            {profile && (
              <span className="text-foreground">{profile.first_name} {profile.last_name}</span>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span className="tracking-widest uppercase">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-8 max-w-5xl">
        {children}
      </main>
    </div>
  );
}
