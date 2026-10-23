# CoachLog backend

REST API for CoachLog: coaches, students, training plans, workout logs, session
packages and their transaction ledger.

Spring Boot 4 · Java 17 · Spring Security (JWT, HS256) · **Cloud Firestore** (Firebase emulator locally)

## Run locally

Requirements: Java 17+ for the app, plus [firebase-tools](https://firebase.google.com/docs/cli) and a
**Java 21+** runtime for the Firestore emulator (`brew install openjdk@21`).

```bash
cd backend
./scripts/dev.sh        # Firestore emulator (data kept in ./data/firestore) + API on http://localhost:8080/api
./scripts/test.sh       # test suite against a throwaway emulator
```

Or run the pieces yourself:

```bash
firebase emulators:start --only firestore --project demo-coachlog   # emulator on 127.0.0.1:8085, UI on :4000
./mvnw spring-boot:run                                              # "dev" profile → emulator + demo mode
```

Then point the frontend at it:

```bash
cd frontend
echo "VITE_API_URL=http://localhost:8080/api" > .env.local
npm run dev             # http://localhost:5173 → "示範" tab → 以示範教練登入
```

The first demo sign-in imports the frontend's demo dataset (11 students, about
300 workouts). Every demo account's password is `demo1234`. Browse the data at
http://localhost:4000/firestore.

## Firestore layout

```
users/{userId}          login identity: role, passwordHash (bcrypt), coachId (= workspace), active
emails/{email}          {userId} — guarantees unique email (written in the same transaction)
invites/{code}          one-time invite for a student or a studio coach (14 days)
exercises/{id}          shared catalog, seeded on startup
coaches/{coachId}       workspace (kind: solo / studio / self, maxCoaches); everything in it is a subcollection:
  students/  plans/  workouts/  packages/  transactions/  metrics/  appointments/
  ledgers/{studentId}   lock token for ledger writes (not a balance)
```

- Roles: `coach` (a free coach, or a coach in a studio), `owner` (runs a studio and also teaches),
  `student` (invited by a coach) and `self` (a self-tracker with no coach).
- A **workspace** is `coaches/{id}`. A free coach's has their own ID; a studio's has its owner's
  ID, so a free coach upgrades to a studio in place. A self-tracker gets a one-person workspace
  holding a single `students/{id}` with the same ID.
- **Studios**: the owner invites coaches (`maxCoaches` seats, owner included, default 3). Coaches
  join with an invite code, never by signing up. Students belong to the studio:
  `students/{id}.assignedCoachId` is the coach who teaches them (absent = the owner), so the owner
  can hand a student, with all their history, to another coach. Studio coaches see only their own
  students (plans are shared); the owner sees everything. A deactivated coach's token stops
  working on the next request.
- Plans embed their days and prescriptions; workouts embed exercises and sets.
- Timestamps are native Firestore Timestamps.
- Queries filter by a single field and sort in memory, so **no composite indexes** are needed.
- `firestore.rules` **denies all client access**. Only this backend, which uses
  server credentials and bypasses rules, may read or write. Browsers never talk
  to Firestore directly.

## Deploying (Firebase / Google Cloud)

1. Create a Firebase project and enable Firestore (Native mode).
2. Deploy the deny-all rules: `firebase deploy --only firestore:rules --project <id>`.
3. Deploy the API to **Cloud Run** (`./mvnw spring-boot:build-image` or a Dockerfile).
   Use a service account with `roles/datastore.user`. Credentials are picked up
   automatically, so no key file is needed.
4. Set env vars on Cloud Run:
   - `GOOGLE_CLOUD_PROJECT=<id>`
   - `COACHLOG_JWT_SECRET` (at least 32 random bytes)
   - `COACHLOG_CORS_ORIGINS=https://<your-hosting-domain>`
   - Leave `COACHLOG_DEMO_ENABLED` unset (off).
   - `COACHLOG_APP_URL` / `COACHLOG_API_URL`: the public app URL and API URL (NewebPay sends people and results back there).
   - `GOOGLE_CLIENT_ID` for Google sign-in, and the `NEWEBPAY_*` shop keys for payments (see below).
5. Host the frontend on **Firebase Hosting**, built with `VITE_API_URL` set to the
   API URL. Alternatively, add a Hosting rewrite `/api/** → Cloud Run service` so
   the app and the API share one origin.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8080` | |
| `GOOGLE_CLOUD_PROJECT` | `demo-coachlog` | Firebase / GCP project ID |
| `FIRESTORE_DATABASE_ID` | `(default)` | |
| `FIRESTORE_EMULATOR_HOST` | unset (`127.0.0.1:8085` in the dev profile) | When set, the app uses the emulator |
| `COACHLOG_JWT_SECRET` | dev-only value | **Must be set in production** (≥ 32 bytes) |
| `COACHLOG_JWT_TTL_HOURS` | `168` | Token lifetime |
| `COACHLOG_CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Comma-separated frontend origins |
| `COACHLOG_DEMO_ENABLED` | `false` (`true` in the dev profile) | Enables `/api/demo/*` |
| `COACHLOG_DEMO_PASSWORD` | `demo1234` | Password given to imported demo accounts |

| `COACHLOG_APP_URL` | `http://localhost:5173` | Frontend origin; NewebPay returns the browser to `/coach/billing` there |
| `COACHLOG_API_URL` | `http://localhost:8080/api` | Public API base; NewebPay posts results to `/billing/newebpay/*` |
| `GOOGLE_CLIENT_ID` | unset (Google sign-in off) | OAuth client ID (Web application); the frontend's `VITE_GOOGLE_CLIENT_ID` must match |
| `NEWEBPAY_MERCHANT_ID` / `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV` | unset (payments off) | NewebPay shop credentials (HashKey 32 chars, HashIV 16) |
| `NEWEBPAY_BASE_URL` | `https://ccore.newebpay.com` (sandbox) | `https://core.newebpay.com` for live payments |

> `/api/demo/import` is unauthenticated and **wipes all coach and user data**.
> It is off by default. Only the local `dev` profile turns it on.

## Subscriptions

Coaching workspaces pay monthly; self-trackers and students are free. The plan follows the workspace:
a free coach is on **Pro** (NT$399, 30 active students), a studio on **Team** (NT$999, 3 coaches,
100 active students). Add-ons: +NT$99 per 10 students, +NT$199 per extra Team coach.

- **Trial**: 10 days from sign-up, no card. When the trial or a paid period lapses (3 days' grace
  after a missed renewal), the workspace turns **read-only**: every write returns
  `402 subscription_required` (`billing/WriteGuard`), reads keep working, nothing is deleted.
- **Limits**: only `active` students count; every active or invited coach takes a seat. Going over
  never deletes anything; adding students/coaches returns `409 student_limit` / `seats_full`.
- **NewebPay**: subscribing creates a monthly credit-card mandate (定期定額), first month charged
  at once. Each renewal arrives at `/api/billing/newebpay/period-notify` and extends the period.
  Upgrades (more seats, Pro → Team) are on immediately after a one-time MPG payment of the
  prorated difference; the mandate's amount is then changed for the next period (`AlterAmt`).
  Downgrades are scheduled for the next renewal. Cancelling terminates the mandate; the workspace
  stays writable until the period ends. Callbacks are idempotent and authenticated by decrypting
  with the shop's HashKey/HashIV.
- **Before going live**: run the whole flow on NewebPay's sandbox. The field names and API
  versions in `billing/NewebPay.java` follow the 定期定額 / MPG specs and must be checked against the
  spec versions issued with your merchant account. **E-invoices (電子發票) are not issued yet.**

## Business rules enforced server-side

- **Balances are never stored.** Each package's remaining sessions are
  `totalSessions + Σ adjustments − (deductions − reversals)`, computed from the
  append-only `session_transactions` ledger.
- **Saving a workout never bills.** A deduction is a separate request
  (`POST /workouts/{id}/deduction`). It works only on `coached` + `completed`
  workouts, only once (until reversed), and draws from the oldest package that
  still has sessions.
- **Independent (student) workouts can never be deducted.**
- **No balance can go negative.** This covers adjustments and deductions, and
  a package's total can't be edited below what has already been used.
- **History is append-only.** Undoing a deduction adds a `reversal` row, and a
  deducted workout can't be deleted.
- **Concurrent ledger writes are serialized** with Firestore transactions. Each
  one reads and bumps the student's `ledgers/{studentId}` token, and each
  deduction also touches the workout. Verified on the emulator:
  - 5 parallel deductions on one workout: one `201`, four `409`.
  - Two different workouts racing for the last remaining session: one `201`,
    one `409 no_balance`, and the balance stays at 0.
- **Row-level access.** Everything lives under the coach's own document, and a
  coach only sees their own students. A student only
  sees their own records and assigned plan, never the coach's private notes,
  and may only create or edit their own independent workouts. Other users'
  IDs return `404` so their existence isn't revealed.

## API

All routes are under `/api`, return JSON, and except auth/health/demo need
`Authorization: Bearer <token>`. Errors are `{status, code, message}`, with
`message` in zh-TW ready to show to users. IDs may be supplied by the client
(`prefix_xxxx`), so offline-created records keep stable IDs.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Coach sign-up → token |
| POST | `/auth/register-self` | public | Self-tracker sign-up (no coach) → token |
| POST | `/auth/register-studio` | public | Studio owner sign-up → token |
| POST | `/auth/login` | public | Email + password → token |
| POST | `/auth/activate` | public | Student or studio coach sets password with invite code → token |
| POST | `/studio/upgrade` | free coach | Become a studio owner in place → new token |
| POST | `/studio/coaches` | owner | Invite a coach (uses a seat) → invite code |
| POST | `/studio/coaches/{id}/invite` | owner | New code for a coach who has not activated |
| POST | `/studio/coaches/{id}/deactivate` | owner | `{transferTo}` takes their students; frees the seat |
| PUT | `/students/{id}/coach` | owner | Hand a student to another active coach |
| GET | `/auth/me` | any | Current user |
| GET | `/bootstrap` | any | Everything the caller may see (frontend `AppData` shape) |
| GET | `/exercises` | any | Exercise catalog |
| GET/POST | `/students` | coach | List / create |
| GET/PUT/DELETE | `/students/{id}` | coach (GET: self too) | Read / replace / delete (cascades) |
| POST | `/students/{id}/invite` | coach | One-time invite code (14 days) |
| GET | `/students/{id}/balance` | coach, self | Derived balance per package |
| GET/POST | `/students/{id}/packages` | coach (GET: self too) | Session packages |
| GET | `/students/{id}/transactions` | coach, self | Ledger |
| GET/POST | `/students/{id}/metrics` | coach, self | Bodyweight etc. |
| PUT/DELETE | `/packages/{id}` | coach | Edit / delete (only if no history) |
| POST | `/packages/{id}/adjustments` | coach | Manual ± with reason |
| GET/POST | `/plans` | coach (GET: student sees assigned plan) | List / create |
| GET/PUT/DELETE | `/plans/{id}` | coach | Read / create-or-replace / delete |
| POST | `/plans/{id}/duplicate` | coach | Copy with new IDs |
| PUT | `/plans/{id}/assignments` | coach | Set exactly these students on the plan |
| GET | `/workouts?studentId=` | coach, self | List |
| GET/PUT/DELETE | `/workouts/{id}` | coach; student for own independent | Read / create-or-replace (drafts autosave) / delete |
| POST | `/workouts/{id}/deduction` | coach | Deduct one session |
| POST | `/workouts/{id}/deduction/reversal` | coach | Undo with reason |
| GET/POST/PUT/DELETE | `/appointments[/{id}]` | coach (GET: student sees own) | Schedule |
| GET | `/health` | public | Liveness |
| GET | `/demo/status`, POST `/demo/import`, POST `/demo/login` | public, demo only | Demo data and one-click login |

## Layout

```
src/main/java/com/example/backend/
  auth/      JWT issuing/verification, SecurityConfig, AuthService, CurrentUser resolver
  common/    ApiException + global error handler, ID rules, allowed domain values
  domain/    Firestore document classes (one per collection)
  store/     Firestore client config, document codec, Db helpers (paths, transactions), exercise catalog
  service/   Business logic: Ledger (balance derivation), Billing, Workouts, Plans, Students, Bootstrap
  web/       REST controllers + DTOs (wire format mirrors frontend/src/types)
  demo/      Demo import / login (disabled unless COACHLOG_DEMO_ENABLED=true)
firebase.json, firestore.rules, firestore.indexes.json   Firebase project config (emulator, deny-all rules)
scripts/dev.sh, scripts/test.sh                          Emulator-wrapped dev server and tests
```
