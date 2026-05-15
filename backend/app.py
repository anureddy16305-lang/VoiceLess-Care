from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import random
import string

app = Flask(__name__)
CORS(app)

DISEASES = {
    "chest_pain": {
        "gesture": "Hand on Chest",
        "disease": "Chest pain / possible heart problem",
        "status": "CRITICAL",
        "advice": "Go to the nearest hospital immediately. Do not ignore chest pain.",
        "specialists": ["Emergency Physician", "Cardiologist"],
    },
    "severe_chest_pain": {
        "gesture": "Both Hands on Chest",
        "disease": "Serious cardiac emergency / heart attack risk",
        "status": "CRITICAL",
        "advice": "Call an ambulance or go to emergency care immediately.",
        "specialists": ["Emergency Physician", "Cardiologist"],
    },
    "fever": {
        "gesture": "Hand on Forehead",
        "disease": "Fever / viral infection",
        "status": "NORMAL",
        "advice": "Drink fluids, rest, and check temperature regularly.",
        "specialists": ["General Physician"],
    },
    "headache": {
        "gesture": "Hand Pressing Head",
        "disease": "Headache / migraine / stress",
        "status": "NORMAL",
        "advice": "Rest, drink water, avoid screen time, and consult a doctor if severe.",
        "specialists": ["General Physician", "Neurologist"],
    },
    "throat_problem": {
        "gesture": "Hand Holding Throat",
        "disease": "Throat pain / throat infection",
        "status": "NORMAL",
        "advice": "Gargle with warm salt water and consult a doctor if pain continues.",
        "specialists": ["ENT Specialist"],
    },
    "breathing_problem": {
        "gesture": "Breathing Difficulty",
        "disease": "Asthma / respiratory issue / breathing problem",
        "status": "CRITICAL",
        "advice": "Needs urgent medical help. Sit upright and go to hospital if breathing is difficult.",
        "specialists": ["Emergency Physician", "Pulmonologist"],
    },
    "stomach_pain": {
        "gesture": "Hand on Stomach",
        "disease": "Stomach pain / gastric issue / food poisoning",
        "status": "NORMAL",
        "advice": "Eat light food, drink water, and consult a doctor if pain increases.",
        "specialists": ["General Physician", "Gastroenterologist"],
    },
    "severe_stomach_pain": {
        "gesture": "Both Hands on Lower Abdomen",
        "disease": "Severe abdominal pain / appendix risk",
        "status": "CRITICAL",
        "advice": "Visit hospital urgently if stomach pain is severe or continuous.",
        "specialists": ["Emergency Physician", "Gastroenterologist", "Surgeon"],
    },
    "vomiting": {
        "gesture": "Hand Near Mouth",
        "disease": "Vomiting / nausea / dehydration",
        "status": "NORMAL",
        "advice": "Drink ORS, rest, and avoid oily food.",
        "specialists": ["General Physician"],
    },
    "eye_problem": {
        "gesture": "Hand on Eyes",
        "disease": "Eye strain / infection / eye pain",
        "status": "NORMAL",
        "advice": "Avoid screen exposure and consult an eye doctor if severe.",
        "specialists": ["Ophthalmologist"],
    },
    "ear_problem": {
        "gesture": "Hand on Ear",
        "disease": "Ear pain / ear infection",
        "status": "NORMAL",
        "advice": "Avoid inserting anything in the ear and consult a doctor if pain continues.",
        "specialists": ["ENT Specialist"],
    },
    "back_pain": {
        "gesture": "Hand Holding Back",
        "disease": "Back pain / muscle pain",
        "status": "NORMAL",
        "advice": "Rest, avoid heavy lifting, and use a warm compress.",
        "specialists": ["Orthopedic Doctor", "Physiotherapist"],
    },
    "weakness": {
        "gesture": "Weakness / Dizziness",
        "disease": "Weakness / low BP / dizziness",
        "status": "NORMAL",
        "advice": "Sit down, drink water, and eat something light.",
        "specialists": ["General Physician"],
    },
    "dehydration": {
        "gesture": "Water / Dehydration",
        "disease": "Possible dehydration / low fluid intake",
        "status": "NORMAL",
        "advice": "Drink clean water or ORS slowly and seek help if dizziness, dry mouth, or weakness continues.",
        "specialists": ["General Physician"],
    },
    "medicine_help": {
        "gesture": "Medicine / Treatment Request",
        "disease": "Medicine or treatment support needed",
        "status": "NORMAL",
        "advice": "Share current symptoms and any medicines already taken with a doctor or pharmacist before taking new medicine.",
        "specialists": ["General Physician", "Pharmacist"],
    },
    "doctor_help": {
        "gesture": "Doctor Needed",
        "disease": "Medical consultation needed",
        "status": "NORMAL",
        "advice": "Book a doctor consultation and show this report so the symptoms can be checked properly.",
        "specialists": ["General Physician"],
    },
    "pain": {
        "gesture": "Pain / Hurting",
        "disease": "Body pain / localized pain",
        "status": "NORMAL",
        "advice": "Rest the painful area and consult a doctor if pain is severe, spreading, or not improving.",
        "specialists": ["General Physician", "Orthopedic Doctor"],
    },
    "severe_pain": {
        "gesture": "Severe Localized Pain",
        "disease": "Severe localized pain / worsening pain",
        "status": "CRITICAL",
        "advice": "Seek medical care urgently if the pain is increasing, unbearable, or linked with swelling, injury, fever, or weakness.",
        "specialists": ["Emergency Physician", "General Physician", "Orthopedic Doctor"],
    },
    "emergency": {
        "gesture": "Help Gesture",
        "disease": "Emergency condition",
        "status": "CRITICAL",
        "advice": "Call an ambulance immediately or go to the nearest hospital.",
        "specialists": ["Emergency Physician"],
    },
    "injury": {
        "gesture": "Holding Injured Area",
        "disease": "Injury / accident / bleeding",
        "status": "CRITICAL",
        "advice": "Apply first aid and visit the nearest hospital immediately.",
        "specialists": ["Emergency Physician", "Orthopedic Doctor"],
    },
    "normal": {
        "gesture": "General Symptoms",
        "disease": "No critical symptom detected",
        "status": "NORMAL",
        "advice": "Stay hydrated and consult a doctor if symptoms continue.",
        "specialists": ["General Physician"],
    },
}

TEXT_KEYWORDS = [
    ("severe chest", "severe_chest_pain"),
    ("heart attack", "severe_chest_pain"),
    ("severe pain", "severe_pain"),
    ("more pain", "severe_pain"),
    ("worsening pain", "severe_pain"),
    ("unbearable pain", "severe_pain"),
    ("breathing", "breathing_problem"),
    ("breath", "breathing_problem"),
    ("nose", "breathing_problem"),
    ("shortness", "breathing_problem"),
    ("asthma", "breathing_problem"),
    ("severe stomach", "severe_stomach_pain"),
    ("appendix", "severe_stomach_pain"),
    ("abdomen", "severe_stomach_pain"),
    ("emergency", "emergency"),
    ("help", "emergency"),
    ("bleeding", "injury"),
    ("accident", "injury"),
    ("injury", "injury"),
    ("chest", "chest_pain"),
    ("heart", "chest_pain"),
    ("pressure", "chest_pain"),
    ("fever", "fever"),
    ("temperature", "fever"),
    ("headache", "headache"),
    ("migraine", "headache"),
    ("head", "headache"),
    ("throat", "throat_problem"),
    ("stomach", "stomach_pain"),
    ("gastric", "stomach_pain"),
    ("vomit", "vomiting"),
    ("nausea", "vomiting"),
    ("eye", "eye_problem"),
    ("ear", "ear_problem"),
    ("back", "back_pain"),
    ("spine", "back_pain"),
    ("weak", "weakness"),
    ("dizzy", "weakness"),
    ("dizziness", "weakness"),
    ("vertigo", "weakness"),
    ("weakness", "weakness"),
    ("fatigue", "weakness"),
    ("tired", "weakness"),
    ("water", "dehydration"),
    ("dehydrat", "dehydration"),
    ("thirst", "dehydration"),
    ("medicine", "medicine_help"),
    ("treatment", "medicine_help"),
    ("doctor", "doctor_help"),
    ("consult", "doctor_help"),
    ("pain", "pain"),
    ("hurting", "pain"),
    ("hurt", "pain"),
]


def detect_symptom(text):
    value = (text or "").lower()
    for keyword, symptom in TEXT_KEYWORDS:
        if keyword in value:
            return symptom
    return "normal"


def severity_level(result):
    if result["status"] == "CRITICAL":
        return "EMERGENCY" if result["gesture"] in ["Help Gesture", "Breathing Difficulty"] else "SEVERE"
    return "MILD"


def make_report(data, symptom_key):
    result = DISEASES.get(symptom_key, DISEASES["normal"])
    level = severity_level(result)
    is_serious = level in ["EMERGENCY", "SEVERE"]
    patient_name = data.get("patient_name") or "Not provided"
    patient_age = int(data.get("patient_age") or 0)
    patient_gender = data.get("patient_gender") or "unspecified"
    input_mode = data.get("input_mode") or "text"
    quote = (
        data.get("text_input")
        or data.get("audio_transcript")
        or ", ".join(data.get("sign_gestures") or [])
        or result["gesture"]
    )
    report_id = "VFA-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    return {
        "report_id": report_id,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "patient": {
            "name": patient_name,
            "age": patient_age,
            "gender": patient_gender,
            "input_mode": input_mode,
        },
        "sign_interpretation": {
            "interpreted_meaning": result["gesture"],
            "confidence_level": "high",
            "confidence_score": 0.88,
        } if input_mode == "video_sign_language" else None,
        "patient_problem_summary": {
            "plain_language": quote,
            "patient_quote_style": f'Patient communicated: "{quote}"',
            "symptoms_detected": [
                {
                    "symptom": result["gesture"],
                    "medical_term": result["disease"],
                    "body_part": result["gesture"],
                    "duration": "Not specified",
                    "severity_described": level.title(),
                }
            ],
            "red_flags_detected": [result["advice"]] if is_serious else [],
        },
        "clinical_analysis": {
            "medical_summary": f"{result['disease']}. {result['advice']}",
            "possible_conditions": [result["disease"]],
            "disclaimer": "This is AI-assisted communication support, not a final medical diagnosis. Please consult a qualified doctor.",
        },
        "severity_assessment": {
            "level": level,
            "level_color": "#DC2626" if is_serious else "#16A34A",
            "reason": result["advice"],
            "age_adjustment_applied": patient_age >= 60,
            "age_adjustment_note": "Older patients should seek care earlier for the same symptoms." if patient_age >= 60 else None,
            "urgency_timeframe": "Go to the nearest hospital now." if is_serious else "Monitor symptoms and consult a doctor if they continue.",
            "recommended_specialists": result["specialists"],
            "confirmation_question": "Are symptoms getting worse or difficult to manage?",
            "route_to_womens_health": patient_gender == "female" and data.get("active_module") == "womens_health",
        },
        "action_plan": {
            "type": "hospital_referral" if is_serious else "home_care",
            "if_hospital_referral": {
                "urgency_message": "This may need urgent medical attention. Please go to the nearest available hospital.",
                "what_to_tell_doctor": f"{patient_name} has {result['disease']}. Main message: {quote}",
                "what_to_bring": ["This report", "Any medicines currently being taken", "Previous medical documents if available"],
                "do_not_delay_if": ["Breathing difficulty", "Severe pain", "Bleeding", "Fainting", "Chest pressure"],
            } if is_serious else None,
            "if_home_care": {
                "precautions": [result["advice"], "Drink water and rest.", "Avoid self-medication without advice."],
                "warning_signs_watch_for": ["Worsening pain", "High fever", "Breathing difficulty", "Dizziness"],
                "when_to_seek_help": "Seek medical help if symptoms worsen or do not improve.",
            } if not is_serious else None,
        },
        "free_resources": {
            "national_helplines": [
                {"name": "Emergency Response", "number": "112", "details": "All India emergency support", "cost": "Free"},
                {"name": "Ambulance", "number": "108", "details": "Emergency ambulance service", "cost": "Free"},
                {"name": "Health Helpline", "number": "104", "details": "State health advice helpline where available", "cost": "Free"},
            ]
        },
        "womens_health_report": {
            "included": True,
            "content": {
                "clinical_summary": "Women's health mode selected. Please consider privacy, menstrual history, pregnancy possibility, and gynecology support if relevant.",
                "recommended_specialists": ["Gynecologist", "General Physician"],
                "womens_free_resources": [
                    {"name": "Women Helpline", "contact": "181", "details": "Women support helpline", "cost": "Free"}
                ],
                "privacy_note": "Discuss sensitive symptoms privately with a qualified healthcare worker.",
            },
        } if patient_gender == "female" and data.get("active_module") == "womens_health" else None,
    }


@app.get("/")
def home():
    return jsonify({"service": "VoiceForAll local backend", "status": "running"})


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "message": "VoiceForAll backend working", "total_diseases": len(DISEASES)})


@app.post("/api/voiceforall/analyze")
def voiceforall_analyze():
    data = request.get_json(silent=True) or {}
    text = data.get("text_input") or data.get("audio_transcript") or " ".join(data.get("sign_gestures") or [])
    symptom = detect_symptom(text)
    return jsonify(make_report(data, symptom))


@app.post("/api/voiceforall/transcribe")
def voiceforall_transcribe():
    return jsonify({"transcript": request.form.get("transcript", "") or "Voice transcript not provided."})


@app.post("/api/analyze/camera")
def analyze_camera_legacy():
    data = request.get_json(silent=True) or {}
    symptom = data.get("symptom", "normal")
    result = DISEASES.get(symptom, DISEASES["normal"])
    return jsonify({"success": True, "result": result, "hospital_map": "https://www.google.com/maps/search/hospitals+near+me"})


@app.post("/api/script/text")
def text_script_legacy():
    data = request.get_json(silent=True) or {}
    symptom = detect_symptom(data.get("message", ""))
    result = DISEASES.get(symptom, DISEASES["normal"])
    return jsonify({"success": True, "result": result, "script": f"{result['disease']}\n{result['advice']}"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
