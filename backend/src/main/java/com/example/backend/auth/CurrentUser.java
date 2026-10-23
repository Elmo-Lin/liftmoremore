package com.example.backend.auth;

import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * The authenticated caller. {@code coachId} is the workspace every query is scoped by: a free
 * coach's own ID, a studio's ID (its owner's) for the owner and its coaches, the workspace a
 * student belongs to, or a self-tracker's own ID.
 */
public record CurrentUser(String userId, String role, String coachId) {

    public static CurrentUser from(Jwt jwt) {
        return new CurrentUser(jwt.getSubject(), jwt.getClaimAsString("role"), jwt.getClaimAsString("coachId"));
    }

    /** Coaches and studio owners (owners teach too). */
    public boolean isCoach() {
        return Domain.COACH.equals(role) || isOwner();
    }

    public boolean isOwner() {
        return Domain.OWNER.equals(role);
    }

    /** A coach working inside someone else's studio (not a free coach, not the owner). */
    public boolean isStudioCoach() {
        return Domain.COACH.equals(role) && !userId.equals(coachId);
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

    public CurrentUser requireOwner() {
        if (!isOwner()) throw ApiException.forbidden("只有工作室經營者可以執行此操作");
        return this;
    }
}
