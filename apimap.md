# AiM Documentary Studio — Frontend API Map

All frontend calls route through the Flask middleware. No direct backend/GCP access from the browser (except ElevenLabs TTS).

## Service Layers

| Service | Base URL | Transport | Notes |
|---|---|---|---|
| `apiService` | `VITE_API_URL \|\| ''` | `fetchAPI()` — always POST | Primary service layer |
| `geminiService` | same | Re-export of `apiService` | Backwards-compat alias |
| `gcpService` | `${VITE_API_URL}/api` | `apiCall<T>()` — flexible method | GCP resource management |
| `elevenLabsService` | `https://api.elevenlabs.io/v1` | Direct fetch with `xi-api-key` header | Only external API; not proxied through Flask |

In dev, Vite proxy routes `/api` → Flask at `localhost:5000`. In prod, `VITE_API_URL` is the Flask Cloud Run URL baked in at build time.

---

## Endpoint Map

### Research & AI

| Endpoint | Method | Service | Consumer | Purpose |
|---|---|---|---|---|
| `/api/research` | POST | apiService | ResearchPhase | Research with engine selection (gemini_pro, vertex_ai, perplexity, google_deep_research) |
| `/api/index-source` | POST | apiService | ResearchPhase | Index a URL, text block, or YouTube video via Vertex AI |
| `/api/analyze-document` | POST | apiService | ResearchPhase, ArchivePhase | Analyze uploaded file (PDF, DOCX, CSV) |
| `/api/query-sources` | POST | apiService | ResearchPhase | Multi-source research query (NotebookLM-style) |
| `/api/series-structure` | POST | apiService / geminiService | ResearchPhase | Generate series structure with episodes and themes |

### Scripting

| Endpoint | Method | Service | Consumer | Purpose |
|---|---|---|---|---|
| `/api/generate-script` | POST | apiService / geminiService | ScriptingPhase, ExpertInterviewPhase | Multi-agent script generation |
| `/api/refine-beat` | POST | apiService / geminiService | ScriptingPhase | Refine a single script beat |
| `/api/generate-broll` | POST | apiService / geminiService | ScriptingPhase | Generate B-roll video via Veo |

### Archive & Clips

| Endpoint | Method | Service | Consumer | Purpose |
|---|---|---|---|---|
| `/api/search-archive` | POST | apiService / geminiService | ArchivePhase | Search external archives (NASA, Getty, AP) |
| `/api/analyze-clip` | POST | apiService / geminiService | ArchivePhase | Analyze clip visual metadata |
| `/api/analyze-document` | POST | direct fetch | ArchivePhase | CSV timeline events analysis |
| `/api/chat` | POST | direct fetch | ArchivePhase | Video file metadata extraction |

### Interviews & Experts

| Endpoint | Method | Service | Consumer | Purpose |
|---|---|---|---|---|
| `/api/interview-plan` | POST | apiService / geminiService | ExpertInterviewPhase | Generate interview plan with questions |
| `/api/find-experts` | POST | apiService / geminiService | ExpertInterviewPhase | Expert discovery with Google Search grounding |

### Chat

| Endpoint | Method | Service | Consumer | Purpose |
|---|---|---|---|---|
| `/api/chat` | POST | apiService / geminiService | ProducerChat, ScriptingPhase, ExpertInterviewPhase | General chat with history and system instruction |

### User Profiles

| Endpoint | Method | Service | Consumer | Purpose |
|---|---|---|---|---|
| `/api/users` | GET | apiService | LoginScreen | List all user profiles |
| `/api/users/{userId}` | PUT | apiService | ProfileSettings | Update a user profile |
| `/api/users/seed` | POST | apiService | LoginScreen | Seed initial users (idempotent) |

### GCP Resource Management

| Endpoint | Method | Service | Consumer | Purpose |
|---|---|---|---|---|
| `/api/gcs/buckets` | GET | gcpService | CloudServices | List GCS buckets |
| `/api/vertex/models` | GET | gcpService | CloudServices | List Vertex AI models |
| `/api/vertex/deploy` | POST | gcpService | CloudServices | Deploy a model version |
| `/api/gcs/purge-cache` | POST | gcpService | CloudServices | Purge CDN cache |

### External (not via Flask middleware)

| Endpoint | Method | Service | Consumer | Purpose |
|---|---|---|---|---|
| `elevenlabs.io/v1/voices` | GET | elevenLabsService | VoiceOverPhase | Fetch voice library |
| `elevenlabs.io/v1/text-to-speech/{voiceId}` | POST | elevenLabsService | VoiceOverPhase | Generate audio from text |

---

## Components with No API Calls

| Component | Notes |
|---|---|
| AssemblyPhase | Local timeline manipulation only |
| ReviewPhase | Local state management only |
| Dashboard | Local project state only |

---

## Notes

- Two direct `fetch()` calls in **ArchivePhase.tsx** bypass the service layer (lines ~176 and ~217). These should ideally go through `apiService`.
- `geminiService.ts` has its own `apiCall<T>()` wrapper but functionally duplicates `apiService`. Both are in use across components.
- ElevenLabs is the only external API called directly from the browser. All other AI/GCP calls go through Flask.
