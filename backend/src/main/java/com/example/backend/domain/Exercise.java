package com.example.backend.domain;

/** A built-in exercise (see ExerciseCatalog), or a custom one in {@code coaches/{id}/exercises/{id}}. */
public class Exercise {
    public String id;
    public String name;
    public String nameEn;
    public String muscleGroup;
    public String equipment;
    public double increment;
    /** Custom exercises only. */
    public String createdBy;
    public java.time.Instant createdAt;
    /** Hidden from pickers; old workouts still show it. */
    public Boolean archived;

    public Exercise() {}

    public Exercise(String id, String name, String nameEn, String muscleGroup, String equipment, double increment) {
        this.id = id;
        this.name = name;
        this.nameEn = nameEn;
        this.muscleGroup = muscleGroup;
        this.equipment = equipment;
        this.increment = increment;
    }
}
