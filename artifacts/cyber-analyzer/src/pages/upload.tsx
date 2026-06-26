import { useApp } from "@/lib/context";
import { useLocation } from "wouter";
import { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import type { CyberAnalysis } from "@workspace/api-zod";

const LOADING_STEPS = [
  "Processing Excel file...",
  "Extracting security events...",
  "Correlating threat patterns...",
  "Calculating exploit probabilities...",
  "Mapping controls and frameworks...",
  "Estimating financial impact...",
  "Generating intelligence report...",
];

export default function Upload() {
  const { selectedOrgType, setAnalysisResult } = useApp();
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedOrgType) {
    setLocation("/");
    return null;
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    setError(null);
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      setError("Invalid format. Please upload a .xlsx or .xls file.");
      return;
    }
    setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(5);
    setLoadingStep(0);
    setError(null);

    const formData = new FormData();
    formData.append("orgType", selectedOrgType);
    formData.append("file", file);

    const stepInterval = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
      setProgress((p) => Math.min(p + (Math.random() * 12 + 3), 88));
    }, 3500);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      clearInterval(stepInterval);
      setProgress(100);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Failed to process analysis" }));
        throw new Error(errData.error ?? "Failed to process analysis");
      }

      const data: CyberAnalysis = await response.json();
      setAnalysisResult(data);
      setLocation("/results");
    } catch (err) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-6">
        <button
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground transition-colors"
          data-testid="btn-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-xs text-primary tracking-widest uppercase">Step 2 of 2</p>
          <h1 className="text-2xl font-bold tracking-tight uppercase">Upload Events File</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Selected sector:{" "}
            <span className="text-primary font-bold tracking-widest uppercase">{selectedOrgType}</span>
          </p>
        </div>
      </div>

      <div
        data-testid="drop-zone"
        className={`border-2 border-dashed p-16 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5"
            : file
            ? "border-primary/40 bg-primary/3"
            : "border-border hover:border-primary/40"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
      >
        {file ? (
          <div className="flex flex-col items-center gap-4">
            <FileSpreadsheet className="w-12 h-12 text-primary" />
            <div>
              <p className="font-bold tracking-wide">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {!isUploading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border px-3 py-1"
                data-testid="btn-change-file"
              >
                CHANGE FILE
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <UploadCloud className="w-12 h-12 text-muted-foreground" />
            <div>
              <p className="font-bold tracking-wide uppercase">Drag and drop here</p>
              <p className="text-xs text-muted-foreground mt-1">Supports .xlsx and .xls</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="text-xs border border-border px-4 py-2 hover:border-primary hover:text-primary transition-colors tracking-widest uppercase"
              data-testid="btn-browse-file"
            >
              Browse File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              data-testid="input-file"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 border border-primary/40 bg-primary/5 p-4" data-testid="error-message">
          <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {isUploading && (
        <div className="space-y-3" data-testid="loading-indicator">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="tracking-wide">{LOADING_STEPS[loadingStep]}</span>
            <span className="font-mono text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-1">
            {LOADING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-0.5 flex-1 transition-colors duration-500 ${
                  i <= loadingStep ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          data-testid="btn-analyze"
          onClick={handleAnalyze}
          disabled={!file || isUploading}
          className="px-8 py-3 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing...
            </>
          ) : (
            "Analyze Events"
          )}
        </button>
      </div>
    </div>
  );
}
