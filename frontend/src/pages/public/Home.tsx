import { CalendarDays, ChartLine, Check, ClipboardList, Dumbbell, ShieldCheck, Ticket, Users } from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
import { BRAND } from '../../config/brand'
import { BILLING_RULES, COACH_SEAT_PRICE, PLANS, STUDENT_PACK, TRIAL_DAYS } from '../../lib/billing'
import { twd } from '../../lib/format'
import { PublicLayout } from './PublicLayout'

const FEATURES = [
  { icon: Users, title: '學員管理', text: '學員資料、訓練目標與私人備註集中在一個地方，結案的學員也保留完整紀錄。' },
  { icon: ClipboardList, title: '訓練計畫', text: '編排課表與動作處方，一鍵指派給學員，學員在手機上就看得到。' },
  { icon: Dumbbell, title: '快速記錄訓練', text: '為手機設計，記錄一組只要幾次點擊，上課時不用分心。' },
  { icon: Ticket, title: '堂數清楚', text: '課程方案、扣堂與調整都留有紀錄，剩餘堂數隨時算得清清楚楚。' },
  { icon: ChartLine, title: '看得見進步', text: '重量、訓練量、頻率與體重變化一目了然，學員更有動力。' },
  { icon: CalendarDays, title: '課表行事曆', text: '一眼看到每週的上課安排，學員也能看到下一堂課。' },
]

const FAQ = [
  { q: '試用需要綁信用卡嗎？', a: `不需要。註冊後即可免費試用 ${TRIAL_DAYS} 天，試用期間功能完整。` },
  { q: '試用結束沒有訂閱會怎樣？', a: '資料都會保留，帳號轉為唯讀：可以查看，但無法新增或編輯。訂閱後立即恢復。' },
  { q: '怎麼付款？安全嗎？', a: '透過藍新金流以信用卡按月自動扣款。卡號在藍新金流的付款頁面輸入，本網站不會取得或保存你的完整卡號。' },
  { q: '可以隨時取消嗎？', a: '可以。在「方案與付款」頁面取消後不會再扣款，已付費的當期仍可使用到期末。' },
  { q: '可以退款嗎？', a: '已開始的計費週期原則上不退費；若有重複扣款或系統錯誤造成的溢收，會全額退還。詳見退款政策。' },
  { q: '學員需要付費嗎？', a: '不需要。學員帳號由教練邀請，免費使用；教練、工作室與自主訓練者需要訂閱。' },
]

/** Every section: a small label, a title and an optional line, the same everywhere. */
function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[13px] font-semibold tracking-wide text-accent-700">{eyebrow}</p>
      <h2 className="mt-1.5 text-[26px] font-semibold tracking-tight text-ink-900 md:text-[30px]">{title}</h2>
      {children && <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{children}</p>}
    </div>
  )
}

const CARD = 'rounded-2xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.05)]'

/** One grey page; sections are separated by space, not by bands and rules. */
export function HomePage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        {/* Hero: fills the first screen on desktop (text left, product preview right), so the next
            section never starts half-cut at the fold. */}
        <section className="grid items-center gap-12 pt-12 pb-4 md:pt-20 lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1.05fr_1fr] lg:py-12">
          <div>
            <h1 className="text-[36px] leading-tight font-semibold tracking-tight text-ink-900 md:text-[52px]">
              {BRAND.tagline[0]}
              <br />
              <span className="text-accent-700">{BRAND.tagline[1]}</span>
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-600 md:text-[17px]">
              無論你是一個人帶學員的自由教練、多位教練的健身工作室，還是沒有教練、自己練的人，都能在這裡管理學員與課表、快速記錄訓練，看見每一次的進步。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink to="/login?tab=register" size="lg">
                免費試用 {TRIAL_DAYS} 天
              </ButtonLink>
              <ButtonLink to="/login" size="lg" variant="secondary">
                登入
              </ButtonLink>
            </div>
            <p className="mt-3 text-[13px] text-ink-500">不需信用卡・可隨時取消</p>
          </div>
          <HeroPreview />
        </section>

        {/* Features */}
        <section id="features" className="mt-20 scroll-mt-20 md:mt-28 lg:mt-16">
          <SectionTitle eyebrow="功能" title="上課、記錄、追蹤，一個地方搞定" />
          <ul className={`${CARD} mt-8 grid gap-x-10 gap-y-8 p-6 sm:grid-cols-2 md:p-10 lg:grid-cols-3`}>
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                  <f.icon className="size-5" />
                </span>
                <p className="mt-3 font-semibold text-ink-900">{f.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-20 scroll-mt-20 md:mt-28">
          <SectionTitle eyebrow="價格" title="簡單透明的月費">
            所有方案皆可免費試用 {TRIAL_DAYS} 天，不需信用卡。價格為新台幣、按月計費，透過藍新金流信用卡自動扣款，可隨時取消。
          </SectionTitle>
          {/* Same card for every plan, cheapest first; the buttons line up at the bottom. */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <PlanCard
              name={PLANS.self.name}
              price={PLANS.self.price}
              who="沒有教練、自己練的人"
              includes={['記錄自己的訓練：動作、重量、次數', '重量、訓練量與體重的進步追蹤', '為手機設計，記錄一組只要幾次點擊']}
              addons={['無加購項目，一個人使用']}
            />
            <PlanCard
              name={PLANS.pro.name}
              price={PLANS.pro.price}
              who="一個人帶學員的自由教練"
              includes={[`包含 ${PLANS.pro.students} 位活躍學員`, '學員管理、訓練計畫、訓練紀錄、堂數管理、進步追蹤', '學員帳號免費']}
              addons={[`額外學員名額：每增加 ${STUDENT_PACK.size} 位 +${twd(STUDENT_PACK.price)} / 月`]}
            />
            <PlanCard
              name={PLANS.team.name}
              price={PLANS.team.price}
              who="多位教練的健身工作室"
              includes={[
                `包含 ${PLANS.team.coaches} 位教練（含經營者）、${PLANS.team.students} 位活躍學員`,
                '自由教練 Pro 的所有功能',
                '邀請教練、分配與轉移學員、共用訓練計畫',
              ]}
              addons={[`額外教練名額：每增加 1 位 +${twd(COACH_SEAT_PRICE)} / 月`, `額外學員名額：每增加 ${STUDENT_PACK.size} 位 +${twd(STUDENT_PACK.price)} / 月`]}
            />
          </div>
          <ul className="mt-8 grid gap-x-10 gap-y-2.5 text-[13px] leading-relaxed text-ink-600 md:grid-cols-2">
            {[...BILLING_RULES, '學員帳號由教練邀請，免費使用。'].map((r) => (
              <li key={r} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent-600" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-20 md:mt-28">
          <SectionTitle eyebrow="常見問題" title="使用前想知道的事" />
          <dl className={`${CARD} mt-8 grid gap-x-10 gap-y-7 p-6 md:grid-cols-2 md:p-10`}>
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-ink-900">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-600">{f.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-500">
            <ShieldCheck className="size-4 text-accent-600" />
            付款由藍新金流處理，本網站不保存信用卡號。
          </p>
        </section>

      </div>
    </PublicLayout>
  )
}

/**
 * A drawn (not screenshotted) glimpse of the app: today's workout, a progress chart and a session
 * balance, in the app's own card style. Decorative; desktop only.
 */
function HeroPreview() {
  const sets = [
    { kg: 80, reps: 5, done: true },
    { kg: 85, reps: 5, done: true },
    { kg: 87.5, reps: 5, done: false },
  ]
  const bars = [52, 58, 55, 63, 68, 66, 74, 80]
  return (
    <div aria-hidden className="hidden grid-cols-[1.15fr_1fr] items-start gap-4 lg:grid">
      {/* Today's workout */}
      <div className={`${CARD} p-5`}>
        <p className="text-xs text-ink-500">今天・教練課</p>
        <p className="mt-0.5 text-lg font-semibold text-ink-900">下肢力量日</p>
        <div className="mt-4 rounded-xl bg-canvas p-3.5">
          <p className="font-medium text-ink-900">槓鈴背蹲舉</p>
          <ul className="mt-2.5 space-y-1.5 text-sm">
            {sets.map((st, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
                <span className="w-5 text-xs text-ink-400">{i + 1}</span>
                <span className="tabular flex-1 font-medium text-ink-900">
                  {st.kg} kg × {st.reps}
                </span>
                <span className={`inline-flex size-5 items-center justify-center rounded-full ${st.done ? 'bg-accent-600 text-white' : 'border border-line-strong'}`}>
                  {st.done && <Check className="size-3" strokeWidth={3} />}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-xs text-ink-500">還有 3 個動作</p>
      </div>

      {/* Progress and session balance, offset down a little for depth */}
      <div className="mt-10 space-y-4">
      <div className={`${CARD} p-5`}>
        <p className="text-xs text-ink-500">深蹲 1RM 估計</p>
        <p className="mt-1 text-2xl font-semibold text-ink-900">
          102.5 <span className="text-sm font-normal text-ink-500">kg</span>
        </p>
        <p className="text-xs font-medium text-alt-600">↑ 12.5 kg・近 8 週</p>
        <div className="mt-4 flex h-20 items-end gap-1.5">
          {bars.map((h, i) => (
            <span key={i} className={`flex-1 rounded-t ${i === bars.length - 1 ? 'bg-accent-600' : 'bg-accent-200'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      <div className={`${CARD} p-5`}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-500">Stone・剩餘堂數</p>
          <Ticket className="size-4 text-accent-600" />
        </div>
        <p className="mt-1 text-2xl font-semibold text-ink-900">
          8 <span className="text-sm font-normal text-ink-500">/ 20 堂</span>
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div className="h-full w-[40%] rounded-full bg-accent-600" />
        </div>
        <p className="mt-2 text-xs text-ink-500">今天上完課已扣 1 堂</p>
      </div>
      </div>
    </div>
  )
}

function PlanCard({ name, price, who, includes, addons }: { name: string; price: number; who: string; includes: string[]; addons: string[] }) {
  return (
    <div className={`${CARD} flex flex-col p-6`}>
      <p className="text-lg font-semibold text-ink-900">{name}</p>
      <p className="mt-1 text-sm text-ink-500">{who}</p>
      <p className="mt-4 text-[32px] font-semibold tracking-tight text-ink-900">
        {twd(price)}
        <span className="ml-1 text-base font-normal text-ink-500">/ 月</span>
      </p>
      <ul className="mt-4 space-y-2 text-sm text-ink-700">
        {includes.map((t) => (
          <li key={t} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-accent-600" />
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-4">
        <div className="border-t border-line pt-4">
          <p className="text-[13px] font-medium text-ink-700">加購</p>
          {/* Room for two lines (Team has two), so the dividers line up across the cards. */}
          <ul className="mt-1.5 min-h-11 space-y-1 text-[13px] text-ink-600">
            {addons.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <ButtonLink to="/login?tab=register" className="mt-6 h-11 w-full md:h-10">
          免費試用 {TRIAL_DAYS} 天
        </ButtonLink>
      </div>
    </div>
  )
}
