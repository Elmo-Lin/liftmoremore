package com.example.backend.auth;

import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * The authenticated caller. {@code coachId} is the coach's own ID for coaches, the owning
 * coach's ID for students, and the user's own ID for self-trackers — every query is scoped by it.
 */
public record CurrentUser(String userId, String role, String coachId) {

    public static CurrentUser from(Jwt jwt) {
        return new CurrentUser(jwt.getSubject(), jwt.getClaimAsString("role"), jwt.getClaimAsString("coachId"));
    }

    public boolean isCoach() {
        return Domain.COACH.equals(role);
    }

    /** Students and self-trackers: may only see and log their own data, never bill or manage others. */
    public boolean isStudent() {
        return Domain.STUDENT.equals(role) || isSelf();
    }

    public boolean isSelf() {
        return Domain.SELF.equals(role);
    }

    public CurrentUser requireCoach() {
        if (!isCoach()) throw ApiException.forbidden("只有教練可以執行此操作");
        return this;
    }
}
