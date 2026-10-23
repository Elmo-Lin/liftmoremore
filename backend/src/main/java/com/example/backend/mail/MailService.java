package com.example.backend.mail;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/**
 * Sends transactional email (password resets) through Resend's HTTP API. Without an API key
 * nothing is sent; the message is logged instead, with its body only when
 * {@code coachlog.mail.log-body} is on (local development), so reset links never reach
 * production logs.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final String apiKey;
    private final String from;
    private final boolean logBody;
    private final JsonMapper json = JsonMapper.builder().build();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public MailService(
            @Value("${coachlog.mail.resend-api-key}") String apiKey,
            @Value("${coachlog.mail.from}") String from,
            @Value("${coachlog.mail.log-body}") boolean logBody) {
        this.apiKey = apiKey;
        this.from = from;
        this.logBody = logBody;
    }

    /** Returns whether the message was handed to the mail provider. Failures are logged, never thrown. */
    public boolean send(String to, String subject, String text, String html) {
        if (apiKey.isBlank()) {
            if (logBody) log.info("Mail not configured; would send to {}: {}\n{}", to, subject, text);
            else log.warn("Mail not configured (COACHLOG_RESEND_API_KEY); dropped \"{}\" to {}", subject, to);
            return false;
        }
        try {
            String body = json.writeValueAsString(Map.of("from", from, "to", List.of(to), "subject", subject, "text", text, "html", html));
            HttpResponse<String> res = http.send(
                    HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
                            .timeout(Duration.ofSeconds(15))
                            .header("Authorization", "Bearer " + apiKey)
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString(body))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 == 2) return true;
            log.error("Resend refused \"{}\" to {}: {} {}", subject, to, res.statusCode(), res.body());
        } catch (Exception e) {
            log.error("Could not send \"{}\" to {}", subject, to, e);
        }
        return false;
    }
}
