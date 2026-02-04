# Carbon Neutral Cafe Web App - Brief

## Purpose
- Evaluate whether local cafes practice carbon-neutral behaviors
- Provide a map service to view nearby cafes and classify them by carbon-neutral keywords

## Target Users
- Local residents who want to find eco-friendly cafes
- Cafe owners or staff who want to self-check sustainability practices

## Core Features (MVP)
1) Survey-based assessment
   - Answer yes/no/unknown questions about cafe operations
   - Calculate a simple score/grade
   - Submit results to Firebase (Firestore)

2) Map search and selection
   - Search cafes via Kakao Places
   - Select a cafe to start the survey

3) Map overview
   - Display submitted cafes on the map
   - Filter or highlight cafes using carbon-neutral keywords (tags)

## Key Data Entities
- Cafe
  - name, address, location(lat/lng)
- SurveyResult
  - answers, answersBool, grade, createdAt
- Tags/Options
  - derived from survey answers (e.g., reusable cup discount, coffee ground reuse)

## User Flows (Happy Path)
1) Open app → Start survey
2) Input cafe info or choose from map
3) Answer questions → View grade
4) Submit results
5) View cafes on map with keyword-based filtering

## External Services
- Kakao Maps/Places SDK (search + map)
- Firebase Firestore (store survey results, reports)

## Environment Variables (Required)
- VITE_KAKAO_API_KEY
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_MEASUREMENT_ID

## Open Decisions / TODO
- Define final keyword taxonomy and mapping from survey answers
- Decide whether keyword filters should hide or only dim non-matching cafes
- Expand survey-to-tag logic beyond the current minimal set
