package com.example.backend.domain;

import java.time.Instant;

/** {@code invites/{code}} — one-time code a student (from their coach) or a coach (from the studio owner) uses to set a password. */
public class Invite {
    public String code;
    /** "coach" for studio coach invites; null (older data) or "student" otherwise. */
    public String kind;
    /** The invited account: a student ID, or the coach's user ID for coach invites. */
    public String studentId;
    public String coachId;
    public Instant expiresAt;
}
