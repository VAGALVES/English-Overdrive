# English Overdrive — System Design v1

## 1. Product objective
A mobile-first PWA that optimizes **TOEIC performance** and **professional English readiness** simultaneously. The current local-first MVP must be able to evolve into an authenticated adaptive-learning platform without a frontend rewrite.

## 2. Architecture evolution

### Phase A — current
```text
Browser / Installed PWA
  ├─ UI + Design System (HTML/CSS)
  ├─ Application logic (app.js)
  ├─ Learning state (localStorage)
  ├─ Manifest
  └─ Service Worker / offline app shell

GitHub → Netlify CDN + HTTPS
```
No build step, intentionally optimized for phone-based GitHub uploads.

### Phase B — modular client
Split logic into ES modules: state, router, theme, diagnostic, TOEIC, errors, speaking, prescription and storage. Files may remain at repository root while mobile upload simplicity is a priority.

### Phase C — cloud/adaptive
```text
PWA Client
  ├─ Auth
  ├─ Sync API
  ├─ Exercise API
  ├─ Adaptive Engine API
  └─ Speech/AI Gateway
          ↓
   Protected serverless/API layer
      ├─ Database
      ├─ Audio/object storage
      └─ AI/speech providers
```
Private keys must never exist in frontend files or GitHub.

## 3. Logical domains
### English Digital Twin
Listening, Reading, Speaking, Writing, Grammar, passive/active Vocabulary, Response Latency, Business English, Pronunciation and TOEIC Part 1–7 performance.

### Diagnostic Engine
Measure correctness **and response time**, generate skill baselines and confidence levels.

### TOEIC Engine
Item selection, section timers, response capture, explanations, difficulty, part-level analytics and score estimation.

### Error Engine
Wrong answers become structured events: skill, error category, context, prompt, chosen/expected response, timestamp, response time, review count and mastery.

### Prescription Engine
Rank training priorities with a model such as:
```text
priority = weakness × examImpact × workImpact × forgettingRisk × confidenceGap
```
Then allocate the learner's daily minutes with mandatory exposure constraints.

### Speaking / Fluency Engine
```text
Prompt → microphone → audio → speech-to-text → latency → fluency/pronunciation → task evaluation → feedback → error events
```

### Shanghai Work
Meetings, interviews, presentations, negotiation and conflict. Difficulty scales with speed, vocabulary, accents, interruptions and ambiguity.

## 4. Data model
Recommended entities: `User`, `UserPreferences`, `SkillSnapshot`, `Exercise`, `ExerciseAttempt`, `ErrorEvent`, `VocabularyItem`, `ReviewSchedule`, `SpeakingAttempt`, `ScenarioAttempt`, `DailyPrescription`, `ToeicSimulation` and `Achievement`.

**Architecture rule:** learning attempts are append-only source events. Scores/snapshots are derived aggregates. This preserves history and lets future models improve without losing source data.

## 5. Local-first + sync
Move from `localStorage` to IndexedDB before large history/audio arrives. Future attempts get UUIDs, are written locally immediately, queued while offline, de-duplicated server-side, and reconciled with the latest learner snapshot.

## 6. Security/privacy
- HTTPS only.
- No private secrets in frontend code.
- AI/speech calls through protected backend functions.
- Microphone permission only at speaking-task time.
- Explicit audio retention policy.
- Avoid long-lived auth secrets in localStorage.
- Sanitize user-generated content before HTML rendering.

## 7. PWA cache strategy
- App shell: versioned cache-first.
- Exercise metadata: stale-while-revalidate.
- User attempts: network/sync queue.
- Audio: explicit bounded cache.
- Navigation: network-first with cached shell fallback.

Change cache version on every shell release.

## 8. Performance budgets
- App shell target <250 KB excluding media.
- No required remote fonts.
- Local UI actions target <100 ms.
- Offline-capable after first successful load.
- Minimum 44px mobile touch target.

## 9. Product observability
Track improvement, not just engagement: diagnostic delta, error recurrence, mastery velocity, TOEIC estimate vs mock exam, response latency trend, speaking minutes, prescription completion, offline sync failures and service-worker adoption.

## 10. Release roadmap
- **v0.1.x:** PWA + local state + responsive professional design + themes + prototype engines.
- **v0.2:** Diagnostic Engine + English Digital Twin v1 + adaptive prescription.
- **v0.3:** TOEIC Parts 1–7 structure, timers, larger item schema and analytics.
- **v0.4:** microphone, speech recognition, automatic latency, shadowing.
- **v0.5:** auth, cloud database, device sync, secure AI gateway.
- **v1.0:** full diagnostic, mocks, spaced review, speech feedback, Shanghai Work simulator and longitudinal analytics.

## 11. Architecture decisions
- **ADR-001:** PWA first.
- **ADR-002:** flat repository during early development for mobile GitHub workflow.
- **ADR-003:** local-first MVP.
- **ADR-004:** no frontend secrets.
- **ADR-005:** event-based learning history.
- **ADR-006:** semantic design tokens for all themes/breakpoints.


## Thinking Toolkit & Response Coach

A camada de fluência passa a incluir uma biblioteca de **mental shortcuts**. O princípio é separar intenção cognitiva de formulação linguística: o usuário reconhece o tipo de movimento mental que deseja fazer e recupera uma estrutura inglesa pronta.

Fluxo:

`Intent → Mental shortcut → User idea → Spoken response → Performance event`

O Shanghai Work usa o mesmo banco para gerar coaching contextual por cenário, combinando um Response Blueprint com atalhos relevantes. No futuro, o Adaptive Engine deverá priorizar atalhos que o usuário ainda não consegue recuperar espontaneamente sob pressão.


## Vocabulary Lab v0.3.0
- Active Vocabulary: lexical items and collocations.
- Thinking Toolkit: mental shortcuts.
- Idea Frameworks: reusable chains of discourse and reasoning.
- Business Roles Glossary: semantic fields and collocations organized by relationship role.
All four layers share speech rate state and local-first mastery state.
