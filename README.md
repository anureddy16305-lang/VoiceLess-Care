# VoiceForAll

VoiceForAll is a hackathon healthcare accessibility app with:

- Patient registration
- Camera/sign input
- Voice-to-text symptom input
- Text symptom input
- Local Flask backend report generation
- Critical-condition nearby hospital map and emergency guidance

## Run Locally

### Backend

Open a terminal:

```powershell
cd Voice-For-All
cd backend
pip install -r requirements.txt
python app.py
```

Backend runs on:

```text
http://127.0.0.1:5000
```

### Frontend

Open a second terminal:

```powershell
cd Voice-For-All
pnpm install
pnpm run dev:frontend
```

Frontend runs on:

```text
http://127.0.0.1:5173
```

## Notes

- Use Chrome or Edge for the best web voice-to-text and camera support.
- Critical or severe reports show a nearby hospital map with a location button and Google Maps link.
- The backend is local and rule-based, so it does not require an API key.
