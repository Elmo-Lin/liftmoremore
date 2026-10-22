package com.example.backend.domain;

import java.time.Instant;

/** {@code invites/{code}} — one-time code a student uses to set a password. */
public class Invite {
    public String code;
    public String studentId;
    public String coachId;
    public Instant expiresAt;
}
