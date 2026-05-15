import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
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

import { usePatient, type Gender } from "@/contexts/PatientContext";

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: "male", label: "Male", icon: "👨" },
  { value: "female", label: "Female", icon: "👩" },
  { value: "unspecified", label: "Prefer not to say", icon: "🧑" },
];


export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { setPatient } = usePatient();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [errors, setErrors] = useState<{ name?: string; age?: string; gender?: string }>({});
  const [step, setStep] = useState<"hero" | "form">("hero");

  // Animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // Logo entrance
    Animated.spring(logoAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();

    // Pulse the orb
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Stagger dot animations
    dotAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  function showForm() {
    setStep("form");
    Animated.spring(formAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }

  function validate() {
    const newErrors: typeof errors = {};
    if (!name.trim() || name.trim().length < 2) newErrors.name = "Please enter your full name";
    const ageNum = parseInt(age);
    if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 120) newErrors.age = "Enter a valid age (1–120)";
    if (!gender) newErrors.gender = "Please select your gender";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPatient({ name: name.trim(), age, gender: gender! });
    router.push("/mode-select");
  }

  // ── Hero screen ──────────────────────────────────────────────────────────
  if (step === "hero") {
    return (
      <LinearGradient colors={["#0a1628", "#0d2640", "#0f3460"]} style={styles.heroContainer}>
        <View style={[styles.heroContent, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>

          {/* Animated logo orb */}
          <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoAnim }, { scale: pulseAnim }], opacity: logoAnim }]}>
            <View style={styles.orb}>
              <LinearGradient colors={["#2BBFA4", "#1A8F7E"]} style={styles.orbGradient}>
                <Text style={styles.orbEmoji}>🤝</Text>
              </LinearGradient>
            </View>
            {/* Orbit rings */}
            <View style={[styles.ring, styles.ring1]} />
            <View style={[styles.ring, styles.ring2]} />
          </Animated.View>

          {/* Badge */}
          <View style={styles.aiBadge}>
            {dotAnims.map((anim, i) => (
              <Animated.View key={i} style={[styles.aiBadgeDot, { opacity: anim }]} />
            ))}
            <Text style={styles.aiBadgeText}>AI-Powered Medical Platform</Text>
          </View>

          {/* Title */}
          <Animated.View style={[styles.heroTitleWrap, { opacity: logoAnim, transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
            <Text style={styles.heroTitle}>VoiceForAll</Text>
            <Text style={styles.heroSubtitle}>
              Healthcare for deaf, mute,{"\n"}and women patients
            </Text>
          </Animated.View>

          {/* Features */}
          <View style={styles.featuresGrid}>
            {[
              { icon: "🤟", title: "Sign Language", sub: "ISL & ASL" },
              { icon: "🎤", title: "Voice AI", sub: "Transcription" },
              { icon: "💬", title: "Text Input", sub: "Any language" },
              { icon: "🏥", title: "AI Report", sub: "WHO guidelines" },
            ].map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.heroCta, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            onPress={showForm}
          >
            <LinearGradient colors={["#2BBFA4", "#1a9b87"]} style={styles.heroCtaGradient}>
              <Text style={styles.heroCtaText}>Start Free Consultation</Text>
              <Feather name="arrow-right" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>

          <Text style={styles.heroDisclaimer}>
            🔒 Private & secure · No data stored · Free of charge
          </Text>
        </View>
      </LinearGradient>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────
  return (
    <LinearGradient colors={["#0a1628", "#0d2640", "#0f3460"]} style={styles.heroContainer}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.formScroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.formHeader}>
            <Pressable style={styles.formBackBtn} onPress={() => setStep("hero")}>
              <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <View style={styles.formLogoSmall}>
              <Text style={{ fontSize: 20 }}>🤝</Text>
            </View>
            <Text style={styles.formHeaderTitle}>VoiceForAll</Text>
          </View>

          {/* Form card */}
          <Animated.View style={[
            styles.formCard,
            {
              opacity: formAnim,
              transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            },
          ]}>
            <View style={styles.formCardHeader}>
              <Text style={styles.formCardTitle}>Patient Registration</Text>
              <Text style={styles.formCardSub}>We need a few details to personalize your health report</Text>
            </View>

            {/* Name field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                <Text style={styles.fieldRequired}>* </Text>Full Name
              </Text>
              <View style={[styles.inputWrap, errors.name ? styles.inputError : name ? styles.inputFilled : null]}>
                <Feather name="user" size={18} color={errors.name ? "#E24B4A" : name ? "#2BBFA4" : "#9CA3AF"} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Priya Sharma"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  accessibilityLabel="Full name"
                />
                {name.trim().length >= 2 && (
                  <Feather name="check-circle" size={16} color="#2BBFA4" />
                )}
              </View>
              {errors.name && <Text style={styles.errorHint}>{errors.name}</Text>}
            </View>

            {/* Age field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                <Text style={styles.fieldRequired}>* </Text>Age
              </Text>
              <View style={[styles.inputWrap, errors.age ? styles.inputError : age ? styles.inputFilled : null]}>
                <Feather name="calendar" size={18} color={errors.age ? "#E24B4A" : age ? "#2BBFA4" : "#9CA3AF"} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 28"
                  placeholderTextColor="#9CA3AF"
                  value={age}
                  onChangeText={(t) => { setAge(t.replace(/\D/g, "")); setErrors((e) => ({ ...e, age: undefined })); }}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel="Age"
                />
                {age && parseInt(age) >= 1 && parseInt(age) <= 120 && (
                  <Feather name="check-circle" size={16} color="#2BBFA4" />
                )}
              </View>
              {errors.age && <Text style={styles.errorHint}>{errors.age}</Text>}
              <Text style={styles.fieldHint}>Used to apply age-appropriate medical guidelines</Text>
            </View>

            {/* Gender */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                <Text style={styles.fieldRequired}>* </Text>Gender
              </Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.genderBtn,
                      gender === opt.value && styles.genderBtnActive,
                      errors.gender && !gender && styles.genderBtnError,
                    ]}
                    onPress={() => { setGender(opt.value); setErrors((e) => ({ ...e, gender: undefined })); Haptics.selectionAsync(); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: gender === opt.value }}
                  >
                    <Text style={styles.genderIcon}>{opt.icon}</Text>
                    <Text style={[styles.genderLabel, gender === opt.value && styles.genderLabelActive]}>
                      {opt.label}
                    </Text>
                    {gender === opt.value && (
                      <View style={styles.genderCheck}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
              {errors.gender && <Text style={styles.errorHint}>{errors.gender}</Text>}
              {gender === "female" && (
                <View style={styles.womensTip}>
                  <Text style={styles.womensTipIcon}>💜</Text>
                  <Text style={styles.womensTipText}>
                    Women's Health module will be available — includes reproductive & hormonal health guidance.
                  </Text>
                </View>
              )}
            </View>

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
              onPress={handleSubmit}
              accessibilityLabel="Start health consultation"
            >
              <LinearGradient colors={["#2BBFA4", "#1a9b87"]} style={styles.submitBtnGradient}>
                <Feather name="activity" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Start Health Consultation</Text>
                <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            </Pressable>

            {/* Privacy notice */}
            <View style={styles.privacyRow}>
              <Feather name="shield" size={13} color="#6B7280" />
              <Text style={styles.privacyText}>
                Your data is processed on secure servers and never stored or shared.
              </Text>
            </View>
          </Animated.View>

          {/* Powered by notice */}
          <View style={styles.poweredBy}>
            <Text style={styles.poweredByText}>🏥 Trained on WHO · NICE · AIIMS · NHS guidelines</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroContainer: { flex: 1 },
  heroContent: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 20,
  },

  // Logo / orb
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 120,
    height: 120,
  },
  orb: {
    width: 90,
    height: 90,
    borderRadius: 45,
    shadowColor: "#2BBFA4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  orbGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  orbEmoji: { fontSize: 38 },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderColor: "rgba(43,191,164,0.2)",
    borderWidth: 1,
  },
  ring1: { width: 112, height: 112 },
  ring2: { width: 132, height: 132, borderColor: "rgba(43,191,164,0.1)" },

  // AI badge
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(43,191,164,0.15)",
    borderWidth: 1,
    borderColor: "rgba(43,191,164,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  aiBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#2BBFA4" },
  aiBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#2BBFA4", letterSpacing: 0.5 },

  // Title
  heroTitleWrap: { alignItems: "center", gap: 6 },
  heroTitle: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 22,
  },

  // Features grid
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  featureCard: {
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  featureIcon: { fontSize: 22 },
  featureTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 2 },
  featureSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },

  // CTA
  heroCta: { width: "100%", borderRadius: 18, overflow: "hidden" },
  heroCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 58,
    gap: 10,
  },
  heroCtaText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  heroDisclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
  },

  // Form
  formScroll: { paddingHorizontal: 20, gap: 20 },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  formBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  formLogoSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(43,191,164,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  formHeaderTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 12,
  },
  formCardHeader: { gap: 6 },
  formCardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#0d2640",
  },
  formCardSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    lineHeight: 18,
  },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
    marginBottom: 2,
  },
  fieldRequired: { color: "#E24B4A" },
  fieldHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    marginTop: 2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#F9FAFB",
  },
  inputFilled: { borderColor: "#2BBFA4", backgroundColor: "#F0FDF9" },
  inputError: { borderColor: "#E24B4A", backgroundColor: "#FFF5F5" },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#111827",
    padding: 0,
  },
  errorHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#E24B4A",
  },
  genderRow: { flexDirection: "row", gap: 8 },
  genderBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F9FAFB",
    position: "relative",
  },
  genderBtnActive: {
    borderColor: "#2BBFA4",
    backgroundColor: "#F0FDF9",
  },
  genderBtnError: { borderColor: "#E24B4A" },
  genderIcon: { fontSize: 22 },
  genderLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#6B7280", textAlign: "center" },
  genderLabelActive: { color: "#1A3A5C", fontFamily: "Inter_700Bold" },
  genderCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2BBFA4",
    alignItems: "center",
    justifyContent: "center",
  },
  womensTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF0F8",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F4C0D1",
    marginTop: 4,
  },
  womensTipIcon: { fontSize: 14 },
  womensTipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#7C1A4A",
    lineHeight: 16,
  },
  submitBtn: { borderRadius: 16, overflow: "hidden" },
  submitBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 58,
    gap: 10,
  },
  submitBtnText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  privacyText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textAlign: "center",
    flex: 1,
  },
  poweredBy: {
    alignItems: "center",
    paddingVertical: 8,
  },
  poweredByText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
  },
});
