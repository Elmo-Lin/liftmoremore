# Lift More More — frontend MVP

教練專心教學，學生看得見進步。

The web app for Lift More More, a coaching platform for independent personal trainers
in Taiwan. Two roles (coach / student), Traditional Chinese UI, TWD and kg.

It runs in two modes:

- **Offline demo** (default): fictional data stored in this browser's `localStorage`; no login.
- **Backend mode**: set `VITE_API_URL` to the Lift More More API (see `../backend`) to get
  real accounts (coach sign-up, email login, student invite codes), with data stored on the server.

## Run locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck (tsc) + production build to dist/
npm run preview    # serve dist/
npm run lint
```

Open `/login` and pick **以教練身分繼續** or **以學員身分繼續**. Switch roles any
time from the sidebar (desktop) or the top-right chip (mobile); the same dialog
has **重設示範資料** to regenerate the demo data.

### Backend mode

```bash
cp .env.example .env.local      # VITE_API_URL=http://localhost:8080/api
npm run dev
```

The login page then offers 示範 (one-click demo accounts), 登入, 註冊教練 and 邀請碼.
Coaches generate a student's invite code from the student page (**邀請登入**).

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · React Router 7 · Recharts 3 · lucide-react

## Structure

```
src/
  config/brand.ts        product name, tagline, storage prefix (rename here)
  types/                 domain model (User, Coach, Student, TrainingPlan, WorkoutSession, SessionPackage, SessionTransaction, …)
  data/                  exercise catalog + seeded mock-data generator (kept out of UI)
  lib/                   pure logic: sessions.ts (balance derivation), stats.ts (volume, PRs, e1RM), format.ts
  store/                 actions.ts (all mutations + validation), Providers.tsx (store, session, toasts, backend sync queue)
  api/                   client.ts (fetch + errors), sync.ts (action → REST call), auth.ts (login, invite, demo)
  components/            ui primitives, layout, workout logger, progress charts, coach panels
  pages/coach, pages/student
```

## Key rules

- **Balances are derived, never stored:** `remaining = totalSessions + Σ transaction.delta`
  per package. Deductions use the oldest package with sessions left.
- **Logging ≠ billing.** Finishing a coached workout saves it, then *asks* whether
  to deduct one session. Deduction can also be done or reversed later from the
  workout record. Reversals add a `reversal` transaction, so history is never edited.
- **Independent (student) workouts can never be deducted**; `deductSession` rejects them.
- Balances can't go negative; manual adjustments require a reason.
- Coach-authored plans are read-only for students. Coach notes are never shown to students.
- Analytics plot the **actual** heaviest completed set. Estimated 1RM (Epley,
  ≤10 reps) is opt-in and always labeled as an estimate.

## How backend sync works

`store/actions.ts` stays the single mutation surface. In backend mode:

1. The local action runs first (instant UI, same validation as the server).
2. `api/sync.ts` maps it to the matching REST call. IDs are generated on the
   client and accepted by the server, so local and server state match.
3. Calls run through a serial queue. If the server rejects one, its zh-TW error
   is shown and all data is re-downloaded from `GET /api/bootstrap`.

On sign-in, the app downloads `/api/bootstrap`, which already holds only what
that user may see.
