package com.example.backend.domain;

import java.time.Instant;

/** {@code coaches/{coachId}/packages/{id}} — purchased sessions; balance is derived from the ledger. */
public class SessionPackage {
    public String id;
    public String studentId;
    public String coachId;
    public String name;
    public int totalSessions;
    public int priceTwd;
    public Instant purchaseDate;
    public Instant expiresAt;
    public String notes;
}
