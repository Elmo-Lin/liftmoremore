package com.example.backend.web;

import com.example.backend.auth.AuthService;
import com.example.backend.auth.CurrentUser;
import com.example.backend.web.Dtos.ActivateInput;
import com.example.backend.web.Dtos.AuthResponse;
import com.example.backend.web.Dtos.LoginInput;
import com.example.backend.web.Dtos.MeDto;
import com.example.backend.web.Dtos.RegisterCoachInput;
import com.example.backend.web.Dtos.RegisterSelfInput;
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

    public AuthController(AuthService auth) {
        this.auth = auth;
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

    @PostMapping("/auth/login")
    public AuthResponse login(@Valid @RequestBody LoginInput in) {
        return auth.login(in);
    }

    /** Student sets a password with the invite code from their coach. */
    @PostMapping("/auth/activate")
    public AuthResponse activate(@Valid @RequestBody ActivateInput in) {
        return auth.activate(in);
    }

    @GetMapping("/auth/me")
    public MeDto me(CurrentUser user) {
        return auth.me(user);
    }
}
