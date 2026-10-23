import {
  Building2,
  CalendarDays,
  ChartLine,
  ClipboardList,
  Dumbbell,
  History,
  House,
  LayoutDashboard,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { BRAND } from '../../config/brand'
import { useData, useSession } from '../../store/contexts'
import { selectIsStudio } from '../../store/selectors'
import { PageLoading } from '../ui/PageLoading'
import { RoleSwitcher } from './RoleSwitcher'

interface NavItem {
  to: string
  label: string
  short?: string
  icon: LucideIcon
  end?: boolean
  primary?: boolean
  /** Sidebar only: the phone tab bar holds at most 5 items. */
  desktopOnly?: boolean
}

const COACH_NAV: NavItem[] = [
  { to: '/coach', label: '總覽', icon: LayoutDashboard, end: true },
  { to: '/coach/students', label: '學員', icon: Users },
  { to: '/coach/workouts/new', label: '記錄訓練', short: '記錄', icon: Dumbbell, primary: true },
  { to: '/coach/schedule', label: '課表', icon: CalendarDays },
  { to: '/coach/plans', label: '訓練計畫', short: '計畫', icon: ClipboardList },
  // On phones: from a student's 進步 tab.
  { to: '/coach/analytics', label: '數據分析', short: '數據', icon: ChartLine, desktopOnly: true },
]

/** Owners manage their studio here; free coaches can upgrade from it. Phones reach it from the account menu. */
const STUDIO_ITEM: NavItem = { to: '/coach/studio', label: '工作室', icon: Building2, desktopOnly: true }

const STUDENT_NAV: NavItem[] = [
  { to: '/student', label: '首頁', icon: House, end: true },
  { to: '/student/plan', label: '我的課表', short: '課表', icon: CalendarDays },
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

/** Whether the page has scrolled away from the top (drives the top bar's scroll-edge appearance). */
function useScrolled() {
  const [scrolled, setScrolled] = useState(() => window.scrollY > 0)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return scrolled
}

export function AppShell() {
  const scrolled = useScrolled()
  const { session } = useSession()
  const { data } = useData()
  const showStudio = session?.role === 'owner' || (session?.role === 'coach' && !selectIsStudio(data))
  const nav = session?.role === 'self' ? SELF_NAV : session?.role === 'student' ? STUDENT_NAV : showStudio ? [...COACH_NAV, STUDIO_ITEM] : COACH_NAV
  const tabBar = nav.filter((item) => !item.desktopOnly)

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
        {/* Mobile top bar. Fixed (not sticky) so it stays put during iOS rubber-band overscroll, like a
            native nav bar. Scroll-edge style: page-coloured at the top (blending into the status bar,
            which shows the page background in the installed app), material + hairline once content
            scrolls underneath. */}
        <header
          data-topbar
          className={`fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b px-4 transition-[background-color,border-color] duration-200 md:hidden ${
            scrolled ? 'material border-black/10' : 'border-transparent bg-canvas'
          }`}
        >
          <Logo />
          <RoleSwitcher placement="topbar" />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-[calc(3rem+1.25rem)] pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-12">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        data-tabbar
        aria-label="主要導覽"
        className={`material fixed inset-x-0 bottom-0 z-40 grid ${tabBar.length === 4 ? 'grid-cols-4' : 'grid-cols-5'} border-t border-black/10 pb-[env(safe-area-inset-bottom)] md:hidden`}
      >
        {tabBar.map((item) => (
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
