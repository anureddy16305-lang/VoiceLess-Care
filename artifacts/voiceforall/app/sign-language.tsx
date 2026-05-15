import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ClassifiedSign } from "@/lib/gestureClassifier";
import { usePatient } from "@/contexts/PatientContext";
import { useColors } from "@/hooks/useColors";

const LiveSignCamera =
  Platform.OS === "web"
    ? React.lazy(() => import("@/components/LiveSignCamera"))
    : null;

type CameraStatus = "initializing" | "loading_model" | "ready" | "no_hand" | "error";

const STATUS_CONFIG: Record<CameraStatus, { label: string; color: string }> = {
  initializing: { label: "Starting camera…", color: "#9CA3AF" },
  loading_model: { label: "Loading AI model (first load ~15s)…", color: "#F59E0B" },
  ready: { label: "AI ready — show your hand signs", color: "#2BBFA4" },
  no_hand: { label: "No hand detected — move closer", color: "#9CA3AF" },
  error: { label: "Error — check camera permissions", color: "#E24B4A" },
};

const DEBOUNCE_MS = 2000;
const MAX_SIGNS = 24;

const QUICK_SIGNS: ClassifiedSign[] = [
  { sign: "CHEST PAIN", meaning: "Chest pain / Heart", confidence: 0.95, category: "health", color: "#DC2626" },
  { sign: "BREATHING", meaning: "Breathing difficulty / Shortness of breath", confidence: 0.95, category: "health", color: "#2563EB" },
  { sign: "FEVER", meaning: "Fever / High temperature", confidence: 0.92, category: "health", color: "#EA580C" },
  { sign: "HEADACHE", meaning: "Headache / Head pain", confidence: 0.92, category: "health", color: "#9333EA" },
  { sign: "STOMACH PAIN", meaning: "Stomach / Abdomen pain", confidence: 0.92, category: "health", color: "#D97706" },
  { sign: "EMERGENCY", meaning: "Emergency need help", confidence: 0.98, category: "health", color: "#DC2626" },
];

export default function SignLanguageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setAnalysisInput, analysisInput } = usePatient();

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<CameraStatus>("initializing");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [currentSign, setCurrentSign] = useState<ClassifiedSign | null>(null);
  const [detectedSigns, setDetectedSigns] = useState<ClassifiedSign[]>([]);

  const cameraRef = useRef<import("@/components/LiveSignCamera").LiveSignCameraHandle | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confAnim = useRef(new Animated.Value(0)).current;
  const lastAddedRef = useRef<{ sign: string; at: number } | null>(null);

  // Pulse current sign badge
  useEffect(() => {
    if (currentSign) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
    return () => pulseAnim.stopAnimation();
  }, [currentSign, pulseAnim]);

  const handleStatusChange = useCallback(
    (s: CameraStatus, msg?: string) => {
      setStatus(s);
      if (msg) setStatusMessage(msg);
    },
    []
  );

  const handleSignDetected = useCallback((sign: ClassifiedSign) => {
    setCurrentSign(sign);
    Animated.timing(confAnim, {
      toValue: sign.confidence,
      duration: 300,
      useNativeDriver: false,
    }).start();

    const now = Date.now();
    const last = lastAddedRef.current;
    if (last && last.sign === sign.sign && now - last.at < DEBOUNCE_MS) return;
    lastAddedRef.current = { sign: sign.sign, at: now };

    setDetectedSigns((prev) => {
      if (prev.length >= MAX_SIGNS) return prev;
      return [...prev, { ...sign }];
    });
  }, [confAnim]);

  const handleSignCleared = useCallback(() => setCurrentSign(null), []);

  function sendToChat() {
    if (detectedSigns.length === 0) return;
    cameraRef.current?.stopCamera();
    setAnalysisInput({
      mode: "video_sign_language",
      activeModule: analysisInput?.activeModule ?? "general",
      signGestures: detectedSigns.map((s) => s.meaning || s.sign),
    });
    router.push("/report");
  }

  function analyzeQuickSign(sign: ClassifiedSign) {
    cameraRef.current?.stopCamera();
    setRunning(false);
    setDetectedSigns([sign]);
    setCurrentSign(sign);
    setAnalysisInput({
      mode: "video_sign_language",
      activeModule: analysisInput?.activeModule ?? "general",
      signGestures: [sign.meaning || sign.sign],
    });
    router.push("/report");
  }

  function removeSign(i: number) {
    setDetectedSigns((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearSigns() {
    setDetectedSigns([]);
    lastAddedRef.current = null;
  }

  const statusCfg = STATUS_CONFIG[status];

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={["#1A3A5C", "#0d2640"]} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Sign Language</Text>
        </LinearGradient>
        <View style={styles.notSupported}>
          <Text style={{ fontSize: 48 }}>🌐</Text>
          <Text style={[styles.notSupportedTitle, { color: colors.navy }]}>Open in Browser</Text>
          <Text style={[styles.notSupportedText, { color: colors.mutedForeground }]}>
            Live sign language detection requires a web browser with camera support. Please open this app in Chrome or Safari.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#0a1628" }]}>
      {/* Header */}
      <LinearGradient
        colors={["#0d1a2a", "#0a1628"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Sign Language</Text>
          <Text style={styles.headerSub}>ISL · ASL · Real-time AI Detection</Text>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: running ? "#E24B4A" : "#374151" }]}>
          <View style={[styles.liveDot, { backgroundColor: running ? "#fff" : "#9CA3AF" }]} />
          <Text style={styles.liveBadgeText}>{running ? "LIVE" : "OFF"}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Camera viewport */}
        <View style={styles.cameraBox}>
          {running ? (
            <React.Suspense
              fallback={
                <View style={styles.camPlaceholder}>
                  <Text style={styles.camPlaceholderText}>Loading camera…</Text>
                </View>
              }
            >
              {LiveSignCamera && (
                <LiveSignCamera
                  ref={cameraRef}
                  running={running}
                  onSignDetected={handleSignDetected}
                  onSignCleared={handleSignCleared}
                  onStatusChange={handleStatusChange}
                  overlayColor="#2BBFA4"
                />
              )}
            </React.Suspense>
          ) : (
            <View style={styles.camPlaceholder}>
              <Feather name="video-off" size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.camPlaceholderText}>Camera off</Text>
              <Text style={styles.camPlaceholderHint}>Tap Start to begin</Text>
            </View>
          )}

          {/* Detected sign badge */}
          {running && currentSign && (
            <Animated.View
              style={[styles.signBadgeWrap, { transform: [{ scale: pulseAnim }] }]}
            >
              <View style={[styles.signBadge, { backgroundColor: currentSign.color }]}>
                <Text style={styles.signBadgeText}>{currentSign.sign}</Text>
              </View>
            </Animated.View>
          )}

          {/* Status bar */}
          {running && (
            <View style={styles.statusBar}>
              <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
              <Text style={styles.statusText} numberOfLines={1}>
                {statusMessage || statusCfg.label}
              </Text>
            </View>
          )}
        </View>

        {/* Confidence bar */}
        {running && currentSign && (
          <View style={styles.confRow}>
            <Text style={styles.confLabel}>Confidence</Text>
            <View style={styles.confTrack}>
              <Animated.View
                style={[
                  styles.confFill,
                  {
                    backgroundColor: currentSign.color,
                    width: confAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.confValue, { color: currentSign.color }]}>
              {Math.round((currentSign.confidence ?? 0) * 100)}%
            </Text>
          </View>
        )}

        {/* Current sign meaning */}
        {running && currentSign && (
          <View style={[styles.meaningCard, { borderColor: currentSign.color }]}>
            <Text style={[styles.meaningSign, { color: currentSign.color }]}>
              {currentSign.sign}
            </Text>
            <Text style={styles.meaningText}>{currentSign.meaning}</Text>
          </View>
        )}

        {/* Detected signs list */}
        {detectedSigns.length > 0 && (
          <View style={styles.signsCard}>
            <View style={styles.signsHeader}>
              <Text style={styles.signsTitle}>
                Detected Signs ({detectedSigns.length})
              </Text>
              <Pressable onPress={clearSigns} style={styles.clearBtn}>
                <Feather name="trash-2" size={14} color="#E24B4A" />
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            </View>
            <View style={styles.signPills}>
              {detectedSigns.map((s, i) => (
                <Pressable
                  key={i}
                  style={[styles.signPill, { borderColor: s.color, backgroundColor: s.color + "15" }]}
                  onPress={() => removeSign(i)}
                >
                  <Text style={[styles.signPillText, { color: s.color }]}>{s.sign}</Text>
                  <Feather name="x" size={10} color={s.color} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.signsHint}>Tap a sign to remove it</Text>
          </View>
        )}

        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>Direct Camera Analysis</Text>
          <Text style={styles.quickHint}>
            Tap the action the patient is showing. This immediately creates the report, even if camera permission or AI detection is not working.
          </Text>
          <View style={styles.quickGrid}>
            {QUICK_SIGNS.map((s) => (
              <Pressable
                key={s.sign}
                style={[styles.quickPill, { borderColor: s.color, backgroundColor: s.color + "18" }]}
                onPress={() => analyzeQuickSign(s)}
              >
                <Text style={[styles.quickPillText, { color: s.color }]}>{s.sign}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Controls */}
        <View style={styles.ctrlRow}>
          {!running ? (
            <Pressable
              style={[styles.ctrlBtn, { backgroundColor: "#2BBFA4" }]}
              onPress={() => setRunning(true)}
            >
              <Feather name="video" size={20} color="#fff" />
              <Text style={styles.ctrlBtnText}>Start Detection</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.ctrlBtn, { backgroundColor: "#374151" }]}
              onPress={() => {
                setRunning(false);
                cameraRef.current?.stopCamera();
              }}
            >
              <Feather name="stop-circle" size={20} color="#fff" />
              <Text style={styles.ctrlBtnText}>Stop Camera</Text>
            </Pressable>
          )}
        </View>

        {detectedSigns.length > 0 && (
          <Pressable
            style={[styles.sendBtn, { backgroundColor: "#1A3A5C" }]}
            onPress={sendToChat}
          >
            <Text style={styles.sendBtnText}>
              Analyze {detectedSigns.length} camera action{detectedSigns.length !== 1 ? "s" : ""} →
            </Text>
          </Pressable>
        )}

        <View style={{ height: Math.max(insets.bottom, 20) }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  content: { padding: 16, gap: 14 },
  cameraBox: {
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0d1a2a",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  camPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  camPlaceholderText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.4)",
  },
  camPlaceholderHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.25)",
  },
  signBadgeWrap: { position: "absolute", top: 12, right: 12 },
  signBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  signBadgeText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  statusBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  statusText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#fff", flex: 1 },
  confRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  confLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#9CA3AF",
    width: 72,
  },
  confTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#1E293B", overflow: "hidden" },
  confFill: { height: "100%", borderRadius: 4 },
  confValue: { fontSize: 13, fontFamily: "Inter_700Bold", width: 44, textAlign: "right" },
  meaningCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    gap: 6,
  },
  meaningSign: { fontSize: 22, fontFamily: "Inter_700Bold" },
  meaningText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#D1D5DB",
    lineHeight: 20,
  },
  signsCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  signsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signsTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#F9FAFB" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  clearBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#E24B4A" },
  signPills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  signPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  signPillText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  signsHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  quickCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#F9FAFB" },
  quickHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", lineHeight: 18 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPill: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  quickPillText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  ctrlRow: {},
  ctrlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 14,
    gap: 10,
  },
  ctrlBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  sendBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sendBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  notSupported: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  notSupportedTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  notSupportedText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
