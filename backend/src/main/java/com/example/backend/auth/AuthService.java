package com.example.backend.auth;

import com.example.backend.auth.GoogleTokenVerifier.GoogleUser;
import com.example.backend.billing.Plans;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.common.Ids;
import com.example.backend.domain.Coach;
import com.example.backend.domain.Invite;
import com.example.backend.domain.Student;
import com.example.backend.domain.UserAccount;
import com.example.backend.service.StudentService.EmailOwner;
import com.example.backend.store.Db;
import com.example.backend.web.Dtos.ActivateInput;
import com.example.backend.web.Dtos.AuthResponse;
import com.example.backend.web.Dtos.GoogleAuthInput;
import com.example.backend.web.Dtos.LoginInput;
import com.example.backend.web.Dtos.MeDto;
import com.example.backend.web.Dtos.RegisterCoachInput;
import com.example.backend.web.Dtos.RegisterSelfInput;
import com.example.backend.web.Dtos.RegisterStudioInput;
import java.time.Instant;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final Db db;
    private final PasswordEncoder passwords;
    private final TokenService tokens;
    private final GoogleTokenVerifier google;

    public AuthService(Db db, PasswordEncoder passwords, TokenService tokens, GoogleTokenVerifier google) {
        this.db = db;
        this.passwords = passwords;
        this.tokens = tokens;
        this.google = google;
    }

    public AuthResponse registerCoach(RegisterCoachInput in) {
        return issue(createCoach(in.name(), in.email(), passwords.encode(in.password()), null, in.studio(), in.title(), false));
    }

    /** A studio owner: a coach whose workspace is a studio they can invite other coaches into. */
    public AuthResponse registerStudio(RegisterStudioInput in) {
        return issue(createCoach(in.name(), in.email(), passwords.encode(in.password()), null, in.studio(), null, true));
    }

    public AuthResponse registerSelf(RegisterSelfInput in) {
        return issue(createSelf(in.name(), in.email(), passwords.encode(in.password()), null));
    }

    /**
     * Sign in with Google. Google has verified the email, so an existing account with that email is
     * linked (and an invited student or coach is activated). A new user must pick an account type.
     */
    public AuthResponse google(GoogleAuthInput in) {
        GoogleUser g = google.verify(in.credential());
        UserAccount existing = db.get(db.doc(Db.EMAILS, key(g.email())), EmailOwner.class)
                .flatMap(o -> db.get(db.doc(Db.USERS, o.userId), UserAccount.class))
                .orElse(null);
        if (existing != null) {
            if (existing.googleSub != null && !existing.googleSub.equals(g.sub())) throw ApiException.unauthorized("此 Email 已綁定其他 Google 帳號");
            if (Boolean.FALSE.equals(existing.active)) throw ApiException.unauthorized("此帳號已停用，請聯絡工作室");
            if (existing.googleSub == null) linkGoogle(existing, g.sub());
            return issue(existing);
        }
        if (in.accountType() == null) throw ApiException.conflict("signup_required", "第一次使用 Google 登入，請選擇帳號類型");
        String name = in.name() != null && !in.name().isBlank() ? in.name() : g.name().isBlank() ? g.email().split("@")[0] : g.name();
        if (name.length() > 30) name = name.substring(0, 30);
        return issue(switch (in.accountType()) {
            case "self" -> createSelf(name, g.email(), null, g.sub());
            case "studio" -> {
                if (in.studio() == null || in.studio().isBlank()) throw ApiException.badRequest("請輸入工作室名稱");
                yield createCoach(name, g.email(), null, g.sub(), in.studio(), null, true);
            }
            default -> createCoach(name, g.email(), null, g.sub(), null, null, false);
        });
    }

    /** A new token for the caller's current role (e.g. after a paid upgrade to a studio). */
    public AuthResponse refresh(CurrentUser user) {
        return issueFor(user.userId());
    }

    /** A free coach, or with {@code studio} a studio owner; the workspace starts its free trial. */
    private UserAccount createCoach(String name, String rawEmail, String passwordHash, String googleSub, String studioName, String title, boolean studio) {
        String email = rawEmail.trim();
        Instant now = Instant.now();
        UserAccount u = new UserAccount();
        u.id = Ids.newId("coach");
        u.role = studio ? Domain.OWNER : Domain.COACH;
        u.name = name.trim();
        u.email = email;
        u.coachId = u.id;
        u.passwordHash = passwordHash;
        u.googleSub = googleSub;
        u.createdAt = now;
        Coach c = new Coach();
        c.id = u.id;
        if (studio) c.kind = Domain.SPACE_STUDIO;
        c.name = u.name;
        c.email = email;
        c.title = title == null || title.isBlank() ? "教練" : title.trim();
        c.studio = studioName == null ? "" : studioName.trim();
        c.subscription = Plans.trial(now);
        c.createdAt = now;
        createAccount(u, tx -> tx.create(db.doc(Db.COACHES, c.id), c));
        return u;
    }

    /**
     * A self-tracker gets a one-person space: a coach document they own (the tenant root every
     * query is scoped by) holding a single student — themselves — with the same ID. Free, no trial.
     */
    private UserAccount createSelf(String name, String rawEmail, String passwordHash, String googleSub) {
        String email = rawEmail.trim();
        Instant now = Instant.now();
        UserAccount u = new UserAccount();
        u.id = Ids.newId("self");
        u.role = Domain.SELF;
        u.name = name.trim();
        u.email = email;
        u.coachId = u.id;
        u.passwordHash = passwordHash;
        u.googleSub = googleSub;
        u.createdAt = now;
        Coach space = new Coach();
        space.id = u.id;
        space.kind = Domain.SPACE_SELF;
        space.name = u.name;
        space.email = email;
        space.title = "";
        space.studio = "";
        space.createdAt = now;
        Student s = new Student();
        s.id = u.id;
        s.coachId = u.id;
        s.name = u.name;
        s.email = email;
        s.goal = "general";
        s.status = "active";
        s.weeklyFrequency = 3;
        s.activated = true;
        s.joinedAt = now;
        s.createdAt = now;
        createAccount(u, tx -> {
            tx.create(db.doc(Db.COACHES, space.id), space);
            tx.create(db.coachDoc(u.id, Db.STUDENTS, s.id), s);
        });
        return u;
    }

    private interface TxWrites {
        void run(Db.Tx tx) throws Exception;
    }

    /** Claims the email and creates the user plus their workspace documents in one transaction. */
    private void createAccount(UserAccount u, TxWrites writes) {
        db.transaction(tx -> {
            var emailRef = db.doc(Db.EMAILS, key(u.email));
            if (tx.get(emailRef, EmailOwner.class).isPresent()) throw ApiException.conflict("email_taken", "此 Email 已註冊");
            tx.create(emailRef, new EmailOwner(u.id));
            tx.create(db.doc(Db.USERS, u.id), u);
            writes.run(tx);
            return null;
        });
    }

    /** Remembers the Google account; an invited student or studio coach is activated by it. */
    private void linkGoogle(UserAccount u, String sub) {
        db.transaction(tx -> {
            var userRef = db.doc(Db.USERS, u.id);
            UserAccount fresh = tx.get(userRef, UserAccount.class).orElseThrow(() -> ApiException.unauthorized("帳號不存在"));
            var studentRef = db.coachDoc(fresh.coachId, Db.STUDENTS, fresh.id);
            Student student = Domain.STUDENT.equals(fresh.role) ? tx.get(studentRef, Student.class).orElse(null) : null;
            String code = student != null ? student.inviteCode : fresh.inviteCode;
            if (code != null) tx.delete(db.doc(Db.INVITES, code));
            if (student != null && !Boolean.TRUE.equals(student.activated)) {
                student.activated = true;
                student.inviteCode = null;
                tx.set(studentRef, student);
            }
            fresh.googleSub = sub;
            fresh.inviteCode = null;
            tx.set(userRef, fresh);
            return null;
        });
        u.googleSub = sub;
    }

    public AuthResponse login(LoginInput in) {
        UserAccount u = db.get(db.doc(Db.EMAILS, key(in.email())), EmailOwner.class)
                .flatMap(o -> db.get(db.doc(Db.USERS, o.userId), UserAccount.class))
                .orElse(null);
        // Same message for unknown email and wrong password — don't reveal which accounts exist.
        if (u == null || u.passwordHash == null || !passwords.matches(in.password(), u.passwordHash)) {
            throw ApiException.unauthorized("Email 或密碼不正確");
        }
        if (Boolean.FALSE.equals(u.active)) throw ApiException.unauthorized("此帳號已停用，請聯絡工作室");
        return issue(u);
    }

    /** A student (code from their coach) or a studio coach (code from the owner) sets their password. */
    public AuthResponse activate(ActivateInput in) {
        String code = in.inviteCode().trim().toUpperCase(Locale.ROOT);
        String hash = passwords.encode(in.password());
        UserAccount u = db.transaction(tx -> {
            var inviteRef = db.doc(Db.INVITES, code);
            Invite invite = tx.get(inviteRef, Invite.class).orElseThrow(() -> ApiException.badRequest("邀請碼無效"));
            boolean forCoach = "coach".equals(invite.kind);
            if (invite.expiresAt == null || invite.expiresAt.isBefore(Instant.now())) {
                throw ApiException.badRequest(forCoach ? "邀請碼已過期，請向工作室索取新的邀請碼" : "邀請碼已過期，請向教練索取新的邀請碼");
            }
            var userRef = db.doc(Db.USERS, invite.studentId);
            if (forCoach) {
                UserAccount coach = tx.get(userRef, UserAccount.class).orElseThrow(() -> ApiException.badRequest("邀請碼無效"));
                if (Boolean.FALSE.equals(coach.active)) throw ApiException.badRequest("邀請碼無效");
                coach.passwordHash = hash;
                coach.inviteCode = null;
                tx.set(userRef, coach);
                tx.delete(inviteRef);
                return coach;
            }
            var studentRef = db.coachDoc(invite.coachId, Db.STUDENTS, invite.studentId);
            UserAccount account = tx.get(userRef, UserAccount.class).orElseThrow(() -> ApiException.badRequest("邀請碼無效"));
            Student student = tx.get(studentRef, Student.class).orElseThrow(() -> ApiException.badRequest("邀請碼無效"));
            account.passwordHash = hash;
            student.activated = true;
            student.inviteCode = null;
            tx.set(userRef, account);
            tx.set(studentRef, student);
            tx.delete(inviteRef);
            return account;
        });
        return issue(u);
    }

    public MeDto me(CurrentUser user) {
        UserAccount u = db.get(db.doc(Db.USERS, user.userId()), UserAccount.class).orElseThrow(() -> ApiException.unauthorized("帳號不存在"));
        return toMe(u);
    }

    public AuthResponse issueFor(String userId) {
        return issue(db.get(db.doc(Db.USERS, userId), UserAccount.class).orElseThrow(() -> ApiException.notFound("找不到帳號")));
    }

    private AuthResponse issue(UserAccount u) {
        TokenService.IssuedToken t = tokens.issue(u.id, u.role, u.coachId);
        return new AuthResponse(t.token(), t.expiresAt(), toMe(u));
    }

    private static MeDto toMe(UserAccount u) {
        return new MeDto(u.id, u.role, u.name, u.email, u.coachId, Domain.COACH.equals(u.role) || Domain.OWNER.equals(u.role) ? null : u.id);
    }

    private static String key(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
