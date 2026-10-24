package com.example.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** End-to-end API tests over HTTP (MockMvc) against the Firestore emulator (see scripts/test.sh). */
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTests {

    @Autowired
    MockMvc mvc;

    final JsonMapper json = JsonMapper.builder().build();

    String coach;
    String suffix;

    record Resp(int status, JsonNode body) {}

    @BeforeEach
    void registerCoach() throws Exception {
        suffix = UUID.randomUUID().toString().substring(0, 8);
        Resp r = call(post("/api/auth/register"), null, Map.of("name", "測試教練", "email", "coach-" + suffix + "@example.com", "password", "password123"));
        assertThat(r.status()).isEqualTo(201);
        coach = r.body().get("token").asString();
    }

    // ------------------------------------------------------------------ helpers

    Resp call(MockHttpServletRequestBuilder req, String token, Object body) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        MvcResult res = mvc.perform(req).andReturn();
        String text = res.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return new Resp(res.getResponse().getStatus(), text.isEmpty() ? null : json.readTree(text));
    }

    String createStudent(String token, String name) throws Exception {
        Resp r = call(post("/api/students"), token, Map.of(
                "name", name, "email", name + "-" + suffix + "@example.com", "gender", "female", "goal", "strength",
                "weeklyFrequency", 2, "status", "active", "coachNotes", "私密備註"));
        assertThat(r.status()).as(String.valueOf(r.body())).isEqualTo(201);
        return r.body().get("id").asString();
    }

    Map<String, Object> workout(String studentId, String type, String status) {
        return Map.of(
                "studentId", studentId, "type", type, "status", status, "title", "訓練 A",
                "startedAt", Instant.now().toString(), "notes", "",
                "exercises", List.of(Map.of("id", "el_1", "exerciseId", "ex_squat",
                        "sets", List.of(Map.of("id", "set_1", "weightKg", 60, "reps", 5, "completed", true)))));
    }

    String saveWorkout(String token, String studentId, String type) throws Exception {
        String id = "wo_" + UUID.randomUUID().toString().substring(0, 10);
        Resp r = call(put("/api/workouts/" + id), token, workout(studentId, type, "completed"));
        assertThat(r.status()).as(String.valueOf(r.body())).isEqualTo(200);
        return id;
    }

    String addPackage(String token, String studentId, int sessions) throws Exception {
        Resp r = call(post("/api/students/" + studentId + "/packages"), token,
                Map.of("name", sessions + " 堂", "totalSessions", sessions, "priceTwd", 18000, "purchaseDate", Instant.now().minusSeconds(3600).toString()));
        assertThat(r.status()).as(String.valueOf(r.body())).isEqualTo(201);
        return r.body().get("id").asString();
    }

    int remaining(String token, String studentId) throws Exception {
        return call(get("/api/students/" + studentId + "/balance"), token, null).body().get("remaining").asInt();
    }

    String studentToken(String studentId) throws Exception {
        String code = call(post("/api/students/" + studentId + "/invite"), coach, null).body().get("inviteCode").asString();
        Resp r = call(post("/api/auth/activate"), null, Map.of("inviteCode", code, "password", "student123"));
        assertThat(r.status()).isEqualTo(200);
        return r.body().get("token").asString();
    }

    // ------------------------------------------------------------------ tests

    @Test
    void requiresAuthentication() throws Exception {
        assertThat(call(get("/api/bootstrap"), null, null).status()).isEqualTo(401);
        assertThat(call(get("/api/bootstrap"), "not-a-token", null).status()).isEqualTo(401);
        assertThat(call(get("/api/health"), null, null).status()).isEqualTo(200);
    }

    @Test
    void loginRejectsWrongPasswordWithoutRevealingAccounts() throws Exception {
        Resp wrong = call(post("/api/auth/login"), null, Map.of("email", "coach-" + suffix + "@example.com", "password", "nope-nope"));
        Resp unknown = call(post("/api/auth/login"), null, Map.of("email", "ghost-" + suffix + "@example.com", "password", "nope-nope"));
        assertThat(wrong.status()).isEqualTo(401);
        assertThat(unknown.status()).isEqualTo(401);
        assertThat(wrong.body().get("message").asString()).isEqualTo(unknown.body().get("message").asString());
        assertThat(call(post("/api/auth/login"), null, Map.of("email", "COACH-" + suffix + "@example.com", "password", "password123")).status())
                .as("email is case-insensitive").isEqualTo(200);
    }

    @Test
    void validatesStudentInput() throws Exception {
        Resp r = call(post("/api/students"), coach, Map.of("name", "", "email", "bad", "gender", "female", "goal", "strength",
                "weeklyFrequency", 2, "status", "active"));
        assertThat(r.status()).isEqualTo(400);
        Resp dup = call(post("/api/students"), coach, Map.of("name", "X", "email", "coach-" + suffix + "@example.com", "gender", "female",
                "goal", "strength", "weeklyFrequency", 2, "status", "active"));
        assertThat(dup.status()).isEqualTo(409);
    }

    @Test
    void coachesCannotSeeEachOthersStudents() throws Exception {
        String sid = createStudent(coach, "amy");
        String other = call(post("/api/auth/register"), null,
                Map.of("name", "別的教練", "email", "other-" + suffix + "@example.com", "password", "password123")).body().get("token").asString();
        assertThat(call(get("/api/students/" + sid), other, null).status()).isEqualTo(404);
        assertThat(call(put("/api/workouts/wo_x" + suffix), other, workout(sid, "coached", "completed")).status()).isEqualTo(404);
        assertThat(call(get("/api/bootstrap"), other, null).body().get("students").size()).isZero();
    }

    @Test
    void deductionIsExplicitSingleAndReversible() throws Exception {
        String sid = createStudent(coach, "bob");
        String wo = saveWorkout(coach, sid, "coached");

        assertThat(call(post("/api/workouts/" + wo + "/deduction"), coach, null).body().get("code").asString())
                .as("no package yet").isEqualTo("no_balance");

        addPackage(coach, sid, 10);
        assertThat(remaining(coach, sid)).as("saving a workout never deducts").isEqualTo(10);

        Resp d = call(post("/api/workouts/" + wo + "/deduction"), coach, Map.of("transactionId", "tx_client1" + suffix));
        assertThat(d.status()).isEqualTo(201);
        assertThat(d.body().get("transaction").get("id").asString()).as("client-provided id kept").isEqualTo("tx_client1" + suffix);
        assertThat(d.body().get("balance").get("remaining").asInt()).isEqualTo(9);

        assertThat(call(post("/api/workouts/" + wo + "/deduction"), coach, null).body().get("code").asString()).isEqualTo("already_deducted");
        assertThat(call(delete("/api/workouts/" + wo), coach, null).status()).as("cannot delete a billed workout").isEqualTo(409);
        assertThat(call(put("/api/workouts/" + wo), coach, workout(sid, "independent", "completed")).status())
                .as("cannot turn a billed workout into an independent one").isEqualTo(409);

        assertThat(call(post("/api/workouts/" + wo + "/deduction/reversal"), coach, Map.of("reason", "")).status()).isEqualTo(400);
        Resp rev = call(post("/api/workouts/" + wo + "/deduction/reversal"), coach, Map.of("reason", "誤扣"));
        assertThat(rev.body().get("balance").get("remaining").asInt()).isEqualTo(10);
        assertThat(call(post("/api/workouts/" + wo + "/deduction"), coach, null).status()).as("can deduct again after reversal").isEqualTo(201);

        JsonNode txs = call(get("/api/students/" + sid + "/transactions"), coach, null).body();
        assertThat(txs.size()).as("history is append-only").isEqualTo(3);
    }

    @Test
    void independentAndDraftWorkoutsCannotBeDeducted() throws Exception {
        String sid = createStudent(coach, "cat");
        addPackage(coach, sid, 5);
        String indep = saveWorkout(coach, sid, "independent");
        assertThat(call(post("/api/workouts/" + indep + "/deduction"), coach, null).body().get("code").asString()).isEqualTo("independent_workout");

        String draft = "wo_draft" + suffix;
        call(put("/api/workouts/" + draft), coach, workout(sid, "coached", "draft"));
        assertThat(call(post("/api/workouts/" + draft + "/deduction"), coach, null).body().get("code").asString()).isEqualTo("not_completed");
        assertThat(remaining(coach, sid)).isEqualTo(5);
    }

    @Test
    void balanceCanNeverGoNegative() throws Exception {
        String sid = createStudent(coach, "dan");
        String pkg = addPackage(coach, sid, 2);
        assertThat(call(post("/api/packages/" + pkg + "/adjustments"), coach, Map.of("delta", -3, "reason", "測試")).body().get("code").asString())
                .isEqualTo("negative_balance");
        assertThat(call(post("/api/packages/" + pkg + "/adjustments"), coach, Map.of("delta", -1, "reason", "")).status()).isEqualTo(400);
        assertThat(call(post("/api/packages/" + pkg + "/adjustments"), coach, Map.of("delta", -2, "reason", "未到課")).status()).isEqualTo(201);
        assertThat(remaining(coach, sid)).isZero();

        String wo = saveWorkout(coach, sid, "coached");
        assertThat(call(post("/api/workouts/" + wo + "/deduction"), coach, null).body().get("code").asString()).isEqualTo("no_balance");
        assertThat(call(put("/api/packages/" + pkg), coach, Map.of("name", "x", "totalSessions", 1, "priceTwd", 0,
                "purchaseDate", Instant.now().toString())).status()).as("total cannot drop below what is consumed").isEqualTo(409);
        assertThat(call(delete("/api/packages/" + pkg), coach, null).status()).as("package with history cannot be deleted").isEqualTo(409);
    }

    @Test
    void coachesKeepTheirOwnPackagePresets() throws Exception {
        assertThat(call(get("/api/bootstrap"), coach, null).body().get("coach").has("packagePresets")).as("unset until customized").isFalse();
        var presets = Map.of("presets", List.of(Map.of("name", " 8 堂體驗 ", "totalSessions", 8, "priceTwd", 12000)));
        Resp r = call(put("/api/me/package-presets"), coach, presets);
        assertThat(r.status()).as(String.valueOf(r.body())).isEqualTo(200);
        JsonNode saved = call(get("/api/bootstrap"), coach, null).body().get("coach").get("packagePresets");
        assertThat(saved.size()).isEqualTo(1);
        assertThat(saved.get(0).get("name").asString()).isEqualTo("8 堂體驗");
        assertThat(saved.get(0).get("priceTwd").asInt()).isEqualTo(12000);

        assertThat(call(put("/api/me/package-presets"), coach, Map.of("presets", List.of(Map.of("name", "x", "totalSessions", 0, "priceTwd", 0)))).status())
                .isEqualTo(400);
        assertThat(call(put("/api/me/package-presets"), coach, Map.of("presets", List.of())).status()).isEqualTo(200);
        assertThat(call(get("/api/bootstrap"), coach, null).body().get("coach").get("packagePresets").size()).as("empty list is kept").isZero();

        String student = studentToken(createStudent(coach, "pia"));
        assertThat(call(put("/api/me/package-presets"), student, presets).status()).isEqualTo(403);
        assertThat(call(get("/api/bootstrap"), student, null).body().get("coach").has("packagePresets")).as("never shown to students").isFalse();
    }

    @Test
    void coachesAddCustomExercisesForTheirWorkspace() throws Exception {
        assertThat(call(get("/api/exercises"), coach, null).body().size()).as("built-in catalog").isGreaterThanOrEqualTo(100);

        Map<String, Object> input = Map.of("id", "cex_sled" + suffix, "name", "雪橇推", "nameEn", "Sled Push", "muscleGroup", "legs", "equipment", "other");
        Resp created = call(post("/api/exercises"), coach, input);
        assertThat(created.status()).as(String.valueOf(created.body())).isEqualTo(201);
        assertThat(created.body().get("custom").asBoolean()).isTrue();
        assertThat(call(post("/api/exercises"), coach, Map.of("name", "雪橇推", "muscleGroup", "legs", "equipment", "other")).status())
                .as("same name twice").isEqualTo(409);
        assertThat(call(post("/api/exercises"), coach, Map.of("name", "槓鈴臥推", "muscleGroup", "chest", "equipment", "barbell")).status())
                .as("a built-in name").isEqualTo(409);
        assertThat(call(post("/api/exercises"), coach, Map.of("name", "X", "muscleGroup", "neck", "equipment", "other")).status()).isEqualTo(400);

        String sid = createStudent(coach, "cex");
        Map<String, Object> workout = Map.of("studentId", sid, "type", "coached", "status", "completed", "title", "A",
                "startedAt", Instant.now().toString(), "notes", "",
                "exercises", List.of(Map.of("id", "el_1", "exerciseId", "cex_sled" + suffix,
                        "sets", List.of(Map.of("id", "set_1", "weightKg", 40, "reps", 10, "completed", true)))));
        assertThat(call(put("/api/workouts/wo_cex" + suffix), coach, workout).status()).isEqualTo(200);

        String student = studentToken(sid);
        assertThat(call(get("/api/bootstrap"), student, null).body().get("exercises").toString()).as("students see them").contains("雪橇推");
        assertThat(call(post("/api/exercises"), student, Map.of("name", "學員動作", "muscleGroup", "core", "equipment", "other")).status()).isEqualTo(403);

        String other = call(post("/api/auth/register"), null,
                Map.of("name", "別的教練", "email", "cexo-" + suffix + "@example.com", "password", "password123")).body().get("token").asString();
        assertThat(call(get("/api/bootstrap"), other, null).body().get("exercises").toString()).as("other workspaces do not").doesNotContain("雪橇推");

        assertThat(call(put("/api/exercises/cex_sled" + suffix), coach, Map.of("name", "雪橇推（重）", "muscleGroup", "legs", "equipment", "other")).status()).isEqualTo(200);
        assertThat(call(put("/api/exercises/ex_bench"), coach, Map.of("name", "改名", "muscleGroup", "chest", "equipment", "barbell")).status())
                .as("built-ins cannot be edited").isEqualTo(404);
        assertThat(call(delete("/api/exercises/cex_sled" + suffix), coach, null).status()).isEqualTo(204);
        JsonNode archived = null;
        for (JsonNode e : call(get("/api/bootstrap"), coach, null).body().get("exercises")) if (e.get("id").asString().equals("cex_sled" + suffix)) archived = e;
        assertThat(archived).as("kept for history").isNotNull();
        assertThat(archived.get("archived").asBoolean()).isTrue();
        assertThat(call(post("/api/exercises"), coach, Map.of("name", "雪橇推（重）", "muscleGroup", "legs", "equipment", "other")).status())
                .as("an archived name can be reused").isEqualTo(201);
    }

    @Test
    void aCoachedSessionBelongsToOneScheduledClass() throws Exception {
        String sid = createStudent(coach, "cls");
        String other = createStudent(coach, "cls2");
        String apt = "apt_c" + suffix;
        call(put("/api/appointments/" + apt), coach, Map.of("studentId", sid, "startAt", Instant.now().toString(), "durationMin", 60, "location", "工作室"));

        Map<String, Object> draft = new java.util.HashMap<>(workout(sid, "coached", "draft"));
        draft.put("appointmentId", apt);
        assertThat(call(put("/api/workouts/wo_c1" + suffix), coach, draft).status()).isEqualTo(200);
        assertThat(call(put("/api/workouts/wo_c2" + suffix), coach, draft).status()).as("one workout per class").isEqualTo(409);
        Map<String, Object> wrong = new java.util.HashMap<>(workout(other, "coached", "draft"));
        wrong.put("appointmentId", apt);
        assertThat(call(put("/api/workouts/wo_c3" + suffix), coach, wrong).status()).as("someone else's class").isEqualTo(400);

        Map<String, Object> done = new java.util.HashMap<>(workout(sid, "coached", "completed"));
        done.put("appointmentId", apt);
        assertThat(call(put("/api/workouts/wo_c1" + suffix), coach, done).body().get("appointmentId").asString()).isEqualTo(apt);
        java.util.function.Supplier<String> status = () -> {
            try {
                for (JsonNode a : call(get("/api/appointments"), coach, null).body()) if (a.get("id").asString().equals(apt)) return a.get("status").asString();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
            return null;
        };
        assertThat(status.get()).as("finishing the workout completes the class").isEqualTo("completed");
        assertThat(call(delete("/api/workouts/wo_c1" + suffix), coach, null).status()).isEqualTo(204);
        assertThat(status.get()).as("deleting it puts the class back").isEqualTo("scheduled");
    }

    @Test
    void deductionsUseOldestPackageFirst() throws Exception {
        String sid = createStudent(coach, "eve");
        Resp older = call(post("/api/students/" + sid + "/packages"), coach,
                Map.of("name", "舊", "totalSessions", 1, "priceTwd", 0, "purchaseDate", Instant.now().minusSeconds(86400 * 30).toString()));
        addPackage(coach, sid, 10);
        String wo = saveWorkout(coach, sid, "coached");
        Resp d = call(post("/api/workouts/" + wo + "/deduction"), coach, null);
        assertThat(d.body().get("transaction").get("packageId").asString()).isEqualTo(older.body().get("id").asString());
    }

    @Test
    void studentSeesOnlyOwnDataAndCannotBill() throws Exception {
        String sid = createStudent(coach, "fay");
        createStudent(coach, "gus");
        String coachWorkout = saveWorkout(coach, sid, "coached");
        String student = studentToken(sid);

        JsonNode boot = call(get("/api/bootstrap"), student, null).body();
        assertThat(boot.get("students").size()).isEqualTo(1);
        assertThat(boot.get("students").get(0).get("coachNotes").asString()).as("coach notes are private").isEmpty();
        assertThat(boot.get("coach").get("email").asString()).isEmpty();

        assertThat(call(put("/api/workouts/wo_s1" + suffix), student, workout(sid, "coached", "completed")).status())
                .as("students may only log independent workouts").isEqualTo(403);
        assertThat(call(put("/api/workouts/wo_s2" + suffix), student, workout(sid, "independent", "completed")).status()).isEqualTo(200);
        assertThat(call(put("/api/workouts/" + coachWorkout), student, workout(sid, "independent", "completed")).status())
                .as("cannot overwrite a coach-logged session").isEqualTo(403);
        assertThat(call(post("/api/workouts/" + coachWorkout + "/deduction"), student, null).status()).isEqualTo(403);
        assertThat(call(post("/api/students"), student, Map.of()).status()).isIn(400, 403);
        assertThat(call(get("/api/students/" + boot.get("students").get(0).get("id").asString() + "x"), student, null).status()).isEqualTo(404);
    }

    @Test
    void selfTrackerLogsOwnTrainingInIsolatedSpace() throws Exception {
        Resp reg = call(post("/api/auth/register-self"), null, Map.of("name", "自主訓練者", "email", "self-" + suffix + "@example.com", "password", "password123"));
        assertThat(reg.status()).isEqualTo(201);
        String self = reg.body().get("token").asString();
        String sid = reg.body().get("user").get("studentId").asString();
        assertThat(reg.body().get("user").get("role").asString()).isEqualTo("self");
        assertThat(sid).isEqualTo(reg.body().get("user").get("userId").asString());

        JsonNode boot = call(get("/api/bootstrap"), self, null).body();
        assertThat(boot.get("students").size()).isEqualTo(1);
        assertThat(boot.get("students").get(0).get("id").asString()).isEqualTo(sid);

        assertThat(call(put("/api/workouts/wo_self1" + suffix), self, workout(sid, "independent", "completed")).status()).isEqualTo(200);
        assertThat(call(put("/api/workouts/wo_self2" + suffix), self, workout(sid, "coached", "completed")).status())
                .as("no coach, so no coached sessions").isEqualTo(403);
        assertThat(call(post("/api/students"), self, Map.of()).status()).isIn(400, 403);
        assertThat(call(get("/api/plans"), self, null).body().size()).isZero();

        // Self-trackers write their own plans (there is no coach to assign them one).
        Map<String, Object> plan = Map.of("name", "我的上肢", "goal", "strength", "description", "",
                "days", List.of(Map.of("id", "day_m", "name", "我的上肢", "exercises", List.of(Map.of("id", "rx_1", "exerciseId", "ex_squat", "sets", 3, "reps", "5")))));
        String planId = "plan_self" + suffix;
        assertThat(call(put("/api/plans/" + planId), self, plan).status()).isEqualTo(200);
        assertThat(call(get("/api/plans"), self, null).body().size()).isEqualTo(1);
        assertThat(call(get("/api/bootstrap"), self, null).body().get("plans").size()).as("all of their plans, not just an assigned one").isEqualTo(1);
        assertThat(call(post("/api/plans/" + planId + "/duplicate"), self, null).status()).isEqualTo(201);
        assertThat(call(put("/api/plans/" + planId + "/assignments"), self, Map.of("studentIds", List.of(sid))).status()).isEqualTo(403);
        assertThat(call(get("/api/plans/" + planId), coach, null).status()).as("stays in their own space").isEqualTo(404);
        assertThat(call(delete("/api/plans/" + planId), self, null).status()).isEqualTo(204);

        String other = createStudent(coach, "jay");
        assertThat(call(get("/api/students/" + other), self, null).status()).as("cannot reach a coach's students").isEqualTo(404);
        assertThat(call(get("/api/students/" + sid), coach, null).status()).as("coach cannot reach a self-tracker").isEqualTo(404);
        assertThat(call(post("/api/auth/register-self"), null, Map.of("name", "X", "email", "SELF-" + suffix + "@example.com", "password", "password123")).status())
                .isEqualTo(409);
    }

    @Test
    void coachSchedulesClassesAndStudentsSeeOnlyTheirOwn() throws Exception {
        String sid = createStudent(coach, "kim");
        String other = createStudent(coach, "lee");
        String at = Instant.now().plusSeconds(86400).toString();
        Map<String, Object> slot = Map.of("studentId", sid, "startAt", at, "durationMin", 60, "location", "工作室");
        String id = "apt_" + suffix;
        assertThat(call(put("/api/appointments/" + id), coach, slot).status()).as("client-generated id is accepted").isEqualTo(200);
        call(put("/api/appointments/apt_o" + suffix), coach, Map.of("studentId", other, "startAt", at, "durationMin", 60, "location", "工作室"));

        Map<String, Object> cancelled = new java.util.HashMap<>(slot);
        cancelled.put("status", "cancelled");
        assertThat(call(put("/api/appointments/" + id), coach, cancelled).body().get("status").asString()).isEqualTo("cancelled");
        assertThat(call(put("/api/appointments/apt_x" + suffix), coach, Map.of("studentId", sid, "startAt", at, "durationMin", 5, "location", "工作室")).status())
                .as("duration is validated").isEqualTo(400);

        String student = studentToken(sid);
        JsonNode mine = call(get("/api/appointments"), student, null).body();
        assertThat(mine.size()).as("students only see their own classes").isEqualTo(1);
        assertThat(mine.get(0).get("id").asString()).isEqualTo(id);
        assertThat(call(put("/api/appointments/apt_s" + suffix), student, slot).status()).as("students cannot schedule").isEqualTo(403);
        assertThat(call(delete("/api/appointments/" + id), student, null).status()).isEqualTo(403);

        assertThat(call(delete("/api/appointments/" + id), coach, null).status()).isEqualTo(204);
        assertThat(call(get("/api/appointments"), student, null).body().size()).isZero();
    }

    // ------------------------------------------------------------------ studios

    record Studio(String owner, String ownerId) {}

    Studio registerStudio() throws Exception {
        Resp r = call(post("/api/auth/register-studio"), null, Map.of("name", "經營者", "email", "owner-" + suffix + "@example.com", "password", "password123", "studio", "測試工作室"));
        assertThat(r.status()).isEqualTo(201);
        assertThat(r.body().get("user").get("role").asString()).isEqualTo("owner");
        return new Studio(r.body().get("token").asString(), r.body().get("user").get("userId").asString());
    }

    /** Invites a coach and activates them; returns {coachId, token}. */
    String[] studioCoach(String owner, String name) throws Exception {
        Resp inv = call(post("/api/studio/coaches"), owner, Map.of("name", name, "email", name + "-" + suffix + "@example.com"));
        assertThat(inv.status()).isEqualTo(201);
        Resp act = call(post("/api/auth/activate"), null, Map.of("inviteCode", inv.body().get("inviteCode").asString(), "password", "coach12345"));
        assertThat(act.status()).isEqualTo(200);
        assertThat(act.body().get("user").get("role").asString()).isEqualTo("coach");
        return new String[] {inv.body().get("coach").get("id").asString(), act.body().get("token").asString()};
    }

    @Test
    void studioOwnerInvitesCoachesUpToTheSeatLimit() throws Exception {
        Studio st = registerStudio();
        JsonNode studio = call(get("/api/bootstrap"), st.owner(), null).body().get("studio");
        assertThat(studio.get("kind").asString()).isEqualTo("studio");
        assertThat(studio.get("maxCoaches").asInt()).isEqualTo(3);
        assertThat(studio.get("coaches").size()).as("the owner takes a seat").isEqualTo(1);

        studioCoach(st.owner(), "amy");
        Resp pending = call(post("/api/studio/coaches"), st.owner(), Map.of("name", "bob", "email", "bob-" + suffix + "@example.com"));
        assertThat(pending.body().get("coach").get("status").asString()).isEqualTo("invited");
        Resp full = call(post("/api/studio/coaches"), st.owner(), Map.of("name", "cat", "email", "cat-" + suffix + "@example.com"));
        assertThat(full.status()).isEqualTo(409);
        assertThat(full.body().get("code").asString()).isEqualTo("seats_full");

        assertThat(call(post("/api/auth/login"), null, Map.of("email", "amy-" + suffix + "@example.com", "password", "coach12345")).status()).isEqualTo(200);
        assertThat(call(post("/api/studio/coaches"), coach, Map.of("name", "x", "email", "x-" + suffix + "@example.com")).status())
                .as("free coaches cannot invite coaches").isEqualTo(403);
    }

    @Test
    void studioCoachesSeeOnlyTheirOwnStudentsAndShareThePlans() throws Exception {
        Studio st = registerStudio();
        String[] amy = studioCoach(st.owner(), "amy");
        String ownStudent = createStudent(st.owner(), "own");
        Resp forAmy = call(post("/api/students"), st.owner(), Map.of("name", "forAmy", "email", "foramy-" + suffix + "@example.com", "gender", "female",
                "goal", "strength", "weeklyFrequency", 2, "status", "active", "coachId", amy[0]));
        assertThat(forAmy.status()).isEqualTo(201);
        String amyStudent = forAmy.body().get("id").asString();
        String amyOwn = createStudent(amy[1], "amyown");

        JsonNode amyBoot = call(get("/api/bootstrap"), amy[1], null).body();
        assertThat(amyBoot.get("students").size()).as("amy sees her two students").isEqualTo(2);
        assertThat(amyBoot.get("coach").get("name").asString()).as("the profile is amy's own").isEqualTo("amy");
        assertThat(call(get("/api/students/" + ownStudent), amy[1], null).status()).isEqualTo(404);
        assertThat(call(put("/api/workouts/wo_amy" + suffix), amy[1], workout(ownStudent, "coached", "completed")).status()).isEqualTo(404);
        assertThat(call(post("/api/students/" + ownStudent + "/packages"), amy[1], Map.of("name", "x", "totalSessions", 5, "priceTwd", 0,
                "purchaseDate", Instant.now().toString())).status()).isEqualTo(404);
        // IDs are client-chosen: knowing one must not let amy overwrite the records of a student who isn't hers.
        String ownersWorkout = saveWorkout(st.owner(), ownStudent, "coached");
        assertThat(call(put("/api/workouts/" + ownersWorkout), amy[1], workout(amyOwn, "coached", "completed")).status()).isEqualTo(404);
        String ownersClass = "apt_own" + suffix;
        String at = Instant.now().plusSeconds(86400).toString();
        call(put("/api/appointments/" + ownersClass), st.owner(), Map.of("studentId", ownStudent, "startAt", at, "durationMin", 60, "location", "工作室"));
        assertThat(call(put("/api/appointments/" + ownersClass), amy[1], Map.of("studentId", amyOwn, "startAt", at, "durationMin", 60, "location", "工作室")).status())
                .isEqualTo(404);
        assertThat(call(get("/api/students"), st.owner(), null).body().size()).as("the owner sees every student").isEqualTo(3);
        String rels = call(get("/api/bootstrap"), st.owner(), null).body().get("relationships").toString();
        assertThat(rels).contains(amy[0]).contains(st.ownerId());

        // Plans are shared, and assigning one only touches the coach's own students.
        Map<String, Object> plan = Map.of("name", "共用計畫", "goal", "strength", "description", "",
                "days", List.of(Map.of("id", "day_a", "name", "A", "exercises", List.of(Map.of("id", "rx_1", "exerciseId", "ex_squat", "sets", 3, "reps", "5")))));
        String planId = "plan_s" + suffix;
        call(put("/api/plans/" + planId), st.owner(), plan);
        call(put("/api/plans/" + planId + "/assignments"), st.owner(), Map.of("studentIds", List.of(ownStudent)));
        assertThat(call(get("/api/plans"), amy[1], null).body().size()).isEqualTo(1);
        assertThat(call(put("/api/plans/" + planId + "/assignments"), amy[1], Map.of("studentIds", List.of(amyOwn))).status()).isEqualTo(204);
        assertThat(call(get("/api/students/" + ownStudent), st.owner(), null).body().get("activePlanId").asString())
                .as("amy's assignment leaves the owner's student alone").isEqualTo(planId);

        assertThat(call(put("/api/students/" + amyOwn + "/coach"), amy[1], Map.of("coachId", st.ownerId())).status()).as("only the owner moves students").isEqualTo(403);

        // A coached session records who taught it: amy for her class, the owner when substituting.
        String amyClass = "wo_ac" + suffix, subClass = "wo_sc" + suffix;
        assertThat(call(put("/api/workouts/" + amyClass), amy[1], workout(amyStudent, "coached", "completed")).body().get("coachId").asString()).isEqualTo(amy[0]);
        assertThat(call(put("/api/workouts/" + subClass), st.owner(), workout(amyStudent, "coached", "completed")).body().get("coachId").asString()).isEqualTo(st.ownerId());
        assertThat(call(put("/api/workouts/" + amyClass), st.owner(), workout(amyStudent, "coached", "completed")).body().get("coachId").asString())
                .as("editing keeps who taught").isEqualTo(amy[0]);
        assertThat(call(post("/api/studio/coaches"), amy[1], Map.of("name", "x", "email", "x-" + suffix + "@example.com")).status()).isEqualTo(403);
    }

    @Test
    void deactivatingACoachHandsOverTheirStudentsAndEndsTheirAccess() throws Exception {
        Studio st = registerStudio();
        String[] amy = studioCoach(st.owner(), "amy");
        String[] ben = studioCoach(st.owner(), "ben");
        String s1 = createStudent(amy[1], "s1");
        call(put("/api/workouts/wo_s1" + suffix), amy[1], workout(s1, "coached", "completed"));

        assertThat(call(put("/api/students/" + s1 + "/coach"), st.owner(), Map.of("coachId", ben[0])).status()).isEqualTo(204);
        assertThat(call(get("/api/students/" + s1), ben[1], null).status()).as("ben now teaches s1").isEqualTo(200);
        assertThat(call(get("/api/students/" + s1), amy[1], null).status()).isEqualTo(404);
        assertThat(call(get("/api/workouts?studentId=" + s1), ben[1], null).body().size()).as("history moves with the student").isEqualTo(1);

        assertThat(call(post("/api/studio/coaches/" + ben[0] + "/deactivate"), st.owner(), Map.of()).status()).as("must say who takes ben's students").isEqualTo(400);
        assertThat(call(post("/api/studio/coaches/" + ben[0] + "/deactivate"), st.owner(), Map.of("transferTo", st.ownerId())).status()).isEqualTo(204);
        assertThat(call(get("/api/bootstrap"), ben[1], null).status()).as("ben's studio token stops working at once").isEqualTo(401);
        Resp benAgain = call(post("/api/auth/login"), null, Map.of("email", "ben-" + suffix + "@example.com", "password", "coach12345"));
        assertThat(benAgain.status()).as("ben keeps his account, as a free coach").isEqualTo(200);
        JsonNode benOwn = call(get("/api/bootstrap"), benAgain.body().get("token").asString(), null).body();
        assertThat(benOwn.get("students").size()).as("in a fresh workspace of his own").isZero();
        assertThat(benOwn.get("billing").get("status").asString()).isEqualTo("trialing");
        assertThat(call(get("/api/bootstrap"), st.owner(), null).body().get("studio").get("coaches").toString()).doesNotContain("ben-" + suffix);
        assertThat(call(get("/api/students/" + s1), st.owner(), null).status()).isEqualTo(200);
        assertThat(call(post("/api/studio/coaches"), st.owner(), Map.of("name", "cat", "email", "cat-" + suffix + "@example.com")).status())
                .as("ben's seat is free again").isEqualTo(201);
        assertThat(call(post("/api/studio/coaches/" + st.ownerId() + "/deactivate"), st.owner(), Map.of()).status()).isEqualTo(400);
    }

    @Test
    void aFreeCoachUpgradesToAStudioWithTheirStudents() throws Exception {
        String sid = createStudent(coach, "keep");
        Resp up = call(post("/api/studio/upgrade"), coach, Map.of("studio", "升級工作室"));
        assertThat(up.status()).isEqualTo(200);
        assertThat(up.body().get("user").get("role").asString()).isEqualTo("owner");
        String owner = up.body().get("token").asString();
        JsonNode boot = call(get("/api/bootstrap"), owner, null).body();
        assertThat(boot.get("studio").get("kind").asString()).isEqualTo("studio");
        assertThat(boot.get("studio").get("name").asString()).isEqualTo("升級工作室");
        assertThat(boot.get("students").get(0).get("id").asString()).isEqualTo(sid);
        assertThat(call(post("/api/studio/coaches"), owner, Map.of("name", "amy", "email", "amy-" + suffix + "@example.com")).status()).isEqualTo(201);
        assertThat(call(post("/api/studio/upgrade"), owner, Map.of("studio", "x")).status()).isEqualTo(409);
    }

    @Test
    void plansAreCoachAuthoredAndAssignable() throws Exception {
        String sid = createStudent(coach, "hal");
        Map<String, Object> plan = Map.of("name", "肌力 5x5", "goal", "strength", "description", "",
                "days", List.of(Map.of("id", "day_a", "name", "A", "exercises",
                        List.of(Map.of("id", "rx_1", "exerciseId", "ex_squat", "sets", 5, "reps", "5")))));
        String planId = "plan_" + suffix;
        assertThat(call(put("/api/plans/" + planId), coach, plan).status()).isEqualTo(200);
        assertThat(call(put("/api/plans/" + planId + "/assignments"), coach, Map.of("studentIds", List.of(sid))).status()).isEqualTo(204);

        String student = studentToken(sid);
        JsonNode plans = call(get("/api/plans"), student, null).body();
        assertThat(plans.size()).isEqualTo(1);
        assertThat(plans.get(0).get("days").get(0).get("exercises").get(0).get("exerciseId").asString()).isEqualTo("ex_squat");
        assertThat(call(put("/api/plans/" + planId), student, plan).status()).as("students cannot edit plans").isEqualTo(403);

        assertThat(call(post("/api/plans/" + planId + "/duplicate"), coach, null).status()).isEqualTo(201);
        assertThat(call(delete("/api/plans/" + planId), coach, null).status()).isEqualTo(204);
        assertThat(call(get("/api/students/" + sid), coach, null).body().has("activePlanId")).as("deleting a plan unassigns it").isFalse();
    }

    @Test
    void workoutSaveIsIdempotentAndReplacesExercises() throws Exception {
        String sid = createStudent(coach, "ivy");
        String id = "wo_idem" + suffix;
        call(put("/api/workouts/" + id), coach, workout(sid, "coached", "draft"));
        Map<String, Object> updated = new java.util.HashMap<>(workout(sid, "coached", "completed"));
        updated.put("exercises", List.of(
                Map.of("id", "el_a", "exerciseId", "ex_bench", "sets", List.of(Map.of("id", "set_a", "weightKg", 40, "reps", 8, "completed", true))),
                Map.of("id", "el_b", "exerciseId", "ex_latpd", "sets", List.of(Map.of("id", "set_b", "weightKg", 35, "reps", 10, "completed", false)))));
        Resp r = call(put("/api/workouts/" + id), coach, updated);
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("exercises").size()).isEqualTo(2);
        assertThat(r.body().get("exercises").get(0).get("id").asString()).isEqualTo("el_a");
        assertThat(r.body().get("completedAt")).isNotNull();
        assertThat(call(get("/api/workouts?studentId=" + sid), coach, null).body().size()).isEqualTo(1);

        Map<String, Object> noSets = new java.util.HashMap<>(workout(sid, "coached", "completed"));
        noSets.put("exercises", List.of());
        assertThat(call(put("/api/workouts/wo_empty" + suffix), coach, noSets).status()).as("completed needs a completed set").isEqualTo(400);
    }

    @Test
    void demoImportAndLogin() throws Exception {
        Map<String, Object> data = Map.ofEntries(
                Map.entry("schemaVersion", 1),
                Map.entry("seededAt", Instant.now().toString()),
                Map.entry("coach", Map.of("id", "coach_demo", "role", "coach", "name", "示範教練", "email", "demo-" + suffix + "@example.com",
                        "title", "教練", "studio", "工作室", "createdAt", Instant.now().toString())),
                Map.entry("students", List.of(Map.ofEntries(
                        Map.entry("id", "stu_demo1"), Map.entry("role", "student"), Map.entry("name", "學員一"),
                        Map.entry("email", "s1-" + suffix + "@example.com"), Map.entry("gender", "male"), Map.entry("goal", "general"),
                        Map.entry("goalDetail", ""), Map.entry("status", "active"), Map.entry("weeklyFrequency", 2), Map.entry("coachNotes", ""),
                        Map.entry("joinedAt", Instant.now().toString()), Map.entry("createdAt", Instant.now().toString())))),
                Map.entry("relationships", List.of()),
                Map.entry("exercises", List.of()),
                Map.entry("plans", List.of()),
                Map.entry("workouts", List.of()),
                Map.entry("packages", List.of(Map.of("id", "pkg_demo1", "studentId", "stu_demo1", "coachId", "coach_demo", "name", "10 堂",
                        "totalSessions", 10, "priceTwd", 18000, "purchaseDate", Instant.now().toString()))),
                Map.entry("transactions", List.of()),
                Map.entry("metrics", List.of()),
                Map.entry("appointments", List.of()));
        assertThat(call(post("/api/demo/import"), null, data).status()).isEqualTo(200);
        Resp login = call(post("/api/demo/login"), null, Map.of("role", "student", "studentId", "stu_demo1"));
        assertThat(login.status()).isEqualTo(200);
        String token = login.body().get("token").asString();
        assertThat(remaining(token, "stu_demo1")).isEqualTo(10);
        assertThat(call(post("/api/auth/login"), null, Map.of("email", "demo-" + suffix + "@example.com", "password", "demo1234")).status()).isEqualTo(200);
    }
}
