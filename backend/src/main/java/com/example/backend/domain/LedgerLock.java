package com.example.backend.domain;

/**
 * {@code coaches/{coachId}/ledgers/{studentId}} — not a balance. Every ledger write for a
 * student reads and bumps {@link #revision} inside its transaction, which serializes
 * concurrent writes so no two of them can each spend the last remaining session.
 */
public class LedgerLock {
    public long revision;
}
