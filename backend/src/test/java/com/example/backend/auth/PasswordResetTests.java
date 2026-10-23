package com.example.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.example.backend.mail.MailService;
import com.example.backend.store.Db;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Forgot password: the mailed link (captured from the mail service) resets the password once. */
@SpringBootTest
@AutoConfigureMockMvc
class PasswordResetTests {

    @Autowired
    MockMvc mvc;

    @Autowired
    Db db;

    @MockitoBean
    MailService mail;

    final JsonMapper json = JsonMapper.builder().build();
    String email;

    record Resp(int status, JsonNode body) {}

    Resp post(String path, Object body) throws Exception {
        MvcResult res = mvc.perform(MockMvcRequestBuilders.post(path)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andReturn();
        String text = res.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return new Resp(res.getResponse().getStatus(), text.isEmpty() ? null : json.readTree(text));
    }

    @BeforeEach
    void register() throws Exception {
        email = "reset-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        assertThat(post("/api/auth/register", Map.of("name", "忘記密碼", "email", email, "password", "old-password")).status()).isEqualTo(201);
    }

    /** Requests a reset and returns the token from the mailed link. */
    String requestToken(String address) throws Exception {
        clearInvocations(mail);
        assertThat(post("/api/auth/forgot-password", Map.of("email", address)).status()).isEqualTo(204);
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(mail).send(eq(email), anyString(), text.capture(), anyString());
        Matcher m = Pattern.compile("/reset-password\\?token=([A-Za-z0-9_-]+)").matcher(text.getValue());
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    @Test
    void theMailedLinkResetsThePasswordOnce() throws Exception {
        String token = requestToken(email.toUpperCase());
        Resp done = post("/api/auth/reset-password", Map.of("token", token, "password", "new-password"));
        assertThat(done.status()).isEqualTo(200);
        assertThat(done.body().get("token").asString()).as("signed in right away").isNotBlank();

        assertThat(post("/api/auth/login", Map.of("email", email, "password", "new-password")).status()).isEqualTo(200);
        assertThat(post("/api/auth/login", Map.of("email", email, "password", "old-password")).status()).isEqualTo(401);
        assertThat(post("/api/auth/reset-password", Map.of("token", token, "password", "another-one")).status()).as("one use only").isEqualTo(400);
    }

    @Test
    void unknownEmailsGetTheSameAnswerAndNoMail() throws Exception {
        clearInvocations(mail);
        assertThat(post("/api/auth/forgot-password", Map.of("email", "nobody-" + UUID.randomUUID() + "@example.com")).status()).isEqualTo(204);
        verify(mail, never()).send(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void linksExpireAndAreRateLimited() throws Exception {
        String token = requestToken(email);
        clearInvocations(mail);
        post("/api/auth/forgot-password", Map.of("email", email));
        verify(mail, never()).send(anyString(), anyString(), anyString(), anyString());

        var ref = db.doc(Db.PASSWORD_RESETS, PasswordResetService.hash(token));
        PasswordResetService.PasswordReset reset = db.get(ref, PasswordResetService.PasswordReset.class).orElseThrow();
        reset.expiresAt = Instant.now().minusSeconds(1);
        db.set(ref, reset);
        assertThat(post("/api/auth/reset-password", Map.of("token", token, "password", "new-password")).status()).isEqualTo(400);
        assertThat(post("/api/auth/reset-password", Map.of("token", "made-up", "password", "new-password")).status()).isEqualTo(400);
        assertThat(post("/api/auth/reset-password", Map.of("token", token, "password", "short")).status()).isEqualTo(400);
    }
}
