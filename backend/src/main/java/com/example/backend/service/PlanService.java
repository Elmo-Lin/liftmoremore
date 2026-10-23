package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.common.Ids;
import com.example.backend.domain.Exercise;
import com.example.backend.domain.Student;
import com.example.backend.domain.TrainingPlan;
import com.example.backend.store.Db;
import com.example.backend.store.ExerciseCatalog;
import com.example.backend.web.Dtos.PlanDto;
import com.example.backend.web.Dtos.PrescriptionDto;
import com.example.backend.web.Dtos.TrainingDayDto;
import com.google.cloud.firestore.WriteBatch;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Plans are coach-authored. Students can only read the plan currently assigned to them. */
@Service
public class PlanService {

    private final Db db;
    private final ExerciseCatalog catalog;
    private final AccessService access;

    public PlanService(Db db, ExerciseCatalog catalog, AccessService access) {
        this.db = db;
        this.catalog = catalog;
        this.access = access;
    }

    public List<PlanDto> list(CurrentUser user) {
        if (user.isStudent()) {
            Student self = access.student(user, user.userId());
            if (self.activePlanId == null) return List.of();
            return db.get(db.coachDoc(user.coachId(), Db.PLANS, self.activePlanId), TrainingPlan.class).map(Mapper::plan).stream().toList();
        }
        return db.list(db.coachCol(user.coachId(), Db.PLANS), TrainingPlan.class).stream()
                .sorted(Comparator.comparing((TrainingPlan p) -> p.updatedAt).reversed())
                .map(Mapper::plan)
                .toList();
    }

    public PlanDto get(CurrentUser user, String id) {
        if (user.isStudent() && !id.equals(access.student(user, user.userId()).activePlanId)) throw ApiException.notFound("找不到計畫");
        return db.get(db.coachDoc(user.coachId(), Db.PLANS, id), TrainingPlan.class).map(Mapper::plan)
                .orElseThrow(() -> ApiException.notFound("找不到計畫"));
    }

    /** Create or replace a plan (PUT semantics). Days and prescriptions are replaced as a whole. */
    public PlanDto save(CurrentUser user, String id, PlanDto in) {
        user.requireCoach();
        String planId = Ids.orNew(id, "plan");
        Domain.require(Domain.GOALS, in.goal(), "goal");
        validateExercises(in.days());
        Instant now = Instant.now();
        var ref = db.coachDoc(user.coachId(), Db.PLANS, planId);
        TrainingPlan existing = db.get(ref, TrainingPlan.class).orElse(null);

        TrainingPlan p = new TrainingPlan();
        p.id = planId;
        p.coachId = user.coachId();
        p.createdAt = existing != null ? existing.createdAt : (in.createdAt() != null ? in.createdAt() : now);
        p.updatedAt = now;
        p.name = in.name().trim();
        p.description = in.description() == null ? "" : in.description().trim();
        p.goal = in.goal();
        p.weeks = in.weeks();
        for (TrainingDayDto d : in.days()) {
            TrainingDayDto withIds = new TrainingDayDto(d.id(), d.name(), d.focus(), d.exercises().stream()
                    .map(r -> new PrescriptionDto(Ids.orNew(r.id(), "rx"), r.exerciseId(), r.sets(), r.reps(), r.targetWeightKg(), r.restSec(), r.notes()))
                    .toList());
            p.days.add(Mapper.dayDoc(withIds, Ids.orNew(d.id(), "day")));
        }
        db.set(ref, p);
        return Mapper.plan(p);
    }

    public PlanDto duplicate(CurrentUser user, String id, String newId) {
        PlanDto src = get(user.requireCoach(), id);
        List<TrainingDayDto> days = src.days().stream()
                .map(d -> new TrainingDayDto(Ids.newId("day"), d.name(), d.focus(),
                        d.exercises().stream()
                                .map(r -> new PrescriptionDto(Ids.newId("rx"), r.exerciseId(), r.sets(), r.reps(), r.targetWeightKg(), r.restSec(), r.notes()))
                                .toList()))
                .toList();
        PlanDto copy = new PlanDto(null, null, Domain.COACH, src.name() + "（副本）", src.description(), src.goal(), src.weeks(), days, null, null);
        return save(user, Ids.orNew(newId, "plan"), copy);
    }

    public void delete(CurrentUser user, String id) {
        var ref = db.coachDoc(user.requireCoach().coachId(), Db.PLANS, id);
        if (db.get(ref, TrainingPlan.class).isEmpty()) throw ApiException.notFound("找不到計畫");
        WriteBatch batch = db.fs.batch();
        // Unassign; past workouts keep their planId as a historical reference.
        for (Student s : db.list(db.coachCol(user.coachId(), Db.STUDENTS).whereEqualTo("activePlanId", id), Student.class)) {
            batch.update(db.coachDoc(user.coachId(), Db.STUDENTS, s.id), "activePlanId", com.google.cloud.firestore.FieldValue.delete());
        }
        batch.delete(ref);
        Db.await(batch.commit());
    }

    /** Sets exactly {@code studentIds} as the students on this plan (others on it are unassigned). */
    public void assign(CurrentUser user, String planId, List<String> studentIds) {
        user.requireCoach();
        if (db.get(db.coachDoc(user.coachId(), Db.PLANS, planId), TrainingPlan.class).isEmpty()) throw ApiException.notFound("找不到計畫");
        Set<String> chosen = new HashSet<>(studentIds);
        for (String sid : chosen) access.student(user, sid);
        WriteBatch batch = db.fs.batch();
        for (Student s : access.visibleStudents(user)) {
            var ref = db.coachDoc(user.coachId(), Db.STUDENTS, s.id);
            if (chosen.contains(s.id) && !planId.equals(s.activePlanId)) batch.update(ref, "activePlanId", planId);
            else if (!chosen.contains(s.id) && planId.equals(s.activePlanId)) batch.update(ref, "activePlanId", com.google.cloud.firestore.FieldValue.delete());
        }
        Db.await(batch.commit());
    }

    private void validateExercises(List<TrainingDayDto> days) {
        Set<String> known = catalog.all().stream().map((Exercise e) -> e.id).collect(Collectors.toSet());
        for (TrainingDayDto d : days) {
            for (PrescriptionDto r : d.exercises()) {
                if (!known.contains(r.exerciseId())) throw ApiException.badRequest("未知的動作：" + r.exerciseId());
            }
        }
    }
}
