package com.example.backend.billing;

import com.example.backend.common.Domain;
import com.example.backend.domain.Coach;
import com.example.backend.domain.Subscription;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/**
 * Prices and what each workspace may do right now. Pure functions, mirrored by
 * frontend/src/lib/billing.ts.
 *
 * Self-trackers are on the 自主訓練 plan: one person, no add-ons.
 *
 * Rules: only active students count against the limit (inactive ones keep their history); every
 * coach account that is active or invited takes a seat; going over a limit never deletes anything,
 * it only blocks adding more. When the trial or the paid period lapses the workspace turns
 * read-only until someone subscribes.
 */
public final class Plans {

    private Plans() {}

    public static final String PRO = "pro";
    public static final String TEAM = "team";
    public static final String SELF = "self";

    public static final int TRIAL_DAYS = 10;
    /** A failed or late renewal keeps the workspace writable this long past the period's end. */
    public static final Duration GRACE = Duration.ofDays(3);
    public static final int STUDENT_PACK_SIZE = 10;
    public static final int STUDENT_PACK_PRICE = 99;
    public static final int COACH_SEAT_PRICE = 199;
    public static final int MAX_STUDENT_PACKS = 100;
    public static final int MAX_COACH_SEATS = 50;
    public static final ZoneId ZONE = ZoneId.of("Asia/Taipei");

    public record Plan(String id, String name, int basePrice, int includedStudents, int includedCoaches) {}

    public static final Plan PRO_PLAN = new Plan(PRO, "自由教練 Pro", 399, 30, 1);
    public static final Plan TEAM_PLAN = new Plan(TEAM, "工作室 Team", 999, 100, 3);
    public static final Plan SELF_PLAN = new Plan(SELF, "自主訓練", 99, 1, 0);

    public static Plan plan(String id) {
        return TEAM.equals(id) ? TEAM_PLAN : SELF.equals(id) ? SELF_PLAN : PRO_PLAN;
    }

    public static Plan planOf(Coach space) {
        return isSelf(space) ? SELF_PLAN : Domain.SPACE_STUDIO.equals(space.kind) ? TEAM_PLAN : PRO_PLAN;
    }

    /** A self-tracker's one-person space; older ones have no kind, only an ID starting with "self_". */
    public static boolean isSelf(Coach space) {
        return Domain.SPACE_SELF.equals(space.kind) || (space.kind == null && space.id != null && space.id.startsWith("self_"));
    }

    /** Extra student packs exist on Pro and Team, extra coach seats only on Team. */
    public static int monthly(Plan plan, int studentPacks, int coachSeats) {
        if (SELF.equals(plan.id())) return plan.basePrice();
        return plan.basePrice() + studentPacks * STUDENT_PACK_PRICE + (TEAM.equals(plan.id()) ? coachSeats * COACH_SEAT_PRICE : 0);
    }

    public static int studentLimit(Plan plan, int studentPacks) {
        return plan.includedStudents() + (SELF.equals(plan.id()) ? 0 : studentPacks * STUDENT_PACK_SIZE);
    }

    public static int coachLimit(Plan plan, int coachSeats) {
        return plan.includedCoaches() + (TEAM.equals(plan.id()) ? coachSeats : 0);
    }

    /** The share of a monthly price difference still owed for the rest of the current period (rounded up). */
    public static int prorate(int monthlyDelta, Instant now, Instant periodStart, Instant periodEnd) {
        if (monthlyDelta <= 0 || periodStart == null || periodEnd == null || !now.isBefore(periodEnd)) return 0;
        double left = (double) Duration.between(now, periodEnd).toSeconds() / Duration.between(periodStart, periodEnd).toSeconds();
        return (int) Math.ceil(monthlyDelta * Math.min(1, left));
    }

    /** One calendar month later in Taiwan time (Jan 31 → Feb 28/29). */
    public static Instant addMonth(Instant from) {
        return from.atZone(ZONE).plusMonths(1).toInstant();
    }

    /** What a workspace may do at {@code now}; {@code status} adds "expired" for a lapsed trial or period. */
    public record Access(Plan plan, String status, boolean writable, Instant trialEndsAt, int studentLimit, int coachLimit) {}

    public static Access access(Coach space, Instant now) {
        Plan plan = planOf(space);
        Subscription sub = space.subscription;
        Instant trialEnds = trialEndsAt(space);
        int packs = sub == null ? 0 : sub.extraStudentPacks;
        int seats = sub == null ? 0 : sub.extraCoachSeats;
        String status = sub == null || sub.status == null ? "trialing" : sub.status;
        boolean writable = switch (status) {
            case "trialing" -> now.isBefore(trialEnds);
            case "active", "past_due" -> sub.currentPeriodEnd != null && now.isBefore(sub.currentPeriodEnd.plus(GRACE));
            case "canceled" -> sub.currentPeriodEnd != null && now.isBefore(sub.currentPeriodEnd);
            default -> false;
        };
        return new Access(plan, writable ? status : "expired", writable, trialEnds, studentLimit(plan, packs), coachLimit(plan, seats));
    }

    static Instant trialEndsAt(Coach space) {
        if (space.subscription != null && space.subscription.trialEndsAt != null) return space.subscription.trialEndsAt;
        Instant from = space.createdAt != null ? space.createdAt : Instant.now();
        return from.plus(Duration.ofDays(TRIAL_DAYS));
    }

    /** A fresh workspace's trial. */
    public static Subscription trial(Instant now) {
        Subscription s = new Subscription();
        s.status = "trialing";
        s.trialEndsAt = now.plus(Duration.ofDays(TRIAL_DAYS));
        return s;
    }
}
