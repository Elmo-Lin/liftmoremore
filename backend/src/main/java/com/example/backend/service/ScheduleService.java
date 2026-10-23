package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.common.Ids;
import com.example.backend.domain.Appointment;
import com.example.backend.domain.ProgressMetric;
import com.example.backend.domain.Student;
import com.example.backend.store.Db;
import com.example.backend.web.Dtos.AppointmentDto;
import com.example.backend.web.Dtos.MetricDto;
import com.example.backend.web.Dtos.MetricInput;
import com.google.cloud.firestore.Query;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Appointments (coach-managed calendar) and progress metrics such as bodyweight. */
@Service
public class ScheduleService {

    private final Db db;
    private final AccessService access;

    public ScheduleService(Db db, AccessService access) {
        this.db = db;
        this.access = access;
    }

    public List<AppointmentDto> listAppointments(CurrentUser user) {
        Query q = db.coachCol(user.coachId(), Db.APPOINTMENTS);
        if (user.isStudent()) q = q.whereEqualTo("studentId", user.userId());
        Set<String> visible = user.isStudent() ? null : access.visibleStudentIds(user);
        return db.list(q, Appointment.class).stream()
                .filter(a -> visible == null || visible.contains(a.studentId))
                .sorted(Comparator.comparing((Appointment a) -> a.startAt))
                .map(Mapper::appointment)
                .toList();
    }

    public AppointmentDto saveAppointment(CurrentUser user, String id, AppointmentDto in) {
        Student s = access.coachStudent(user, in.studentId());
        String status = in.status() == null ? "scheduled" : Domain.require(Domain.APPOINTMENT_STATUSES, in.status(), "status");
        Appointment a = new Appointment();
        a.id = Ids.orNew(id, "apt");
        a.coachId = user.coachId();
        a.studentId = s.id;
        a.startAt = in.startAt();
        a.durationMin = in.durationMin();
        a.location = in.location().trim();
        a.status = status;
        db.set(db.coachDoc(user.coachId(), Db.APPOINTMENTS, a.id), a);
        return Mapper.appointment(a);
    }

    public void deleteAppointment(CurrentUser user, String id) {
        var ref = db.coachDoc(user.requireCoach().coachId(), Db.APPOINTMENTS, id);
        Appointment a = db.get(ref, Appointment.class).orElseThrow(() -> ApiException.notFound("找不到此課程"));
        access.student(user, a.studentId);
        db.delete(ref);
    }

    public List<MetricDto> listMetrics(CurrentUser user, String studentId) {
        access.student(user, studentId);
        return db.list(db.coachCol(user.coachId(), Db.METRICS).whereEqualTo("studentId", studentId), ProgressMetric.class).stream()
                .sorted(Comparator.comparing((ProgressMetric m) -> m.recordedAt))
                .map(Mapper::metric)
                .toList();
    }

    /** Both the coach and the student themself may record metrics. */
    public MetricDto addMetric(CurrentUser user, String studentId, MetricInput in) {
        access.student(user, studentId);
        ProgressMetric m = new ProgressMetric();
        m.id = Ids.orNew(in.id(), "met");
        m.studentId = studentId;
        m.type = Domain.require(Domain.METRIC_TYPES, in.type(), "type");
        m.value = Math.round(in.value() * 10) / 10.0;
        m.unit = "kg";
        m.recordedAt = in.recordedAt() != null ? in.recordedAt() : Instant.now();
        db.create(db.coachDoc(user.coachId(), Db.METRICS, m.id), m);
        return Mapper.metric(m);
    }
}
