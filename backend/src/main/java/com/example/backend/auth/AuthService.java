package com.example.backend.auth;

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

    public AuthService(Db db, PasswordEncoder passwords, TokenService tokens) {
        this.db = db;
        this.passwords = passwords;
        this.tokens = tokens;
    }

    public AuthResponse registerCoach(RegisterCoachInput in) {
        String email = in.email().trim();
        Instant now = Instant.now();
        UserAccount u = new UserAccount();
        u.id = Ids.newId("coach");
        u.role = Domain.COACH;
        u.name = in.name().trim();
        u.email = email;
        u.coachId = u.id;
        u.passwordHash = passwords.encode(in.password());
        u.createdAt = now;
        Coach c = new Coach();
        c.id = u.id;
        c.name = u.name;
        c.email = email;
        c.title = in.title() == null || in.title().isBlank() ? "教練" : in.title().trim();
        c.studio = in.studio() == null ? "" : in.studio().trim();
        c.createdAt = now;

        db.transaction(tx -> {
            var emailRef = db.doc(Db.EMAILS, key(email));
            if (tx.get(emailRef, EmailOwner.class).isPresent()) throw ApiException.conflict("email_taken", "此 Email 已註冊");
            tx.create(emailRef, new EmailOwner(u.id));
            tx.create(db.doc(Db.USERS, u.id), u);
            tx.create(db.doc(Db.COACHES, c.id), c);
            return null;
        });
        return issue(u);
    }

    /** A studio owner: a coach whose workspace is a studio they can invite other coaches into. */
    public AuthResponse registerStudio(RegisterStudioInput in) {
        AuthResponse solo = registerCoach(new RegisterCoachInput(in.name(), in.email(), in.password(), in.studio(), null));
        String id = solo.user().userId();
        db.transaction(tx -> {
            var spaceRef = db.doc(Db.COACHES, id);
            Coach space = tx.get(spaceRef, Coach.class).orElseThrow();
            space.kind = Domain.SPACE_STUDIO;
            space.maxCoaches = Domain.DEFAULT_STUDIO_SEATS;
            tx.set(spaceRef, space);
            tx.update(db.doc(Db.USERS, id), "role", Domain.OWNER);
            return null;
        });
        return issueFor(id);
    }

    /**
     * A self-tracker gets a one-person space: a coach document they own (the tenant root every
     * query is scoped by) holding a single student — themselves — with the same ID.
     */
    public AuthResponse registerSelf(RegisterSelfInput in) {
        String email = in.email().trim();
        Instant now = Instant.now();
        UserAccount u = new UserAccount();
        u.id = Ids.newId("self");
        u.role = Domain.SELF;
        u.name = in.name().trim();
        u.email = email;
        u.coachId = u.id;
        u.passwordHash = passwords.encode(in.password());
        u.createdAt = now;
        Coach space = new Coach();
        space.id = u.id;
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

        db.transaction(tx -> {
            var emailRef = db.doc(Db.EMAILS, key(email));
            if (tx.get(emailRef, EmailOwner.class).isPresent()) throw ApiException.conflict("email_taken", "此 Email 已註冊");
            tx.create(emailRef, new EmailOwner(u.id));
            tx.create(db.doc(Db.USERS, u.id), u);
            tx.create(db.doc(Db.COACHES, space.id), space);
            tx.create(db.coachDoc(u.id, Db.STUDENTS, s.id), s);
            return null;
        });
        return issue(u);
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
