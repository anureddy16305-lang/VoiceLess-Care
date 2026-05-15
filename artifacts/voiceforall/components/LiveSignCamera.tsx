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
    const animFrameRef = useRef<number | null>(null);
    const smootherRef = useRef(new GestureSmoother(10, 6));
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
          if (!cancelled) onStatusChange("error", "Model failed to load. Check your internet connection.");
        }
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
              const classified = classifyHandGesture(landmarks);
              const smoothed = smootherRef.current.push(classified?.sign ?? null);

              if (smoothed && smoothed !== lastSignRef.current) {
                lastSignRef.current = smoothed;
                if (classified) onSignDetected({ ...classified, sign: smoothed });
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
