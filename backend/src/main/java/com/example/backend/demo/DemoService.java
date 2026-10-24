package com.example.backend.demo;

import com.example.backend.billing.Plans;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.domain.Appointment;
import com.example.backend.domain.Coach;
import com.example.backend.domain.ProgressMetric;
import com.example.backend.domain.SessionPackage;
import com.example.backend.domain.SessionTransaction;
import com.example.backend.domain.Student;
import com.example.backend.domain.TrainingPlan;
import com.example.backend.domain.UserAccount;
import com.example.backend.domain.Workout;
import com.example.backend.service.Mapper;
import com.example.backend.service.StudentService;
import com.example.backend.service.StudentService.EmailOwner;
import com.example.backend.store.Db;
import com.example.backend.web.Dtos.AppDataDto;
import com.example.backend.web.Dtos.AppointmentDto;
import com.example.backend.web.Dtos.CoachMemberDto;
import com.example.backend.web.Dtos.ExerciseLogDto;
import com.example.backend.web.Dtos.MetricDto;
import com.example.backend.web.Dtos.PackageDto;
import com.example.backend.web.Dtos.PlanDto;
import com.example.backend.web.Dtos.RelationshipDto;
import com.example.backend.web.Dtos.StudentDto;
import com.example.backend.web.Dtos.TrainingDayDto;
import com.example.backend.web.Dtos.TransactionDto;
import com.example.backend.web.Dtos.WorkoutDto;
import com.google.cloud.firestore.BulkWriter;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Demo-only: replace all coach/user data with an AppData snapshot (the same JSON the frontend
 * generates for its offline demo). Every imported account gets the demo password.
 */
@Service
public class DemoService {

    private final Db db;
    private final PasswordEncoder passwords;

    public DemoService(Db db, PasswordEncoder passwords) {
        this.db = db;
        this.passwords = passwords;
    }

    public boolean isSeeded() {
        return !Db.await(db.fs.collection(Db.COACHES).limit(1).get()).isEmpty();
    }

    public String firstCoachId() {
        List<QueryDocumentSnapshot> docs = Db.await(db.fs.collection(Db.COACHES).orderBy(com.google.cloud.firestore.FieldPath.documentId()).limit(1).get()).getDocuments();
        if (docs.isEmpty()) throw ApiException.conflict("demo_not_seeded", "尚未匯入示範資料");
        return docs.get(0).getId();
    }

    public int importData(AppDataDto data, String demoPassword) {
        if (data.coach() == null) throw ApiException.badRequest("缺少教練資料");
        for (String col : List.of(Db.COACHES, Db.USERS, Db.EMAILS, Db.INVITES)) Db.await(db.fs.recursiveDelete(db.fs.collection(col)));
        String hash = passwords.encode(demoPassword);
        String coachId = data.coach().id();
        BulkWriter w = db.fs.bulkWriter();

        // Exercises are built in (ExerciseCatalog); the demo data uses only those.

        Coach coach = new Coach();
        coach.id = coachId;
        coach.name = data.coach().name();
        coach.email = data.coach().email();
        coach.phone = data.coach().phone();
        coach.title = data.coach().title();
        coach.studio = data.coach().studio();
        coach.createdAt = data.coach().createdAt();
        boolean studio = data.studio() != null && Domain.SPACE_STUDIO.equals(data.studio().kind());
        if (studio) {
            coach.kind = Domain.SPACE_STUDIO;
        }
        // The demo data is months old; give the demo workspace a fresh trial so it stays writable.
        coach.subscription = Plans.trial(Instant.now());
        w.set(db.doc(Db.COACHES, coachId), db.encode(coach));
        account(w, coachId, studio ? Domain.OWNER : Domain.COACH, coach.name, coach.email, coach.phone, coach.createdAt, coachId, hash);
        if (studio) {
            for (CoachMemberDto m : data.studio().coaches()) {
                if (!m.id().equals(coachId)) account(w, m.id(), Domain.COACH, m.name(), m.email(), null, m.createdAt(), coachId, hash);
            }
        }
        // Which coach teaches each student (the owner when not stated).
        Map<String, String> teacher = new HashMap<>();
        for (RelationshipDto r : data.relationships()) if (!coachId.equals(r.coachId())) teacher.put(r.studentId(), r.coachId());

        for (StudentDto s : data.students()) {
            Student st = new Student();
            st.id = s.id();
            st.coachId = coachId;
            st.assignedCoachId = teacher.get(s.id());
            st.name = s.name();
            st.email = s.email();
            st.phone = s.phone();
            st.gender = s.gender();
            st.birthYear = s.birthYear();
            st.heightCm = s.heightCm();
            st.goal = s.goal();
            st.goalDetail = s.goalDetail() == null ? "" : s.goalDetail();
            st.status = s.status();
            st.weeklyFrequency = s.weeklyFrequency();
            st.coachNotes = s.coachNotes() == null ? "" : s.coachNotes();
            st.activePlanId = s.activePlanId();
            st.joinedAt = s.joinedAt();
            st.createdAt = s.createdAt() != null ? s.createdAt() : s.joinedAt();
            st.activated = true;
            w.set(db.coachDoc(coachId, Db.STUDENTS, st.id), db.encode(st));
            account(w, st.id, Domain.STUDENT, st.name, st.email, st.phone, st.createdAt, coachId, hash);
        }

        for (PlanDto p : data.plans()) {
            TrainingPlan plan = new TrainingPlan();
            plan.id = p.id();
            plan.coachId = coachId;
            plan.name = p.name();
            plan.description = p.description() == null ? "" : p.description();
            plan.goal = p.goal();
            plan.weeks = p.weeks();
            plan.createdAt = p.createdAt();
            plan.updatedAt = p.updatedAt();
            for (TrainingDayDto d : p.days()) plan.days.add(Mapper.dayDoc(d, d.id()));
            w.set(db.coachDoc(coachId, Db.PLANS, plan.id), db.encode(plan));
        }

        for (WorkoutDto in : data.workouts()) {
            Workout wo = new Workout();
            wo.id = in.id();
            wo.studentId = in.studentId();
            wo.coachId = in.coachId();
            wo.type = in.type();
            wo.createdBy = in.createdBy();
            wo.status = in.status();
            wo.title = in.title();
            wo.planId = in.planId();
            wo.trainingDayId = in.trainingDayId();
            wo.appointmentId = in.appointmentId();
            wo.startedAt = in.startedAt();
            wo.completedAt = in.completedAt();
            wo.updatedAt = in.updatedAt() != null ? in.updatedAt() : in.startedAt();
            wo.notes = in.notes() == null ? "" : in.notes();
            for (ExerciseLogDto l : in.exercises()) wo.exercises.add(Mapper.logDoc(l, l.id()));
            w.set(db.coachDoc(coachId, Db.WORKOUTS, wo.id), db.encode(wo));
        }

        for (PackageDto in : data.packages()) {
            SessionPackage p = new SessionPackage();
            p.id = in.id();
            p.studentId = in.studentId();
            p.coachId = coachId;
            p.name = in.name();
            p.totalSessions = in.totalSessions();
            p.priceTwd = in.priceTwd();
            p.purchaseDate = in.purchaseDate();
            p.expiresAt = in.expiresAt();
            p.notes = in.notes();
            w.set(db.coachDoc(coachId, Db.PACKAGES, p.id), db.encode(p));
        }

        for (TransactionDto in : data.transactions()) {
            SessionTransaction t = new SessionTransaction();
            t.id = in.id();
            t.packageId = in.packageId();
            t.studentId = in.studentId();
            t.type = in.type();
            t.delta = in.delta();
            t.reason = in.reason();
            t.workoutId = in.workoutSessionId();
            t.createdAt = in.createdAt();
            t.createdBy = in.createdBy();
            w.set(db.coachDoc(coachId, Db.TRANSACTIONS, t.id), db.encode(t));
        }

        for (MetricDto in : data.metrics()) {
            ProgressMetric m = new ProgressMetric();
            m.id = in.id();
            m.studentId = in.studentId();
            m.type = in.type();
            m.value = in.value();
            m.unit = in.unit();
            m.recordedAt = in.recordedAt();
            w.set(db.coachDoc(coachId, Db.METRICS, m.id), db.encode(m));
        }

        for (AppointmentDto in : data.appointments()) {
            Appointment a = new Appointment();
            a.id = in.id();
            a.coachId = coachId;
            a.studentId = in.studentId();
            a.startAt = in.startAt();
            a.durationMin = in.durationMin();
            a.location = in.location();
            a.status = in.status();
            w.set(db.coachDoc(coachId, Db.APPOINTMENTS, a.id), db.encode(a));
        }
        Db.finish(w);
        return data.students().size();
    }

    private void account(BulkWriter w, String id, String role, String name, String email, String phone, Instant createdAt, String coachId, String hash) {
        UserAccount u = new UserAccount();
        u.id = id;
        u.role = role;
        u.name = name;
        u.email = email;
        u.phone = phone;
        u.createdAt = createdAt != null ? createdAt : Instant.now();
        u.coachId = coachId;
        u.passwordHash = hash;
        w.set(db.doc(Db.USERS, id), db.encode(u));
        w.set(db.doc(Db.EMAILS, StudentService.key(email)), db.encode(new EmailOwner(id)));
    }
}
