package com.example.backend.common;

import java.util.Set;

/** Allowed values for string-typed domain fields (mirrors frontend/src/types). */
public final class Domain {

    private Domain() {}

    public static final String COACH = "coach";
    public static final String STUDENT = "student";
    /** Self-tracker: no coach; owns a one-person space where they are the only student. */
    public static final String SELF = "self";

    public static final Set<String> GOALS = Set.of("strength", "hypertrophy", "fatLoss", "general", "powerlifting", "mobility");
    public static final Set<String> GENDERS = Set.of("female", "male", "other");
    public static final Set<String> STUDENT_STATUSES = Set.of("active", "inactive");
    public static final Set<String> WORKOUT_TYPES = Set.of("coached", "independent");
    public static final Set<String> WORKOUT_STATUSES = Set.of("draft", "completed");
    public static final Set<String> APPOINTMENT_STATUSES = Set.of("scheduled", "completed", "cancelled");
    public static final Set<String> METRIC_TYPES = Set.of("bodyweight");

    public static final String TX_DEDUCTION = "deduction";
    public static final String TX_REVERSAL = "reversal";
    public static final String TX_ADJUSTMENT = "adjustment";

    public static String require(Set<String> allowed, String value, String field) {
        if (value == null || !allowed.contains(value)) {
            throw ApiException.badRequest(field + " 的值不正確：" + value);
        }
        return value;
    }
}
