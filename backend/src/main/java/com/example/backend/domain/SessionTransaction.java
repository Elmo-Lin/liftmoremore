package com.example.backend.domain;

import java.time.Instant;

/** {@code coaches/{coachId}/transactions/{id}} — append-only ledger entry. */
public class SessionTransaction {
    public String id;
    public String packageId;
    public String studentId;
    public String type;
    public int delta;
    public String reason;
    public String workoutId;
    public Instant createdAt;
    public String createdBy;
}
