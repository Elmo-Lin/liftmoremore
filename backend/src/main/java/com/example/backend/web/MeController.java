package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.BillingService;
import com.example.backend.web.Dtos.PackagePresetDto;
import com.example.backend.web.Dtos.PackagePresetsInput;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in coach's own settings. They are read back through {@code GET /bootstrap} ({@code coach}). */
@RestController
@RequestMapping("/api/me")
public class MeController {

    private final BillingService billing;

    public MeController(BillingService billing) {
        this.billing = billing;
    }

    @PutMapping("/package-presets")
    public List<PackagePresetDto> packagePresets(CurrentUser user, @Valid @RequestBody PackagePresetsInput in) {
        return billing.savePresets(user, in.presets());
    }
}
