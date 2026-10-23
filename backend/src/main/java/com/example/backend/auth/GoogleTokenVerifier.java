package com.example.backend.auth;

import com.example.backend.common.ApiException;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Verifies a Google Identity Services ID token (the {@code credential} from "Sign in with Google"):
 * Google's signature, issuer, expiry, and that it was issued for our client ID.
 */
@Component
public class GoogleTokenVerifier {

    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    public record GoogleUser(String sub, String email, String name) {}

    private final String clientId;
    private volatile JwtDecoder decoder;

    public GoogleTokenVerifier(@Value("${coachlog.google.client-id}") String clientId) {
        this.clientId = clientId;
    }

    public GoogleUser verify(String credential) {
        if (clientId.isBlank()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "google_unavailable", "Google 登入尚未開放");
        Jwt jwt;
        try {
            jwt = decoder().decode(credential);
        } catch (JwtException e) {
            throw ApiException.unauthorized("Google 登入驗證失敗，請再試一次");
        }
        if (!Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")) || jwt.getClaimAsString("email") == null) {
            throw ApiException.unauthorized("此 Google 帳號的 Email 尚未驗證");
        }
        String name = jwt.getClaimAsString("name");
        return new GoogleUser(jwt.getSubject(), jwt.getClaimAsString("email"), name == null ? "" : name);
    }

    private JwtDecoder decoder() {
        if (decoder == null) {
            NimbusJwtDecoder d = NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build();
            d.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                    JwtValidators.createDefault(),
                    new JwtClaimValidator<String>("iss", ISSUERS::contains),
                    new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(clientId))));
            decoder = d;
        }
        return decoder;
    }
}
