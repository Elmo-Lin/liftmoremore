package com.example.backend.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** {@code coaches/{coachId}/plans/{id}} — coach-authored; days and prescriptions are embedded. */
public class TrainingPlan {
    public String id;
    public String coachId;
    public String name;
    public String description = "";
    public String goal;
    public Integer weeks;
    public Instant createdAt;
    public Instant updatedAt;
    public List<TrainingDay> days = new ArrayList<>();

    public static class TrainingDay {
        public String id;
        public String name;
        public String focus;
        public List<ExercisePrescription> exercises = new ArrayList<>();
    }

    public static class ExercisePrescription {
        public String id;
        public String exerciseId;
        public int sets;
        public String reps;
        public Double targetWeightKg;
        public Integer restSec;
        public String notes;
    }
}
