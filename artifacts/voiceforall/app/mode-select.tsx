import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePatient, type ActiveModule, type InputMode } from "@/contexts/PatientContext";
import { useColors } from "@/hooks/useColors";

const MODES: {
  id: InputMode;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  badge?: string;
  route: "/sign-language" | "/audio-record" | "/text-input";
}[] = [
  {
    id: "video_sign_language",
    icon: "video",
    title: "Sign Language",
    description: "Record yourself signing. Our AI reads ISL/ASL gestures and understands your problem — no speaking needed.",
    badge: "Best for deaf & mute users",
    route: "/sign-language",
  },
  {
    id: "audio",
    icon: "mic",
    title: "Speak Your Problem",
    description: "Record your voice describing your symptoms. AI will transcribe and analyze what you say.",
    route: "/audio-record",
  },
  {
    id: "text",
    icon: "edit-3",
    title: "Type Your Problem",
    description: "Prefer typing? Write your symptoms in your own words. Simple language is perfectly fine.",
    route: "/text-input",
  },
];

export default function ModeSelectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { patient, setAnalysisInput } = usePatient();
  const [activeModule, setActiveModule] = useState<ActiveModule>("general");

  const isFemale = patient?.gender === "female";

  function handleModeSelect(mode: typeof MODES[0]) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnalysisInput({
      mode: mode.id,
      activeModule,
    });
    router.push(mode.route);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#1A3A5C", "#0d2640"]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Hello, {patient?.name ?? "Guest"}</Text>
            {isFemale && (
              <View style={styles.womensBadge}>
                <Text style={styles.womensBadgeText}>Women's Mode Available</Text>
              </View>
            )}
          </View>
        </View>

        {isFemale && (
          <View style={styles.tabRow}>
            {(["general", "womens_health"] as ActiveModule[]).map((mod) => (
              <Pressable
                key={mod}
                style={[
                  styles.tab,
                  activeModule === mod && styles.tabActive,
                  activeModule === "womens_health" && mod === "womens_health" && styles.tabWomens,
                ]}
                onPress={() => {
                  setActiveModule(mod);
                  Haptics.selectionAsync();
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeModule === mod }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeModule === mod && styles.tabTextActive,
                    activeModule === "womens_health" && mod === "womens_health" && styles.tabTextWomens,
                  ]}
                >
                  {mod === "general" ? "General Health" : "Women's Health 🔒"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.navy }]}>
          How would you like to describe your problem?
        </Text>

        {MODES.map((mode) => (
          <Pressable
            key={mode.id}
            style={({ pressed }) => [
              styles.card,
              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={() => handleModeSelect(mode)}
            accessibilityRole="button"
            accessibilityLabel={mode.title}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: "#E6F9F6" }]}>
                <Feather name={mode.icon} size={26} color="#2BBFA4" />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: "#1A3A5C" }]}>{mode.title}</Text>
                {mode.badge && (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{mode.badge}</Text>
                  </View>
                )}
              </View>
              <Feather name="chevron-right" size={20} color="#2BBFA4" />
            </View>
            <Text style={[styles.cardDesc, { color: "#6B7280" }]}>{mode.description}</Text>
          </Pressable>
        ))}

        <View style={[styles.infoBox, { backgroundColor: "#F0F7FF" }]}>
          <Feather name="shield" size={16} color="#1A3A5C" />
          <Text style={[styles.infoText, { color: "#1A3A5C" }]}>
            Your health data is processed securely and never stored on our servers.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  womensBadge: {
    marginTop: 4,
    backgroundColor: "#F4C0D1",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  womensBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#C0194B",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabActive: {
    backgroundColor: "#2BBFA4",
  },
  tabWomens: {
    backgroundColor: "#F4C0D1",
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  tabTextActive: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  tabTextWomens: {
    color: "#C0194B",
  },
  content: {
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#1A3A5C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  pill: {
    backgroundColor: "#E6F9F6",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  pillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#2BBFA4",
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
