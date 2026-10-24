package com.example.backend.auth;

import com.example.backend.common.ApiException;
import com.example.backend.service.StudentService;
import com.example.backend.store.Db;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Stops password guessing against one account: after {@link #MAX_FAILURES} wrong passwords within
 * {@link #WINDOW}, password sign-in for that email pauses for {@link #LOCK}. Kept in Firestore
 * ({@code loginGuards/{sha256(email)}}) so it holds across server instances and IP addresses.
 * Google sign-in and password resets still work while it is paused.
 */
@Service
public class LoginGuard {

    static final int MAX_FAILURES = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);
    static final Duration LOCK = Duration.ofMinutes(15);

    /** {@code loginGuards/{sha256(email)}}. */
    public static class Attempts {
        public int failures;
        public Instant windowStart;
        public Instant lockedUntil;
    }

    private final Db db;

    public LoginGuard(Db db) {
        this.db = db;
    }

    /** Refuses before the password is even checked while the account is paused. */
    public void check(String email) {
        Attempts a = db.get(ref(email), Attempts.class).orElse(null);
        if (a != null && a.lockedUntil != null && a.lockedUntil.isAfter(Instant.now())) throw locked();
    }

    public void failed(String email) {
        var ref = ref(email);
        boolean nowLocked = db.transaction(tx -> {
            Instant now = Instant.now();
            Attempts a = tx.get(ref, Attempts.class).orElseGet(Attempts::new);
            if (a.windowStart == null || a.windowStart.isBefore(now.minus(WINDOW))) {
                a.windowStart = now;
                a.failures = 0;
            }
            a.failures++;
            if (a.failures >= MAX_FAILURES) {
                a.lockedUntil = now.plus(LOCK);
                a.failures = 0;
                a.windowStart = null;
            }
            tx.set(ref, a);
            return a.lockedUntil != null && a.lockedUntil.isAfter(now);
        });
        if (nowLocked) throw locked();
    }

    public void succeeded(String email) {
        var ref = ref(email);
        if (db.get(ref, Attempts.class).isPresent()) db.delete(ref);
    }

    private com.google.cloud.firestore.DocumentReference ref(String email) {
        return db.doc(Db.LOGIN_GUARDS, PasswordResetService.hash(StudentService.key(email)));
    }

    private static ApiException locked() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "login_locked", "密碼錯誤次數過多，請 15 分鐘後再試，或使用「忘記密碼」重設");
    }
}
