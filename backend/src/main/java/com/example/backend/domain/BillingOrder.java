package com.example.backend.domain;

import java.time.Instant;

/**
 * {@code billingOrders/{orderNo}} — one checkout sent to NewebPay: a new monthly mandate
 * ({@code subscribe}) or a one-time prorated charge for an upgrade ({@code change}). Top-level so
 * the unauthenticated payment callbacks can find it by the order number alone.
 */
public class BillingOrder {
    public String id;
    public String workspaceId;
    public String userId;
    /** subscribe or change. */
    public String kind;
    /** Charged now (the first month, or the prorated difference). */
    public int amount;
    /** The mandate's monthly amount once this order is applied. */
    public int monthlyAmount;
    /** What the order turns on: plan (pro / team), add-ons, and the studio name when upgrading to Team. */
    public String plan;
    public String studioName;
    public int extraStudentPacks;
    public int extraCoachSeats;
    /** Downgrades requested together with an upgrade; they wait for the next renewal. */
    public Integer nextExtraStudentPacks;
    public Integer nextExtraCoachSeats;
    /** pending, paid or failed. */
    public String status;
    public String tradeNo;
    public Instant createdAt;
    public Instant paidAt;
}
