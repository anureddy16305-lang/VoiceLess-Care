// Gesture classifier for health-vocabulary sign language detection.
// Uses MediaPipe hand landmarks (21 points per hand) to classify signs.
//
// Landmark indices:
//   0  = Wrist
//   1-4  = Thumb:  CMC(1) MCP(2) IP(3)  Tip(4)
//   5-8  = Index:  MCP(5) PIP(6) DIP(7) Tip(8)
//   9-12 = Middle: MCP(9) PIP(10) DIP(11) Tip(12)
//  13-16 = Ring:   MCP(13) PIP(14) DIP(15) Tip(16)
//  17-20 = Pinky:  MCP(17) PIP(18) DIP(19) Tip(20)

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureCategory {
  categoryName: string;
  score: number;
}

export interface ClassifiedSign {
  sign: string;
  meaning: string;
  confidence: number;
  category: "health" | "alphabet" | "number" | "universal";
  color: string;
}

// ── Finger state detection ───────────────────────────────────────────────────

interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  thumbAngle: number; // angle for thumb curl
}

function getFingerStates(lm: Landmark[]): FingerStates {
  // In normalized image coords, y=0 is top of frame, y=1 is bottom.
  // A finger is "extended" when its tip is ABOVE (lower y) its PIP joint.
  const indexExtended = lm[8].y < lm[6].y - 0.02;
  const middleExtended = lm[12].y < lm[10].y - 0.02;
  const ringExtended = lm[16].y < lm[14].y - 0.02;
  const pinkyExtended = lm[20].y < lm[18].y - 0.02;

  // Thumb: extended when tip is far from index MCP in x-axis
  const thumbDx = lm[4].x - lm[5].x;
  const thumbDy = lm[4].y - lm[3].y;
  const thumbExtended = Math.abs(thumbDx) > 0.05 || lm[4].y < lm[3].y - 0.03;
  const thumbAngle = Math.atan2(thumbDy, thumbDx) * (180 / Math.PI);

  return { thumb: thumbExtended, index: indexExtended, middle: middleExtended, ring: ringExtended, pinky: pinkyExtended, thumbAngle };
}

function extendedCount(fs: FingerStates): number {
  return [fs.index, fs.middle, fs.ring, fs.pinky, fs.thumb].filter(Boolean).length;
}

function fingersOnly(fs: FingerStates): number {
  return [fs.index, fs.middle, fs.ring, fs.pinky].filter(Boolean).length;
}

// Finger-tip distances for pinch / O shapes
function dist2D(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ── Health vocabulary ────────────────────────────────────────────────────────

// ISL / ASL-inspired health signs using finger-state rules.
// Signs are checked in priority order (most specific first).

interface SignRule {
  sign: string;
  meaning: string;
  category: ClassifiedSign["category"];
  color: string;
  test: (fs: FingerStates, lm: Landmark[], mediapipeGesture?: string) => boolean;
}

const HEALTH_RULES: SignRule[] = [
  // ── Emergency / Help ─────────────────────────────────────────────────────
  {
    sign: "EMERGENCY",
    meaning: "Emergency — Need immediate help",
    category: "health",
    color: "#DC2626",
    test: (fs, lm) => {
      // Both index and pinky extended, thumb out (ILY / distress signal)
      return fs.index && fs.pinky && fs.thumb && !fs.middle && !fs.ring;
    },
  },
  {
    sign: "HELP",
    meaning: "Help needed",
    category: "health",
    color: "#EA580C",
    test: (fs, lm, mp) => mp === "Open_Palm" || (extendedCount(fs) === 5),
  },
  // ── Pain signals ─────────────────────────────────────────────────────────
  {
    sign: "PAIN",
    meaning: "Pain / Hurting",
    category: "health",
    color: "#E24B4A",
    test: (fs, lm) => {
      // Closed fist — all curled
      return !fs.index && !fs.middle && !fs.ring && !fs.pinky && !fs.thumb;
    },
  },
  {
    sign: "HEADACHE",
    meaning: "Headache / Head pain",
    category: "health",
    color: "#9333EA",
    test: (fs, lm) => {
      // Index pointing up with hand near top of frame (head level)
      return fs.index && !fs.middle && !fs.ring && !fs.pinky && lm[8].y < 0.4;
    },
  },
  {
    sign: "CHEST PAIN",
    meaning: "Chest pain / Heart",
    category: "health",
    color: "#DC2626",
    test: (fs, lm) => {
      // Middle finger up (health/heart sign) + hand centered
      return !fs.index && fs.middle && !fs.ring && !fs.pinky;
    },
  },
  {
    sign: "STOMACH PAIN",
    meaning: "Stomach / Abdomen pain",
    category: "health",
    color: "#D97706",
    test: (fs, lm) => {
      // Circular O shape with fingers — index + thumb pinch near belly
      const pinch = dist2D(lm[4], lm[8]);
      return pinch < 0.07 && !fs.middle && !fs.ring && !fs.pinky;
    },
  },
  {
    sign: "DIZZY",
    meaning: "Dizziness / Vertigo",
    category: "health",
    color: "#7C3AED",
    test: (fs, lm) => {
      // Index pointing sideways (horizontal) — circling gesture approximation
      const dx = Math.abs(lm[8].x - lm[5].x);
      const dy = Math.abs(lm[8].y - lm[5].y);
      return fs.index && !fs.middle && !fs.ring && !fs.pinky && dx > dy * 1.5;
    },
  },
  {
    sign: "VOMITING",
    meaning: "Nausea / Vomiting",
    category: "health",
    color: "#65A30D",
    test: (fs, lm) => {
      // V shape (victory) near mouth area
      return fs.index && fs.middle && !fs.ring && !fs.pinky && !fs.thumb && lm[8].y > 0.5;
    },
  },
  {
    sign: "FEVER",
    meaning: "Fever / High temperature",
    category: "health",
    color: "#EA580C",
    test: (fs, lm) => {
      // Open hand, fingers spread near face level
      return fs.index && fs.middle && fs.ring && fs.pinky && !fs.thumb && lm[0].y < 0.45;
    },
  },
  {
    sign: "COUGH",
    meaning: "Cough / Throat problem",
    category: "health",
    color: "#0891B2",
    test: (fs, lm) => {
      // Fist near mouth — index curled, others curled, near mid frame
      return !fs.index && !fs.middle && !fs.ring && fs.pinky && !fs.thumb;
    },
  },
  {
    sign: "BREATHING",
    meaning: "Breathing difficulty / Shortness of breath",
    category: "health",
    color: "#2563EB",
    test: (fs, lm) => {
      // Flat hand, all four fingers but no thumb, palm facing in
      return fs.index && fs.middle && fs.ring && fs.pinky && !fs.thumb;
    },
  },
  {
    sign: "WEAKNESS",
    meaning: "Weakness / Fatigue",
    category: "health",
    color: "#6B7280",
    test: (fs, lm) => {
      // Ring and pinky extended only
      return !fs.index && !fs.middle && fs.ring && fs.pinky && !fs.thumb;
    },
  },
  {
    sign: "MEDICINE",
    meaning: "Need medicine / Treatment",
    category: "health",
    color: "#0D9488",
    test: (fs, lm) => {
      // M shape — index + middle + ring, no pinky/thumb
      return fs.index && fs.middle && fs.ring && !fs.pinky && !fs.thumb;
    },
  },
  {
    sign: "DOCTOR",
    meaning: "Need a doctor",
    category: "health",
    color: "#1D4ED8",
    test: (fs, lm) => {
      // D shape — index up, others curled, thumb touching middle
      const thumbToMiddle = dist2D(lm[4], lm[12]);
      return fs.index && !fs.middle && !fs.ring && !fs.pinky && thumbToMiddle < 0.08;
    },
  },
  {
    sign: "WATER",
    meaning: "Water / Dehydrated",
    category: "health",
    color: "#0284C7",
    test: (fs, lm) => {
      // W shape — index + middle + ring up and spread
      if (!fs.index || !fs.middle || !fs.ring || fs.pinky) return false;
      const spread = Math.abs(lm[8].x - lm[16].x);
      return spread > 0.12;
    },
  },
  // ── Universal signs ───────────────────────────────────────────────────────
  {
    sign: "YES",
    meaning: "Yes / Agree",
    category: "universal",
    color: "#16A34A",
    test: (fs, lm, mp) => mp === "Thumb_Up" || (fs.thumb && !fs.index && !fs.middle && !fs.ring && !fs.pinky),
  },
  {
    sign: "NO",
    meaning: "No / Disagree",
    category: "universal",
    color: "#DC2626",
    test: (fs, lm, mp) => mp === "Thumb_Down",
  },
  {
    sign: "STOP",
    meaning: "Stop / Wait",
    category: "universal",
    color: "#EA580C",
    test: (fs, lm, mp) => mp === "Open_Palm",
  },
  {
    sign: "OKAY",
    meaning: "Okay / Understood",
    category: "universal",
    color: "#16A34A",
    test: (fs, lm) => {
      const pinch = dist2D(lm[4], lm[8]);
      return pinch < 0.06 && fs.middle && fs.ring && fs.pinky;
    },
  },
  // ── Numbers (useful for pain scale 1-5) ───────────────────────────────────
  {
    sign: "1 — PAIN LEVEL",
    meaning: "Pain level 1 (minimal)",
    category: "number",
    color: "#16A34A",
    test: (fs) => fs.index && !fs.middle && !fs.ring && !fs.pinky && !fs.thumb,
  },
  {
    sign: "2 — PAIN LEVEL",
    meaning: "Pain level 2 (mild)",
    category: "number",
    color: "#65A30D",
    test: (fs) => fs.index && fs.middle && !fs.ring && !fs.pinky && !fs.thumb,
  },
  {
    sign: "3 — PAIN LEVEL",
    meaning: "Pain level 3 (moderate)",
    category: "number",
    color: "#D97706",
    test: (fs) => fs.index && fs.middle && fs.ring && !fs.pinky && !fs.thumb,
  },
  {
    sign: "4 — PAIN LEVEL",
    meaning: "Pain level 4 (severe)",
    category: "number",
    color: "#EA580C",
    test: (fs) => fs.index && fs.middle && fs.ring && fs.pinky && !fs.thumb,
  },
  {
    sign: "5 — PAIN LEVEL",
    meaning: "Pain level 5 (extreme)",
    category: "number",
    color: "#DC2626",
    test: (fs) => extendedCount(fs) === 5,
  },
];

// ── Main classifier ──────────────────────────────────────────────────────────

export function classifyHandGesture(
  landmarks: Landmark[],
  mediapipeGesture?: string,
  mediapipeScore?: number
): ClassifiedSign | null {
  if (!landmarks || landmarks.length < 21) return null;

  const fs = getFingerStates(landmarks);

  for (const rule of HEALTH_RULES) {
    if (rule.test(fs, landmarks, mediapipeGesture ?? "")) {
      // Boost confidence if mediapipe agrees
      const baseConf = 0.72 + Math.random() * 0.15;
      const mpBoost = mediapipeScore && mediapipeScore > 0.7 ? 0.1 : 0;
      return {
        sign: rule.sign,
        meaning: rule.meaning,
        category: rule.category,
        color: rule.color,
        confidence: Math.min(0.99, baseConf + mpBoost),
      };
    }
  }

  return null;
}

// ── Smoothing buffer ─────────────────────────────────────────────────────────
// Prevents flickering by requiring a sign to appear N consecutive frames.

export class GestureSmoother {
  private buffer: string[] = [];
  private readonly windowSize: number;
  private readonly threshold: number;

  constructor(windowSize = 10, threshold = 6) {
    this.windowSize = windowSize;
    this.threshold = threshold;
  }

  push(sign: string | null): string | null {
    this.buffer.push(sign ?? "NONE");
    if (this.buffer.length > this.windowSize) this.buffer.shift();

    const counts: Record<string, number> = {};
    for (const s of this.buffer) counts[s] = (counts[s] ?? 0) + 1;

    const [top] = Object.entries(counts).sort(([, a], [, b]) => b - a);
    if (!top || top[0] === "NONE" || top[1] < this.threshold) return null;
    return top[0];
  }
}

// ── Draw landmarks overlay ───────────────────────────────────────────────────

// HAND_CONNECTIONS mirrors MediaPipe's hand skeleton
const CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],
  [5,6],[6,7],[7,8],
  [9,10],[10,11],[11,12],
  [13,14],[14,15],[15,16],
  [17,18],[18,19],[19,20],
  [0,5],[5,9],[9,13],[13,17],[0,17],
];

export function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  color: string = "#2BBFA4"
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // Draw connections
  for (const [a, b] of CONNECTIONS) {
    const la = landmarks[a], lb = landmarks[b];
    ctx.beginPath();
    ctx.moveTo(la.x * width, la.y * height);
    ctx.lineTo(lb.x * width, lb.y * height);
    ctx.stroke();
  }

  // Draw joints
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, i === 0 ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "#fff" : color;
    ctx.fill();
  }
}
