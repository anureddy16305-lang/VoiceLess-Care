# VoiceForAll

An AI-powered health chatbot mobile app for deaf, mute, and women patients. Patients can describe symptoms via sign language, voice, or text — and receive a structured AI health report with severity assessment, action plan, and free healthcare resources.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/voiceforall run dev` — run the Expo app (port varies, see workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, path `/api`)
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI GPT-5.2 (health analysis) + gpt-4o-mini-transcribe (audio)
- Mobile: Expo Router 6, React Native, react-native-reanimated
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/voiceforall.ts` — AI analysis & transcription endpoints
- `artifacts/api-server/src/routes/index.ts` — route registry
- `artifacts/voiceforall/app/` — all Expo screens (index, mode-select, sign-language, audio-record, text-input, report)
- `artifacts/voiceforall/contexts/PatientContext.tsx` — shared state (patient info, analysis input, report)
- `lib/integrations-openai-ai-server/` — OpenAI server integration

## Architecture decisions

- **Stack-only navigation** — No tabs; the app is a linear wizard flow (register → mode select → input → report).
- **PatientContext** — Shared React context for patient state across all screens; no prop drilling.
- **Sign language simulation** — Gesture detection is simulated for Expo Go compatibility (no native MediaPipe); UI is camera-ready; gesture sequences are passed to the AI backend.
- **Audio transcription** — Uses simulated transcripts for Expo Go web; real `gpt-4o-mini-transcribe` endpoint exists at `/api/voiceforall/transcribe`.
- **50 MB body limit** — Express body size increased for audio base64 payloads.
- **Backend AI system prompt** — Strict medical AI rules: no diagnosis, severity rules by condition, age-adjustment logic, women's health module, emergency footer always present.

## Product

- **Screen 1 (Registration):** Name, age, gender — patient profile for tailored analysis.
- **Screen 2 (Mode Select):** Choose sign language, voice, or text. Women get a "Women's Health" module toggle.
- **Screen 3A (Sign Language):** Simulated camera + gesture selection → AI interprets gesture sequences.
- **Screen 3B (Audio Record):** Waveform animation → AI transcribes + analyzes.
- **Screen 3C (Text Input):** Free-form symptom description with character counter.
- **Screen 4 (Report):** Full AI health report: severity banner (EMERGENCY/SEVERE/MODERATE/MILD), clinical analysis, action plan, free helplines, women's health section, emergency footer.

## User preferences

_Populate as needed._

## Gotchas

- API server bundles with esbuild — run `pnpm --filter @workspace/api-server run build` to verify bundle succeeds before deploying.
- `EXPO_PUBLIC_DOMAIN` env var must be set for the Expo app to reach the API server at runtime.
- The Expo app uses `@workspace/integrations-openai-ai-server` only on the API side — the mobile client calls `/api/voiceforall/analyze` via raw `fetch`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
