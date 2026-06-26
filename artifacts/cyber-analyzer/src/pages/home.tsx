import { useApp } from "@/lib/context";
import { useLocation } from "wouter";
import {
  HeartPulse,
  Landmark,
  GraduationCap,
  Wifi,
  Zap,
  ShoppingCart,
  Factory,
  Train,
  ShieldCheck,
  Building2,
} from "lucide-react";

const ORG_TYPES = [
  { id: "Healthcare", icon: HeartPulse },
  { id: "Banking", icon: Landmark },
  { id: "Education", icon: GraduationCap },
  { id: "Telecommunications", icon: Wifi },
  { id: "Energy", icon: Zap },
  { id: "Retail", icon: ShoppingCart },
  { id: "Government", icon: Building2 },
  { id: "Manufacturing", icon: Factory },
  { id: "Transportation", icon: Train },
  { id: "Insurance", icon: ShieldCheck },
];

export default function Home() {
  const { setSelectedOrgType } = useApp();
  const [, setLocation] = useLocation();

  const handleSelect = (org: string) => {
    setSelectedOrgType(org);
    setLocation("/upload");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <p className="text-xs text-primary tracking-widest uppercase">Step 1 of 2</p>
        <h1 className="text-2xl font-bold tracking-tight uppercase">Select Organization Sector</h1>
        <p className="text-sm text-muted-foreground">
          Risk analysis and recommended controls are tailored to sector-specific threats.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3" data-testid="org-type-grid">
        {ORG_TYPES.map((org) => {
          const Icon = org.icon;
          return (
            <button
              key={org.id}
              data-testid={`org-type-${org.id}`}
              onClick={() => handleSelect(org.id)}
              className="group flex flex-col items-center justify-center gap-3 p-5 border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all cursor-pointer text-center"
            >
              <Icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                {org.id}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
