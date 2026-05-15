// Web Speech API voice recorder hook.
// Uses the browser's built-in SpeechRecognition (Chrome, Edge, Safari).
// Falls back gracefully when not supported.

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// Web Speech API types (not in standard lib — declare minimally)
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultItem;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type Status = "idle" | "listening" | "processing" | "unsupported";

interface VoiceRecorderState {
  status: Status;
  interimText: string;
  finalText: string;
  error: string | null;
}

interface VoiceRecorderActions {
  start: () => void;
  stop: () => void;
  clear: () => void;
  isSupported: boolean;
}

export function useVoiceRecorder(
  onFinalTranscript: (text: string) => void
): VoiceRecorderState & VoiceRecorderActions {
  const [status, setStatus] = useState<Status>("idle");
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = useRef("");

  const isSupported =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  useEffect(() => {
    if (!isSupported) setStatus("unsupported");
    return () => { recognitionRef.current?.abort(); };
  }, [isSupported]);

  const start = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecog = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecog) return;

    const recognition = new SpeechRecog();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    finalRef.current = "";
    setInterimText("");
    setFinalText("");
    setError(null);

    recognition.onstart = () => setStatus("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = finalRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim = transcript;
        }
      }

      finalRef.current = final;
      setFinalText(final);
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied. Please allow microphone access."
          : `Voice error: ${event.error}`
      );
      setStatus("idle");
    };

    recognition.onend = () => {
      const text = finalRef.current.trim();
      setStatus("idle");
      setInterimText("");
      if (text) {
        setFinalText(text);
        onFinalTranscript(text);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError("Could not start voice recognition. Please try again.");
      setStatus("idle");
    }
  }, [isSupported, onFinalTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const clear = useCallback(() => {
    setFinalText("");
    setInterimText("");
    setError(null);
    finalRef.current = "";
  }, []);

  return { status, interimText, finalText, error, start, stop, clear, isSupported };
}
