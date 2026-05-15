import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useState, useCallback } from "react";

export type Gender = "male" | "female" | "unspecified";
export type InputMode = "text" | "audio" | "video_sign_language";
export type ActiveModule = "general" | "womens_health";

export interface PatientInfo {
  name: string;
  age: string;
  gender: Gender;
}

export interface AnalysisInput {
  mode: InputMode;
  activeModule: ActiveModule;
  textInput?: string;
  audioTranscript?: string;
  signGestures?: string[];
}

interface PatientContextValue {
  patient: PatientInfo | null;
  analysisInput: AnalysisInput | null;
  report: Record<string, unknown> | null;
  setPatient: (p: PatientInfo) => void;
  setAnalysisInput: (i: AnalysisInput) => void;
  setReport: (r: Record<string, unknown>) => void;
  reset: () => void;
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const [patient, setPatientState] = useState<PatientInfo | null>(null);
  const [analysisInput, setAnalysisInputState] = useState<AnalysisInput | null>(null);
  const [report, setReportState] = useState<Record<string, unknown> | null>(null);

  const setPatient = useCallback((p: PatientInfo) => {
    setPatientState(p);
    AsyncStorage.setItem("lastPatient", JSON.stringify(p)).catch(() => {});
  }, []);

  const setAnalysisInput = useCallback((i: AnalysisInput) => {
    setAnalysisInputState(i);
  }, []);

  const setReport = useCallback((r: Record<string, unknown>) => {
    setReportState(r);
  }, []);

  const reset = useCallback(() => {
    setPatientState(null);
    setAnalysisInputState(null);
    setReportState(null);
  }, []);

  return (
    <PatientContext.Provider
      value={{ patient, analysisInput, report, setPatient, setAnalysisInput, setReport, reset }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient(): PatientContextValue {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used within PatientProvider");
  return ctx;
}
