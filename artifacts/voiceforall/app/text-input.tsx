import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
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

const MAX_CHARS = 1000;
const MIN_CHARS = 20;

const PROCESSING_STEPS = [
  "Reading your description...",
  "Identifying symptoms and severity...",
  "Building your health summary...",
];

export default function TextInputScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setAnalysisInput, analysisInput } = usePatient();

  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const isReady = text.trim().length >= MIN_CHARS;

  async function handleSubmit() {
    if (!isReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    setProcessingStep(0);
    setCompletedSteps([]);

    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setProcessingStep(i);
      await new Promise((r) => setTimeout(r, 1200));
      setCompletedSteps((prev) => [...prev, i]);
    }

    setAnalysisInput({
      mode: "text",
      activeModule: analysisInput?.activeModule ?? "general",
      textInput: text.trim(),
    });

    router.push("/report");
  }

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
          <Text style={styles.headerTitle}>Describe Your Problem</Text>
          <View style={styles.modeBadge}>
            <Feather name="edit-3" size={12} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isProcessing ? (
            <>
              <View style={styles.card}>
                <Text style={[styles.instruction, { color: colors.navy }]}>
                  Write freely. Use simple words.
                </Text>
                <Text style={[styles.instructionSub, { color: colors.mutedForeground }]}>
                  You can describe in English, Hindi, or mix both — our AI understands.
                </Text>

                <TextInput
                  style={[
                    styles.textArea,
                    {
                      borderColor: text.length > 0 ? colors.teal : colors.border,
                      color: colors.foreground,
                      backgroundColor: colors.background,
                    },
                  ]}
                  multiline
                  placeholder="Example: I have been having a severe headache for 3 days. I also feel dizzy when I stand up. My vision gets blurry sometimes..."
                  placeholderTextColor={colors.mutedForeground}
                  value={text}
                  onChangeText={(v) => {
                    if (v.length <= MAX_CHARS) setText(v);
                  }}
                  accessibilityLabel="Describe your symptoms"
                  textAlignVertical="top"
                />

                <View style={styles.counterRow}>
                  <Text
                    style={[
                      styles.counter,
                      {
                        color:
                          text.length < MIN_CHARS
                            ? colors.red
                            : text.length > MAX_CHARS * 0.9
                            ? colors.warning
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {text.length} / {MAX_CHARS} characters
                  </Text>
                  {text.length > 0 && text.length < MIN_CHARS && (
                    <Text style={[styles.minHint, { color: colors.mutedForeground }]}>
                      ({MIN_CHARS - text.length} more needed)
                    </Text>
                  )}
                </View>
              </View>

              <View style={[styles.tipsBox, { backgroundColor: "#F0F7FF" }]}>
                <Text style={[styles.tipsTitle, { color: colors.navy }]}>Tips for a better analysis:</Text>
                {[
                  "Describe WHERE the pain or discomfort is",
                  "Mention HOW LONG you have had the symptoms",
                  "Rate the severity (mild / moderate / severe)",
                  "List any other symptoms you notice",
                ].map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <View style={[styles.tipDot, { backgroundColor: colors.teal }]} />
                    <Text style={[styles.tipText, { color: colors.navy }]}>{tip}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={[
                  styles.submitBtn,
                  { backgroundColor: isReady ? colors.teal : colors.border },
                ]}
                onPress={handleSubmit}
                disabled={!isReady}
                accessibilityLabel="Submit for analysis"
              >
                <Feather name="send" size={20} color={isReady ? "#fff" : colors.mutedForeground} />
                <Text
                  style={[
                    styles.submitBtnText,
                    { color: isReady ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  Submit for Analysis
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.processingCard}>
              <View style={styles.processingIcon}>
                <Feather name="cpu" size={32} color="#2BBFA4" />
              </View>
              <Text style={[styles.processingTitle, { color: colors.navy }]}>
                Analyzing your description...
              </Text>
              <View style={styles.steps}>
                {PROCESSING_STEPS.map((step, i) => (
                  <View key={i} style={styles.step}>
                    <View
                      style={[
                        styles.stepIndicator,
                        {
                          backgroundColor:
                            completedSteps.includes(i)
                              ? "#2BBFA4"
                              : processingStep === i
                              ? "#F59E0B"
                              : colors.border,
                        },
                      ]}
                    >
                      {completedSteps.includes(i) ? (
                        <Feather name="check" size={14} color="#fff" />
                      ) : processingStep === i ? (
                        <Text style={{ color: "#fff", fontSize: 10 }}>⏳</Text>
                      ) : (
                        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>○</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepText,
                        {
                          color: completedSteps.includes(i)
                            ? "#2BBFA4"
                            : processingStep === i
                            ? "#F59E0B"
                            : colors.mutedForeground,
                          fontFamily: processingStep === i ? "Inter_600SemiBold" : "Inter_400Regular",
                        },
                      ]}
                    >
                      Step {i + 1}: {step}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  modeBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#2BBFA4",
    alignItems: "center", justifyContent: "center",
  },
  content: { padding: 20, gap: 16 },
  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 20, gap: 12,
    shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  instruction: { fontSize: 18, fontFamily: "Inter_700Bold" },
  instructionSub: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  textArea: {
    borderWidth: 1.5, borderRadius: 12, padding: 16,
    minHeight: 200, fontSize: 15, fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  counterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  counter: { fontSize: 12, fontFamily: "Inter_500Medium" },
  minHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tipsBox: { borderRadius: 14, padding: 16, gap: 10 },
  tipsTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 56, borderRadius: 16, gap: 10,
    shadowColor: "#2BBFA4", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  processingCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 28, gap: 20,
    alignItems: "center",
    shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    marginTop: 40,
  },
  processingIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#E6F9F6",
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
});
