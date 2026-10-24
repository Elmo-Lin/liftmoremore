package com.example.backend.billing;

import com.example.backend.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Read-only mode: once a workspace's trial or paid period lapses, every write in it is refused
 * (402 subscription_required) until someone subscribes. Reads keep working and nothing is deleted.
 * Signing in, billing itself, and a coach leaving a studio stay open.
 */
@Configuration
public class WriteGuard implements WebMvcConfigurer, HandlerInterceptor {

    private static final Set<String> READS = Set.of("GET", "HEAD", "OPTIONS");

    private final SubscriptionService subscriptions;

    public WriteGuard(@Lazy SubscriptionService subscriptions) {
        this.subscriptions = subscriptions;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/**", "/api/billing/**", "/api/demo/**", "/api/health", "/api/studio/leave");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (READS.contains(request.getMethod())) return true;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) subscriptions.requireWritable(CurrentUser.from(jwt));
        return true;
    }
}
