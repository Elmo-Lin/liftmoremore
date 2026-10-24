package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.common.Ids;
import com.example.backend.domain.Appointment;
import com.example.backend.domain.SessionTransaction;
import com.example.backend.domain.Student;
import com.example.backend.domain.Workout;
import com.example.backend.store.Db;
import com.example.backend.store.ExerciseCatalog;
import com.example.backend.web.Dtos.ExerciseLogDto;
import com.example.backend.web.Dtos.SetLogDto;
import com.example.backend.web.Dtos.WorkoutDto;
import com.google.cloud.firestore.Query;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Workout logging. Saving a workout NEVER touches session balances — billing is a separate,
 * explicit action in {@link BillingService#deduct}. A coached session belongs to one scheduled
 * class: finishing it marks the class completed, and a class holds at most one workout.
 */
@Service
public class WorkoutService {

    private final Db db;
    private final ExerciseCatalog catalog;
    private final AccessService access;

    public WorkoutService(Db db, ExerciseCatalog catalog, AccessService access) {
        this.db = db;
        this.catalog = catalog;
        this.access = access;
    }

    public List<WorkoutDto> list(CurrentUser user, String studentId) {
        Query q = db.coachCol(user.coachId(), Db.WORKOUTS);
        if (studentId != null) {
            access.student(user, studentId);
            q = q.whereEqualTo("studentId", studentId);
        } else if (user.isStudent()) {
            q = q.whereEqualTo("studentId", user.userId());
        }
        Set<String> visible = studentId != null || user.isStudent() ? null : access.visibleStudentIds(user);
        return db.list(q, Workout.class).stream()
                .filter(w -> visible == null || visible.contains(w.studentId))
                .sorted(Comparator.comparing((Workout w) -> w.startedAt).reversed())
                .map(Mapper::workout)
                .toList();
    }

    public WorkoutDto get(CurrentUser user, String id) {
        Workout w = db.get(db.coachDoc(user.coachId(), Db.WORKOUTS, id), Workout.class).orElseThrow(WorkoutService::notFound);
        if (user.isStudent() && !w.studentId.equals(user.userId())) throw notFound();
        requireVisible(user, w.studentId);
        return Mapper.workout(w);
    }

    /** Create or replace a workout (drafts autosave through here too). */
    public WorkoutDto save(CurrentUser user, String id, WorkoutDto in) {
        String workoutId = Ids.orNew(id, "wo");
        Domain.require(Domain.WORKOUT_TYPES, in.type(), "type");
        Domain.require(Domain.WORKOUT_STATUSES, in.status(), "status");
        Student student = access.student(user, in.studentId());
        if (user.isStudent() && !"independent".equals(in.type())) throw ApiException.forbidden("學員只能記錄自主訓練");
        boolean completed = "completed".equals(in.status());
        if (completed && in.exercises().stream().noneMatch(e -> e.sets().stream().anyMatch(SetLogDto::completed))) {
            throw ApiException.badRequest("請至少完成一組再結束訓練");
        }
        validateExercises(user.coachId(), in.exercises());
        String appointmentId = "coached".equals(in.type()) && in.appointmentId() != null && !in.appointmentId().isBlank() ? in.appointmentId() : null;

        var ref = db.coachDoc(user.coachId(), Db.WORKOUTS, workoutId);
        var apptRef = appointmentId == null ? null : db.coachDoc(user.coachId(), Db.APPOINTMENTS, appointmentId);
        return db.transaction(tx -> {
            Workout existing = tx.get(ref, Workout.class).orElse(null);
            Appointment appt = null;
            if (apptRef != null) {
                appt = tx.get(apptRef, Appointment.class).orElseThrow(() -> ApiException.badRequest("找不到這堂課"));
                if (!appt.studentId.equals(student.id)) throw ApiException.badRequest("這堂課不是此學員的");
                if ("cancelled".equals(appt.status)) throw ApiException.badRequest("這堂課已取消");
                boolean taken = tx.list(db.coachCol(user.coachId(), Db.WORKOUTS).whereEqualTo("appointmentId", appointmentId), Workout.class).stream()
                        .anyMatch(o -> !o.id.equals(workoutId));
                if (taken) throw ApiException.conflict("class_logged", "這堂課已經有訓練紀錄");
            }
            if (existing != null) {
                if (user.isStudent() && (!existing.studentId.equals(user.userId()) || !Domain.STUDENT.equals(existing.createdBy))) {
                    throw ApiException.forbidden("無法修改教練記錄的課程");
                }
                // The ID is client-chosen: a studio coach must not overwrite another coach's student's workout.
                requireVisible(user, existing.studentId);
                List<SessionTransaction> linked = tx.list(db.coachCol(user.coachId(), Db.TRANSACTIONS).whereEqualTo("workoutId", workoutId), SessionTransaction.class);
                if (Ledger.netForWorkout(workoutId, linked) < 0) {
                    if (!existing.studentId.equals(in.studentId())) throw ApiException.conflict("already_deducted", "已扣堂的課程無法更換學員");
                    if (!"coached".equals(in.type())) throw ApiException.conflict("already_deducted", "已扣堂的課程無法改為自主訓練");
                    if (!completed) throw ApiException.conflict("already_deducted", "已扣堂的課程無法改回草稿");
                }
            }
            Instant now = Instant.now();
            Workout w = new Workout();
            w.id = workoutId;
            w.createdBy = existing != null ? existing.createdBy : (user.isStudent() ? Domain.STUDENT : Domain.COACH);
            w.billingRevision = existing != null ? existing.billingRevision : 0;
            w.studentId = student.id;
            // Who taught a coached session: kept from the first save, else the coach logging it
            // (in a studio that may be a substitute, not the student's own coach).
            w.coachId = !"coached".equals(in.type()) ? null : existing != null && existing.coachId != null ? existing.coachId : user.userId();
            w.type = in.type();
            w.status = in.status();
            w.title = in.title() == null || in.title().isBlank() ? "自由訓練" : in.title().trim();
            w.planId = in.planId();
            w.trainingDayId = in.trainingDayId();
            w.appointmentId = appointmentId;
            w.startedAt = in.startedAt();
            w.completedAt = completed ? (in.completedAt() != null ? in.completedAt() : now) : null;
            w.updatedAt = now;
            w.notes = in.notes() == null ? "" : in.notes();
            for (ExerciseLogDto l : in.exercises()) {
                List<SetLogDto> sets = l.sets().stream().map(s -> new SetLogDto(Ids.orNew(s.id(), "set"), s.weightKg(), s.reps(), s.rpe(), s.completed())).toList();
                w.exercises.add(Mapper.logDoc(new ExerciseLogDto(l.id(), l.exerciseId(), sets, l.notes()), Ids.orNew(l.id(), "el")));
            }
            tx.set(ref, w);
            if (completed && appt != null && "scheduled".equals(appt.status)) tx.update(apptRef, "status", "completed");
            return Mapper.workout(w);
        });
    }

    public void delete(CurrentUser user, String id) {
        var ref = db.coachDoc(user.coachId(), Db.WORKOUTS, id);
        db.transaction(tx -> {
            Workout w = tx.get(ref, Workout.class).orElseThrow(WorkoutService::notFound);
            if (user.isStudent()) {
                if (!w.studentId.equals(user.userId())) throw notFound();
                if (!Domain.STUDENT.equals(w.createdBy)) throw ApiException.forbidden("無法刪除教練記錄的課程");
            }
            requireVisible(user, w.studentId);
            List<SessionTransaction> linked = tx.list(db.coachCol(user.coachId(), Db.TRANSACTIONS).whereEqualTo("workoutId", id), SessionTransaction.class);
            if (Ledger.netForWorkout(id, linked) < 0) throw ApiException.conflict("already_deducted", "此課程已扣堂，請先撤銷扣堂再刪除");
            // The class is no longer logged: back on the schedule as not yet done.
            var apptRef = w.appointmentId == null ? null : db.coachDoc(user.coachId(), Db.APPOINTMENTS, w.appointmentId);
            Appointment appt = apptRef == null ? null : tx.get(apptRef, Appointment.class).orElse(null);
            tx.delete(ref);
            if (appt != null && "completed".equals(appt.status)) tx.update(apptRef, "status", "scheduled");
            return null;
        });
    }

    private void validateExercises(String spaceId, List<ExerciseLogDto> logs) {
        Set<String> known = catalog.knownIds(spaceId);
        for (ExerciseLogDto l : logs) {
            if (!known.contains(l.exerciseId())) throw ApiException.badRequest("未知的動作：" + l.exerciseId());
            for (SetLogDto s : l.sets()) {
                if (s.completed() && (s.reps() == null || s.reps() <= 0)) throw ApiException.badRequest("已完成的組數需要填寫次數");
            }
        }
    }

    /** Studio coaches may only touch their own students' workouts (students are checked by ID above). */
    private void requireVisible(CurrentUser user, String studentId) {
        if (user.isStudent()) return;
        Student s = db.get(db.coachDoc(user.coachId(), Db.STUDENTS, studentId), Student.class).orElseThrow(WorkoutService::notFound);
        if (!access.canSee(user, s)) throw notFound();
    }

    private static ApiException notFound() {
        return ApiException.notFound("找不到此訓練紀錄");
    }
}
