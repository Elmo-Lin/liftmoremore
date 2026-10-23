package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.billing.SubscriptionService;
import com.example.backend.common.ApiException;
import com.example.backend.domain.Appointment;
import com.example.backend.domain.Coach;
import com.example.backend.domain.ProgressMetric;
import com.example.backend.domain.SessionPackage;
import com.example.backend.domain.SessionTransaction;
import com.example.backend.domain.Student;
import com.example.backend.domain.TrainingPlan;
import com.example.backend.domain.Workout;
import com.example.backend.store.Db;
import com.example.backend.store.ExerciseCatalog;
import com.example.backend.web.Dtos.AppDataDto;
import com.example.backend.web.Dtos.CoachDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QuerySnapshot;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * One request that returns everything the caller may see, in the frontend's AppData shape.
 * Free coaches and studio owners get the whole workspace; studio coaches get their own students
 * (and the shared plans); students get only their own records, their assigned plan, and never the
 * coach's private notes. Collections are fetched in parallel.
 */
@Service
public class BootstrapService {

    public static final int SCHEMA_VERSION = 1;

    private final Db db;
    private final ExerciseCatalog catalog;
    private final AccessService access;
    private final StudioService studios;
    private final SubscriptionService subscriptions;

    public BootstrapService(Db db, ExerciseCatalog catalog, AccessService access, StudioService studios, SubscriptionService subscriptions) {
        this.db = db;
        this.catalog = catalog;
        this.access = access;
        this.studios = studios;
        this.subscriptions = subscriptions;
    }

    public AppDataDto load(CurrentUser user) {
        String coachId = user.coachId();
        Coach space = subscriptions.startTrialIfMissing(
                db.get(db.doc(Db.COACHES, coachId), Coach.class).orElseThrow(() -> ApiException.notFound("找不到教練資料")));
        boolean asCoach = user.isCoach();

        // Fire all reads at once, then collect.
        ApiFuture<QuerySnapshot> students = scoped(coachId, Db.STUDENTS, user, "id");
        ApiFuture<QuerySnapshot> workouts = scoped(coachId, Db.WORKOUTS, user, "studentId");
        ApiFuture<QuerySnapshot> packages = scoped(coachId, Db.PACKAGES, user, "studentId");
        ApiFuture<QuerySnapshot> transactions = scoped(coachId, Db.TRANSACTIONS, user, "studentId");
        ApiFuture<QuerySnapshot> metrics = scoped(coachId, Db.METRICS, user, "studentId");
        ApiFuture<QuerySnapshot> appointments = scoped(coachId, Db.APPOINTMENTS, user, "studentId");
        ApiFuture<QuerySnapshot> plans = asCoach ? db.coachCol(coachId, Db.PLANS).get() : null;

        List<Student> all = decode(students, Student.class);
        List<Student> roster = all.stream().filter(s -> access.canSee(user, s)).toList();
        if (!asCoach && roster.isEmpty()) throw ApiException.notFound("找不到學員資料");
        Set<String> visible = roster.stream().map(s -> s.id).collect(Collectors.toSet());
        // The profile shown as "the coach": yourself as a coach, your responsible coach as a student.
        CoachDto coach = studios.profile(space, asCoach ? user.userId() : roster.get(0).coach(), asCoach);
        List<TrainingPlan> planList = asCoach
                ? decode(plans, TrainingPlan.class)
                : roster.get(0).activePlanId == null ? List.of()
                        : db.get(db.coachDoc(coachId, Db.PLANS, roster.get(0).activePlanId), TrainingPlan.class).stream().toList();

        return new AppDataDto(
                SCHEMA_VERSION,
                Instant.now(),
                coach,
                roster.stream().sorted(Comparator.comparing((Student s) -> s.joinedAt)).map(s -> Mapper.student(s, asCoach)).toList(),
                roster.stream().map(Mapper::relationship).toList(),
                catalog.all().stream().map(Mapper::exercise).toList(),
                planList.stream().sorted(Comparator.comparing((TrainingPlan p) -> p.updatedAt).reversed()).map(Mapper::plan).toList(),
                mine(decode(workouts, Workout.class), visible, x -> x.studentId).stream().sorted(Comparator.comparing((Workout w) -> w.startedAt).reversed()).map(Mapper::workout).toList(),
                mine(decode(packages, SessionPackage.class), visible, x -> x.studentId).stream().map(Mapper::pkg).toList(),
                mine(decode(transactions, SessionTransaction.class), visible, x -> x.studentId).stream().map(Mapper::tx).toList(),
                mine(decode(metrics, ProgressMetric.class), visible, x -> x.studentId).stream().map(Mapper::metric).toList(),
                mine(decode(appointments, Appointment.class), visible, x -> x.studentId).stream().sorted(Comparator.comparing((Appointment a) -> a.startAt)).map(Mapper::appointment).toList(),
                studios.studio(user, space),
                SubscriptionService.paysOrSees(user) ? subscriptions.view(user, space, activeCount(all), activeCount(all) - activeCount(roster)) : null);
    }

    private static int activeCount(List<Student> students) {
        return (int) students.stream().filter(s -> "active".equals(s.status)).count();
    }

    private static <T> List<T> mine(List<T> all, Set<String> visible, Function<T, String> studentOf) {
        return all.stream().filter(x -> visible.contains(studentOf.apply(x))).toList();
    }

    /** Whole collection for coaches; only the student's own documents for students. */
    private ApiFuture<QuerySnapshot> scoped(String coachId, String collection, CurrentUser user, String ownerField) {
        Query q = db.coachCol(coachId, collection);
        if (user.isStudent()) q = q.whereEqualTo(ownerField, user.userId());
        return q.get();
    }

    private <T> List<T> decode(ApiFuture<QuerySnapshot> future, Class<T> type) {
        return Db.await(future).getDocuments().stream().map(d -> db.decodeDoc(d.getData(), type)).toList();
    }
}
