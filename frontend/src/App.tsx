import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { ScrollToTop } from './components/layout/ScrollToTop'
import { DemoPage, LoginPage } from './pages/Login'
import { NotFoundPage } from './pages/NotFound'
import { HomePage } from './pages/public/Home'
import { useData, useSession } from './store/contexts'
import { billingPath } from './lib/billing'
import { homePath, isCoachRole } from './lib/roles'

const CoachAnalyticsPage = lazy(() => import('./pages/coach/Analytics').then((m) => ({ default: m.CoachAnalyticsPage })))
const CoachDashboardPage = lazy(() => import('./pages/coach/Dashboard').then((m) => ({ default: m.CoachDashboardPage })))
const PlanEditorPage = lazy(() => import('./pages/coach/PlanEditor').then((m) => ({ default: m.PlanEditorPage })))
const PlansPage = lazy(() => import('./pages/coach/Plans').then((m) => ({ default: m.PlansPage })))
const StudentDetailPage = lazy(() => import('./pages/coach/StudentDetail').then((m) => ({ default: m.StudentDetailPage })))
const StudentsPage = lazy(() => import('./pages/coach/Students').then((m) => ({ default: m.StudentsPage })))
const CoachDetailPage = lazy(() => import('./pages/coach/CoachDetail').then((m) => ({ default: m.CoachDetailPage })))
const BillingPage = lazy(() => import('./pages/coach/Billing').then((m) => ({ default: m.BillingPage })))
const StudioPage = lazy(() => import('./pages/coach/Studio').then((m) => ({ default: m.StudioPage })))
const CoachSchedulePage = lazy(() => import('./pages/coach/Schedule').then((m) => ({ default: m.CoachSchedulePage })))
const CoachWorkoutLoggerPage = lazy(() => import('./pages/coach/WorkoutLogger').then((m) => ({ default: m.CoachWorkoutLoggerPage })))
const StudentDashboardPage = lazy(() => import('./pages/student/Dashboard').then((m) => ({ default: m.StudentDashboardPage })))
const StudentHistoryPage = lazy(() => import('./pages/student/History').then((m) => ({ default: m.StudentHistoryPage })))
const StudentPlanPage = lazy(() => import('./pages/student/Plan').then((m) => ({ default: m.StudentPlanPage })))
const StudentProgressPage = lazy(() => import('./pages/student/Progress').then((m) => ({ default: m.StudentProgressPage })))
const PrivacyPage = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.TermsPage })))
const StudentWorkoutPage = lazy(() => import('./pages/student/Workout').then((m) => ({ default: m.StudentWorkoutPage })))

function RequireRole({ role, children }: { role: 'coach' | 'student'; children: ReactNode }) {
  const { session } = useSession()
  const { data } = useData()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // Self-trackers share the student area.
  if ((isCoachRole(session.role) ? 'coach' : 'student') !== role) return <Navigate to={homePath(session.role)} replace />
  if (role === 'student' && !data.students.some((s) => s.id === session.studentId)) {
    return <Navigate to="/login" replace state={{ missingStudent: true }} />
  }
  return <>{children}</>
}

/** Visitors see the public home page (what it is, prices, policies); signed-in users go to their app. */
function Home() {
  const { session } = useSession()
  if (!session) return <HomePage />
  return <Navigate to={homePath(session.role)} replace />
}

/** NewebPay sends everyone back to /billing; forward to the signed-in user's own billing page, keeping ?result. */
function BillingRedirect() {
  const { session } = useSession()
  const { search } = useLocation()
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={`${billingPath(session.role)}${search}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPage /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={null}><TermsPage /></Suspense>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route
          path="/coach"
          element={
            <RequireRole role="coach">
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<CoachDashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="workouts/new" element={<CoachWorkoutLoggerPage />} />
          <Route path="schedule" element={<CoachSchedulePage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="plans/:id" element={<PlanEditorPage />} />
          <Route path="analytics" element={<CoachAnalyticsPage />} />
          <Route path="studio" element={<StudioPage />} />
          <Route path="studio/coaches/:id" element={<CoachDetailPage />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>
        <Route
          path="/student"
          element={
            <RequireRole role="student">
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<StudentDashboardPage />} />
          <Route path="plan" element={<StudentPlanPage />} />
          <Route path="history" element={<StudentHistoryPage />} />
          <Route path="progress" element={<StudentProgressPage />} />
          <Route path="workouts/new" element={<StudentWorkoutPage />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>
        <Route path="/billing" element={<BillingRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
