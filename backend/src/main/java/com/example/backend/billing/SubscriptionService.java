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
        Access a = access(user.coachId());
        if (a.writable()) return;
        throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "subscription_required", user.isCoach() || user.isSelf()
                ? "方案已到期，目前為唯讀。訂閱後即可繼續新增與編輯，資料都還在。"
                : "教練的方案已到期，暫時無法記錄。請聯絡你的教練。");
    }

    /** Before a student becomes active (added as active, or reactivated). */
    public void requireStudentSlot(CurrentUser user) {
        Access a = access(user.coachId());
        long active = Db.await(db.coachCol(user.coachId(), Db.STUDENTS).whereEqualTo("status", "active").count().get()).getCount();
        if (active >= a.studentLimit()) {
            throw ApiException.conflict("student_limit", "活躍學員已達方案上限（" + a.studentLimit() + " 位）。"
                    + (canManage(user) ? "請至「方案與付款」加購學員名額，或將已結案的學員設為停用。" : "請聯絡工作室經營者加購名額。"));
        }
    }

    /** Before inviting a coach; {@code used} counts the owner and every active or invited coach. */
    public void requireCoachSeat(String spaceId, long used) {
        Coach space = space(spaceId);
        if (space.subscription != null && Plans.PRO.equals(space.subscription.nextPlan)) {
            throw ApiException.conflict("downgrade_scheduled", "已排定下期改回自由教練，請先在「方案與付款」取消，才能邀請教練");
        }
        Access a = Plans.access(space, Instant.now());
        int seats = a.coachLimit();
        if (used >= seats) throw ApiException.conflict("seats_full", "教練名額已滿（" + seats + " 位，含經營者）。請至「方案與付款」加購教練名額。");
    }

    /** Free coaches, studio owners and self-trackers pay; studio coaches only see the status. */
    public static boolean canManage(CurrentUser user) {
        return user.isOwner() || user.isSelf() || (user.isCoach() && user.userId().equals(user.coachId()));
    }

    /** Who sees billing: coaches and self-trackers (students are covered by their coach). */
    public static boolean paysOrSees(CurrentUser user) {
        return user.isCoach() || user.isSelf();
    }

    /** Whether a paid mandate is running (changes then need a prorated payment). */
    public static boolean hasMandate(Subscription sub) {
        return sub != null && sub.periodNo != null && ("active".equals(sub.status) || "past_due".equals(sub.status));
    }

    // ----------------------------------------------------------------------------- reads

    /** For coaches; {@code activeStudents} is the whole workspace, {@code hiddenActive} those the caller cannot see. */
    public BillingDto view(CurrentUser user, Coach space, int activeStudents, int hiddenActive) {
        Access a = Plans.access(space, Instant.now());
        if (!paysOrSees(user)) return null;
        Subscription sub = space.subscription;
        int packs = sub == null ? 0 : sub.extraStudentPacks;
        int seats = sub == null ? 0 : sub.extraCoachSeats;
        int monthly = hasMandate(sub) ? sub.monthlyAmount : Plans.monthly(a.plan(), packs, seats);
        return new BillingDto(a.plan().id(), a.status(), a.writable(), canManage(user), a.trialEndsAt(),
                sub == null ? null : sub.currentPeriodEnd, packs, seats,
                sub == null ? null : sub.nextExtraStudentPacks, sub == null ? null : sub.nextExtraCoachSeats,
                sub == null ? null : sub.nextPlan, monthly, a.studentLimit(), a.coachLimit(), activeStudents, hiddenActive, hasMandate(sub), newebPay.configured());
    }

    public BillingOverviewDto overview(CurrentUser user) {
        if (!paysOrSees(user)) throw ApiException.forbidden("方案由你的教練管理");
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
        int packs = Plans.SELF.equals(plan.id()) ? 0 : in.extraStudentPacks();
        int seats = Plans.TEAM.equals(plan.id()) ? in.extraCoachSeats() : 0;
        BillingOrder order = order(space.id, user.userId(), "subscribe", plan.id(), packs, seats);
        order.monthlyAmount = Plans.monthly(plan, packs, seats);
        order.amount = order.monthlyAmount;
        db.create(db.doc(Db.BILLING_ORDERS, order.id), order);
        String email = db.get(db.doc(Db.USERS, user.userId()), UserAccount.class).map(u -> u.email).orElse(null);
        var form = newebPay.periodForm(order.id, order.monthlyAmount, plan.name() + " 月費", email, Instant.now(),
                apiUrl + "/billing/newebpay/period-return", apiUrl + "/billing/newebpay/period-notify", appUrl + "/billing");
        return new CheckoutDto(form.action(), form.fields());
    }

    /**
     * Add-ons, and upgrades: 自主訓練 → Pro, Pro → Team. Without a running mandate (trial, lapsed
     * plan) a plan change is free and immediate; with one, upgrades are prorated. Team → Pro is
     * {@link #downgradeToPro}.
     */
    public ChangeResultDto change(CurrentUser user, ChangePlanInput in) {
        requireManager(user);
        Instant now = Instant.now();
        Coach space = space(user.coachId());
        Access access = Plans.access(space, now);
        Plan current = Plans.planOf(space);
        Plan target = Plans.plan(in.plan());
        if (Plans.TEAM.equals(current.id()) && Plans.PRO.equals(target.id())) {
            throw ApiException.conflict("use_downgrade", "請使用「改回自由教練」");
        }
        if (Plans.SELF.equals(current.id()) && !Plans.PRO.equals(target.id())) {
            throw ApiException.conflict("nothing_to_change", "自主訓練可以升級為自由教練，沒有其他可調整的項目");
        }
        if (Plans.SELF.equals(target.id())) throw ApiException.badRequest("無法改為自主訓練方案");
        boolean upgrading = !current.id().equals(target.id());
        String studioName = in.studioName() == null ? "" : in.studioName().trim();
        if (upgrading && Plans.TEAM.equals(target.id()) && studioName.isEmpty()) throw ApiException.badRequest("請輸入工作室名稱");
        int packs = in.extraStudentPacks();
        int seats = Plans.TEAM.equals(target.id()) ? in.extraCoachSeats() : 0;

        Subscription sub = subscriptionOf(space);
        if (!hasMandate(sub)) {
            // Add-ons are free only during the trial; switching plan type never costs anything without a mandate.
            if (!"trialing".equals(sub.status) && !upgrading) throw ApiException.conflict("subscription_canceled", "已取消或到期，請重新訂閱後再調整名額");
            apply(space, sub, upgrading ? target.id() : null, studioName, packs, seats, null, null, sub.monthlyAmount);
            return new ChangeResultDto(true, null);
        }
        if (!access.writable()) throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "subscription_required", "方案已到期，請先訂閱");

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
            order.studioName = upgrading && Plans.TEAM.equals(target.id()) ? studioName : null;
            order.nextExtraStudentPacks = nextPacks;
            order.nextExtraCoachSeats = nextSeats;
            db.create(db.doc(Db.BILLING_ORDERS, order.id), order);
            var form = newebPay.mpgForm(order.id, charge, target.name() + " 方案調整（本期按比例）", null, now,
                    apiUrl + "/billing/newebpay/mpg-return", apiUrl + "/billing/newebpay/mpg-notify", appUrl + "/billing");
            return new ChangeResultDto(false, new CheckoutDto(form.action(), form.fields()));
        }
        // Only downgrades (or nothing): the mandate charges less from the next period.
        if (newMonthly != sub.monthlyAmount) newebPay.alterAmount(sub.mandateOrderNo, sub.periodNo, newMonthly, now);
        apply(space, sub, null, null, nowPacks, nowSeats, nextPacks, nextSeats, newMonthly);
        return new ChangeResultDto(true, null);
    }

    /**
     * A studio goes back to a free coach (Pro). Only when no other coach is active or invited, so
     * nobody loses their account. Without a mandate it happens now; with one, the current period
     * stays Team and the mandate charges the Pro price from the next renewal, which switches over.
     */
    public ChangeResultDto downgradeToPro(CurrentUser user) {
        requireManager(user);
        Coach space = space(user.coachId());
        if (!Plans.TEAM.equals(Plans.planOf(space).id())) throw ApiException.conflict("not_studio", "目前不是工作室方案");
        boolean othersStay = db.list(db.fs.collection(Db.USERS).whereEqualTo("coachId", space.id), UserAccount.class).stream()
                .anyMatch(u -> !u.id.equals(space.id) && Domain.COACH.equals(u.role) && !Boolean.FALSE.equals(u.active));
        if (othersStay) throw ApiException.conflict("coaches_remain", "工作室裡還有其他教練，請先到工作室頁面停用他們，才能改回自由教練");
        Subscription sub = subscriptionOf(space);
        if (!hasMandate(sub)) {
            apply(space, sub, Plans.PRO, null, sub.extraStudentPacks, 0, sub.nextExtraStudentPacks, null, sub.monthlyAmount);
            return new ChangeResultDto(true, null);
        }
        int packs = sub.nextExtraStudentPacks != null ? sub.nextExtraStudentPacks : sub.extraStudentPacks;
        int monthly = Plans.monthly(Plans.PRO_PLAN, packs, 0);
        newebPay.alterAmount(sub.mandateOrderNo, sub.periodNo, monthly, Instant.now());
        sub.nextPlan = Plans.PRO;
        sub.nextExtraCoachSeats = 0;
        sub.monthlyAmount = monthly;
        db.update(db.doc(Db.COACHES, space.id), "subscription", db.encode(sub));
        return new ChangeResultDto(false, null);
    }

    /** Keeps the studio after all: the mandate goes back to the Team price. */
    public void cancelDowngrade(CurrentUser user) {
        requireManager(user);
        Coach space = space(user.coachId());
        Subscription sub = space.subscription;
        if (sub == null || !Plans.PRO.equals(sub.nextPlan)) throw ApiException.conflict("no_downgrade", "沒有排定改回自由教練");
        int packs = sub.nextExtraStudentPacks != null ? sub.nextExtraStudentPacks : sub.extraStudentPacks;
        int monthly = Plans.monthly(Plans.TEAM_PLAN, packs, sub.extraCoachSeats);
        newebPay.alterAmount(sub.mandateOrderNo, sub.periodNo, monthly, Instant.now());
        sub.nextPlan = null;
        sub.nextExtraCoachSeats = null;
        sub.monthlyAmount = monthly;
        db.update(db.doc(Db.COACHES, space.id), "subscription", db.encode(sub));
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
                sub.nextPlan = null;
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
                if (Plans.PRO.equals(sub.nextPlan)) {
                    switchPlan(tx, space, Plans.PRO, null);
                    sub.extraCoachSeats = 0;
                    sub.nextPlan = null;
                }
                if (!"canceled".equals(sub.status)) sub.status = "active";
            } else {
                return true; // already applied
            }
            space.subscription = sub;
            tx.set(spaceRef, space);
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
            if (!o.plan.equals(Plans.planOf(space).id())) switchPlan(tx, space, o.plan, o.studioName);
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

    /**
     * Where the browser lands after NewebPay; the app sends /billing on to the caller's own billing
     * page. {@code result}: success, failed, or pending (unknown yet; the server notification decides).
     */
    public String returnUrl(String result) {
        return appUrl + "/billing?result=" + result;
    }

    // ----------------------------------------------------------------------------- helpers

    /** A change that needs no payment, on at once; {@code plan} switches the plan type too. */
    private void apply(Coach space, Subscription sub, String plan, String studioName, int packs, int seats, Integer nextPacks, Integer nextSeats, int monthly) {
        db.transaction(tx -> {
            var spaceRef = db.doc(Db.COACHES, space.id);
            Coach fresh = tx.get(spaceRef, Coach.class).orElseThrow();
            if (plan != null) switchPlan(tx, fresh, plan, studioName);
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

    /**
     * Makes the workspace the given plan's type, and the owner's account the matching role: Team →
     * studio + owner; Pro → free coach (from a studio, or from a self-tracker, whose own training
     * stays as a student record of theirs). The workspace's ID is its owner's user ID.
     */
    private void switchPlan(Db.Tx tx, Coach space, String plan, String studioName) {
        var owner = db.doc(Db.USERS, space.id);
        if (Plans.TEAM.equals(plan)) {
            space.kind = Domain.SPACE_STUDIO;
            if (studioName != null && !studioName.isBlank()) space.studio = studioName.trim();
            tx.update(owner, "role", Domain.OWNER);
        } else if (Plans.PRO.equals(plan)) {
            if (Plans.isSelf(space) && (space.title == null || space.title.isBlank())) space.title = "教練";
            space.kind = Domain.SPACE_SOLO;
            tx.update(owner, "role", Domain.COACH);
        }
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
        if (!canManage(user)) throw ApiException.forbidden(user.isStudent() ? "方案由你的教練管理" : "只有工作室經營者可以管理方案與付款");
    }

    private Coach space(String spaceId) {
        return startTrialIfMissing(db.get(db.doc(Db.COACHES, spaceId), Coach.class).orElseThrow(() -> ApiException.notFound("找不到教練資料")));
    }

    /**
     * Workspaces created before billing existed have no subscription. Their 10-day trial starts the
     * first time they are used after launch (not at sign-up, which would lock them out at once).
     */
    public Coach startTrialIfMissing(Coach space) {
        if (space.subscription != null) return space;
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
