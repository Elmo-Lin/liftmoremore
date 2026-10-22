package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.common.ApiException;
import com.example.backend.domain.Student;
import com.example.backend.store.Db;
import org.springframework.stereotype.Service;

/**
 * Row-level access. A student document only exists under its coach, so looking it up under the
 * caller's coachId already enforces tenancy; students additionally may only see themselves.
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
        return db.get(db.coachDoc(user.coachId(), Db.STUDENTS, studentId), Student.class)
                .orElseThrow(() -> ApiException.notFound("找不到此學員"));
    }

    public Student coachStudent(CurrentUser user, String studentId) {
        user.requireCoach();
        return student(user, studentId);
    }
}
