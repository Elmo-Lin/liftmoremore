// Plans and payments. Calls go straight to the server (not through the local action + sync queue)
// because paying leaves the app for NewebPay's payment page.
import type { Billing, PlanId } from '../types'
import { api } from './client'

export interface Payment {
  id: string
  kind: 'subscription' | 'renewal' | 'proration'
  amount: number
  status: 'paid' | 'failed'
  createdAt: string
}

/** The browser posts `fields` to `action`: NewebPay's page, where the card is entered. */
export interface Checkout {
  action: string
  fields: Record<string, string>
}

export const fetchBilling = (token: string) => api<{ billing: Billing | null; payments: Payment[] }>('GET', '/billing', undefined, token)

export const subscribe = (input: { extraStudentPacks: number; extraCoachSeats: number }, token: string) =>
  api<Checkout>('POST', '/billing/subscribe', input, token)

/** applied: done (trial, or a downgrade); otherwise pay the prorated difference through `checkout`. */
export const changePlan = (input: { plan: PlanId; extraStudentPacks: number; extraCoachSeats: number; studioName?: string }, token: string) =>
  api<{ applied: boolean; checkout?: Checkout }>('POST', '/billing/change', input, token)

/** Studio → free coach. applied: done now (no running subscription); otherwise from the next renewal. */
export const downgradeToPro = (token: string) => api<{ applied: boolean }>('POST', '/billing/downgrade', undefined, token)

/** Keep the studio after all. */
export const cancelDowngrade = (token: string) => api('DELETE', '/billing/downgrade', undefined, token)

export const cancelSubscription = (token: string) => api('POST', '/billing/cancel', undefined, token)

/** Leaves the app for NewebPay; it sends the browser back to /coach/billing?result=… */
export function goToCheckout(checkout: Checkout) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = checkout.action
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.append(input)
  }
  document.body.append(form)
  form.submit()
}
