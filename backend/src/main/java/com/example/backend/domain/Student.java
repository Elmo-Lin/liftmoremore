package com.example.backend.domain;

import java.time.Instant;

/** {@code coaches/{coachId}/students/{id}} — profile as the coach manages it. */
public class Student {
    public String id;
    /** Workspace the student belongs to (not necessarily the coach who teaches them). */
    public String coachId;
    /** Coach responsible for this student in a studio; null means the workspace owner. */
    public String assignedCoachId;
    public String name;
    public String email;
    public String phone;
    public String gender;
    public Integer birthYear;
    public Integer heightCm;
    public String goal;
    public String goalDetail = "";
    public String status;
    public int weeklyFrequency;
    /** Private to the coach — never serialized for the student role. */
    public String coachNotes = "";
    public String activePlanId;
    public Instant joinedAt;
    public Instant createdAt;
    /** Whether the student has set a password via an invite. */
    public boolean activated;
    /** Current outstanding invite code (so a new invite can revoke the old one). */
    public String inviteCode;

    /** The coach responsible for this student. */
    public String coach() {
        return assignedCoachId != null ? assignedCoachId : coachId;
    }
}
