package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.ScheduleService;
import com.example.backend.web.Dtos.AppointmentDto;
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
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final ScheduleService schedule;

    public AppointmentController(ScheduleService schedule) {
        this.schedule = schedule;
    }

    @GetMapping
    public List<AppointmentDto> list(CurrentUser user) {
        return schedule.listAppointments(user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AppointmentDto create(CurrentUser user, @Valid @RequestBody AppointmentDto in) {
        return schedule.saveAppointment(user, in.id(), in);
    }

    @PutMapping("/{id}")
    public AppointmentDto save(CurrentUser user, @PathVariable String id, @Valid @RequestBody AppointmentDto in) {
        return schedule.saveAppointment(user, id, in);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(CurrentUser user, @PathVariable String id) {
        schedule.deleteAppointment(user, id);
    }
}
