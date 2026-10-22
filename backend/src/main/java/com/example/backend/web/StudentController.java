package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.BillingService;
import com.example.backend.service.ScheduleService;
import com.example.backend.service.StudentService;
import com.example.backend.web.Dtos.BalanceDto;
import com.example.backend.web.Dtos.InviteDto;
import com.example.backend.web.Dtos.MetricDto;
import com.example.backend.web.Dtos.MetricInput;
import com.example.backend.web.Dtos.PackageDto;
import com.example.backend.web.Dtos.PackageInput;
import com.example.backend.web.Dtos.StudentDto;
import com.example.backend.web.Dtos.StudentInput;
import com.example.backend.web.Dtos.TransactionDto;
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
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService students;
    private final BillingService billing;
    private final ScheduleService schedule;

    public StudentController(StudentService students, BillingService billing, ScheduleService schedule) {
        this.students = students;
        this.billing = billing;
        this.schedule = schedule;
    }

    @GetMapping
    public List<StudentDto> list(CurrentUser user) {
        return students.list(user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentDto create(CurrentUser user, @Valid @RequestBody StudentInput in) {
        return students.create(user, in);
    }

    @GetMapping("/{id}")
    public StudentDto get(CurrentUser user, @PathVariable String id) {
        return students.get(user, id);
    }

    @PutMapping("/{id}")
    public StudentDto update(CurrentUser user, @PathVariable String id, @Valid @RequestBody StudentInput in) {
        return students.update(user, id, in);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(CurrentUser user, @PathVariable String id) {
        students.delete(user, id);
    }

    @PostMapping("/{id}/invite")
    public InviteDto invite(CurrentUser user, @PathVariable String id) {
        return students.invite(user, id);
    }

    @GetMapping("/{id}/balance")
    public BalanceDto balance(CurrentUser user, @PathVariable String id) {
        return billing.balance(user, id);
    }

    @GetMapping("/{id}/packages")
    public List<PackageDto> packages(CurrentUser user, @PathVariable String id) {
        return billing.listPackages(user, id);
    }

    @PostMapping("/{id}/packages")
    @ResponseStatus(HttpStatus.CREATED)
    public PackageDto addPackage(CurrentUser user, @PathVariable String id, @Valid @RequestBody PackageInput in) {
        return billing.addPackage(user, id, in);
    }

    @GetMapping("/{id}/transactions")
    public List<TransactionDto> transactions(CurrentUser user, @PathVariable String id) {
        return billing.listTransactions(user, id);
    }

    @GetMapping("/{id}/metrics")
    public List<MetricDto> metrics(CurrentUser user, @PathVariable String id) {
        return schedule.listMetrics(user, id);
    }

    @PostMapping("/{id}/metrics")
    @ResponseStatus(HttpStatus.CREATED)
    public MetricDto addMetric(CurrentUser user, @PathVariable String id, @Valid @RequestBody MetricInput in) {
        return schedule.addMetric(user, id, in);
    }
}
