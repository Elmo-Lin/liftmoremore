package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.common.Ids;
import com.example.backend.domain.Invite;
import com.example.backend.domain.Student;
import com.example.backend.domain.UserAccount;
import com.example.backend.store.Db;
import com.example.backend.web.Dtos.InviteDto;
import com.example.backend.web.Dtos.StudentDto;
import com.example.backend.web.Dtos.StudentInput;
import com.google.cloud.firestore.BulkWriter;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import java.time.Duration;
import java.time.Instant;
import java.time.Year;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class StudentService {

    private static final Duration INVITE_TTL = Duration.ofDays(14);

    private final Db db;
    private final AccessService access;

    public StudentService(Db db, AccessService access) {
        this.db = db;
        this.access = access;
    }

    public List<StudentDto> list(CurrentUser user) {
        if (user.isStudent()) return List.of(Mapper.student(access.student(user, user.userId()), false));
        return db.list(db.coachCol(user.userId(), Db.STUDENTS), Student.class).stream()
                .sorted(Comparator.comparing((Student s) -> s.joinedAt))
                .map(s -> Mapper.student(s, true))
                .toList();
    }

    public StudentDto get(CurrentUser user, String id) {
        return Mapper.student(access.student(user, id), user.isCoach());
    }

    public StudentDto create(CurrentUser user, StudentInput in) {
        user.requireCoach();
        String id = Ids.orNew(in.id(), "stu");
        validate(user, in);
        String email = in.email().trim();
        Instant now = Instant.now();

        Student s = new Student();
        s.id = id;
        s.coachId = user.userId();
        s.joinedAt = now;
        s.createdAt = now;
        apply(s, in);
        UserAccount account = new UserAccount();
        account.id = id;
        account.role = Domain.STUDENT;
        account.coachId = user.userId();
        account.createdAt = now;
        copyProfile(account, s);

        db.transaction(tx -> {
            DocumentReference emailRef = db.doc(Db.EMAILS, key(email));
            if (tx.get(emailRef, EmailOwner.class).isPresent()) throw ApiException.conflict("email_taken", "此 Email 已被其他帳號使用");
            if (tx.get(db.doc(Db.USERS, id), UserAccount.class).isPresent()) throw ApiException.conflict("id_taken", "此 ID 已被使用");
            tx.create(db.doc(Db.USERS, id), account);
            tx.create(emailRef, new EmailOwner(id));
            tx.create(db.coachDoc(user.userId(), Db.STUDENTS, id), s);
            return null;
        });
        return Mapper.student(s, true);
    }

    public StudentDto update(CurrentUser user, String id, StudentInput in) {
        access.coachStudent(user, id);
        validate(user, in);
        String newEmail = in.email().trim();
        return db.transaction(tx -> {
            DocumentReference ref = db.coachDoc(user.userId(), Db.STUDENTS, id);
            Student s = tx.get(ref, Student.class).orElseThrow(() -> ApiException.notFound("找不到此學員"));
            UserAccount account = tx.get(db.doc(Db.USERS, id), UserAccount.class).orElseThrow();
            boolean emailChanged = !key(s.email).equals(key(newEmail));
            if (emailChanged) {
                var owner = tx.get(db.doc(Db.EMAILS, key(newEmail)), EmailOwner.class);
                if (owner.isPresent() && !id.equals(owner.get().userId)) throw ApiException.conflict("email_taken", "此 Email 已被其他帳號使用");
            }
            String oldEmail = s.email;
            apply(s, in);
            copyProfile(account, s);
            tx.set(ref, s);
            tx.set(db.doc(Db.USERS, id), account);
            if (emailChanged) {
                tx.delete(db.doc(Db.EMAILS, key(oldEmail)));
                tx.set(db.doc(Db.EMAILS, key(newEmail)), new EmailOwner(id));
            }
            return Mapper.student(s, true);
        });
    }

    /** Deletes the student and everything that belongs to them. */
    public void delete(CurrentUser user, String id) {
        Student s = access.coachStudent(user, id);
        BulkWriter writer = db.fs.bulkWriter();
        for (String col : List.of(Db.WORKOUTS, Db.PACKAGES, Db.TRANSACTIONS, Db.METRICS, Db.APPOINTMENTS)) {
            for (QueryDocumentSnapshot d : Db.await(db.coachCol(s.coachId, col).whereEqualTo("studentId", id).get()).getDocuments()) {
                writer.delete(d.getReference());
            }
        }
        writer.delete(db.coachDoc(s.coachId, Db.LEDGERS, id));
        if (s.inviteCode != null) writer.delete(db.doc(Db.INVITES, s.inviteCode));
        writer.delete(db.doc(Db.EMAILS, key(s.email)));
        writer.delete(db.doc(Db.USERS, id));
        writer.delete(db.coachDoc(s.coachId, Db.STUDENTS, id));
        Db.finish(writer);
    }

    /** One-time code the student uses to set a password (see AuthService#activate). Replaces any previous code. */
    public InviteDto invite(CurrentUser user, String id) {
        Student s = access.coachStudent(user, id);
        Invite invite = new Invite();
        invite.studentId = id;
        invite.coachId = s.coachId;
        invite.expiresAt = Instant.now().plus(INVITE_TTL);
        for (int attempt = 0; ; attempt++) {
            invite.code = Ids.inviteCode();
            try {
                db.create(db.doc(Db.INVITES, invite.code), invite);
                break;
            } catch (ApiException e) {
                if (!"id_taken".equals(e.code()) || attempt > 5) throw e;
            }
        }
        if (s.inviteCode != null) db.delete(db.doc(Db.INVITES, s.inviteCode));
        db.update(db.coachDoc(s.coachId, Db.STUDENTS, id), "inviteCode", invite.code);
        return new InviteDto(invite.code, invite.expiresAt);
    }

    /** {@code emails/{email}} document body. */
    public static class EmailOwner {
        public String userId;

        public EmailOwner() {}

        public EmailOwner(String userId) {
            this.userId = userId;
        }
    }

    public static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private void validate(CurrentUser user, StudentInput in) {
        Domain.require(Domain.GENDERS, in.gender(), "gender");
        Domain.require(Domain.GOALS, in.goal(), "goal");
        Domain.require(Domain.STUDENT_STATUSES, in.status(), "status");
        if (in.birthYear() != null && in.birthYear() > Year.now().getValue() - 10) throw ApiException.badRequest("出生年份不合理");
        if (in.activePlanId() != null && !Db.await(db.coachDoc(user.userId(), Db.PLANS, in.activePlanId()).get()).exists()) {
            throw ApiException.badRequest("找不到指派的計畫");
        }
    }

    private static void apply(Student s, StudentInput in) {
        s.name = in.name().trim();
        s.email = in.email().trim();
        s.phone = in.phone() == null || in.phone().isBlank() ? null : in.phone().trim();
        s.gender = in.gender();
        s.birthYear = in.birthYear();
        s.heightCm = in.heightCm();
        s.goal = in.goal();
        s.goalDetail = in.goalDetail() == null ? "" : in.goalDetail().trim();
        s.status = in.status();
        s.weeklyFrequency = in.weeklyFrequency();
        s.coachNotes = in.coachNotes() == null ? "" : in.coachNotes();
        s.activePlanId = in.activePlanId();
    }

    private static void copyProfile(UserAccount a, Student s) {
        a.name = s.name;
        a.email = s.email;
        a.phone = s.phone;
    }
}
