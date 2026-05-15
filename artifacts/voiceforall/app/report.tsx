import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePatient } from "@/contexts/PatientContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:5000";

interface HealthReport {
  report_id: string;
  generated_at: string;
  patient: { name: string; age: number; gender: string; input_mode: string };
  sign_interpretation?: { interpreted_meaning: string; confidence_level: string; confidence_score: number } | null;
  patient_problem_summary: {
    plain_language: string;
    patient_quote_style: string;
    symptoms_detected: { symptom: string; medical_term: string; body_part?: string; duration?: string; severity_described?: string }[];
    red_flags_detected: string[];
  };
  clinical_analysis: {
    medical_summary: string;
    possible_conditions: string[];
    disclaimer: string;
  };
  severity_assessment: {
    level: "EMERGENCY" | "SEVERE" | "MODERATE" | "MILD";
    level_color: string;
    reason: string;
    age_adjustment_applied: boolean;
    age_adjustment_note?: string | null;
    urgency_timeframe: string;
    recommended_specialists: string[];
    confirmation_question: string;
    route_to_womens_health: boolean;
  };
  action_plan: {
    type: "hospital_referral" | "home_care";
    if_hospital_referral?: { urgency_message: string; what_to_tell_doctor: string; what_to_bring: string[]; do_not_delay_if: string[] } | null;
    if_home_care?: { precautions: string[]; warning_signs_watch_for: string[]; when_to_seek_help: string } | null;
  };
  free_resources: {
    national_helplines: { name: string; number?: string | null; contact?: string | null; url?: string | null; details: string; cost: string }[];
  };
  womens_health_report?: {
    included: boolean;
    content?: {
      clinical_summary: string;
      recommended_specialists: string[];
      womens_free_resources: { name: string; contact: string; details: string; cost: string }[];
      privacy_note: string;
    } | null;
  } | null;
}

const SEVERITY_CONFIG = {
  EMERGENCY: { bg: "#DC2626", text: "#fff", label: "EMERGENCY" },
  SEVERE: { bg: "#EA580C", text: "#fff", label: "SEVERE" },
  MODERATE: { bg: "#D97706", text: "#fff", label: "MODERATE" },
  MILD: { bg: "#16A34A", text: "#fff", label: "MILD" },
};

function SectionCard({ title, children, accentColor = "#2BBFA4" }: { title: string; children: React.ReactNode; accentColor?: string }) {
  return (
    <View style={[styles.sectionCard, { borderLeftColor: accentColor }]}>
      <Text style={[styles.sectionTitle, { color: "#1A3A5C" }]}>{title}</Text>
      {children}
    </View>
  );
}

function SymptomPill({ symptom, medical }: { symptom: string; medical: string }) {
  return (
    <View style={styles.symptomPill}>
      <Text style={styles.symptomPillText}>{medical || symptom}</Text>
    </View>
  );
}

function ResourceItem({ name, contact, details, cost }: { name: string; contact?: string | null; details: string; cost: string }) {
  return (
    <View style={styles.resourceItem}>
      <View style={styles.resourceIcon}>
        <Feather name="phone" size={14} color="#2BBFA4" />
      </View>
      <View style={styles.resourceText}>
        <Text style={styles.resourceName}>{name}</Text>
        {contact && <Text style={styles.resourceContact}>{contact}</Text>}
        <Text style={styles.resourceDetails}>{details}</Text>
        <View style={styles.resourceCostBadge}>
          <Text style={styles.resourceCost}>{cost}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { patient, analysisInput, setReport, reset } = usePatient();

  const [report, setLocalReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAnswer, setConfirmAnswer] = useState<"yes" | "no" | null>(null);
  const [hospitalMapUrl, setHospitalMapUrl] = useState("https://www.google.com/maps?q=hospitals+near+me&output=embed");
  const [hospitalSearchUrl, setHospitalSearchUrl] = useState("https://www.google.com/maps/search/?api=1&query=hospitals+near+me");

  useEffect(() => {
    fetchReport();
  }, []);

  async function fetchReport() {
    if (!patient || !analysisInput) {
      setError("Missing patient information. Please start over.");
      setLoading(false);
      return;
    }

    try {
      const body = {
        patient_name: patient.name,
        patient_age: parseInt(patient.age),
        patient_gender: patient.gender,
        input_mode: analysisInput.mode,
        text_input: analysisInput.textInput ?? null,
        audio_transcript: analysisInput.audioTranscript ?? null,
        sign_gestures: analysisInput.signGestures ?? null,
        active_module: analysisInput.activeModule,
      };

      const res = await fetch(`${API_BASE}/api/voiceforall/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = (await res.json()) as HealthReport;
      setLocalReport(data);
      setReport(data as unknown as Record<string, unknown>);
    } catch (err) {
      setError("We had trouble analyzing your input. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!report) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const summary = `VoiceForAll Health Report\n${report.report_id}\n\nPatient: ${report.patient.name}, Age ${report.patient.age}\n\nSeverity: ${report.severity_assessment.level}\n${report.severity_assessment.reason}\n\nUrgency: ${report.severity_assessment.urgency_timeframe}\n\n⚠️ IF YOUR CONDITION WORSENS AT ANY TIME, PLEASE GO TO THE NEAREST HOSPITAL. EMERGENCY: DIAL 112`;
    try {
      await Share.share({ message: summary, title: "VoiceForAll Health Report" });
    } catch {
      Alert.alert("Share", "Could not open share sheet. Please screenshot this report.");
    }
  }

  function handleNewConsultation() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reset();
    router.replace("/");
  }

  function findNearbyHospitals() {
    if (Platform.OS !== "web" || typeof navigator === "undefined" || !navigator.geolocation) {
      Linking.openURL(hospitalSearchUrl).catch(() => {
        Alert.alert("Maps", "Could not open maps on this device.");
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setHospitalMapUrl(`https://www.google.com/maps?q=hospitals+near+${latitude},${longitude}&z=14&output=embed`);
        setHospitalSearchUrl(`https://www.google.com/maps/search/hospitals/@${latitude},${longitude},14z`);
      },
      () => {
        Alert.alert("Location", "Location permission was not allowed. You can still open Google Maps and search manually.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function openHospitalMap() {
    Linking.openURL(hospitalSearchUrl).catch(() => {
      Alert.alert("Maps", "Could not open Google Maps.");
    });
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={["#1A3A5C", "#0d2640"]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <Text style={styles.headerTitle}>VoiceForAll Health Report</Text>
        </LinearGradient>
        <View style={styles.loadingContent}>
          <View style={styles.loadingIconBox}>
            <ActivityIndicator size="large" color="#2BBFA4" />
          </View>
          <Text style={[styles.loadingTitle, { color: colors.navy }]}>
            Generating your health report...
          </Text>
          <Text style={[styles.loadingSubtitle, { color: colors.mutedForeground }]}>
            Our AI is analyzing your symptoms and preparing a comprehensive assessment.
          </Text>
          {[
            "Reviewing your symptoms...",
            "Applying medical guidelines...",
            "Identifying free healthcare resources...",
          ].map((step, i) => (
            <View key={i} style={styles.loadingStep}>
              <View style={[styles.loadingStepDot, { backgroundColor: "#2BBFA4" }]} />
              <Text style={[styles.loadingStepText, { color: colors.mutedForeground }]}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={["#1A3A5C", "#0d2640"]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <Text style={styles.headerTitle}>VoiceForAll Health Report</Text>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Feather name="alert-triangle" size={52} color="#E24B4A" />
          <Text style={[styles.errorTitle, { color: colors.navy }]}>Analysis Failed</Text>
          <Text style={[styles.errorDesc, { color: colors.mutedForeground }]}>
            {error ?? "Something went wrong. Please try again."}
          </Text>
          <View style={styles.errorBtns}>
            <Pressable style={[styles.errorBtn, { backgroundColor: "#2BBFA4" }]} onPress={fetchReport}>
              <Text style={[styles.errorBtnText, { color: "#fff" }]}>Try Again</Text>
            </Pressable>
            <Pressable style={[styles.errorBtn, { backgroundColor: colors.secondary }]} onPress={() => router.back()}>
              <Text style={[styles.errorBtnText, { color: colors.navy }]}>Switch Mode</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const severity = report.severity_assessment;
  const severityConfig = SEVERITY_CONFIG[severity.level] ?? SEVERITY_CONFIG.MODERATE;
  const isSerious = severity.level === "EMERGENCY" || severity.level === "SEVERE";

  const generatedDate = new Date(report.generated_at);
  const formattedDate = generatedDate.toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

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
            <Text style={styles.headerTitle}>Health Report</Text>
            <Text style={styles.headerSub}>{formattedDate}</Text>
          </View>
          <Pressable style={styles.shareBtn} onPress={handleShare} accessibilityLabel="Share report">
            <Feather name="share-2" size={18} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.reportId}>{report.report_id}</Text>
      </LinearGradient>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard title="Patient Details">
          <View style={[styles.patientBox, { backgroundColor: colors.muted }]}>
            {[
              ["Name", report.patient.name],
              ["Age", `${report.patient.age} years`],
              ["Gender", report.patient.gender.charAt(0).toUpperCase() + report.patient.gender.slice(1)],
              ["Input Method", report.patient.input_mode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())],
            ].map(([label, value]) => (
              <View key={label} style={styles.patientRow}>
                <Text style={[styles.patientLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <Text style={[styles.patientValue, { color: colors.navy }]}>{value}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="What You Communicated">
          <Text style={[styles.bodyText, { color: colors.foreground }]}>
            {report.patient_problem_summary.patient_quote_style}
          </Text>
          {report.sign_interpretation && (
            <View style={[styles.confidenceBadge, {
              backgroundColor:
                report.sign_interpretation.confidence_level === "high" ? "#E6F9F6" :
                report.sign_interpretation.confidence_level === "medium" ? "#FEF3C7" : "#FEE2E2",
            }]}>
              <Feather
                name={report.sign_interpretation.confidence_level === "high" ? "check-circle" : "alert-triangle"}
                size={14}
                color={
                  report.sign_interpretation.confidence_level === "high" ? "#2BBFA4" :
                  report.sign_interpretation.confidence_level === "medium" ? "#D97706" : "#E24B4A"
                }
              />
              <Text style={[styles.confidenceText, {
                color:
                  report.sign_interpretation.confidence_level === "high" ? "#2BBFA4" :
                  report.sign_interpretation.confidence_level === "medium" ? "#D97706" : "#E24B4A",
              }]}>
                {report.sign_interpretation.confidence_level.charAt(0).toUpperCase() + report.sign_interpretation.confidence_level.slice(1)} Confidence
                {" "}({Math.round(report.sign_interpretation.confidence_score * 100)}%)
              </Text>
            </View>
          )}
        </SectionCard>

        <SectionCard title="Clinical Assessment">
          <Text style={[styles.bodyText, { color: colors.foreground }]}>
            {report.clinical_analysis.medical_summary}
          </Text>
          {report.patient_problem_summary.symptoms_detected.length > 0 && (
            <View style={styles.pillsContainer}>
              {report.patient_problem_summary.symptoms_detected.map((s, i) => (
                <SymptomPill key={i} symptom={s.symptom} medical={s.medical_term} />
              ))}
            </View>
          )}
          {report.clinical_analysis.possible_conditions.length > 0 && (
            <View style={[styles.conditionsBox, { backgroundColor: "#F0F7FF" }]}>
              <Text style={[styles.conditionsTitle, { color: colors.navy }]}>Possible Considerations:</Text>
              {report.clinical_analysis.possible_conditions.map((c, i) => (
                <Text key={i} style={[styles.conditionItem, { color: colors.foreground }]}>• {c}</Text>
              ))}
              <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
                {report.clinical_analysis.disclaimer}
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={[styles.severityBanner, { backgroundColor: severityConfig.bg }]}>
          <View style={styles.severityHeader}>
            <Feather
              name={severity.level === "EMERGENCY" ? "alert-octagon" : severity.level === "SEVERE" ? "alert-triangle" : "info"}
              size={24}
              color={severityConfig.text}
            />
            <Text style={[styles.severityLevel, { color: severityConfig.text }]}>
              {severityConfig.label}
            </Text>
          </View>
          <Text style={[styles.severityReason, { color: severityConfig.text }]}>
            {severity.reason}
          </Text>
          {severity.age_adjustment_applied && severity.age_adjustment_note && (
            <View style={styles.ageAdjustBox}>
              <Text style={[styles.ageAdjustText, { color: severityConfig.text }]}>
                {severity.age_adjustment_note}
              </Text>
            </View>
          )}
          <View style={[styles.urgencyBox, { backgroundColor: "rgba(0,0,0,0.15)" }]}>
            <Feather name="clock" size={14} color={severityConfig.text} />
            <Text style={[styles.urgencyText, { color: severityConfig.text }]}>
              {severity.urgency_timeframe}
            </Text>
          </View>
        </View>

        {isSerious && severity.recommended_specialists.length > 0 && (
          <SectionCard title="Recommended Specialists" accentColor="#E24B4A">
            <View style={styles.specialistsList}>
              {severity.recommended_specialists.map((s, i) => (
                <View key={i} style={styles.specialistItem}>
                  <View style={[styles.specialistIcon, { backgroundColor: "#FEE2E2" }]}>
                    <Feather name="user" size={16} color="#E24B4A" />
                  </View>
                  <Text style={[styles.specialistName, { color: colors.navy }]}>{s}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {isSerious && report.action_plan.if_hospital_referral && (
          <SectionCard title="What To Do" accentColor="#E24B4A">
            <View style={[styles.urgencyMsg, { backgroundColor: "#FEE2E2" }]}>
              <Text style={[styles.urgencyMsgText, { color: "#DC2626" }]}>
                {report.action_plan.if_hospital_referral.urgency_message}
              </Text>
            </View>
            <Text style={[styles.subHeading, { color: colors.navy }]}>Tell the doctor:</Text>
            <Text style={[styles.bodyText, { color: colors.foreground }]}>
              {report.action_plan.if_hospital_referral.what_to_tell_doctor}
            </Text>
            <Text style={[styles.subHeading, { color: colors.navy }]}>What to bring:</Text>
            {report.action_plan.if_hospital_referral.what_to_bring.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <Feather name="check" size={14} color="#2BBFA4" />
                <Text style={[styles.listItemText, { color: colors.foreground }]}>{item}</Text>
              </View>
            ))}
          </SectionCard>
        )}

        {isSerious && (
          <SectionCard title="Nearby Available Hospitals" accentColor="#DC2626">
            <Text style={[styles.bodyText, { color: colors.foreground }]}>
              For critical conditions, find the nearest available hospital and show this report at reception.
            </Text>
            <View style={styles.mapActions}>
              <Pressable style={[styles.mapBtn, { backgroundColor: "#DC2626" }]} onPress={findNearbyHospitals}>
                <Feather name="map-pin" size={16} color="#fff" />
                <Text style={styles.mapBtnText}>Use My Location</Text>
              </Pressable>
              <Pressable style={[styles.mapBtn, { backgroundColor: "#1A3A5C" }]} onPress={openHospitalMap}>
                <Feather name="external-link" size={16} color="#fff" />
                <Text style={styles.mapBtnText}>Open Maps</Text>
              </Pressable>
            </View>
            {Platform.OS === "web" && (
              <View style={styles.mapFrameWrap}>
                {React.createElement("iframe", {
                  title: "Nearby hospitals map",
                  src: hospitalMapUrl,
                  style: styles.mapFrame,
                  loading: "lazy",
                })}
              </View>
            )}
          </SectionCard>
        )}

        {!isSerious && report.action_plan.if_home_care && (
          <SectionCard title="Home Care Precautions" accentColor="#16A34A">
            {report.action_plan.if_home_care.precautions.map((p, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listNumber}>{i + 1}.</Text>
                <Text style={[styles.listItemText, { color: colors.foreground }]}>{p}</Text>
              </View>
            ))}
            <View style={[styles.warningBox, { backgroundColor: "#FEF3C7" }]}>
              <Text style={[styles.warningTitle, { color: "#92400E" }]}>Monitor these warning signs:</Text>
              {report.action_plan.if_home_care.warning_signs_watch_for.map((w, i) => (
                <View key={i} style={styles.listItem}>
                  <Feather name="alert-triangle" size={13} color="#D97706" />
                  <Text style={[styles.listItemText, { color: "#92400E" }]}>{w}</Text>
                </View>
              ))}
              <Text style={[styles.warningSeek, { color: "#92400E" }]}>
                {report.action_plan.if_home_care.when_to_seek_help}
              </Text>
            </View>
          </SectionCard>
        )}

        {severity.confirmation_question && (
          <SectionCard title="Quick Confirmation">
            <View style={[styles.confirmBox, { backgroundColor: "#F0F7FF" }]}>
              <Text style={[styles.confirmQuestion, { color: colors.navy }]}>
                {severity.confirmation_question}
              </Text>
              <View style={styles.confirmBtns}>
                <Pressable
                  style={[
                    styles.confirmBtn,
                    {
                      backgroundColor: confirmAnswer === "yes" ? "#E24B4A" : colors.secondary,
                      borderColor: confirmAnswer === "yes" ? "#E24B4A" : colors.border,
                    },
                  ]}
                  onPress={() => { setConfirmAnswer("yes"); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.confirmBtnText, { color: confirmAnswer === "yes" ? "#fff" : colors.navy }]}>
                    Yes
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.confirmBtn,
                    {
                      backgroundColor: confirmAnswer === "no" ? "#2BBFA4" : colors.secondary,
                      borderColor: confirmAnswer === "no" ? "#2BBFA4" : colors.border,
                    },
                  ]}
                  onPress={() => { setConfirmAnswer("no"); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.confirmBtnText, { color: confirmAnswer === "no" ? "#fff" : colors.navy }]}>
                    No
                  </Text>
                </Pressable>
              </View>
              {confirmAnswer === "yes" && (
                <Text style={[styles.confirmFollowUp, { color: "#DC2626" }]}>
                  This is important. Please seek medical attention as soon as possible and show this report to your doctor.
                </Text>
              )}
              {confirmAnswer === "no" && (
                <Text style={[styles.confirmFollowUp, { color: "#2BBFA4" }]}>
                  Good to know. Continue with the recommendations above and monitor your symptoms closely.
                </Text>
              )}
            </View>
          </SectionCard>
        )}

        <SectionCard title="Free Healthcare Resources">
          {report.free_resources.national_helplines.map((resource, i) => (
            <ResourceItem
              key={i}
              name={resource.name}
              contact={resource.number ?? resource.contact ?? resource.url}
              details={resource.details}
              cost={resource.cost}
            />
          ))}
        </SectionCard>

        {report.womens_health_report?.included && report.womens_health_report?.content && (
          <View style={[styles.womensSection, { backgroundColor: "#FFF0F5" }]}>
            <View style={styles.womensSectionHeader}>
              <Feather name="lock" size={16} color="#C0194B" />
              <Text style={[styles.womensSectionTitle, { color: "#C0194B" }]}>
                Women's Health Assessment
              </Text>
            </View>
            <View style={styles.womensConfidential}>
              <Text style={styles.womensConfidentialText}>CONFIDENTIAL</Text>
            </View>
            <Text style={[styles.bodyText, { color: "#7C1A4A" }]}>
              {report.womens_health_report.content.clinical_summary}
            </Text>
            {report.womens_health_report.content.recommended_specialists.length > 0 && (
              <View>
                <Text style={[styles.subHeading, { color: "#C0194B" }]}>Recommended Specialists:</Text>
                {report.womens_health_report.content.recommended_specialists.map((s, i) => (
                  <View key={i} style={styles.listItem}>
                    <Feather name="user" size={13} color="#C0194B" />
                    <Text style={[styles.listItemText, { color: "#7C1A4A" }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={[styles.privacyNote, { color: "#9F4A6E" }]}>
              {report.womens_health_report.content.privacy_note}
            </Text>
            {report.womens_health_report.content.womens_free_resources.map((r, i) => (
              <ResourceItem
                key={i}
                name={r.name}
                contact={r.contact}
                details={r.details}
                cost={r.cost}
              />
            ))}
          </View>
        )}

        <View style={[styles.emergencyFooter, { backgroundColor: "#DC2626" }]}>
          <Feather name="alert-octagon" size={22} color="#fff" />
          <Text style={styles.emergencyText}>
            IF YOUR CONDITION WORSENS AT ANY TIME,{"\n"}
            PLEASE GO TO THE NEAREST HOSPITAL IMMEDIATELY.{"\n"}
            EMERGENCY: DIAL 112
          </Text>
        </View>

        <View style={styles.actionBtns}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "#2BBFA4" }]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff" }]}>Share Report</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "#1A3A5C" }]}
            onPress={handleNewConsultation}
          >
            <Feather name="refresh-cw" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff" }]}>New Consultation</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  shareBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  reportId: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)", marginTop: 4,
  },
  loadingContent: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 16,
  },
  loadingIconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#E6F9F6",
    alignItems: "center", justifyContent: "center",
  },
  loadingTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  loadingSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  loadingStep: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingStepDot: { width: 8, height: 8, borderRadius: 4 },
  loadingStepText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  errorTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  errorDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  errorBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
  errorBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  errorBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 14 },
  sectionCard: {
    backgroundColor: "#fff", borderRadius: 16,
    borderLeftWidth: 4, padding: 16,
    shadowColor: "#1A3A5C", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  patientBox: { borderRadius: 10, padding: 14, gap: 8 },
  patientRow: { flexDirection: "row", justifyContent: "space-between" },
  patientLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  patientValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1, marginLeft: 8 },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  confidenceBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: "flex-start",
  },
  confidenceText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pillsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  symptomPill: {
    backgroundColor: "#EEF3FF", paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20,
  },
  symptomPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1A3A5C" },
  conditionsBox: { borderRadius: 10, padding: 12, gap: 6 },
  conditionsTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 4 },
  conditionItem: { fontSize: 13, fontFamily: "Inter_400Regular" },
  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, fontStyle: "italic", marginTop: 4 },
  severityBanner: {
    borderRadius: 16, padding: 20, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  severityHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  severityLevel: { fontSize: 22, fontFamily: "Inter_700Bold" },
  severityReason: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, opacity: 0.95 },
  ageAdjustBox: { backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 8, padding: 10 },
  ageAdjustText: { fontSize: 12, fontFamily: "Inter_500Medium", fontStyle: "italic" },
  urgencyBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 10 },
  urgencyText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  specialistsList: { gap: 10 },
  specialistItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  specialistIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  specialistName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  urgencyMsg: { borderRadius: 10, padding: 12 },
  urgencyMsgText: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  subHeading: { fontSize: 13, fontFamily: "Inter_700Bold" },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  listNumber: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#2BBFA4", minWidth: 20 },
  listItemText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  warningBox: { borderRadius: 10, padding: 12, gap: 8 },
  warningTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  warningSeek: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16, fontStyle: "italic", marginTop: 4 },
  confirmBox: { borderRadius: 12, padding: 16, gap: 12 },
  confirmQuestion: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  confirmBtns: { flexDirection: "row", gap: 10 },
  confirmBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  confirmBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  confirmFollowUp: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  resourceItem: { flexDirection: "row", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#E2EBF0" },
  resourceIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E6F9F6", alignItems: "center", justifyContent: "center" },
  resourceText: { flex: 1, gap: 2 },
  resourceName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1A3A5C" },
  resourceContact: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#2BBFA4" },
  resourceDetails: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 16 },
  resourceCostBadge: { backgroundColor: "#E6F9F6", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start" },
  resourceCost: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#2BBFA4" },
  womensSection: { borderRadius: 16, padding: 16, gap: 12 },
  womensSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  womensSectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  womensConfidential: {
    backgroundColor: "#F4C0D1", paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, alignSelf: "flex-start",
  },
  womensConfidentialText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#C0194B", letterSpacing: 1 },
  privacyNote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, fontStyle: "italic" },
  emergencyFooter: {
    borderRadius: 16, padding: 20,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  emergencyText: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 20 },
  actionBtns: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 52, borderRadius: 14, gap: 8,
  },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  mapActions: { flexDirection: "row", gap: 10 },
  mapBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 12,
    gap: 8,
  },
  mapBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  mapFrameWrap: {
    height: 260,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEE2E2",
  },
  mapFrame: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  } as unknown as object,
});
