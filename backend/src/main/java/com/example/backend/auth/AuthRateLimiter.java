package com.example.backend.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Caps how often one IP address may call the public sign-in endpoints (sign-up, sign-in, invite
 * codes, password resets), against scripted guessing and mass sign-ups. Counts live in this
 * server instance's memory, so they are approximate across instances; {@link LoginGuard} is the
 * per-account limit that always holds.
 */
@Component
public class AuthRateLimiter extends OncePerRequestFilter {

    record Limit(int max, Duration per) {}

    static final Map<String, Limit> LIMITS = Map.of(
            "/api/auth/login", new Limit(30, Duration.ofMinutes(5)),
            "/api/auth/google", new Limit(30, Duration.ofMinutes(5)),
            "/api/auth/register", new Limit(10, Duration.ofHours(1)),
            "/api/auth/register-self", new Limit(10, Duration.ofHours(1)),
            "/api/auth/register-studio", new Limit(10, Duration.ofHours(1)),
            "/api/auth/activate", new Limit(20, Duration.ofMinutes(15)),
            "/api/auth/forgot-password", new Limit(10, Duration.ofMinutes(15)),
            "/api/auth/reset-password", new Limit(20, Duration.ofMinutes(15)));

    /** Forget windows once this many are tracked (expired ones first). */
    private static final int MAX_TRACKED = 50_000;

    private static final class Window {
        final long start;
        int count;

        Window(long start) {
            this.start = start;
        }
    }

    private final boolean enabled;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public AuthRateLimiter(@Value("${coachlog.ratelimit.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || !"POST".equals(request.getMethod()) || !LIMITS.containsKey(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!allow(path, clientIp(request), System.currentTimeMillis())) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("{\"status\":429,\"code\":\"too_many_requests\",\"message\":\"嘗試次數過多，請稍後再試\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    boolean allow(String path, String ip, long nowMs) {
        Limit limit = LIMITS.get(path);
        long per = limit.per().toMillis();
        if (windows.size() > MAX_TRACKED) {
            windows.values().removeIf(w -> nowMs - w.start >= Duration.ofHours(1).toMillis());
            if (windows.size() > MAX_TRACKED) windows.clear();
        }
        Window w = windows.compute(path + "|" + ip, (k, old) -> {
            Window next = old == null || nowMs - old.start >= per ? new Window(nowMs) : old;
            next.count++;
            return next;
        });
        return w.count <= limit.max();
    }

    /**
     * The caller's address. Behind Firebase Hosting the request reaches Cloud Run with
     * {@code X-Forwarded-For: <client>, <hosting proxy>}; Google's front end appends the address it
     * saw, so the entry before the last is the client. A caller going straight to the run.app URL
     * can make that entry up — which only spreads their attempts over more windows, still bounded by
     * {@link LoginGuard}.
     */
    static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff == null || xff.isBlank()) return request.getRemoteAddr();
        String[] hops = xff.split(",");
        return (hops.length >= 2 ? hops[hops.length - 2] : hops[0]).trim();
    }
}
