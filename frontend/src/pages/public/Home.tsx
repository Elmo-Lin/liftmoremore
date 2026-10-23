import { Building2, CalendarDays, ChartLine, Check, ClipboardList, Dumbbell, ShieldCheck, Ticket, User, Users } from 'lucide-react'
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

const AUDIENCES = [
  { icon: User, title: '自由教練', text: '一個人帶學員，學員、課表、堂數與訓練紀錄一次管好。', price: `${twd(PLANS.pro.price)} / 月` },
  { icon: Building2, title: '健身工作室', text: '多位教練一起使用，學員屬於工作室，教練交接時紀錄與堂數都保留。', price: `${twd(PLANS.team.price)} / 月` },
  { icon: Dumbbell, title: '自主訓練者', text: '沒有教練也能記錄自己的訓練、追蹤進步。', price: `${twd(PLANS.self.price)} / 月` },
]

const FAQ = [
  { q: '試用需要綁信用卡嗎？', a: `不需要。註冊後即可免費試用 ${TRIAL_DAYS} 天，試用期間功能完整。` },
  { q: '試用結束沒有訂閱會怎樣？', a: '資料都會保留，帳號轉為唯讀：可以查看，但無法新增或編輯。訂閱後立即恢復。' },
  { q: '怎麼付款？安全嗎？', a: '透過藍新金流以信用卡按月自動扣款。卡號在藍新金流的付款頁面輸入，本網站不會取得或保存你的完整卡號。' },
  { q: '可以隨時取消嗎？', a: '可以。在「方案與付款」頁面取消後不會再扣款，已付費的當期仍可使用到期末。' },
  { q: '可以退款嗎？', a: '已開始的計費週期原則上不退費；若有重複扣款或系統錯誤造成的溢收，會全額退還。詳見退款政策。' },
  { q: '學員需要付費嗎？', a: '不需要。學員帳號由教練邀請，免費使用；教練、工作室與自主訓練者需要訂閱。' },
]

export function HomePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-12 md:px-8 md:pt-20">
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight text-ink-900 md:text-[48px]">
          {BRAND.tagline[0]}
          <br />
          <span className="text-accent-700">{BRAND.tagline[1]}</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-600 md:text-[17px]">
          為台灣健身教練打造的課程管理工具：學員、課表、堂數與訓練紀錄，一個地方搞定。自己練的人也能用它記錄訓練、追蹤進步。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/login?tab=register" size="lg">
            免費試用 {TRIAL_DAYS} 天
          </ButtonLink>
          <ButtonLink to="/login" size="lg" variant="secondary">
            登入
          </ButtonLink>
        </div>
        <p className="mt-3 text-[13px] text-ink-500">不需信用卡・可隨時取消</p>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">功能</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-accent-700">
                  <f.icon className="size-[18px]" />
                </span>
                <div>
                  <p className="font-medium text-ink-900">{f.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <ul className="mt-12 grid gap-3 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <li key={a.title} className="rounded-2xl bg-canvas p-5">
                <a.icon className="size-5 text-accent-700" />
                <p className="mt-3 font-medium text-ink-900">{a.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{a.text}</p>
                <p className="mt-3 text-sm font-semibold text-ink-900">{a.price}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">價格方案</h2>
          <p className="mt-2 text-sm text-ink-600">
            所有方案皆可免費試用 {TRIAL_DAYS} 天，不需信用卡。價格皆為新台幣、按月計費，透過藍新金流信用卡自動扣款。
          </p>
          {/* Same card for every plan, cheapest first; the buttons line up at the bottom. */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <PlanCard
              name={PLANS.self.name}
              price={PLANS.self.price}
              who="沒有教練、自己練的人"
              includes={['記錄自己的訓練：動作、重量、次數、RPE', '重量、訓練量與體重的進步追蹤', '為手機設計，記錄一組只要幾次點擊']}
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
          <div className="mt-6 rounded-2xl bg-surface p-5">
            <p className="text-sm font-medium text-ink-900">計費方式</p>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-600">
              {BILLING_RULES.map((r) => (
                <li key={r} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-accent-600" />
                  {r}
                </li>
              ))}
              <li className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent-600" />
                學員帳號由教練邀請，免費使用。
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">常見問題</h2>
          <dl className="mt-6 divide-y divide-line">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-medium text-ink-900">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-600">{f.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 flex items-center gap-2 text-[13px] text-ink-500">
            <ShieldCheck className="size-4 text-accent-600" />
            付款由藍新金流處理，本網站不保存信用卡號。
          </p>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">現在就開始</h2>
          <p className="mt-2 text-sm text-ink-600">免費試用 {TRIAL_DAYS} 天，不需信用卡。</p>
          <ButtonLink to="/login?tab=register" size="lg" className="mt-6">
            免費試用
          </ButtonLink>
        </div>
      </section>
    </PublicLayout>
  )
}

function PlanCard({ name, price, who, includes, addons }: { name: string; price: number; who: string; includes: string[]; addons: string[] }) {
  return (
    <div className="flex flex-col rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.05)]">
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
