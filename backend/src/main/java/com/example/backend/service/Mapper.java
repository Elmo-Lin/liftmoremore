package com.example.backend.service;

import com.example.backend.common.Domain;
import com.example.backend.domain.Appointment;
import com.example.backend.domain.Coach;
import com.example.backend.domain.Exercise;
import com.example.backend.domain.ProgressMetric;
import com.example.backend.domain.SessionPackage;
import com.example.backend.domain.SessionTransaction;
import com.example.backend.domain.Student;
import com.example.backend.domain.TrainingPlan;
import com.example.backend.domain.Workout;
import com.example.backend.web.Dtos.AppointmentDto;
import com.example.backend.web.Dtos.CoachDto;
import com.example.backend.web.Dtos.ExerciseDto;
import com.example.backend.web.Dtos.ExerciseLogDto;
import com.example.backend.web.Dtos.MetricDto;
import com.example.backend.web.Dtos.PackageDto;
import com.example.backend.web.Dtos.PlanDto;
import com.example.backend.web.Dtos.PrescriptionDto;
import com.example.backend.web.Dtos.RelationshipDto;
import com.example.backend.web.Dtos.SetLogDto;
import com.example.backend.web.Dtos.StudentDto;
import com.example.backend.web.Dtos.TrainingDayDto;
import com.example.backend.web.Dtos.TransactionDto;
import com.example.backend.web.Dtos.WorkoutDto;
import java.util.List;

/** Document ⇄ wire DTO. Visibility rules (e.g. hiding coach notes) are applied here by the {@code forCoach} flag. */
public final class Mapper {

    private Mapper() {}

    public static CoachDto coach(Coach c, boolean includeContact) {
        return new CoachDto(c.id, Domain.COACH, c.name, includeContact ? c.email : "", includeContact ? c.phone : null, c.title, c.studio, c.createdAt);
    }

    public static StudentDto student(Student s, boolean forCoach) {
        return new StudentDto(s.id, Domain.STUDENT, s.name, s.email, s.phone, s.gender, s.birthYear, s.heightCm, s.goal, s.goalDetail,
                s.status, s.weeklyFrequency, forCoach ? s.coachNotes : "", s.activePlanId, s.joinedAt, s.createdAt,
                forCoach ? s.activated : null);
    }

    public static RelationshipDto relationship(Student s) {
        return new RelationshipDto("rel_" + s.id, s.coachId, s.id, s.status, s.joinedAt);
    }

    public static ExerciseDto exercise(Exercise e) {
        return new ExerciseDto(e.id, e.name, e.nameEn, e.muscleGroup, e.equipment, e.increment);
    }

    public static PlanDto plan(TrainingPlan p) {
        return new PlanDto(p.id, p.coachId, Domain.COACH, p.name, p.description, p.goal, p.weeks,
                p.days.stream().map(Mapper::day).toList(), p.createdAt, p.updatedAt);
    }

    static TrainingDayDto day(TrainingPlan.TrainingDay d) {
        return new TrainingDayDto(d.id, d.name, d.focus, d.exercises.stream()
                .map(r -> new PrescriptionDto(r.id, r.exerciseId, r.sets, r.reps, r.targetWeightKg, r.restSec, r.notes)).toList());
    }

    public static WorkoutDto workout(Workout w) {
        List<ExerciseLogDto> logs = w.exercises.stream()
                .map(l -> new ExerciseLogDto(l.id, l.exerciseId,
                        l.sets.stream().map(s -> new SetLogDto(s.id, s.weightKg, s.reps, s.rpe, s.completed)).toList(), l.notes))
                .toList();
        return new WorkoutDto(w.id, w.studentId, w.coachId, w.type, w.createdBy, w.status, w.title, w.planId, w.trainingDayId,
                w.startedAt, w.completedAt, w.updatedAt, logs, w.notes);
    }

    public static PackageDto pkg(SessionPackage p) {
        return new PackageDto(p.id, p.studentId, p.coachId, p.name, p.totalSessions, p.priceTwd, p.purchaseDate, p.expiresAt, p.notes);
    }

    public static TransactionDto tx(SessionTransaction t) {
        return new TransactionDto(t.id, t.packageId, t.studentId, t.type, t.delta, t.reason, t.workoutId, t.createdAt, t.createdBy);
    }

    public static MetricDto metric(ProgressMetric m) {
        return new MetricDto(m.id, m.studentId, m.type, m.value, m.unit, m.recordedAt);
    }

    public static AppointmentDto appointment(Appointment a) {
        return new AppointmentDto(a.id, a.coachId, a.studentId, a.startAt, a.durationMin, a.location, a.status);
    }

    // ------------------------------------------------------------------ DTO → document (shared by save + demo import)

    public static TrainingPlan.TrainingDay dayDoc(TrainingDayDto d, String id) {
        TrainingPlan.TrainingDay day = new TrainingPlan.TrainingDay();
        day.id = id;
        day.name = d.name().trim();
        day.focus = d.focus();
        for (PrescriptionDto r : d.exercises()) {
            TrainingPlan.ExercisePrescription rx = new TrainingPlan.ExercisePrescription();
            rx.id = r.id();
            rx.exerciseId = r.exerciseId();
            rx.sets = r.sets();
            rx.reps = r.reps();
            rx.targetWeightKg = r.targetWeightKg();
            rx.restSec = r.restSec();
            rx.notes = r.notes();
            day.exercises.add(rx);
        }
        return day;
    }

    public static Workout.ExerciseLog logDoc(ExerciseLogDto l, String id) {
        Workout.ExerciseLog log = new Workout.ExerciseLog();
        log.id = id;
        log.exerciseId = l.exerciseId();
        log.notes = l.notes();
        for (SetLogDto s : l.sets()) {
            Workout.SetLog set = new Workout.SetLog();
            set.id = s.id();
            set.weightKg = s.weightKg();
            set.reps = s.reps();
            set.rpe = s.rpe();
            set.completed = s.completed();
            log.sets.add(set);
        }
        return log;
    }
}
