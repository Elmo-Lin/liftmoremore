package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.common.Ids;
import com.example.backend.domain.LedgerLock;
import com.example.backend.domain.SessionPackage;
import com.example.backend.domain.SessionTransaction;
import com.example.backend.domain.Student;
import com.example.backend.domain.UserAccount;
import com.example.backend.domain.Workout;
import com.example.backend.service.Ledger.PackageBalance;
import com.example.backend.store.Db;
import com.example.backend.web.Dtos.AdjustmentInput;
import com.example.backend.web.Dtos.BalanceDto;
import com.example.backend.web.Dtos.LedgerResult;
import com.example.backend.web.Dtos.PackagePresetDto;
import com.example.backend.web.Dtos.PackageDto;
import com.example.backend.web.Dtos.PackageInput;
import com.example.backend.web.Dtos.TransactionDto;
import com.google.cloud.firestore.DocumentReference;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Session packages and the transaction ledger.
 * Invariants enforced here (not just in the UI):
 *  - only coached + completed workouts can be deducted, at most once at a time;
 *  - independent workouts can never be deducted;
 *  - no package balance may go below zero;
 *  - every change is a new ledger document (reversals instead of edits/deletes).
 *
 * Concurrency: every ledger write runs in a Firestore transaction that reads and bumps the
 * student's {@link LedgerLock} (and, for deductions, the workout's billingRevision). Two
 * concurrent writes therefore conflict; Firestore retries the loser, which then sees the
 * winner's ledger entry — so a session can never be spent twice.
 */
@Service
public class BillingService {

    private final Db db;
    private final AccessService access;

    public BillingService(Db db, AccessService access) {
        this.db = db;
        this.access = access;
    }

    // ----------------------------------------------------------------------------- reads

    public BalanceDto balance(CurrentUser user, String studentId) {
        access.student(user, studentId);
        return Ledger.toDto(studentId, Ledger.balances(packagesOf(user.coachId(), studentId), txsOf(user.coachId(), studentId)));
    }

    public List<PackageDto> listPackages(CurrentUser user, String studentId) {
        access.student(user, studentId);
        return packagesOf(user.coachId(), studentId).stream()
                .sorted(Comparator.comparing((SessionPackage p) -> p.purchaseDate))
                .map(Mapper::pkg)
                .toList();
    }

    public List<TransactionDto> listTransactions(CurrentUser user, String studentId) {
        access.student(user, studentId);
        return txsOf(user.coachId(), studentId).stream()
                .sorted(Comparator.comparing((SessionTransaction t) -> t.createdAt).reversed())
                .map(Mapper::tx)
                .toList();
    }

    // ----------------------------------------------------------------------------- packages

    /** Replaces the caller's own quick-select options; an empty list hides quick select. */
    public List<PackagePresetDto> savePresets(CurrentUser user, List<PackagePresetDto> presets) {
        user.requireCoach();
        List<PackagePresetDto> saved = presets.stream().map(p -> new PackagePresetDto(p.name().trim(), p.totalSessions(), p.priceTwd())).toList();
        List<Map<String, Object>> docs = saved.stream().map(p -> {
            UserAccount.PackagePreset doc = new UserAccount.PackagePreset();
            doc.name = p.name();
            doc.totalSessions = p.totalSessions();
            doc.priceTwd = p.priceTwd();
            return db.encode(doc);
        }).toList();
        db.update(db.doc(Db.USERS, user.userId()), "packagePresets", docs);
        return saved;
    }

    public PackageDto addPackage(CurrentUser user, String studentId, PackageInput in) {
        Student s = access.coachStudent(user, studentId);
        validate(in);
        SessionPackage p = new SessionPackage();
        p.id = Ids.orNew(in.id(), "pkg");
        p.studentId = s.id;
        p.coachId = s.coachId;
        apply(p, in);
        db.create(db.coachDoc(s.coachId, Db.PACKAGES, p.id), p); // fails with 409 if the ID exists
        return Mapper.pkg(p);
    }

    public PackageDto updatePackage(CurrentUser user, String packageId, PackageInput in) {
        user.requireCoach();
        validate(in);
        DocumentReference ref = db.coachDoc(user.coachId(), Db.PACKAGES, packageId);
        return db.transaction(tx -> {
            SessionPackage p = tx.get(ref, SessionPackage.class).orElseThrow(BillingService::packageNotFound);
            access.student(user, p.studentId);
            LedgerLock lock = lock(tx, user.coachId(), p.studentId);
            List<SessionTransaction> txs = tx.list(txQuery(user.coachId(), p.studentId), SessionTransaction.class);
            PackageBalance b = Ledger.of(p, txs);
            if (in.totalSessions() + b.adjusted() - b.used() < 0) {
                throw ApiException.conflict("below_used", "此方案已使用 " + b.used() + " 堂，總堂數不可低於已使用數");
            }
            apply(p, in);
            tx.set(ref, p);
            bump(tx, user.coachId(), p.studentId, lock);
            return Mapper.pkg(p);
        });
    }

    public void deletePackage(CurrentUser user, String packageId) {
        user.requireCoach();
        DocumentReference ref = db.coachDoc(user.coachId(), Db.PACKAGES, packageId);
        db.transaction(tx -> {
            SessionPackage p = tx.get(ref, SessionPackage.class).orElseThrow(BillingService::packageNotFound);
            access.student(user, p.studentId);
            LedgerLock lock = lock(tx, user.coachId(), p.studentId);
            boolean hasHistory = !tx.list(db.coachCol(user.coachId(), Db.TRANSACTIONS).whereEqualTo("packageId", packageId).limit(1),
                    SessionTransaction.class).isEmpty();
            if (hasHistory) throw ApiException.conflict("has_transactions", "此方案已有異動紀錄，無法刪除");
            tx.delete(ref);
            bump(tx, user.coachId(), p.studentId, lock);
            return null;
        });
    }

    // ----------------------------------------------------------------------------- ledger writes

    /** Manual +/- adjustment with a required reason. */
    public LedgerResult adjust(CurrentUser user, String packageId, AdjustmentInput in) {
        user.requireCoach();
        if (in.delta() == 0) throw ApiException.badRequest("調整數量需為非 0 的整數");
        String coachId = user.coachId();
        return db.transaction(tx -> {
            SessionPackage p = tx.get(db.coachDoc(coachId, Db.PACKAGES, packageId), SessionPackage.class).orElseThrow(BillingService::packageNotFound);
            access.student(user, p.studentId);
            LedgerLock lock = lock(tx, coachId, p.studentId);
            List<SessionPackage> pkgs = tx.list(pkgQuery(coachId, p.studentId), SessionPackage.class);
            List<SessionTransaction> txs = new ArrayList<>(tx.list(txQuery(coachId, p.studentId), SessionTransaction.class));
            PackageBalance b = Ledger.of(p, txs);
            if (b.remaining() + in.delta() < 0) {
                throw ApiException.conflict("negative_balance", "剩餘 " + b.remaining() + " 堂，無法扣除 " + (-in.delta()) + " 堂（餘額不可為負）");
            }
            SessionTransaction t = record(Ids.orNew(in.id(), "tx"), p, Domain.TX_ADJUSTMENT, in.delta(), in.reason().trim(), null);
            tx.create(db.coachDoc(coachId, Db.TRANSACTIONS, t.id), t);
            bump(tx, coachId, p.studentId, lock);
            txs.add(t);
            return new LedgerResult(Mapper.tx(t), Ledger.toDto(p.studentId, Ledger.balances(pkgs, txs)));
        });
    }

    /** Deduct one session for a completed coached workout. Always an explicit, separate action. */
    public LedgerResult deduct(CurrentUser user, String workoutId, String transactionId) {
        user.requireCoach();
        String coachId = user.coachId();
        DocumentReference wref = db.coachDoc(coachId, Db.WORKOUTS, workoutId);
        return db.transaction(tx -> {
            Workout w = tx.get(wref, Workout.class).orElseThrow(() -> ApiException.notFound("找不到此訓練紀錄"));
            access.student(user, w.studentId);
            LedgerLock lock = lock(tx, coachId, w.studentId);
            List<SessionPackage> pkgs = tx.list(pkgQuery(coachId, w.studentId), SessionPackage.class);
            List<SessionTransaction> txs = new ArrayList<>(tx.list(txQuery(coachId, w.studentId), SessionTransaction.class));

            if (!"coached".equals(w.type)) throw ApiException.conflict("independent_workout", "自主訓練不會扣除教練課堂數");
            if (!"completed".equals(w.status)) throw ApiException.conflict("not_completed", "請先完成訓練再扣堂");
            if (Ledger.netForWorkout(w.id, txs) < 0) throw ApiException.conflict("already_deducted", "此堂課已扣除");
            PackageBalance next = Ledger.nextPackage(Ledger.balances(pkgs, txs))
                    .orElseThrow(() -> ApiException.conflict("no_balance", "剩餘堂數不足，請先新增課程方案"));

            SessionTransaction t = record(Ids.orNew(transactionId, "tx"), next.pkg(), Domain.TX_DEDUCTION, -1, w.title + " 上課扣堂", w.id);
            tx.create(db.coachDoc(coachId, Db.TRANSACTIONS, t.id), t);
            tx.update(wref, "billingRevision", w.billingRevision + 1);
            bump(tx, coachId, w.studentId, lock);
            txs.add(t);
            return new LedgerResult(Mapper.tx(t), Ledger.toDto(w.studentId, Ledger.balances(pkgs, txs)));
        });
    }

    /** Undo a deduction by appending a +1 reversal (history is preserved). */
    public LedgerResult reverse(CurrentUser user, String workoutId, String transactionId, String reason) {
        user.requireCoach();
        String coachId = user.coachId();
        DocumentReference wref = db.coachDoc(coachId, Db.WORKOUTS, workoutId);
        return db.transaction(tx -> {
            Workout w = tx.get(wref, Workout.class).orElseThrow(() -> ApiException.notFound("找不到此訓練紀錄"));
            access.student(user, w.studentId);
            LedgerLock lock = lock(tx, coachId, w.studentId);
            List<SessionPackage> pkgs = tx.list(pkgQuery(coachId, w.studentId), SessionPackage.class);
            List<SessionTransaction> txs = new ArrayList<>(tx.list(txQuery(coachId, w.studentId), SessionTransaction.class));
            if (Ledger.netForWorkout(w.id, txs) >= 0) throw ApiException.conflict("not_deducted", "此課程尚未扣堂");
            SessionTransaction deduction = txs.stream()
                    .filter(t -> w.id.equals(t.workoutId) && Domain.TX_DEDUCTION.equals(t.type))
                    .max(Comparator.comparing((SessionTransaction t) -> t.createdAt))
                    .orElseThrow();
            SessionPackage p = pkgs.stream().filter(x -> x.id.equals(deduction.packageId)).findFirst().orElseThrow();
            SessionTransaction t = record(Ids.orNew(transactionId, "tx"), p, Domain.TX_REVERSAL, 1, reason.trim(), w.id);
            tx.create(db.coachDoc(coachId, Db.TRANSACTIONS, t.id), t);
            tx.update(wref, "billingRevision", w.billingRevision + 1);
            bump(tx, coachId, w.studentId, lock);
            txs.add(t);
            return new LedgerResult(Mapper.tx(t), Ledger.toDto(w.studentId, Ledger.balances(pkgs, txs)));
        });
    }

    // ----------------------------------------------------------------------------- helpers

    private com.google.cloud.firestore.Query pkgQuery(String coachId, String studentId) {
        return db.coachCol(coachId, Db.PACKAGES).whereEqualTo("studentId", studentId);
    }

    private com.google.cloud.firestore.Query txQuery(String coachId, String studentId) {
        return db.coachCol(coachId, Db.TRANSACTIONS).whereEqualTo("studentId", studentId);
    }

    private List<SessionPackage> packagesOf(String coachId, String studentId) {
        return db.list(pkgQuery(coachId, studentId), SessionPackage.class);
    }

    private List<SessionTransaction> txsOf(String coachId, String studentId) {
        return db.list(txQuery(coachId, studentId), SessionTransaction.class);
    }

    private LedgerLock lock(Db.Tx tx, String coachId, String studentId) throws Exception {
        return tx.get(db.coachDoc(coachId, Db.LEDGERS, studentId), LedgerLock.class).orElseGet(LedgerLock::new);
    }

    private void bump(Db.Tx tx, String coachId, String studentId, LedgerLock lock) {
        LedgerLock next = new LedgerLock();
        next.revision = lock.revision + 1;
        tx.set(db.coachDoc(coachId, Db.LEDGERS, studentId), next);
    }

    private static SessionTransaction record(String id, SessionPackage p, String type, int delta, String reason, String workoutId) {
        SessionTransaction t = new SessionTransaction();
        t.id = id;
        t.packageId = p.id;
        t.studentId = p.studentId;
        t.type = type;
        t.delta = delta;
        t.reason = reason;
        t.workoutId = workoutId;
        t.createdAt = Instant.now();
        t.createdBy = Domain.COACH;
        return t;
    }

    private static ApiException packageNotFound() {
        return ApiException.notFound("找不到方案");
    }

    private static void validate(PackageInput in) {
        if (in.expiresAt() != null && in.expiresAt().isBefore(in.purchaseDate())) throw ApiException.badRequest("到期日不可早於購買日");
    }

    private static void apply(SessionPackage p, PackageInput in) {
        p.name = in.name().trim();
        p.totalSessions = in.totalSessions();
        p.priceTwd = in.priceTwd();
        p.purchaseDate = in.purchaseDate();
        p.expiresAt = in.expiresAt();
        p.notes = in.notes() == null || in.notes().isBlank() ? null : in.notes().trim();
    }
}
