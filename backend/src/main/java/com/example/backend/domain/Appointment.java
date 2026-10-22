package com.example.backend.domain;

import java.time.Instant;

/** {@code coaches/{coachId}/appointments/{id}}. */
public class Appointment {
    public String id;
    public String coachId;
    public String studentId;
    public Instant startAt;
    public int durationMin;
    public String location;
    public String status;
}
