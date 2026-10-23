package com.example.backend.demo;

import com.example.backend.auth.AuthService;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.domain.Student;
import com.example.backend.store.Db;
import com.example.backend.web.Dtos.AppDataDto;
import com.example.backend.web.Dtos.AuthResponse;
import com.example.backend.web.Dtos.DemoLoginInput;
import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Demo helpers, available only when {@code coachlog.demo.enabled=true}. These endpoints are
 * unauthenticated and destructive (import wipes the database) — never enable in production.
 */
@RestController
@RequestMapping("/api/demo")
public class DemoController {

    private static final Logger log = LoggerFactory.getLogger(DemoController.class);

    private final boolean enabled;
    private final String demoPassword;
    private final DemoService demo;
    private final AuthService auth;
    private final Db db;

    public DemoController(@Value("${coachlog.demo.enabled}") boolean enabled, @Value("${coachlog.demo.password}") String demoPassword,
            DemoService demo, AuthService auth, Db db) {
        this.enabled = enabled;
        this.demoPassword = demoPassword;
        this.demo = demo;
        this.auth = auth;
        this.db = db;
    }

    @PostConstruct
    void warn() {
        if (enabled) log.warn("Demo mode is ENABLED: /api/demo/* can wipe and replace all data. Disable with COACHLOG_DEMO_ENABLED=false.");
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of("enabled", enabled, "seeded", enabled && demo.isSeeded());
    }

    /** Replace all data with the given AppData snapshot. Every account gets the demo password. */
    @PostMapping("/import")
    public Map<String, Object> importData(@RequestBody AppDataDto data) {
        requireEnabled();
        int count = demo.importData(data, demoPassword);
        return Map.of("students", count, "coachId", data.coach().id());
    }

    /** One-click sign-in as the demo coach or one of their students. */
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody DemoLoginInput in) {
        requireEnabled();
        if (!demo.isSeeded()) throw ApiException.conflict("demo_not_seeded", "尚未匯入示範資料");
        String coachId = demo.firstCoachId();
        if (Domain.COACH.equals(in.role()) || Domain.OWNER.equals(in.role())) return auth.issueFor(coachId);
        if (!Domain.STUDENT.equals(in.role())) throw ApiException.badRequest("role 的值不正確");
        String studentId = in.studentId() != null ? in.studentId()
                : db.list(db.coachCol(coachId, Db.STUDENTS), Student.class).stream()
                        .min(java.util.Comparator.comparing((Student s) -> s.joinedAt)).map(s -> s.id)
                        .orElseThrow(() -> ApiException.notFound("尚無學員"));
        db.get(db.coachDoc(coachId, Db.STUDENTS, studentId), Student.class).orElseThrow(() -> ApiException.notFound("找不到此學員"));
        return auth.issueFor(studentId);
    }

    private void requireEnabled() {
        if (!enabled) throw new ApiException(HttpStatus.NOT_FOUND, "not_found", "找不到此 API");
    }
}
