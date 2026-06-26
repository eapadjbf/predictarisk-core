import { createContext, useContext, useState, ReactNode } from "react";
import type { CyberAnalysis } from "@workspace/api-zod/src/generated/types";

interface AppState {
  selectedOrgType: string | null;
  setSelectedOrgType: (org: string | null) => void;
  analysisResult: CyberAnalysis | null;
  setAnalysisResult: (result: CyberAnalysis | null) => void;
  reset: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedOrgType, setSelectedOrgType] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CyberAnalysis | null>(null);

  const reset = () => {
    setSelectedOrgType(null);
    setAnalysisResult(null);
  };

  return (
    <AppContext.Provider
      value={{
        selectedOrgType,
        setSelectedOrgType,
        analysisResult,
        setAnalysisResult,
        reset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
