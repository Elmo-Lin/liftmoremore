import {
  ChartLine,
  ClipboardList,
  Dumbbell,
  History,
  House,
  LayoutDashboard,
  ListChecks,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { BRAND } from '../../config/brand'
import { useSession } from '../../store/contexts'
import { PageLoading } from '../ui/PageLoading'
import { RoleSwitcher } from './RoleSwitcher'

interface NavItem {
  to: string
  label: string
  short?: string
  icon: LucideIcon
  end?: boolean
  primary?: boolean
}

const COACH_NAV: NavItem[] = [
  { to: '/coach', label: '總覽', icon: LayoutDashboard, end: true },
  { to: '/coach/students', label: '學員', icon: Users },
  { to: '/coach/workouts/new', label: '記錄訓練', short: '記錄', icon: Dumbbell, primary: true },
  { to: '/coach/plans', label: '訓練課表', short: '課表', icon: ClipboardList },
  { to: '/coach/analytics', label: '數據分析', short: '數據', icon: ChartLine },
]

const STUDENT_NAV: NavItem[] = [
  { to: '/student', label: '首頁', icon: House, end: true },
  { to: '/student/plan', label: '我的課表', short: '課表', icon: ListChecks },
  { to: '/student/workouts/new', label: '自主訓練', short: '訓練', icon: Dumbbell, primary: true },
  { to: '/student/history', label: '訓練紀錄', short: '紀錄', icon: History },
  { to: '/student/progress', label: '進步追蹤', short: '進步', icon: TrendingUp },
]

const SELF_NAV: NavItem[] = [
  { to: '/student', label: '首頁', icon: House, end: true },
  { to: '/student/workouts/new', label: '記錄訓練', short: '訓練', icon: Dumbbell, primary: true },
  { to: '/student/history', label: '訓練紀錄', short: '紀錄', icon: History },
  { to: '/student/progress', label: '進步追蹤', short: '進步', icon: TrendingUp },
]

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-flex size-7 items-center justify-center rounded-[7px] bg-accent-600">
        <svg viewBox="0 0 32 32" className="size-[18px]" aria-hidden>
          <path d="M9 20.5v-9M23 20.5v-9M6.5 14v4M25.5 14v4M9 16h14" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink-900">{BRAND.name}</span>
    </span>
  )
}

export function AppShell() {
  const { session } = useSession()
  const nav = session?.role === 'self' ? SELF_NAV : session?.role === 'student' ? STUDENT_NAV : COACH_NAV

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-[#f7f7f9] px-3 py-5 md:flex">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="主要導覽">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors ${
                  isActive ? 'bg-black/[0.07] font-medium text-ink-900' : 'text-ink-800 hover:bg-black/[0.04]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="size-4 text-accent-600" strokeWidth={isActive ? 2.25 : 2} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <RoleSwitcher placement="sidebar" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="material sticky top-0 z-30 flex h-12 items-center justify-between border-b border-black/10 px-4 md:hidden">
          <Logo />
          <RoleSwitcher placement="topbar" />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-12">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="主要導覽"
        className={`material fixed inset-x-0 bottom-0 z-40 grid ${nav.length === 4 ? 'grid-cols-4' : 'grid-cols-5'} border-t border-black/10 pb-[env(safe-area-inset-bottom)] md:hidden`}
      >
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex h-[50px] flex-col items-center justify-center gap-0 text-[10px] font-medium ${isActive ? 'text-accent-600' : 'text-ink-400'}`
            }
          >
            {({ isActive }) =>
              <>
                <span className="inline-flex h-7 items-center">
                  <item.icon className="size-6" strokeWidth={isActive ? 2.1 : 1.75} />
                </span>
                {item.short ?? item.label}
              </>
            }
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
