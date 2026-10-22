package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.PlanService;
import com.example.backend.web.Dtos.AssignInput;
import com.example.backend.web.Dtos.DuplicateInput;
import com.example.backend.web.Dtos.PlanDto;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/plans")
public class PlanController {

    private final PlanService plans;

    public PlanController(PlanService plans) {
        this.plans = plans;
    }

    @GetMapping
    public List<PlanDto> list(CurrentUser user) {
        return plans.list(user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlanDto create(CurrentUser user, @Valid @RequestBody PlanDto in) {
        return plans.save(user, in.id(), in);
    }

    @GetMapping("/{id}")
    public PlanDto get(CurrentUser user, @PathVariable String id) {
        return plans.get(user, id);
    }

    /** Create-or-replace with a client-chosen ID. */
    @PutMapping("/{id}")
    public PlanDto save(CurrentUser user, @PathVariable String id, @Valid @RequestBody PlanDto in) {
        return plans.save(user, id, in);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(CurrentUser user, @PathVariable String id) {
        plans.delete(user, id);
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public PlanDto duplicate(CurrentUser user, @PathVariable String id, @RequestBody(required = false) DuplicateInput in) {
        return plans.duplicate(user, id, in == null ? null : in.id());
    }

    /** Replace the set of students assigned to this plan. */
    @PutMapping("/{id}/assignments")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void assign(CurrentUser user, @PathVariable String id, @Valid @RequestBody AssignInput in) {
        plans.assign(user, id, in.studentIds());
    }
}
