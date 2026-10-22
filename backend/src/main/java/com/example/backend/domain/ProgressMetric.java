package com.example.backend.domain;

import java.time.Instant;

/** {@code coaches/{coachId}/metrics/{id}}. */
public class ProgressMetric {
    public String id;
    public String studentId;
    public String type;
    public double value;
    public String unit;
    public Instant recordedAt;
}
