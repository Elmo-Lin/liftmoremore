package com.example.backend.domain;

import java.time.Instant;

/**
 * {@code users/{id}} — login identity for coaches and students.
 * Students have no password until they activate an invite.
 */
public class UserAccount {
    public String id;
    public String role;
    public String name;
    public String email;
    public String phone;
    public String passwordHash;
    /** Owning coach for students; the coach's own ID for coaches. */
    public String coachId;
    public Instant createdAt;
}
