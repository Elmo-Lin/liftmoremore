package com.example.backend.store;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FirestoreOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Firestore client. With {@code coachlog.firestore.emulator-host} set (local dev / tests) it talks
 * to the Firebase emulator without credentials; otherwise it uses Application Default
 * Credentials (e.g. the Cloud Run service account) against the real project.
 */
@Configuration
public class FirestoreConfig {

    private static final Logger log = LoggerFactory.getLogger(FirestoreConfig.class);

    @Bean(destroyMethod = "close")
    Firestore firestore(
            @Value("${coachlog.firestore.project-id}") String projectId,
            @Value("${coachlog.firestore.emulator-host:}") String emulatorHost,
            @Value("${coachlog.firestore.database-id:(default)}") String databaseId) {
        FirestoreOptions.Builder builder = FirestoreOptions.newBuilder()
                .setProjectId(projectId)
                .setDatabaseId(databaseId);
        if (!emulatorHost.isBlank()) {
            builder.setEmulatorHost(emulatorHost); // also installs plaintext transport + emulator "owner" credentials
            log.info("Using Firestore emulator at {} (project {})", emulatorHost, projectId);
        } else {
            log.info("Using Cloud Firestore project {} database {}", projectId, databaseId);
        }
        return builder.build().getService();
    }
}
