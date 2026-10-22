package com.example.backend.domain;

/** {@code exercises/{id}} — shared catalog. */
public class Exercise {
    public String id;
    public String name;
    public String nameEn;
    public String muscleGroup;
    public String equipment;
    public double increment;

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
