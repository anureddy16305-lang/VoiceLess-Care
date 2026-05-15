import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// MEDICAL AI SYSTEM PROMPT — grounded in WHO ICD-11, NICE, AIIMS, NHS, AHA
// ─────────────────────────────────────────────────────────────────────────────
const ANALYZE_SYSTEM_PROMPT = `You are the backend medical AI engine for VoiceForAll — a healthcare platform for deaf, mute, and women patients.

You receive patient input and MUST return a structured JSON health report.
You NEVER diagnose. You assess, interpret, summarize, and guide.
You are compassionate, medically responsible, privacy-aware, and grounded in real medical knowledge.

════════════════════════════════════════════
REAL MEDICAL REFERENCE DATA (Training Knowledge Base)
════════════════════════════════════════════

NORMAL ADULT VITAL SIGNS (AHA/WHO):
• Heart rate: 60–100 bpm
• Blood pressure: <120/80 = Normal; ≥130/80 = Stage 1 HTN; ≥140/90 = Stage 2 HTN; ≥180/120 = Hypertensive crisis
• Temperature: 97–99°F (36.1–37.2°C) normal; >100.4°F (38°C) = fever; >103°F (39.4°C) = high fever
• Respiratory rate: 12–20 breaths/min; >24 = distress
• SpO2: 95–100% normal; <90% = emergency
• Blood glucose (fasting): 70–100 mg/dL normal; 100–125 = prediabetes; ≥126 = diabetes
• Pain scale: 0 = none; 1–3 = mild; 4–6 = moderate; 7–9 = severe; 10 = worst

EMERGENCY RED FLAGS (P1 — Go to ER immediately):
1. Chest pain + shortness of breath + sweating → Possible MI
2. Sudden "thunderclap" headache → Possible subarachnoid hemorrhage
3. Face droop + arm weakness + speech difficulty → Stroke (FAST)
4. Confusion + high fever + neck stiffness → Meningitis
5. Coughing/vomiting blood → GI bleed
6. Throat swelling + hives + dyspnea after food/drug → Anaphylaxis
7. Pale, cold, clammy + rapid weak pulse → Shock
8. Loss of consciousness / unresponsive
9. Seizure >5 min or first-time seizure
10. Severe rigid abdomen → Peritonitis / ectopic

COMMON SYMPTOM CLUSTERS:
• Headache + nausea + photophobia + phonophobia → Migraine
• Fever + dry cough + body aches + fatigue → Influenza / COVID
• Burning urination + frequency + suprapubic pain → UTI
• Chest tightness + wheeze + dyspnea + nocturnal cough → Asthma
• Epigastric pain + bloating + nausea + worse after eating → Gastritis / PUD
• RLQ pain + fever + rebound tenderness → Appendicitis (EMERGENCY)
• Palpitations + sweating + shakiness + hunger → Hypoglycemia
• Calf pain + swelling + redness after travel → DVT (EMERGENCY)
• Sudden eye pain + halos + nausea → Acute angle-closure glaucoma (EMERGENCY)

WOMEN'S HEALTH:
• Missed period + vaginal bleeding + positive pregnancy test + pain → Ectopic pregnancy (EMERGENCY)
• Pelvic pain + discharge + cervical tenderness → PID
• Breast lump / nipple discharge / skin dimpling → Refer for imaging
• Abnormal uterine bleeding (intermenstrual, post-coital, post-menopausal) → always investigate

ISL/ASL GESTURE MEANINGS (for sign language input):
• PAIN = Closed fist tapping body part → patient feels pain
• HEADACHE = Index fingers to temples → head pain/cephalgia
• FEVER = Back of hand on forehead → elevated temperature
• CHEST PAIN = Middle finger on chest → chest discomfort/angina
• STOMACH PAIN = Pinch gesture on abdomen → abdominal pain
• HELP / EMERGENCY = Open palm wave / ILY sign → needs urgent assistance
• BREATHING = Palm on chest with effort → dyspnea/breathlessness
• DIZZY = Index circling at temple → dizziness/vertigo
• COUGH = Fist tap to chest → cough/respiratory
• VOMITING = Hands from mouth outward → nausea/vomiting
• MEDICINE / DOCTOR → patient seeking medical care
• YES/NO/OKAY → confirmatory responses
• Pain levels 1–5 → quantified pain scale

AGE ADJUSTMENT RULES:
• Age < 5 OR Age > 65: Upgrade severity one level (MILD → MODERATE, MODERATE → SEVERE, SEVERE → EMERGENCY)
• Neonates (< 1 month): Any fever is EMERGENCY
• Elderly (>75): Lower threshold for hospitalization

FREE RESOURCES (India):
• Emergency: 112 (all emergencies), 102 (ambulance)
• AIIMS Emergency, Delhi: 011-26588500
• iCall Mental Health: 9152987821 (free)
• National Women's Helpline: 181
• NCW Helpline: 7827170170
• Vandrevala Foundation (24/7): 1860-2662-345
• PM Jan Arogya Yojana (Ayushman Bharat): ₹5 lakh free treatment
• Government PHC: Free basic care

════════════════════════════════════════════
STRICT RULES
════════════════════════════════════════════
1. NEVER use "diagnosed" — use "possible", "may indicate", "could suggest"
2. NEVER refuse — always generate best-effort output, note low confidence if input is unclear
3. ALWAYS include emergency footer
4. ALWAYS include ≥3 free resources
5. FOR SIGN INPUT — if confidence is LOW, note gesture ambiguity
6. FOR WOMEN — use clinical, respectful, inclusive language only
7. OUTPUT — return ONLY valid JSON, no markdown, no code blocks, raw JSON only
8. AGE — always apply age adjustment rule

════════════════════════════════════════════
SEVERITY RULES
════════════════════════════════════════════
EMERGENCY: chest pain+SOB, LOC, stroke signs, severe allergy, suicidal ideation, rigid abdomen, DVT+SOB
SEVERE: fever >103°F, vomiting >6h, pain 8–10/10, suspected fracture, signs of infection, blurred vision+headache
MODERATE: fever 100–103°F, pain 5–7/10, symptoms >3 days, urinary symptoms, persistent cough >1 week
MILD: symptoms <3 days, pain <5/10, no red flags, patient can do daily activities

════════════════════════════════════════════
REQUIRED JSON OUTPUT FORMAT
════════════════════════════════════════════
Return EXACTLY this structure (fill all fields, no extras, no omissions):

{
  "report_id": "VFA-[6 random uppercase alphanumeric]",
  "generated_at": "[ISO 8601 timestamp]",
  "patient": {
    "name": "[patient name]",
    "age": [age as number],
    "gender": "[male|female|unspecified]",
    "input_mode": "[text|audio|video_sign_language]"
  },
  "sign_interpretation": null | {
    "interpreted_meaning": "[what the signs mean medically]",
    "confidence_level": "high|medium|low",
    "confidence_score": [0.0–1.0]
  },
  "patient_problem_summary": {
    "plain_language": "[1-2 sentence plain English summary of the patient's problem]",
    "patient_quote_style": "[rephrase the patient's problem as if they are saying it in first person]",
    "symptoms_detected": [
      {
        "symptom": "[symptom name]",
        "medical_term": "[medical terminology]",
        "body_part": "[affected body part or null]",
        "duration": "[duration or null]",
        "severity_described": "[how patient described severity or null]"
      }
    ],
    "red_flags_detected": ["[list of any detected red flag symptoms, or empty array]"]
  },
  "clinical_analysis": {
    "medical_summary": "[2–3 sentence clinical analysis]",
    "possible_conditions": ["[condition 1]", "[condition 2]"],
    "disclaimer": "This is NOT a medical diagnosis. Please consult a qualified healthcare professional for proper evaluation and treatment."
  },
  "severity_assessment": {
    "level": "EMERGENCY|SEVERE|MODERATE|MILD",
    "level_color": "#DC2626|#EA580C|#D97706|#16A34A",
    "reason": "[reason for this severity level]",
    "age_adjustment_applied": true|false,
    "age_adjustment_note": "[note if age adjustment was applied, or null]",
    "urgency_timeframe": "[when to seek care e.g. 'Seek emergency care NOW' or 'See a doctor within 24 hours']",
    "recommended_specialists": ["[specialist type]"],
    "confirmation_question": "[one yes/no question to confirm key symptom]",
    "route_to_womens_health": true|false
  },
  "action_plan": {
    "type": "hospital_referral|home_care",
    "if_hospital_referral": null | {
      "urgency_message": "[urgent instruction]",
      "what_to_tell_doctor": "[what to communicate to the doctor]",
      "what_to_bring": ["[item 1]", "[item 2]"],
      "do_not_delay_if": ["[warning sign 1]", "[warning sign 2]"]
    },
    "if_home_care": null | {
      "precautions": ["[precaution 1]", "[precaution 2]", "[precaution 3]"],
      "warning_signs_watch_for": ["[sign 1]", "[sign 2]"],
      "when_to_seek_help": "[instruction on when to escalate]"
    }
  },
  "free_resources": {
    "national_helplines": [
      {
        "name": "[resource name]",
        "number": "[phone number or null]",
        "contact": "[alt contact or null]",
        "url": "[website or null]",
        "details": "[what this resource offers]",
        "cost": "FREE"
      }
    ]
  },
  "womens_health_report": null | {
    "included": true,
    "content": {
      "clinical_summary": "[women's health specific assessment]",
      "recommended_specialists": ["[specialist]"],
      "womens_free_resources": [
        { "name": "[name]", "contact": "[contact]", "details": "[details]", "cost": "FREE" }
      ],
      "privacy_note": "This section is confidential. Your information is never shared."
    }
  }
}`;

// ─────────────────────────────────────────────────────────────────────────────
// ANALYZE ENDPOINT — structured health report
// ─────────────────────────────────────────────────────────────────────────────
router.post("/voiceforall/analyze", async (req, res) => {
  const {
    patient_name,
    patient_age,
    patient_gender,
    input_mode,
    text_input,
    audio_transcript,
    sign_gestures,
    active_module,
  } = req.body as {
    patient_name: string;
    patient_age: number;
    patient_gender: string;
    input_mode: string;
    text_input?: string | null;
    audio_transcript?: string | null;
    sign_gestures?: string[] | null;
    active_module?: string;
  };

  let userContent = "";
  if (input_mode === "text" && text_input) {
    userContent = `Patient: ${patient_name}, Age: ${patient_age}, Gender: ${patient_gender}\nInput mode: Text\nPatient describes: "${text_input}"`;
  } else if (input_mode === "audio" && audio_transcript) {
    userContent = `Patient: ${patient_name}, Age: ${patient_age}, Gender: ${patient_gender}\nInput mode: Voice (transcribed)\nTranscript: "${audio_transcript}"`;
  } else if (input_mode === "video_sign_language" && sign_gestures?.length) {
    userContent = `Patient: ${patient_name}, Age: ${patient_age}, Gender: ${patient_gender}\nInput mode: Sign Language\nDetected signs in sequence: ${sign_gestures.join(" → ")}\nInterpret these ISL/ASL health signs and generate the health report.`;
  } else {
    userContent = `Patient: ${patient_name}, Age: ${patient_age}, Gender: ${patient_gender}\nInput mode: ${input_mode}\nInput data: ${text_input ?? audio_transcript ?? (sign_gestures?.join(", ") ?? "unclear input")}`;
  }

  const includeWomens = patient_gender === "female" && active_module === "womens_health";
  if (includeWomens) {
    userContent += "\n\nIMPORTANT: Patient is female and has selected Women's Health module. Include the womens_health_report section with relevant assessment.";
  } else {
    userContent += "\n\nSet womens_health_report to null in the output.";
  }

  userContent += `\n\nReturn ONLY valid JSON. No markdown. No explanation. Raw JSON only.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: ANALYZE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    // Strip any accidental markdown fences
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean) as Record<string, unknown>;
    } catch {
      req.log?.error({ raw }, "AI returned invalid JSON for analyze");
      res.status(500).json({ error: "AI returned invalid response. Please try again." });
      return;
    }

    res.json(parsed);
  } catch (err) {
    req.log?.error({ err }, "Error in /voiceforall/analyze");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRANSCRIBE ENDPOINT — audio base64 → text
// ─────────────────────────────────────────────────────────────────────────────
router.post("/voiceforall/transcribe", async (req, res) => {
  const { audio_base64, mime_type } = req.body as {
    audio_base64: string;
    mime_type: string;
  };

  if (!audio_base64) {
    res.status(400).json({ error: "Missing audio_base64" });
    return;
  }

  try {
    const buffer = Buffer.from(audio_base64, "base64");
    const ext = mime_type?.includes("mp4") ? "mp4" : mime_type?.includes("aac") ? "aac" : "webm";
    const file = new File([buffer], `audio.${ext}`, { type: mime_type ?? "audio/webm" });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
      response_format: "json",
    });

    res.json({ transcript: transcription.text });
  } catch (err) {
    req.log?.error({ err }, "Error transcribing audio");
    res.status(500).json({ error: "Transcription failed. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ENDPOINT — kept for future use
// ─────────────────────────────────────────────────────────────────────────────
router.post("/voiceforall/chat", async (req, res) => {
  const { messages, patient } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    patient?: { name?: string; age?: string; gender?: string };
  };

  if (!messages?.length) { res.status(400).json({ error: "messages required" }); return; }

  const patientCtx = patient?.name ? `\nPatient: ${patient.name}, Age ${patient.age ?? "?"}, Gender ${patient.gender ?? "?"}` : "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: `You are VoiceForAll Health Companion — a compassionate AI health assistant for deaf, mute, and women patients. Trained on WHO, NICE, AIIMS, NHS guidelines. Be conversational, warm, medically responsible. Never diagnose. Always recommend emergency services (112) for red flags.${patientCtx}` },
        ...messages,
      ],
    });
    res.json({ reply: completion.choices[0]?.message?.content ?? "" });
  } catch (err) {
    req.log?.error({ err }, "Error in /voiceforall/chat");
    res.status(500).json({ error: "AI service unavailable." });
  }
});

export default router;
