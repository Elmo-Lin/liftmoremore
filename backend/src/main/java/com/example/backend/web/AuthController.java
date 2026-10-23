package com.example.backend.web;

import com.example.backend.auth.AuthService;
import com.example.backend.auth.CurrentUser;
import com.example.backend.auth.PasswordResetService;
import com.example.backend.web.Dtos.ActivateInput;
import com.example.backend.web.Dtos.AuthResponse;
import com.example.backend.web.Dtos.ForgotPasswordInput;
import com.example.backend.web.Dtos.GoogleAuthInput;
import com.example.backend.web.Dtos.LoginInput;
import com.example.backend.web.Dtos.MeDto;
import com.example.backend.web.Dtos.RegisterCoachInput;
import com.example.backend.web.Dtos.RegisterSelfInput;
import com.example.backend.web.Dtos.RegisterStudioInput;
import com.example.backend.web.Dtos.ResetPasswordInput;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService auth;
    private final PasswordResetService resets;

    public AuthController(AuthService auth, PasswordResetService resets) {
        this.auth = auth;
        this.resets = resets;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    /** Coach self-registration. */
    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterCoachInput in) {
        return auth.registerCoach(in);
    }

    /** Self-tracker registration: logs their own training without a coach. */
    @PostMapping("/auth/register-self")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse registerSelf(@Valid @RequestBody RegisterSelfInput in) {
        return auth.registerSelf(in);
    }

    /** Studio owner registration: a coach who can invite other coaches. */
    @PostMapping("/auth/register-studio")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse registerStudio(@Valid @RequestBody RegisterStudioInput in) {
        return auth.registerStudio(in);
    }

    @PostMapping("/auth/login")
    public AuthResponse login(@Valid @RequestBody LoginInput in) {
        return auth.login(in);
    }

    /** Student sets a password with the invite code from their coach. */
    @PostMapping("/auth/activate")
    public AuthResponse activate(@Valid @RequestBody ActivateInput in) {
        return auth.activate(in);
    }

    /** Always 204, whether or not the email is registered. */
    @PostMapping("/auth/forgot-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgotPassword(@Valid @RequestBody ForgotPasswordInput in) {
        resets.request(in.email());
    }

    @PostMapping("/auth/reset-password")
    public AuthResponse resetPassword(@Valid @RequestBody ResetPasswordInput in) {
        return resets.reset(in.token(), in.password());
    }

    @PostMapping("/auth/google")
    public AuthResponse google(@Valid @RequestBody GoogleAuthInput in) {
        return auth.google(in);
    }

    /** A token for the caller's current role, e.g. after a paid upgrade made them a studio owner. */
    @PostMapping("/auth/refresh")
    public AuthResponse refresh(CurrentUser user) {
        return auth.refresh(user);
    }

    @GetMapping("/auth/me")
    public MeDto me(CurrentUser user) {
        return auth.me(user);
    }
}
