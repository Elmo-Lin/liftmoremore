// Single place to rename the product.
export const BRAND = {
  name: 'Lift More More',
  /** Headline lines, shown without punctuation. */
  tagline: ['教練專心教學', '每個人都看得見進步'],
  storagePrefix: 'liftmoremore',
  domain: 'liftmoremore.com',
} as const

/**
 * Who runs the service, shown on the public pages, the privacy policy and the terms (as NewebPay's
 * merchant review and Taiwan's 個資法 / 消保法 expect). The operator's name must match the NewebPay
 * merchant account.
 */
export const OPERATOR = {
  name: '林孟玄',
  email: 'alvin4883889@gmail.com',
  /** Date the current privacy policy and terms take effect. */
  policyDate: '2026 年 10 月 23 日',
} as const
