package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.BillingService;
import com.example.backend.service.WorkoutService;
import com.example.backend.web.Dtos.DeductionInput;
import com.example.backend.web.Dtos.LedgerResult;
import com.example.backend.web.Dtos.ReversalInput;
import com.example.backend.web.Dtos.WorkoutDto;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workouts")
public class WorkoutController {

    private final WorkoutService workouts;
    private final BillingService billing;

    public WorkoutController(WorkoutService workouts, BillingService billing) {
        this.workouts = workouts;
        this.billing = billing;
    }

    @GetMapping
    public List<WorkoutDto> list(CurrentUser user, @RequestParam(required = false) String studentId) {
        return workouts.list(user, studentId);
    }

    @GetMapping("/{id}")
    public WorkoutDto get(CurrentUser user, @PathVariable String id) {
        return workouts.get(user, id);
    }

    /** Create-or-replace (drafts autosave here). Never changes session balances. */
    @PutMapping("/{id}")
    public WorkoutDto save(CurrentUser user, @PathVariable String id, @Valid @RequestBody WorkoutDto in) {
        return workouts.save(user, id, in);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(CurrentUser user, @PathVariable String id) {
        workouts.delete(user, id);
    }

    /** Explicitly deduct one coaching session for this (coached, completed) workout. */
    @PostMapping("/{id}/deduction")
    @ResponseStatus(HttpStatus.CREATED)
    public LedgerResult deduct(CurrentUser user, @PathVariable String id, @RequestBody(required = false) DeductionInput in) {
        return billing.deduct(user, id, in == null ? null : in.transactionId());
    }

    @PostMapping("/{id}/deduction/reversal")
    @ResponseStatus(HttpStatus.CREATED)
    public LedgerResult reverse(CurrentUser user, @PathVariable String id, @Valid @RequestBody ReversalInput in) {
        return billing.reverse(user, id, in.transactionId(), in.reason());
    }
}
