package com.example.backend.domain;

import java.time.Instant;
import java.util.List;

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
    /** Workspace this account belongs to: the coach's own ID for free coaches and studio owners. */
    public String coachId;
    /** Coaches: shown on their profile (the workspace's title is used for the owner of older data). */
    public String title;
    /** Studio coaches the owner has deactivated can no longer sign in; null means active. */
    public Boolean active;
    /** Studio coaches: outstanding invite code until they activate. */
    public String inviteCode;
    /** Coaches: quick-select options when adding a session package; null until they customize (the UI shows defaults). */
    public List<PackagePreset> packagePresets;
    public Instant createdAt;

    public static class PackagePreset {
        public String name;
        public int totalSessions;
        public int priceTwd;
    }
}
