package com.example.backend.billing;

import com.example.backend.auth.CurrentUser;
import com.example.backend.billing.Plans.Access;
import com.example.backend.billing.Plans.Plan;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.domain.BillingOrder;
import com.example.backend.domain.Coach;
import com.example.backend.domain.Student;
import com.example.backend.domain.Subscription;
import com.example.backend.domain.UserAccount;
import com.example.backend.store.Db;
import com.example.backend.web.Dtos.BillingDto;
import com.example.backend.web.Dtos.BillingOverviewDto;
import com.example.backend.web.Dtos.ChangePlanInput;
import com.example.backend.web.Dtos.ChangeResultDto;
import com.example.backend.web.Dtos.CheckoutDto;
import com.example.backend.web.Dtos.PaymentDto;
import com.example.backend.web.Dtos.SubscribeInput;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/**
 * Subscriptions: limits, the read-only switch, and the NewebPay flows.
 *
 * - Subscribe: a monthly mandate, first month charged now. Each later charge arrives as a
 *   notification that extends the period and applies any scheduled downgrade.
 * - Upgrade (more students, more coach seats, Pro → Team): on at once after a one-time payment of
 *   the prorated difference for the rest of the period; the mandate charges the new amount from
 *   the next period. Downgrades wait for the next period.
 * - Cancel: the mandate stops; the workspace stays writable until the paid period ends.
 */
@Service
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter ORDER_TIME = DateTimeFormatter.ofPattern("yyMMddHHmmss").withZone(Plans.ZONE);

    private final Db db;
    private final NewebPay newebPay;
    private final String appUrl;
    private final String apiUrl;

    public SubscriptionService(Db db, NewebPay newebPay, @Value("${coachlog.app-url}") String appUrl, @Value("${coachlog.api-url}") String apiUrl) {
        this.db = db;
        this.newebPay = newebPay;
        this.appUrl = appUrl.replaceAll("/$", "");
        this.apiUrl = apiUrl.replaceAll("/$", "");
    }

    // ----------------------------------------------------------------------------- limits

    public Access access(String spaceId) {
        return Plans.access(space(spaceId), Instant.now());
    }

    /** Every write outside auth and billing goes through here (see {@link WriteGuard}). */
    public void requireWritable(CurrentUser user) {
        if (user.isSelf()) return;
        Access a = access(user.coachId());
        if (a == null || a.writable()) return;
        throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "subscription_required", user.isCoach()
                ? "方案已到期，目前為唯讀。訂閱後即可繼續新增與編輯，資料都還在。"
                : "教練的方案已到期，暫時無法記錄。請聯絡你的教練。");
    }

    /** Before a student becomes active (added as active, or reactivated). */
    public void requireStudentSlot(CurrentUser user) {
        Access a = access(user.coachId());
        if (a == null) return;
        long active = Db.await(db.coachCol(user.coachId(), Db.STUDENTS).whereEqualTo("status", "active").count().get()).getCount();
        if (active >= a.studentLimit()) {
            throw ApiException.conflict("student_limit", "活躍學員已達方案上限（" + a.studentLimit() + " 位）。"
                    + (canManage(user) ? "請至「方案與付款」加購學員名額，或將已結案的學員設為停用。" : "請聯絡工作室經營者加購名額。"));
        }
    }

    /** Before inviting a coach; {@code used} counts the owner and every active or invited coach. */
    public void requireCoachSeat(String spaceId, long used) {
        Access a = access(spaceId);
        int seats = a == null ? 1 : a.coachLimit();
        if (used >= seats) throw ApiException.conflict("seats_full", "教練名額已滿（" + seats + " 位，含經營者）。請至「方案與付款」加購教練名額。");
    }

    /** Free coaches and studio owners pay; studio coaches only see the status. */
    public static boolean canManage(CurrentUser user) {
        return user.isOwner() || (user.isCoach() && user.userId().equals(user.coachId()));
    }

    /** Whether a paid mandate is running (changes then need a prorated payment). */
    public static boolean hasMandate(Subscription sub) {
        return sub != null && sub.periodNo != null && ("active".equals(sub.status) || "past_due".equals(sub.status));
    }

    // ----------------------------------------------------------------------------- reads

    /** For coaches; {@code activeStudents} is the whole workspace, {@code hiddenActive} those the caller cannot see. */
    public BillingDto view(CurrentUser user, Coach space, int activeStudents, int hiddenActive) {
        Access a = Plans.access(space, Instant.now());
        if (a == null || !user.isCoach()) return null;
        Subscription sub = space.subscription;
        int packs = sub == null ? 0 : sub.extraStudentPacks;
        int seats = sub == null ? 0 : sub.extraCoachSeats;
        int monthly = hasMandate(sub) ? sub.monthlyAmount : Plans.monthly(a.plan(), packs, seats);
        return new BillingDto(a.plan().id(), a.status(), a.writable(), canManage(user), a.trialEndsAt(),
                sub == null ? null : sub.currentPeriodEnd, packs, seats,
                sub == null ? null : sub.nextExtraStudentPacks, sub == null ? null : sub.nextExtraCoachSeats,
                monthly, a.studentLimit(), a.coachLimit(), activeStudents, hiddenActive, hasMandate(sub), newebPay.configured());
    }

    public BillingOverviewDto overview(CurrentUser user) {
        user.requireCoach();
        Coach space = space(user.coachId());
        List<Student> students = db.list(db.coachCol(user.coachId(), Db.STUDENTS).whereEqualTo("status", "active"), Student.class);
        int visible = (int) students.stream().filter(s -> user.isOwner() || !user.isStudioCoach() || user.userId().equals(s.coach())).count();
        var payments = canManage(user)
                ? db.list(db.coachCol(user.coachId(), Db.PAYMENTS), Payment.class).stream()
                        .sorted(Comparator.comparing((Payment p) -> p.createdAt).reversed())
                        .limit(24)
                        .map(p -> new PaymentDto(p.id, p.kind, p.amount, p.status, p.createdAt))
                        .toList()
                : List.<PaymentDto>of();
        return new BillingOverviewDto(view(user, space, students.size(), students.size() - visible), payments);
    }

    // ----------------------------------------------------------------------------- flows

    /** Starts the monthly mandate (from a trial, a lapsed plan, or after a failed renewal). */
    public CheckoutDto subscribe(CurrentUser user, SubscribeInput in) {
        requireManager(user);
        Coach space = space(user.coachId());
        if (space.subscription != null && "active".equals(space.subscription.status) && hasMandate(space.subscription)) {
            throw ApiException.conflict("already_subscribed", "已經在訂閱中，如需調整請使用「變更方案」");
        }
        Plan plan = Plans.planOf(space);
        int seats = Plans.TEAM.equals(plan.id()) ? in.extraCoachSeats() : 0;
        BillingOrder order = order(space.id, user.userId(), "subscribe", plan.id(), in.extraStudentPacks(), seats);
        order.monthlyAmount = Plans.monthly(plan, in.extraStudentPacks(), seats);
        order.amount = order.monthlyAmount;
        db.create(db.doc(Db.BILLING_ORDERS, order.id), order);
        String email = db.get(db.doc(Db.USERS, user.userId()), UserAccount.class).map(u -> u.email).orElse(null);
        var form = newebPay.periodForm(order.id, order.monthlyAmount, plan.name() + " 月費", email, Instant.now(),
                apiUrl + "/billing/newebpay/period-return", apiUrl + "/billing/newebpay/period-notify", appUrl + "/coach/billing");
        return new CheckoutDto(form.action(), form.fields());
    }

    /** Add-ons and Pro → Team. During the trial changes are free; with a mandate, upgrades are prorated. */
    public ChangeResultDto change(CurrentUser user, ChangePlanInput in) {
        requireManager(user);
        Instant now = Instant.now();
        Coach space = space(user.coachId());
        Access access = Plans.access(space, now);
        Plan current = Plans.planOf(space);
        Plan target = Plans.plan(in.plan());
        if (Plans.TEAM.equals(current.id()) && Plans.PRO.equals(target.id())) {
            throw ApiException.conflict("downgrade_unsupported", "工作室方案無法直接改回自由教練，請聯絡我們");
        }
        boolean upgrading = !current.id().equals(target.id());
        String studioName = in.studioName() == null ? "" : in.studioName().trim();
        if (upgrading && studioName.isEmpty()) throw ApiException.badRequest("請輸入工作室名稱");
        int packs = in.extraStudentPacks();
        int seats = Plans.TEAM.equals(target.id()) ? in.extraCoachSeats() : 0;
        if (!access.writable()) throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "subscription_required", "方案已到期，請先訂閱");

        Subscription sub = subscriptionOf(space);
        if (!hasMandate(sub)) {
            if (!"trialing".equals(sub.status)) throw ApiException.conflict("subscription_canceled", "已取消訂閱，請重新訂閱後再調整方案");
            apply(space, sub, user.userId(), upgrading ? studioName : null, packs, seats, null, null, sub.monthlyAmount);
            return new ChangeResultDto(true, null);
        }

        int nowPacks = Math.max(sub.extraStudentPacks, packs);
        int nowSeats = Math.max(sub.extraCoachSeats, seats);
        Integer nextPacks = packs < sub.extraStudentPacks ? packs : null;
        Integer nextSeats = seats < sub.extraCoachSeats ? seats : null;
        int newMonthly = Plans.monthly(target, packs, seats);
        int charge = Plans.prorate(Plans.monthly(target, nowPacks, nowSeats) - Plans.monthly(current, sub.extraStudentPacks, sub.extraCoachSeats),
                now, sub.currentPeriodStart, sub.currentPeriodEnd);
        if (charge > 0) {
            BillingOrder order = order(space.id, user.userId(), "change", target.id(), nowPacks, nowSeats);
            order.amount = charge;
            order.monthlyAmount = newMonthly;
            order.studioName = upgrading ? studioName : null;
            order.nextExtraStudentPacks = nextPacks;
            order.nextExtraCoachSeats = nextSeats;
            db.create(db.doc(Db.BILLING_ORDERS, order.id), order);
            var form = newebPay.mpgForm(order.id, charge, target.name() + " 方案調整（本期按比例）", null, now,
                    apiUrl + "/billing/newebpay/mpg-return", apiUrl + "/billing/newebpay/mpg-notify", appUrl + "/coach/billing");
            return new ChangeResultDto(false, new CheckoutDto(form.action(), form.fields()));
        }
        // Only downgrades (or nothing): the mandate charges less from the next period.
        if (newMonthly != sub.monthlyAmount) newebPay.alterAmount(sub.mandateOrderNo, sub.periodNo, newMonthly, now);
        apply(space, sub, user.userId(), null, nowPacks, nowSeats, nextPacks, nextSeats, newMonthly);
        return new ChangeResultDto(true, null);
    }

    /** Stops future charges; the workspace stays writable until the paid period ends. */
    public void cancel(CurrentUser user) {
        requireManager(user);
        Coach space = space(user.coachId());
        Subscription sub = space.subscription;
        if (!hasMandate(sub)) throw ApiException.conflict("not_subscribed", "目前沒有進行中的訂閱");
        newebPay.terminate(sub.mandateOrderNo, sub.periodNo, Instant.now());
        sub.status = "canceled";
        db.update(db.doc(Db.COACHES, space.id), "subscription", db.encode(sub));
    }

    // ----------------------------------------------------------------------------- NewebPay callbacks

    /** A mandate's first charge (ReturnURL) or any later one (NotifyURL). Idempotent. */
    public boolean onPeriodResult(String encrypted) {
        JsonNode r = newebPay.decryptJson(encrypted);
        JsonNode result = r.path("Result");
        if (!newebPay.isOurs(result)) throw ApiException.badRequest("金流通知驗證失敗");
        String orderNo = result.path("MerchantOrderNo").asString("");
        String periodNo = result.path("PeriodNo").asString("");
        int times = result.has("AlreadyTimes") ? result.path("AlreadyTimes").asInt(1) : 1;
        int amount = result.has("AuthAmt") ? result.path("AuthAmt").asInt() : result.path("PeriodAmt").asInt();
        boolean ok = "SUCCESS".equals(r.path("Status").asString(""));
        BillingOrder order = db.get(db.doc(Db.BILLING_ORDERS, orderNo), BillingOrder.class).orElseThrow(() -> ApiException.notFound("找不到訂單"));

        String[] replaced = new String[2];
        boolean applied = db.transaction(tx -> {
            var spaceRef = db.doc(Db.COACHES, order.workspaceId);
            Coach space = tx.get(spaceRef, Coach.class).orElseThrow();
            Subscription sub = subscriptionOf(space);
            Instant now = Instant.now();
            boolean newMandate = !periodNo.equals(sub.periodNo);
            if (!ok) {
                if (newMandate) {
                    order.status = "failed";
                    tx.set(db.doc(Db.BILLING_ORDERS, order.id), order);
                } else if (times > sub.paidPeriods) {
                    sub.status = "past_due";
                    tx.update(spaceRef, "subscription", db.encode(sub));
                    tx.set(db.coachDoc(space.id, Db.PAYMENTS, periodNo + "_" + times), payment(periodNo + "_" + times, "renewal", amount, "failed", now));
                }
                return false;
            }
            if (newMandate) {
                if (hasMandate(sub)) {
                    replaced[0] = sub.mandateOrderNo;
                    replaced[1] = sub.periodNo;
                }
                sub.status = "active";
                sub.mandateOrderNo = order.id;
                sub.periodNo = periodNo;
                sub.paidPeriods = times;
                sub.currentPeriodStart = now;
                sub.currentPeriodEnd = Plans.addMonth(now);
                sub.extraStudentPacks = order.extraStudentPacks;
                sub.extraCoachSeats = order.extraCoachSeats;
                sub.nextExtraStudentPacks = null;
                sub.nextExtraCoachSeats = null;
                sub.monthlyAmount = order.monthlyAmount;
                order.status = "paid";
                order.paidAt = now;
                order.tradeNo = result.path("TradeNo").asString(null);
                tx.set(db.doc(Db.BILLING_ORDERS, order.id), order);
            } else if (times > sub.paidPeriods) {
                sub.paidPeriods = times;
                Instant start = sub.currentPeriodEnd != null && sub.currentPeriodEnd.isAfter(now.minus(Plans.GRACE)) ? sub.currentPeriodEnd : now;
                sub.currentPeriodStart = start;
                sub.currentPeriodEnd = Plans.addMonth(start);
                if (sub.nextExtraStudentPacks != null) sub.extraStudentPacks = sub.nextExtraStudentPacks;
                if (sub.nextExtraCoachSeats != null) sub.extraCoachSeats = sub.nextExtraCoachSeats;
                sub.nextExtraStudentPacks = null;
                sub.nextExtraCoachSeats = null;
                if (!"canceled".equals(sub.status)) sub.status = "active";
            } else {
                return true; // already applied
            }
            tx.update(spaceRef, "subscription", db.encode(sub));
            String id = periodNo + "_" + times;
            tx.set(db.coachDoc(space.id, Db.PAYMENTS, id), payment(id, newMandate ? "subscription" : "renewal", amount, "paid", now));
            return true;
        });
        // A new card replaced a failing mandate: stop the old one so it is never charged twice.
        if (replaced[1] != null) {
            try {
                newebPay.terminate(replaced[0], replaced[1], Instant.now());
            } catch (Exception e) {
                log.error("Could not terminate replaced NewebPay mandate {} ({}); terminate it in the NewebPay console", replaced[1], replaced[0], e);
            }
        }
        return applied;
    }

    /** A prorated upgrade payment (MPG NotifyURL or ReturnURL). Idempotent. */
    public boolean onTradeResult(String tradeInfo, String tradeSha) {
        JsonNode r = newebPay.decryptTrade(tradeInfo, tradeSha);
        JsonNode result = r.path("Result");
        if (!newebPay.isOurs(result)) throw ApiException.badRequest("金流通知驗證失敗");
        BillingOrder order = db.get(db.doc(Db.BILLING_ORDERS, result.path("MerchantOrderNo").asString("")), BillingOrder.class)
                .orElseThrow(() -> ApiException.notFound("找不到訂單"));
        boolean ok = "SUCCESS".equals(r.path("Status").asString("")) && result.path("Amt").asInt() == order.amount;

        Subscription[] after = new Subscription[1];
        boolean paid = db.transaction(tx -> {
            var orderRef = db.doc(Db.BILLING_ORDERS, order.id);
            BillingOrder o = tx.get(orderRef, BillingOrder.class).orElseThrow();
            if (!"pending".equals(o.status)) return "paid".equals(o.status);
            Instant now = Instant.now();
            if (!ok) {
                o.status = "failed";
                tx.set(orderRef, o);
                return false;
            }
            var spaceRef = db.doc(Db.COACHES, o.workspaceId);
            Coach space = tx.get(spaceRef, Coach.class).orElseThrow();
            Subscription sub = space.subscription;
            if (o.studioName != null && !Domain.SPACE_STUDIO.equals(space.kind)) {
                space.kind = Domain.SPACE_STUDIO;
                space.studio = o.studioName;
                tx.update(db.doc(Db.USERS, space.id), "role", Domain.OWNER);
            }
            sub.extraStudentPacks = o.extraStudentPacks;
            sub.extraCoachSeats = o.extraCoachSeats;
            sub.nextExtraStudentPacks = o.nextExtraStudentPacks;
            sub.nextExtraCoachSeats = o.nextExtraCoachSeats;
            int previousMonthly = sub.monthlyAmount;
            sub.monthlyAmount = o.monthlyAmount;
            space.subscription = sub;
            tx.set(spaceRef, space);
            o.status = "paid";
            o.paidAt = now;
            o.tradeNo = result.path("TradeNo").asString(null);
            tx.set(orderRef, o);
            tx.set(db.coachDoc(space.id, Db.PAYMENTS, o.id), payment(o.id, "proration", o.amount, "paid", now));
            if (previousMonthly != sub.monthlyAmount) after[0] = sub;
            return true;
        });
        if (after[0] != null) {
            try {
                newebPay.alterAmount(after[0].mandateOrderNo, after[0].periodNo, after[0].monthlyAmount, Instant.now());
            } catch (Exception e) {
                // The upgrade is paid and on; only next month's amount is stale.
                log.error("Paid upgrade {} applied but the NewebPay mandate {} still charges the old amount; set it to NT${} in the NewebPay console",
                        order.id, after[0].periodNo, after[0].monthlyAmount, e);
            }
        }
        return paid;
    }

    /** Where the browser lands after NewebPay. */
    /** {@code result}: success, failed, or pending (unknown yet; the server notification decides). */
    public String returnUrl(String result) {
        return appUrl + "/coach/billing?result=" + result;
    }

    // ----------------------------------------------------------------------------- helpers

    /** Trial-time change: no payment, on at once. */
    private void apply(Coach space, Subscription sub, String userId, String upgradeTo, int packs, int seats, Integer nextPacks, Integer nextSeats, int monthly) {
        db.transaction(tx -> {
            var spaceRef = db.doc(Db.COACHES, space.id);
            Coach fresh = tx.get(spaceRef, Coach.class).orElseThrow();
            if (upgradeTo != null && !Domain.SPACE_STUDIO.equals(fresh.kind)) {
                fresh.kind = Domain.SPACE_STUDIO;
                fresh.studio = upgradeTo;
                tx.update(db.doc(Db.USERS, userId), "role", Domain.OWNER);
            }
            sub.extraStudentPacks = packs;
            sub.extraCoachSeats = seats;
            sub.nextExtraStudentPacks = nextPacks;
            sub.nextExtraCoachSeats = nextSeats;
            sub.monthlyAmount = monthly;
            fresh.subscription = sub;
            tx.set(spaceRef, fresh);
            return null;
        });
    }

    /** The stored subscription, or the implicit trial of a workspace that never had one. */
    private static Subscription subscriptionOf(Coach space) {
        if (space.subscription != null) return space.subscription;
        Subscription s = new Subscription();
        s.status = "trialing";
        s.trialEndsAt = Plans.trialEndsAt(space);
        return s;
    }

    private void requireManager(CurrentUser user) {
        user.requireCoach();
        if (!canManage(user)) throw ApiException.forbidden("只有工作室經營者可以管理方案與付款");
    }

    private Coach space(String spaceId) {
        return startTrialIfMissing(db.get(db.doc(Db.COACHES, spaceId), Coach.class).orElseThrow(() -> ApiException.notFound("找不到教練資料")));
    }

    /**
     * Workspaces created before billing existed have no subscription. Their 10-day trial starts the
     * first time they are used after launch (not at sign-up, which would lock them out at once).
     */
    public Coach startTrialIfMissing(Coach space) {
        // Self-trackers are free; older ones have no kind but an ID starting with "self_".
        if (space.subscription != null || Domain.SPACE_SELF.equals(space.kind) || space.id.startsWith("self_")) return space;
        Subscription trial = Plans.trial(Instant.now());
        db.update(db.doc(Db.COACHES, space.id), "subscription", db.encode(trial));
        space.subscription = trial;
        return space;
    }

    private static BillingOrder order(String spaceId, String userId, String kind, String plan, int packs, int seats) {
        BillingOrder o = new BillingOrder();
        // NewebPay order numbers: letters, digits and _, at most 30 characters.
        o.id = "LM" + ORDER_TIME.format(Instant.now()) + String.format("%06d", RANDOM.nextInt(1_000_000));
        o.workspaceId = spaceId;
        o.userId = userId;
        o.kind = kind;
        o.plan = plan;
        o.extraStudentPacks = packs;
        o.extraCoachSeats = seats;
        o.status = "pending";
        o.createdAt = Instant.now();
        return o;
    }

    private static Payment payment(String id, String kind, int amount, String status, Instant at) {
        Payment p = new Payment();
        p.id = id;
        p.kind = kind;
        p.amount = amount;
        p.status = status;
        p.createdAt = at;
        return p;
    }

    /** {@code coaches/{id}/payments/{id}}: every charge, for the billing page. */
    public static class Payment {
        public String id;
        /** subscription (first month), renewal or proration. */
        public String kind;
        public int amount;
        /** paid or failed. */
        public String status;
        public Instant createdAt;
    }
}
