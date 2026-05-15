import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePatient } from "@/contexts/PatientContext";
import { useColors } from "@/hooks/useColors";

// ── Web Speech API type declarations ────────────────────────────────────────
interface SpeechResultItem { transcript: string; confidence: number; }
interface SpeechResult { readonly length: number; isFinal: boolean; [i: number]: SpeechResultItem; }
interface SpeechResultList { readonly length: number; [i: number]: SpeechResult; }
interface SpeechRecognitionEvent extends Event { readonly resultIndex: number; readonly results: SpeechResultList; }
interface SpeechErrorEvent extends Event { readonly error: string; }
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechErrorEvent) => void) | null;
}
interface SpeechRecognitionCtor { new(): SpeechRecognitionInstance; }
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const PROCESSING_STEPS = [
  "Reviewing your transcript...",
  "Extracting symptoms and details...",
  "Building your health summary...",
];

const NUM_BARS = 9;

export default function AudioRecordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setAnalysisInput, analysisInput } = usePatient();

  const [phase, setPhase] = useState<"ready" | "recording" | "recorded" | "editing" | "processing">("ready");
  const [timer, setTimer] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [processingStep, setProcessingStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef = useRef("");

  const barAnims = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.15))
  ).current;

  useEffect(() => {
    if (Platform.OS === "web") {
      const isSupported = !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
      setVoiceSupported(isSupported);
    } else {
      setVoiceSupported(false);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      recognitionRef.current?.abort();
    };
  }, []);

  const startWaveAnimation = useCallback(() => {
    barAnims.forEach((anim, i) => {
      const loop = () => {
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.8,
            duration: 200 + i * 30 + Math.random() * 200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.1 + Math.random() * 0.3,
            duration: 200 + i * 30 + Math.random() * 200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start((result) => { if (result.finished) loop(); });
      };
      loop();
    });
  }, [barAnims]);

  const stopWaveAnimation = useCallback(() => {
    barAnims.forEach((anim) => {
      anim.stopAnimation();
      Animated.timing(anim, { toValue: 0.15, duration: 300, useNativeDriver: true }).start();
    });
  }, [barAnims]);

  function startRecording() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setError(null);
    setPhase("recording");
    setTimer(0);
    setTranscript("");
    setInterimText("");
    finalTextRef.current = "";
    startWaveAnimation();
    intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);

    if (Platform.OS === "web" && voiceSupported) {
      const SpeechRecog = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!SpeechRecog) return;

      const recognition = new SpeechRecog();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = finalTextRef.current;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) { final += t + " "; }
          else { interim = t; }
        }
        finalTextRef.current = final;
        setTranscript(final);
        setInterimText(interim);
      };

      recognition.onerror = (event: SpeechErrorEvent) => {
        if (event.error === "aborted" || event.error === "no-speech") return;
        setError(
          event.error === "not-allowed"
            ? "Microphone access was denied. Please allow microphone permissions and try again."
            : `Microphone error: ${event.error}. Please try again.`
        );
        stopRecording();
      };

      recognition.onend = () => {
        const final = finalTextRef.current.trim();
        if (final) {
          setTranscript(final);
          setInterimText("");
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch {
        setError("Could not start microphone. Please reload and try again.");
        stopRecordingCleanup();
      }
    }
  }

  function stopRecording() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopRecordingCleanup();
    const finalText = finalTextRef.current.trim() || transcript.trim();
    if (finalText) {
      setTranscript(finalText);
      setPhase("recorded");
    } else {
      setPhase("recorded");
    }
  }

  function stopRecordingCleanup() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopWaveAnimation();
  }

  function reRecord() {
    setPhase("ready");
    setTimer(0);
    setError(null);
    setCompletedSteps([]);
    setProcessingStep(0);
    setTranscript("");
    setInterimText("");
    finalTextRef.current = "";
  }

  async function analyzeRecording() {
    const finalTranscript = transcript.trim();
    if (!finalTranscript) {
      setError("No speech detected. Please try recording again.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase("processing");
    setProcessingStep(0);
    setCompletedSteps([]);

    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setProcessingStep(i);
      await new Promise((r) => setTimeout(r, 1200));
      setCompletedSteps((prev) => [...prev, i]);
    }

    setAnalysisInput({
      mode: "audio",
      activeModule: analysisInput?.activeModule ?? "general",
      audioTranscript: finalTranscript,
    });

    router.push("/report");
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const displayTranscript = transcript + (interimText ? (transcript ? " " : "") + interimText : "");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#1A3A5C", "#0d2640"]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Voice Recording</Text>
            <Text style={styles.headerSub}>
              {voiceSupported ? "Speak your symptoms clearly" : "Web browser required for voice"}
            </Text>
          </View>
          <View style={[styles.modeBadge, { backgroundColor: phase === "recording" ? "#E24B4A" : "#2BBFA4" }]}>
            <Feather name="mic" size={14} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {phase !== "processing" && (
          <View style={styles.micContainer}>
            {/* Mic circle */}
            <View
              style={[
                styles.micCircle,
                {
                  backgroundColor: phase === "recording" ? "#FEE2E2" : "#E6F9F6",
                  borderColor: phase === "recording" ? "#E24B4A" : "#2BBFA4",
                  borderWidth: phase === "recording" ? 3 : 2,
                },
              ]}
            >
              <Feather
                name="mic"
                size={52}
                color={phase === "recording" ? "#E24B4A" : phase === "recorded" ? "#2BBFA4" : "#2BBFA4"}
              />
              {phase === "recording" && (
                <View style={styles.recordingIndicator} />
              )}
            </View>

            {/* Waveform */}
            {phase === "recording" && (
              <View style={styles.waveContainer}>
                {barAnims.map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        backgroundColor: i % 2 === 0 ? "#2BBFA4" : "#1A3A5C",
                        transform: [{ scaleY: anim }],
                      },
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Timer */}
            {phase === "recording" && (
              <View style={styles.timerRow}>
                <View style={styles.timerDot} />
                <Text style={[styles.timerText, { color: "#E24B4A" }]}>
                  {formatTime(timer)}
                </Text>
                <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>
                  recording
                </Text>
              </View>
            )}

            {phase === "recorded" && (
              <View style={styles.recordedBadge}>
                <Feather name="check-circle" size={20} color="#2BBFA4" />
                <Text style={[styles.recordedText, { color: "#2BBFA4" }]}>
                  Recorded · {formatTime(timer)}
                </Text>
              </View>
            )}

            {phase === "ready" && (
              <Text style={[styles.readyText, { color: colors.mutedForeground }]}>
                {voiceSupported
                  ? "Tap the button below to start. Speak naturally about your symptoms."
                  : "Open this app in Chrome or Edge for voice recording support."}
              </Text>
            )}
          </View>
        )}

        {/* Live transcript card */}
        {(phase === "recording" || phase === "recorded") && (
          <View style={[styles.transcriptCard, { borderColor: phase === "recording" ? "#2BBFA4" : "#E5E7EB" }]}>
            <View style={styles.transcriptHeader}>
              <Feather name="file-text" size={14} color="#2BBFA4" />
              <Text style={styles.transcriptLabel}>
                {phase === "recording" ? "Live Transcript" : "Your Transcript"}
              </Text>
              {phase === "recording" && interimText && (
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            {displayTranscript ? (
              <Text style={[styles.transcriptText, { color: colors.navy }]}>
                <Text style={styles.transcriptFinal}>{transcript}</Text>
                {interimText ? (
                  <Text style={styles.transcriptInterim}>{(transcript ? " " : "") + interimText}</Text>
                ) : null}
              </Text>
            ) : (
              <Text style={[styles.transcriptEmpty, { color: colors.mutedForeground }]}>
                {phase === "recording" ? "Listening… start speaking" : "No speech captured"}
              </Text>
            )}
          </View>
        )}

        {/* Editable transcript (after recorded) */}
        {phase === "recorded" && transcript && (
          <View style={styles.editCard}>
            <Text style={[styles.editLabel, { color: colors.navy }]}>
              ✏️ Review & Edit Transcript
            </Text>
            <Text style={[styles.editHint, { color: colors.mutedForeground }]}>
              You can correct any mistakes before analyzing
            </Text>
            <TextInput
              style={[styles.editInput, { color: colors.navy, borderColor: "#2BBFA4" }]}
              multiline
              value={transcript}
              onChangeText={setTranscript}
              textAlignVertical="top"
              accessibilityLabel="Edit transcript"
            />
          </View>
        )}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
            <Feather name="alert-circle" size={16} color="#E24B4A" />
            <Text style={[styles.errorText, { color: "#E24B4A" }]}>{error}</Text>
          </View>
        )}

        {/* CTAs */}
        {phase === "ready" && (
          <Pressable
            style={[styles.recordBtn, { opacity: voiceSupported ? 1 : 0.5 }]}
            onPress={voiceSupported ? startRecording : undefined}
          >
            <LinearGradient colors={["#1A3A5C", "#0d2640"]} style={styles.recordBtnInner}>
              <Feather name="mic" size={22} color="#fff" />
              <Text style={styles.recordBtnText}>Start Speaking</Text>
            </LinearGradient>
          </Pressable>
        )}

        {phase === "recording" && (
          <Pressable style={styles.recordBtn} onPress={stopRecording}>
            <View style={[styles.recordBtnInner, { backgroundColor: "#E24B4A", borderRadius: 16 }]}>
              <Feather name="square" size={22} color="#fff" />
              <Text style={styles.recordBtnText}>Stop Recording</Text>
            </View>
          </Pressable>
        )}

        {phase === "recorded" && (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.secondary, flex: 1 }]}
              onPress={reRecord}
            >
              <Feather name="refresh-cw" size={18} color={colors.navy} />
              <Text style={[styles.actionBtnText, { color: colors.navy }]}>Re-record</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#2BBFA4", flex: 2 }]}
              onPress={analyzeRecording}
              disabled={!transcript.trim()}
            >
              <Feather name="activity" size={18} color="#fff" />
              <Text style={[styles.actionBtnText, { color: "#fff" }]}>Analyze Recording</Text>
            </Pressable>
          </View>
        )}

        {phase === "processing" && (
          <View style={styles.processingCard}>
            <View style={[styles.processingIcon, { backgroundColor: "#E6F9F6" }]}>
              <Feather name="cpu" size={32} color="#2BBFA4" />
            </View>
            <Text style={[styles.processingTitle, { color: colors.navy }]}>Analyzing your voice...</Text>
            <View style={styles.steps}>
              {PROCESSING_STEPS.map((step, i) => (
                <View key={i} style={styles.step}>
                  <View
                    style={[
                      styles.stepIndicator,
                      {
                        backgroundColor: completedSteps.includes(i) ? "#2BBFA4"
                          : processingStep === i ? "#F59E0B" : colors.border,
                      },
                    ]}
                  >
                    {completedSteps.includes(i) ? (
                      <Feather name="check" size={14} color="#fff" />
                    ) : processingStep === i ? (
                      <Text style={{ color: "#fff", fontSize: 10 }}>●</Text>
                    ) : (
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>○</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      {
                        color: completedSteps.includes(i) ? "#2BBFA4"
                          : processingStep === i ? "#F59E0B" : colors.mutedForeground,
                        fontFamily: processingStep === i ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {phase === "ready" && voiceSupported && (
          <View style={[styles.helpBox, { backgroundColor: "#F0F7FF" }]}>
            <Feather name="info" size={15} color="#1A3A5C" />
            <Text style={[styles.helpText, { color: "#1A3A5C" }]}>
              Speak clearly in English or Hindi. Describe your symptoms, duration, and severity. For example: "I have had a severe headache for 3 days with dizziness."
            </Text>
          </View>
        )}

        {!voiceSupported && Platform.OS !== "web" && (
          <View style={[styles.helpBox, { backgroundColor: "#FEF3C7" }]}>
            <Feather name="globe" size={15} color="#92400E" />
            <Text style={[styles.helpText, { color: "#92400E" }]}>
              Voice recording requires a web browser. Open this app at its web URL in Chrome or Edge.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },
  modeBadge: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  content: { padding: 20, gap: 16 },
  micContainer: { alignItems: "center", paddingVertical: 24, gap: 18 },
  micCircle: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
    position: "relative",
  },
  recordingIndicator: {
    position: "absolute",
    top: 10, right: 10,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: "#E24B4A",
    borderWidth: 2, borderColor: "#fff",
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 60,
    paddingHorizontal: 8,
  },
  waveBar: {
    width: 5,
    height: 48,
    borderRadius: 3,
  },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#E24B4A" },
  timerText: { fontSize: 32, fontFamily: "Inter_700Bold" },
  timerLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  recordedBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  recordedText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  readyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  transcriptCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 10,
    shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  transcriptHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  transcriptLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#2BBFA4" },
  liveChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#E24B4A" },
  liveText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#E24B4A" },
  transcriptText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
  transcriptFinal: { fontFamily: "Inter_400Regular" },
  transcriptInterim: { color: "#9CA3AF", fontStyle: "italic" },
  transcriptEmpty: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  editCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 8,
    shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  editLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  editHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  editInput: {
    borderWidth: 1.5, borderRadius: 12, padding: 14,
    minHeight: 100, fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22,
  },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 12 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  recordBtn: {
    borderRadius: 16,
    shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    overflow: "hidden",
  },
  recordBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, height: 58, borderRadius: 16,
  },
  recordBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 52, borderRadius: 14, gap: 8,
  },
  actionBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  processingCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 28, gap: 20,
    alignItems: "center",
    shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  processingIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
  },
  processingTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  steps: { gap: 14, width: "100%" },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepIndicator: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  stepText: { fontSize: 14, flex: 1 },
  helpBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12 },
  helpText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
