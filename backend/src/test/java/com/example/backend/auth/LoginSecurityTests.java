package com.example.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.example.backend.auth.GoogleTokenVerifier.GoogleUser;
import com.example.backend.store.Db;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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

/** Password guessing pauses an account; a Google sign-in takes over an email someone else registered. */
@SpringBootTest
@AutoConfigureMockMvc
class LoginSecurityTests {

    @Autowired
    MockMvc mvc;

    @Autowired
    Db db;

    @MockitoBean
    GoogleTokenVerifier google;

    final JsonMapper json = JsonMapper.builder().build();
    String email;
    String userId;

    record Resp(int status, JsonNode body) {}

    Resp post(String path, Object body) throws Exception {
        MvcResult res = mvc.perform(MockMvcRequestBuilders.post(path)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andReturn();
        String text = res.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return new Resp(res.getResponse().getStatus(), text.isEmpty() ? null : json.readTree(text));
    }

    Resp login(String password) throws Exception {
        return post("/api/auth/login", Map.of("email", email, "password", password));
    }

    @BeforeEach
    void register() throws Exception {
        email = "guard-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        Resp r = post("/api/auth/register", Map.of("name", "登入測試", "email", email, "password", "right-password"));
        assertThat(r.status()).isEqualTo(201);
        userId = r.body().get("user").get("userId").asString();
    }

    @Test
    void tooManyWrongPasswordsPauseTheAccount() throws Exception {
        for (int i = 1; i < LoginGuard.MAX_FAILURES; i++) assertThat(login("wrong-password").status()).isEqualTo(401);
        assertThat(login("wrong-password").status()).as("the last allowed failure pauses sign-in").isEqualTo(429);
        Resp paused = login("right-password");
        assertThat(paused.status()).as("even the right password waits").isEqualTo(429);
        assertThat(paused.body().get("code").asString()).isEqualTo("login_locked");
    }

    @Test
    void aSuccessfulSignInClearsEarlierFailures() throws Exception {
        for (int i = 1; i < LoginGuard.MAX_FAILURES; i++) login("wrong-password");
        assertThat(login("right-password").status()).isEqualTo(200);
        assertThat(login("wrong-password").status()).as("counting starts over").isEqualTo(401);
    }

    @Test
    void googleTakesOverAnEmailRegisteredBySomeoneElse() throws Exception {
        when(google.verify(anyString())).thenReturn(new GoogleUser("google-" + userId, email, "本人"));
        Resp owner = post("/api/auth/google", Map.of("credential", "token"));
        assertThat(owner.status()).isEqualTo(200);
        assertThat(owner.body().get("user").get("userId").asString()).isEqualTo(userId);
        assertThat(login("right-password").status()).as("whoever registered it can no longer sign in").isEqualTo(401);
    }

    @Test
    void googleKeepsThePasswordOfAVerifiedAccount() throws Exception {
        db.update(db.doc(Db.USERS, userId), "emailVerified", true); // e.g. reset the password from a mailed link
        when(google.verify(anyString())).thenReturn(new GoogleUser("google-" + userId, email, "本人"));
        assertThat(post("/api/auth/google", Map.of("credential", "token")).status()).isEqualTo(200);
        assertThat(login("right-password").status()).isEqualTo(200);
    }
}
