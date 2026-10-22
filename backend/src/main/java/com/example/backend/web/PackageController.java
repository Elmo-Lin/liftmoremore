package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.BillingService;
import com.example.backend.web.Dtos.AdjustmentInput;
import com.example.backend.web.Dtos.LedgerResult;
import com.example.backend.web.Dtos.PackageDto;
import com.example.backend.web.Dtos.PackageInput;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/packages")
public class PackageController {

    private final BillingService billing;

    public PackageController(BillingService billing) {
        this.billing = billing;
    }

    @PutMapping("/{id}")
    public PackageDto update(CurrentUser user, @PathVariable String id, @Valid @RequestBody PackageInput in) {
        return billing.updatePackage(user, id, in);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(CurrentUser user, @PathVariable String id) {
        billing.deletePackage(user, id);
    }

    @PostMapping("/{id}/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    public LedgerResult adjust(CurrentUser user, @PathVariable String id, @Valid @RequestBody AdjustmentInput in) {
        return billing.adjust(user, id, in);
    }
}
