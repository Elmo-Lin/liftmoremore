package com.example.backend.domain;

import java.time.Instant;

/**
 * Embedded in {@code coaches/{id}.subscription}. The plan follows the workspace's kind (a free coach
 * is on Pro, a studio on Team); self-trackers have none. A workspace without one is on its trial,
 * counted from the workspace's creation (see {@link com.example.backend.billing.Plans#access}).
 */
public class Subscription {
    /** trialing, active (paid), past_due (the last renewal failed) or canceled (runs to the period's end). */
    public String status;
    public Instant trialEndsAt;
    public Instant currentPeriodStart;
    public Instant currentPeriodEnd;
    public int extraStudentPacks;
    public int extraCoachSeats;
    /** Downgrades wait for the next renewal; null = no change scheduled. */
    public Integer nextExtraStudentPacks;
    public Integer nextExtraCoachSeats;
    /** A plan change waiting for the next renewal: "pro" when a studio goes back to a free coach. */
    public String nextPlan;
    /** What the NewebPay mandate charges each month. */
    public int monthlyAmount;
    /** NewebPay periodic mandate: its order number and PeriodNo. */
    public String mandateOrderNo;
    public String periodNo;
    /** Mandate charges already applied (NewebPay's AlreadyTimes), so repeated notifications are ignored. */
    public int paidPeriods;
}
