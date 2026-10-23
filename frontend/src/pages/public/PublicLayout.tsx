import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../../components/layout/AppShell'
import { ButtonLink } from '../../components/ui/Button'
import { BRAND, OPERATOR } from '../../config/brand'
import { TRIAL_DAYS } from '../../lib/billing'
import { useScrollTopIfCurrent } from '../../lib/scroll'

/** Header and footer of the public pages: home, privacy policy, terms. */
export function PublicLayout({ title, children }: { title?: string; children: ReactNode }) {
  const toTop = useScrollTopIfCurrent('/')
  useEffect(() => {
    document.title = title ? `${title}｜${BRAND.name}` : BRAND.name
    return () => {
      document.title = BRAND.name
    }
  }, [title])

  return (
    // The bar is fixed, not sticky, so it stays put during iOS rubber-band overscroll (like the app's bars);
    // the page pads its content by the bar's 3.5rem height.
    <div className="flex min-h-dvh flex-col bg-canvas pt-14">
      <header className="material fixed inset-x-0 top-0 z-30 border-b border-black/10">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-8">
          <Link to="/" onClick={toTop} aria-label={`${BRAND.name} 首頁`} className="-m-1 rounded-lg p-1">
            <Logo />
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="網站導覽">
            <a href="/#features" className="hidden rounded-md px-3 py-1.5 text-ink-700 hover:bg-black/4 sm:block">
              功能
            </a>
            <a href="/#pricing" className="rounded-md px-3 py-1.5 text-ink-700 hover:bg-black/4">
              價格
            </a>
            <Link to="/login" className="rounded-md px-3 py-1.5 text-ink-700 hover:bg-black/4">
              登入
            </Link>
            {/* Phones: the hero's button is enough, and the bar has no room for it. */}
            <span className="ml-1 hidden sm:block">
              <ButtonLink to="/login?tab=register" size="sm">
                免費試用 {TRIAL_DAYS} 天
              </ButtonLink>
            </span>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Page-coloured, so pulling past the bottom on iOS reveals the same colour instead of a strip. */}
      <footer className="border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm md:grid-cols-[1fr_auto] md:px-8">
          <div className="space-y-1.5 text-ink-500">
            <Logo />
            <p className="pt-2">經營者：{OPERATOR.name}</p>
            <p>
              聯絡我們：
              <a href={`mailto:${OPERATOR.email}`} className="text-accent-700 hover:underline">
                {OPERATOR.email}
              </a>
            </p>
            <p>
              © {new Date().getFullYear()} {BRAND.name}
            </p>
          </div>
          <nav className="flex flex-wrap content-start gap-x-5 gap-y-2" aria-label="條款與政策">
            <Link to="/#pricing" className="text-ink-700 hover:underline">
              價格方案
            </Link>
            <Link to="/terms" className="text-ink-700 hover:underline">
              服務條款
            </Link>
            <Link to="/terms#refund" className="text-ink-700 hover:underline">
              退款政策
            </Link>
            <Link to="/privacy" className="text-ink-700 hover:underline">
              隱私權政策
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
