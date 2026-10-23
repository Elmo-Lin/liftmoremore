import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { BRAND, OPERATOR } from '../../config/brand'
import { BILLING_RULES, COACH_SEAT_PRICE, PLANS, STUDENT_PACK, TRIAL_DAYS } from '../../lib/billing'
import { twd } from '../../lib/format'
import { PublicLayout } from './PublicLayout'

// Draft policies for a Taiwan-based subscription service. Have them reviewed by a lawyer before relying on them.

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const { hash } = useLocation()
  // Deep links such as /terms#refund: scroll once the page has rendered.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <PublicLayout title={title}>
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <h1 className="text-[30px] font-semibold tracking-tight text-ink-900">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">生效日期：{OPERATOR.policyDate}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink-700">{children}</div>
      </article>
    </PublicLayout>
  )
}

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  )
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

const contact = (
  <a href={`mailto:${OPERATOR.email}`} className="text-accent-700 hover:underline">
    {OPERATOR.email}
  </a>
)

// ----------------------------------------------------------------------------- privacy

export function PrivacyPage() {
  return (
    <LegalPage title="隱私權政策">
      <p>
        {BRAND.name}（以下稱「本服務」，網址 https://{BRAND.domain}）由 {OPERATOR.name}（以下稱「我們」）經營。我們依《個人資料保護法》說明如何蒐集、處理及利用你的個人資料。使用本服務即表示你已閱讀並同意本政策。
      </p>

      <Section title="一、蒐集的目的">
        <List
          items={[
            '提供本服務：建立與管理帳號、記錄訓練與課程、計算堂數、顯示進步數據。',
            '契約與付款：訂閱方案的計費、扣款與付款紀錄（特定目的：契約、類似契約或其他法律關係事務；消費者、客戶管理與服務；網路購物及其他電子商務服務）。',
            '客服與通知：回覆詢問、寄送帳號與服務相關通知。',
            '服務改善與安全：維護系統安全、防止濫用、統計分析（統計資料不會識別到個人）。',
          ]}
        />
      </Section>

      <Section title="二、蒐集的個人資料">
        <List
          items={[
            '帳號資料：姓名、Email、電話（選填）；使用 Google 登入時，Google 提供的姓名、Email 與帳號識別碼。',
            '學員資料：由教練輸入，包括姓名、Email、性別、出生年、身高、訓練目標、教練備註。',
            '訓練與身體數據：訓練紀錄（動作、重量、次數、RPE）、體重、上課紀錄與堂數。',
            '付款資料：方案、金額、付款時間與藍新金流交易序號。信用卡號由藍新金流直接處理，我們不會取得或保存完整卡號。',
            '技術資料：登入狀態、瀏覽器在你裝置上儲存的設定（localStorage），以及為了系統安全與除錯的伺服器紀錄。',
          ]}
        />
      </Section>

      <Section title="三、教練輸入的學員資料">
        <p>
          教練與工作室在本服務中建立學員資料時，應事先取得學員同意，並對所輸入資料的正確性與合法性負責。教練的私人備註不會顯示給學員。學員可以向其教練或直接向我們提出查詢、更正或刪除的請求。
        </p>
      </Section>

      <Section title="四、利用的期間、地區、對象與方式">
        <List
          items={[
            '期間：帳號存續期間，以及帳號刪除後依法令（例如稅務、會計）須保存的期間。',
            '地區：資料存放於 Google Cloud（Firebase）的資料中心，可能位於中華民國境外。',
            '對象：我們；你所屬的教練或工作室（僅限其管理的學員資料）；為提供服務必要的受託廠商，包括 Google（主機、資料庫、Google 登入）與藍新科技股份有限公司（金流）；依法令要求的機關。',
            '方式：以電子方式蒐集、處理、利用與國際傳輸。我們不會出售你的個人資料。',
          ]}
        />
      </Section>

      <Section title="五、你的權利">
        <p>依《個人資料保護法》第 3 條，你可以就你的個人資料向我們請求：</p>
        <List items={['查詢或請求閱覽', '請求製給複製本', '請求補充或更正', '請求停止蒐集、處理或利用', '請求刪除']} />
        <p>請寄信至 {contact}，我們將在確認身分後於法定期間內處理。你可以選擇不提供個人資料，但可能因此無法註冊或使用部分功能。</p>
      </Section>

      <Section title="六、資料安全">
        <p>
          全站以 HTTPS 加密傳輸；密碼以不可逆的方式加密保存；資料庫只允許本服務的伺服器存取。即使如此，任何網路傳輸都無法保證百分之百安全，若發生個資外洩，我們將依法通知你。
        </p>
      </Section>

      <Section title="七、未成年人">
        <p>未滿 18 歲者應在法定代理人同意下使用本服務。</p>
      </Section>

      <Section title="八、政策修訂">
        <p>我們可能因法令或服務調整修訂本政策，修訂後會公告於本頁並更新生效日期；重大變更將另以 Email 或站內通知。</p>
      </Section>

      <Section title="九、聯絡我們">
        <p>
          經營者：{OPERATOR.name}
          <br />
          Email：{contact}
        </p>
      </Section>
    </LegalPage>
  )
}

// ----------------------------------------------------------------------------- terms

export function TermsPage() {
  return (
    <LegalPage title="服務條款">
      <p>
        歡迎使用 {BRAND.name}（以下稱「本服務」，網址 https://{BRAND.domain}），本服務由 {OPERATOR.name}（以下稱「我們」）經營。註冊或使用本服務，即表示你同意本條款及
        <Link to="/privacy" className="text-accent-700 hover:underline">
          隱私權政策
        </Link>
        。
      </p>

      <Section title="一、服務內容">
        <p>
          本服務為健身教練與工作室提供學員管理、訓練計畫、訓練紀錄、堂數管理與進步追蹤等線上工具，並提供自主訓練者記錄訓練的功能。本服務以網站形式提供，不包含任何實體商品。本服務提供的數據與紀錄僅供參考，不構成醫療或專業健康建議。
        </p>
      </Section>

      <Section title="二、帳號">
        <List
          items={[
            '你應提供正確的資料註冊，並妥善保管帳號與密碼；透過你的帳號進行的操作視為你本人的行為。',
            '學員帳號與工作室教練帳號由教練或工作室邀請建立。',
            '你不得將本服務用於違法用途、侵害他人權利，或干擾本服務的正常運作。違反者我們得暫停或終止其帳號。',
          ]}
        />
      </Section>

      <Section id="pricing" title="三、方案與費用">
        <p>學員帳號（由教練邀請）免費使用。其他帳號依下列方案按月付費（新台幣，含稅）：</p>
        <List
          items={[
            `${PLANS.pro.name}：每月 ${twd(PLANS.pro.price)}，包含 ${PLANS.pro.students} 位活躍學員；每增加 ${STUDENT_PACK.size} 位學員 +${twd(STUDENT_PACK.price)} / 月。`,
            `${PLANS.team.name}：每月 ${twd(PLANS.team.price)}，包含 ${PLANS.team.coaches} 位教練（含經營者）、${PLANS.team.students} 位活躍學員；每增加 1 位教練 +${twd(COACH_SEAT_PRICE)} / 月，每增加 ${STUDENT_PACK.size} 位學員 +${twd(STUDENT_PACK.price)} / 月。`,
            `${PLANS.self.name}：每月 ${twd(PLANS.self.price)}，供沒有教練、自己記錄訓練的個人使用，無加購項目。`,
          ]}
        />
        <p>計費規則：</p>
        <List items={BILLING_RULES} />
        <p>我們調整價格時，將於生效前至少 30 天公告並通知訂閱者；已付費的當期不受影響。</p>
      </Section>

      <Section title="四、免費試用">
        <p>
          新註冊的教練、工作室與自主訓練者可免費試用 {TRIAL_DAYS} 天，不需提供信用卡，試用期間不會收費。試用結束後若未訂閱，資料會保留，但帳號轉為唯讀（可查看、不可新增或編輯），訂閱後立即恢復。
        </p>
      </Section>

      <Section title="五、訂閱、自動續扣與取消">
        <List
          items={[
            '訂閱時透過藍新金流以信用卡付款：訂閱當下扣第一個月的費用，之後每月同一天自動扣款，直到你取消為止。',
            '加購名額或升級方案立即生效，本期按剩餘天數比例收取差額；之後每月依新的金額扣款。減少名額於下個計費週期生效。',
            '你可以隨時在「方案與付款」頁面取消訂閱。取消後不會再扣款，已付費的當期仍可使用至期末，之後帳號轉為唯讀，資料保留。',
            '若自動扣款失敗，我們會在頁面上提醒你更新付款方式；逾期 3 天仍未完成付款，帳號將轉為唯讀。',
          ]}
        />
      </Section>

      <Section id="refund" title="六、退款政策">
        <List
          items={[
            `本服務提供 ${TRIAL_DAYS} 天免費試用，讓你在付款前完整體驗。`,
            '本服務為線上提供、付款後立即開通的數位服務。依《通訊交易解除權合理例外情事適用準則》，你在訂閱時同意立即開始提供服務，即不適用七日解除權。',
            '已開始的計費週期（含按比例收取的加購費用）原則上不退費；取消訂閱後可使用至當期結束。',
            '若發生重複扣款、系統錯誤造成溢收，或因我們的原因導致服務連續無法使用超過 72 小時，我們將退還溢收或相應的費用。',
            `申請退款請寄信至 ${OPERATOR.email}，並附上帳號 Email 與藍新金流交易序號；我們將於收到後 7 個工作天內回覆，核准的退款會退回原付款信用卡。`,
          ]}
        />
      </Section>

      <Section title="七、資料">
        <List
          items={[
            '你在本服務中建立的資料屬於你（或你所屬的工作室）。我們僅為提供服務而處理這些資料，處理方式依隱私權政策。',
            '方案到期或超過名額時，我們不會刪除你的資料。',
            '你可以寄信要求刪除帳號與資料；刪除後無法復原。',
          ]}
        />
      </Section>

      <Section title="八、服務變更與中斷">
        <p>
          我們會盡力維持服務穩定，但可能因維護、升級或不可抗力暫停服務，並會盡可能事先公告。我們得調整或停止部分功能；若終止整體服務，將於至少 30 天前通知，並退還已付費但未使用期間的費用。
        </p>
      </Section>

      <Section title="九、責任限制">
        <p>在法律允許的範圍內，我們對於因使用或無法使用本服務所生的間接損失不負賠償責任；我們的賠償總額以你最近 3 個月實際支付的費用為上限。</p>
      </Section>

      <Section title="十、條款修訂、準據法與管轄">
        <p>
          我們可能修訂本條款，修訂後會公告於本頁並更新生效日期；重大變更將另行通知，你於修訂後繼續使用即視為同意。本條款以中華民國法律為準據法，如有爭議，以臺灣臺北地方法院為第一審管轄法院。
        </p>
      </Section>

      <Section title="十一、聯絡我們">
        <p>
          經營者：{OPERATOR.name}
          <br />
          Email：{contact}
        </p>
      </Section>
    </LegalPage>
  )
}
