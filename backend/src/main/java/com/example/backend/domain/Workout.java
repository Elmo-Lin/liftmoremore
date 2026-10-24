package com.example.backend.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * {@code coaches/{coachId}/workouts/{id}} — a logged session with embedded exercises and sets.
 * {@code coached} sessions may be billed via a separate deduction; {@code independent} never.
 */
public class Workout {
    public String id;
    public String studentId;
    public String coachId;
    public String type;
    public String createdBy;
    public String status;
    public String title;
    public String planId;
    public String trainingDayId;
    public Instant startedAt;
    public Instant completedAt;
    public Instant updatedAt;
    public String notes = "";
    public List<ExerciseLog> exercises = new ArrayList<>();
    /**
     * Bumped on every billing change. Not data — it makes concurrent deductions on the same
     * workout conflict inside Firestore transactions so one of them retries and sees the other.
     */
    public long billingRevision;

    public static class ExerciseLog {
        public String id;
        public String exerciseId;
        public List<SetLog> sets = new ArrayList<>();
        public String notes;
    }

    public static class SetLog {
        public String id;
        public Double weightKg;
        public Integer reps;
        public Double rpe;
        public boolean completed;
    }
}
