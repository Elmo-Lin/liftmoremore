package com.example.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthRateLimiterTests {

    final AuthRateLimiter limiter = new AuthRateLimiter(true);

    @Test
    void capsEachAddressPerEndpointAndWindow() {
        AuthRateLimiter.Limit limit = AuthRateLimiter.LIMITS.get("/api/auth/register");
        long t = 1_000_000;
        for (int i = 0; i < limit.max(); i++) assertThat(limiter.allow("/api/auth/register", "1.1.1.1", t)).isTrue();
        assertThat(limiter.allow("/api/auth/register", "1.1.1.1", t)).isFalse();
        assertThat(limiter.allow("/api/auth/register", "2.2.2.2", t)).as("another address").isTrue();
        assertThat(limiter.allow("/api/auth/login", "1.1.1.1", t)).as("another endpoint").isTrue();
        assertThat(limiter.allow("/api/auth/register", "1.1.1.1", t + limit.per().toMillis())).as("the next window").isTrue();
    }

    @Test
    void readsTheClientBeforeTheLastProxy() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("10.0.0.1");
        assertThat(AuthRateLimiter.clientIp(req)).isEqualTo("10.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.7, 35.1.2.3");
        assertThat(AuthRateLimiter.clientIp(req)).isEqualTo("203.0.113.7");
        MockHttpServletRequest spoofed = new MockHttpServletRequest();
        spoofed.addHeader("X-Forwarded-For", "6.6.6.6, 203.0.113.7, 35.1.2.3");
        assertThat(AuthRateLimiter.clientIp(spoofed)).as("a made-up first entry is ignored").isEqualTo("203.0.113.7");
    }
}
