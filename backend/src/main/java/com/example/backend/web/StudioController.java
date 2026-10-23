package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.StudioService;
import com.example.backend.web.Dtos.AuthResponse;
import com.example.backend.web.Dtos.CoachInviteDto;
import com.example.backend.web.Dtos.DeactivateCoachInput;
import com.example.backend.web.Dtos.InviteCoachInput;
import com.example.backend.web.Dtos.TransferStudentInput;
import com.example.backend.web.Dtos.UpgradeStudioInput;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Studio management. The studio and its coaches are also part of {@code GET /bootstrap}. */
@RestController
@RequestMapping("/api")
public class StudioController {

    private final StudioService studios;

    public StudioController(StudioService studios) {
        this.studios = studios;
    }

    /** A free coach becomes a studio owner; returns a new token for the new role. */
    @PostMapping("/studio/upgrade")
    public AuthResponse upgrade(CurrentUser user, @Valid @RequestBody UpgradeStudioInput in) {
        return studios.upgrade(user, in.studio());
    }

    @PostMapping("/studio/coaches")
    @ResponseStatus(HttpStatus.CREATED)
    public CoachInviteDto invite(CurrentUser user, @Valid @RequestBody InviteCoachInput in) {
        return studios.inviteCoach(user, in);
    }

    @PostMapping("/studio/coaches/{id}/invite")
    public CoachInviteDto reinvite(CurrentUser user, @PathVariable String id) {
        return studios.reinvite(user, id);
    }

    @PostMapping("/studio/coaches/{id}/deactivate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(CurrentUser user, @PathVariable String id, @RequestBody(required = false) DeactivateCoachInput in) {
        studios.deactivate(user, id, in == null ? null : in.transferTo());
    }

    @PutMapping("/students/{id}/coach")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void transfer(CurrentUser user, @PathVariable String id, @Valid @RequestBody TransferStudentInput in) {
        studios.transferStudent(user, id, in.coachId());
    }
}
