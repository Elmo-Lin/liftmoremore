package com.example.backend.domain;

import java.time.Instant;

/** {@code coaches/{id}} — all of a coach's data lives in subcollections of this document. */
public class Coach {
    public String id;
    public String name;
    public String email;
    public String phone;
    public String title;
    public String studio;
    public Instant createdAt;
}
