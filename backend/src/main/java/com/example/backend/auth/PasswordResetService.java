package com.example.backend.auth;

import com.example.backend.common.ApiException;
import com.example.backend.domain.UserAccount;
import com.example.backend.mail.MailService;
import com.example.backend.service.StudentService;
import com.example.backend.service.StudentService.EmailOwner;
import com.example.backend.store.Db;
import com.example.backend.web.Dtos.AuthResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * "Forgot password": a one-time link, valid for an hour, mailed to the account's email. Only the
 * token's SHA-256 is stored ({@code passwordResets/{hash}}), so the database alone cannot be used
 * to reset anyone. Requests never reveal whether an email is registered.
 */
@Service
public class PasswordResetService {

    static final Duration TTL = Duration.ofHours(1);
    /** One email per account per minute, so the form cannot be used to flood an inbox. */
    static final Duration COOLDOWN = Duration.ofMinutes(1);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final Db db;
    private final PasswordEncoder passwords;
    private final AuthService auth;
    private final MailService mail;
    private final String appUrl;

    public PasswordResetService(Db db, PasswordEncoder passwords, AuthService auth, MailService mail, @Value("${coachlog.app-url}") String appUrl) {
        this.db = db;
        this.passwords = passwords;
        this.auth = auth;
        this.mail = mail;
        this.appUrl = appUrl.replaceAll("/$", "");
    }

    /** {@code passwordResets/{sha256(token)}}. */
    public static class PasswordReset {
        public String userId;
        public Instant expiresAt;
        public Instant createdAt;
    }

    /** Mails a reset link if the email belongs to an account that can sign in; silently does nothing otherwise. */
    public void request(String email) {
        UserAccount u = db.get(db.doc(Db.EMAILS, StudentService.key(email)), EmailOwner.class)
                .flatMap(o -> db.get(db.doc(Db.USERS, o.userId), UserAccount.class))
                .orElse(null);
        // Invited users activate with their invite code (or Google) instead; deactivated coaches cannot come back this way.
        if (u == null || !u.hasLogin() || Boolean.FALSE.equals(u.active)) return;

        Instant now = Instant.now();
        var earlier = Db.await(db.fs.collection(Db.PASSWORD_RESETS).whereEqualTo("userId", u.id).get()).getDocuments();
        if (earlier.stream().anyMatch(d -> d.getTimestamp("createdAt") != null && d.getTimestamp("createdAt").toDate().toInstant().isAfter(now.minus(COOLDOWN)))) return;
        earlier.forEach(d -> db.delete(d.getReference())); // only the newest link works

        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        PasswordReset reset = new PasswordReset();
        reset.userId = u.id;
        reset.createdAt = now;
        reset.expiresAt = now.plus(TTL);
        db.create(db.doc(Db.PASSWORD_RESETS, hash(token)), reset);

        String link = appUrl + "/reset-password?token=" + token;
        String name = u.name == null || u.name.isBlank() ? "你好" : u.name + " 你好";
        String text = name + "：\n\n我們收到重設 Lift More More 密碼的申請。請在 1 小時內點下面的連結設定新密碼：\n\n" + link
                + "\n\n如果你沒有申請，請忽略這封信，你的密碼不會改變。\n\nLift More More";
        String html = "<p>" + escape(name) + "：</p><p>我們收到重設 Lift More More 密碼的申請。請在 1 小時內點下面的按鈕設定新密碼。</p>"
                + "<p><a href=\"" + link + "\" style=\"display:inline-block;padding:10px 18px;background:#0071e3;color:#fff;border-radius:8px;text-decoration:none\">設定新密碼</a></p>"
                + "<p style=\"color:#6e6e73;font-size:13px\">按鈕無法使用時，請複製這個網址到瀏覽器：<br>" + link + "</p>"
                + "<p style=\"color:#6e6e73;font-size:13px\">如果你沒有申請，請忽略這封信，你的密碼不會改變。</p>";
        mail.send(u.email, "重設你的 Lift More More 密碼", text, html);
    }

    /** Sets the new password, spends the link, and signs the user in. */
    public AuthResponse reset(String token, String password) {
        String hash = passwords.encode(password);
        var resetRef = db.doc(Db.PASSWORD_RESETS, hash(token.trim()));
        String userId = db.transaction(tx -> {
            PasswordReset reset = tx.get(resetRef, PasswordReset.class).orElse(null);
            if (reset == null || reset.expiresAt == null || reset.expiresAt.isBefore(Instant.now())) {
                throw ApiException.badRequest("重設連結已失效或已使用過，請重新申請");
            }
            var userRef = db.doc(Db.USERS, reset.userId);
            UserAccount u = tx.get(userRef, UserAccount.class).orElseThrow(() -> ApiException.badRequest("重設連結已失效，請重新申請"));
            if (Boolean.FALSE.equals(u.active)) throw ApiException.unauthorized("此帳號已停用，請聯絡工作室");
            tx.update(userRef, "passwordHash", hash);
            tx.delete(resetRef);
            return u.id;
        });
        return auth.issueFor(userId);
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
