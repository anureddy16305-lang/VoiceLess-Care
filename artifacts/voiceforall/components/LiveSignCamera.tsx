// LiveSignCamera — web-only component.
// Uses @tensorflow-models/hand-pose-detection with WebGL backend.
// No CDN WASM required — runs fully in-browser via WebGL.

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import {
  classifyHandGesture,
  drawLandmarks,
  GestureSmoother,
  type ClassifiedSign,
  type Landmark,
} from "@/lib/gestureClassifier";

export interface LiveSignCameraHandle {
  stopCamera: () => void;
}

interface Props {
  onSignDetected: (sign: ClassifiedSign) => void;
  onSignCleared: () => void;
  onStatusChange: (
    status: "initializing" | "loading_model" | "ready" | "no_hand" | "error",
    message?: string
  ) => void;
  running: boolean;
  overlayColor?: string;
}

type Keypoint = { x: number; y: number; z?: number; score?: number; name?: string };

function classifyByHandPosition(landmarks: Landmark[]): ClassifiedSign {
  const average = landmarks.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  const x = average.x / landmarks.length;
  const y = average.y / landmarks.length;

  if (y < 0.22) {
    return { sign: "FEVER", meaning: "Fever / High temperature", confidence: 0.82, category: "health", color: "#EA580C" };
  }
  if (y < 0.50 && x > 0.20 && x < 0.80) {
    return { sign: "HEADACHE", meaning: "Headache / Head pain", confidence: 0.84, category: "health", color: "#9333EA" };
  }
  if (y < 0.58 && x > 0.34 && x < 0.66) {
    return { sign: "THROAT", meaning: "Throat pain / Cough / Breathing discomfort", confidence: 0.80, category: "health", color: "#0891B2" };
  }
  if (y < 0.72 && x > 0.25 && x < 0.75) {
    return { sign: "CHEST PAIN", meaning: "Chest pain / Heart", confidence: 0.86, category: "health", color: "#DC2626" };
  }
  if (y < 0.76 && x > 0.22 && x < 0.78) {
    return { sign: "STOMACH PAIN", meaning: "Stomach / Abdomen pain", confidence: 0.84, category: "health", color: "#D97706" };
  }
  if (x < 0.22 || x > 0.78) {
    return { sign: "EMERGENCY", meaning: "Emergency need help", confidence: 0.78, category: "health", color: "#DC2626" };
  }

  return { sign: "PAIN", meaning: "Pain / Hurting", confidence: 0.74, category: "health", color: "#E24B4A" };
}

const LiveSignCamera = forwardRef<LiveSignCameraHandle, Props>(
  function LiveSignCamera(
    { onSignDetected, onSignCleared, onStatusChange, running, overlayColor = "#2BBFA4" },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectorRef = useRef<{ estimateHands: (v: HTMLVideoElement) => Promise<unknown[]> } | null>(null);
    const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const smootherRef = useRef(new GestureSmoother(10, 7));
    const lastSignRef = useRef<string | null>(null);
    const mountedRef = useRef(true);

    const stopCamera = useCallback(() => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }, []);

    useImperativeHandle(ref, () => ({ stopCamera }));

    // Build DOM elements imperatively
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.cssText =
        "width:100%;height:100%;object-fit:cover;border-radius:16px;transform:scaleX(-1)";
      videoRef.current = video;

      const canvas = document.createElement("canvas");
      canvas.style.cssText =
        "position:absolute;top:0;left:0;width:100%;height:100%;border-radius:16px;pointer-events:none;transform:scaleX(-1)";
      canvasRef.current = canvas;
      analysisCanvasRef.current = document.createElement("canvas");

      container.appendChild(video);
      container.appendChild(canvas);
      return () => {
        try { container.removeChild(video); } catch { /* ignore */ }
        try { container.removeChild(canvas); } catch { /* ignore */ }
      };
    }, []);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        stopCamera();
      };
    }, [stopCamera]);

    // Main init + loop
    useEffect(() => {
      if (!running) return;
      let cancelled = false;

      async function init() {
        onStatusChange("initializing");

        // 1. Camera
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
        } catch (e) {
          if (!cancelled) onStatusChange("error", "Camera permission denied. Please allow camera access and reload.");
          return;
        }

        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await new Promise<void>((res) => {
          video.onloadedmetadata = () => res();
        });
        await video.play().catch(() => {});
        if (cancelled) return;

        // 2. Load TF.js hand detection model (WebGL — no CDN WASM)
        onStatusChange("loading_model");
        try {
          const tf = await import("@tensorflow/tfjs-core");
          await import("@tensorflow/tfjs-backend-webgl");
          await tf.setBackend("webgl");
          await tf.ready();

          const handDetection = await import("@tensorflow-models/hand-pose-detection");
          const detector = await handDetection.createDetector(
            handDetection.SupportedModels.MediaPipeHands,
            { runtime: "tfjs", maxHands: 2 }
          );

          if (cancelled) return;
          detectorRef.current = detector as typeof detectorRef.current;
          onStatusChange("ready");
          detectLoop();
        } catch (err) {
          console.error("TF.js model load error:", err);
          if (!cancelled) {
            onStatusChange("ready", "Local action detection active. Move your hand to chest, head, forehead, stomach, or side.");
            localActionLoop();
          }
        }
      }

      function classifyByPoint(x: number, y: number): ClassifiedSign {
        if (y < 0.22) {
          return { sign: "FEVER", meaning: "Fever / High temperature", confidence: 0.78, category: "health", color: "#EA580C" };
        }
        if (y < 0.52 && x > 0.18 && x < 0.82) {
          return { sign: "HEADACHE", meaning: "Headache / Head pain", confidence: 0.78, category: "health", color: "#9333EA" };
        }
        if (y < 0.60 && x > 0.32 && x < 0.68) {
          return { sign: "THROAT", meaning: "Throat pain / Cough / Breathing discomfort", confidence: 0.76, category: "health", color: "#0891B2" };
        }
        if (y < 0.74 && x > 0.22 && x < 0.78) {
          return { sign: "CHEST PAIN", meaning: "Chest pain / Heart", confidence: 0.82, category: "health", color: "#DC2626" };
        }
        if (y < 0.84 && x > 0.18 && x < 0.82) {
          return { sign: "STOMACH PAIN", meaning: "Stomach / Abdomen pain", confidence: 0.80, category: "health", color: "#D97706" };
        }
        if (x < 0.20 || x > 0.80) {
          return { sign: "EMERGENCY", meaning: "Emergency need help", confidence: 0.76, category: "health", color: "#DC2626" };
        }
        return { sign: "PAIN", meaning: "Pain / Hurting", confidence: 0.72, category: "health", color: "#E24B4A" };
      }

      function drawLocalMarker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sign: ClassifiedSign) {
        ctx.beginPath();
        ctx.arc(x * w, y * h, 28, 0, Math.PI * 2);
        ctx.strokeStyle = sign.color;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = "rgba(0,0,0,0.58)";
        ctx.fillRect(10, 10, Math.min(330, w - 20), 44);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px Arial";
        ctx.fillText(`Detected: ${sign.sign}`, 22, 38);
      }

      function localActionLoop() {
        if (cancelled || !mountedRef.current) return;
        const video = videoRef.current;
        const overlay = canvasRef.current;
        const analysis = analysisCanvasRef.current;

        if (!video || !overlay || !analysis || video.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(localActionLoop);
          return;
        }

        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        if (overlay.width !== w || overlay.height !== h) {
          overlay.width = w;
          overlay.height = h;
        }

        const aw = 96;
        const ah = 72;
        analysis.width = aw;
        analysis.height = ah;

        const overlayCtx = overlay.getContext("2d");
        const analysisCtx = analysis.getContext("2d", { willReadFrequently: true });
        if (!overlayCtx || !analysisCtx) {
          animFrameRef.current = requestAnimationFrame(localActionLoop);
          return;
        }

        overlayCtx.clearRect(0, 0, w, h);
        analysisCtx.drawImage(video, 0, 0, aw, ah);
        const frame = analysisCtx.getImageData(0, 0, aw, ah).data;
        const previous = previousFrameRef.current;

        let sumX = 0;
        let sumY = 0;
        let count = 0;
        let minX = aw;
        let minY = ah;
        let maxX = 0;
        let maxY = 0;
        const movingPixels: Array<{ x: number; y: number }> = [];

        if (previous) {
          for (let y = 0; y < ah; y += 1) {
            for (let x = 0; x < aw; x += 1) {
              const i = (y * aw + x) * 4;
              const diff =
                Math.abs(frame[i] - previous[i]) +
                Math.abs(frame[i + 1] - previous[i + 1]) +
                Math.abs(frame[i + 2] - previous[i + 2]);

              if (diff > 85) {
                sumX += x;
                sumY += y;
                count += 1;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                movingPixels.push({ x, y });
              }
            }
          }
        }

        previousFrameRef.current = new Uint8ClampedArray(frame);

        if (count > 35) {
          // Use the leading/top-most motion cluster as the hand position.
          // Averaging all movement includes the forearm and can classify head touches as stomach pain.
          const handBandLimit = minY + Math.max(4, (maxY - minY) * 0.35);
          const handPixels = movingPixels.filter((p) => p.y <= handBandLimit);
          const focusPixels = handPixels.length >= 8 ? handPixels : movingPixels;
          const focus = focusPixels.reduce(
            (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
            { x: 0, y: 0 }
          );
          const x = focus.x / focusPixels.length / aw;
          const y = focus.y / focusPixels.length / ah;
          const sign = classifyByPoint(x, y);
          drawLocalMarker(overlayCtx, x, y, w, h, sign);

          const smoothed = smootherRef.current.push(sign.sign);
          if (smoothed && smoothed !== lastSignRef.current) {
            lastSignRef.current = smoothed;
            onSignDetected({ ...sign, sign: smoothed });
          }
          onStatusChange("ready", `Local action detected: ${sign.sign}`);
        } else {
          onStatusChange("no_hand", "Move your hand to the symptom area and hold briefly.");
        }

        animFrameRef.current = requestAnimationFrame(localActionLoop);
      }

      async function detectLoop() {
        if (cancelled || !mountedRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const detector = detectorRef.current;

        if (!video || !canvas || !detector || video.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        // Sync canvas to video dimensions
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) { animFrameRef.current = requestAnimationFrame(detectLoop); return; }
        ctx.clearRect(0, 0, w, h);

        try {
          const hands = await detector.estimateHands(video) as Array<{
            keypoints: Keypoint[];
            handedness: string;
            score: number;
          }>;

          if (hands.length > 0) {
            onStatusChange("ready");
            for (const hand of hands) {
              // Normalize keypoints to 0–1 range for classifier
              const landmarks: Landmark[] = hand.keypoints.map((kp) => ({
                x: kp.x / w,
                y: kp.y / h,
                z: (kp.z ?? 0),
              }));

              // Draw skeleton overlay
              drawLandmarks(ctx, landmarks, w, h, overlayColor);

              // Classify
              const classified = classifyHandGesture(landmarks) ?? classifyByHandPosition(landmarks);
              const smoothed = smootherRef.current.push(classified?.sign ?? null);

              if (smoothed && smoothed !== lastSignRef.current) {
                lastSignRef.current = smoothed;
                onSignDetected({ ...classified, sign: smoothed });
              } else if (!smoothed && lastSignRef.current) {
                lastSignRef.current = null;
                onSignCleared();
              }
            }
          } else {
            onStatusChange("no_hand");
            const smoothed = smootherRef.current.push(null);
            if (!smoothed && lastSignRef.current) {
              lastSignRef.current = null;
              onSignCleared();
            }
          }
        } catch { /* skip frame on error */ }

        animFrameRef.current = requestAnimationFrame(detectLoop);
      }

      init();
      return () => { cancelled = true; };
    }, [running, onSignDetected, onSignCleared, onStatusChange, overlayColor]);

    return (
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: 16,
          background: "#0d1a2a",
        }}
      />
    );
  }
);

export default LiveSignCamera;
