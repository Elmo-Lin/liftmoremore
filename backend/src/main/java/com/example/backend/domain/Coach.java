package com.example.backend.domain;

import java.time.Instant;

/**
 * {@code coaches/{id}} — a workspace: everything in it lives in subcollections of this document.
 * A free coach's workspace has their own ID; a studio's has its owner's ID (so upgrading a free
 * coach to a studio moves nothing). Name, title and contact describe the workspace's owner.
 */
public class Coach {
    public String id;
    /** {@link com.example.backend.common.Domain#SPACE_SOLO} (also when null, for older data), studio or self. */
    public String kind;
    public String name;
    public String email;
    public String phone;
    public String title;
    public String studio;
    /** Coaching workspaces only; null until it changes (the trial then counts from {@link #createdAt}). */
    public Subscription subscription;
    public Instant createdAt;
}
