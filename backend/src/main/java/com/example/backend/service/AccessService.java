package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.common.ApiException;
import com.example.backend.domain.Student;
import com.example.backend.store.Db;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Row-level access. A student document only exists in its workspace, so looking it up under the
 * caller's workspace already enforces tenancy. Within a studio, coaches see only the students they
 * are responsible for (the owner sees all); students see only themselves.
 * Missing and forbidden both return 404 so other coaches' IDs are not revealed.
 */
@Service
public class AccessService {

    private final Db db;

    public AccessService(Db db) {
        this.db = db;
    }

    public Student student(CurrentUser user, String studentId) {
        if (studentId == null || (user.isStudent() && !studentId.equals(user.userId()))) throw ApiException.notFound("找不到此學員");
        Student s = db.get(db.coachDoc(user.coachId(), Db.STUDENTS, studentId), Student.class)
                .orElseThrow(() -> ApiException.notFound("找不到此學員"));
        if (!canSee(user, s)) throw ApiException.notFound("找不到此學員");
        return s;
    }

    /** For lists: a studio coach sees their own students; the owner, free coaches and students see the whole (already scoped) list. */
    public boolean canSee(CurrentUser user, Student s) {
        return !user.isCoach() || user.isOwner() || user.userId().equals(s.coach());
    }

    /** Students the caller may see in their workspace. */
    public List<Student> visibleStudents(CurrentUser user) {
        if (user.isStudent()) return List.of(student(user, user.userId()));
        return db.list(db.coachCol(user.coachId(), Db.STUDENTS), Student.class).stream().filter(s -> canSee(user, s)).toList();
    }

    public Set<String> visibleStudentIds(CurrentUser user) {
        return visibleStudents(user).stream().map(s -> s.id).collect(Collectors.toSet());
    }

    public Student coachStudent(CurrentUser user, String studentId) {
        user.requireCoach();
        return student(user, studentId);
    }
}
