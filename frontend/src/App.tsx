import { lazy, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { ScrollToTop } from './components/layout/ScrollToTop'
import { LoginPage } from './pages/Login'
import { NotFoundPage } from './pages/NotFound'
import { useData, useSession } from './store/contexts'
import type { Role } from './types'

const CoachAnalyticsPage = lazy(() => import('./pages/coach/Analytics').then((m) => ({ default: m.CoachAnalyticsPage })))
const CoachDashboardPage = lazy(() => import('./pages/coach/Dashboard').then((m) => ({ default: m.CoachDashboardPage })))
const PlanEditorPage = lazy(() => import('./pages/coach/PlanEditor').then((m) => ({ default: m.PlanEditorPage })))
const PlansPage = lazy(() => import('./pages/coach/Plans').then((m) => ({ default: m.PlansPage })))
const StudentDetailPage = lazy(() => import('./pages/coach/StudentDetail').then((m) => ({ default: m.StudentDetailPage })))
const StudentsPage = lazy(() => import('./pages/coach/Students').then((m) => ({ default: m.StudentsPage })))
const CoachWorkoutLoggerPage = lazy(() => import('./pages/coach/WorkoutLogger').then((m) => ({ default: m.CoachWorkoutLoggerPage })))
const StudentDashboardPage = lazy(() => import('./pages/student/Dashboard').then((m) => ({ default: m.StudentDashboardPage })))
const StudentHistoryPage = lazy(() => import('./pages/student/History').then((m) => ({ default: m.StudentHistoryPage })))
const StudentPlanPage = lazy(() => import('./pages/student/Plan').then((m) => ({ default: m.StudentPlanPage })))
const StudentProgressPage = lazy(() => import('./pages/student/Progress').then((m) => ({ default: m.StudentProgressPage })))
const StudentWorkoutPage = lazy(() => import('./pages/student/Workout').then((m) => ({ default: m.StudentWorkoutPage })))

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session } = useSession()
  const { data } = useData()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (session.role !== role) return <Navigate to={session.role === 'coach' ? '/coach' : '/student'} replace />
  if (role === 'student' && !data.students.some((s) => s.id === session.studentId)) {
    return <Navigate to="/login" replace state={{ missingStudent: true }} />
  }
  return <>{children}</>
}

function HomeRedirect() {
  const { session } = useSession()
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={session.role === 'coach' ? '/coach' : '/student'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
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
          <Route path="plans" element={<PlansPage />} />
          <Route path="plans/:id" element={<PlanEditorPage />} />
          <Route path="analytics" element={<CoachAnalyticsPage />} />
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
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
