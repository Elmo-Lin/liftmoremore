package com.example.backend.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.example.backend.auth.GoogleTokenVerifier;
import com.example.backend.auth.GoogleTokenVerifier.GoogleUser;
import com.example.backend.domain.Coach;
import com.example.backend.store.Db;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Trial, limits, read-only mode, the NewebPay flows (callbacks built with the test shop keys) and
 * Google sign-in (token verification stubbed). Mandate changes on NewebPay's side are stubbed too.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BillingFlowTests {

    @Autowired
    MockMvc mvc;

    @Autowired
    Db db;

    @MockitoSpyBean
    NewebPay newebPay;

    @MockitoBean
    GoogleTokenVerifier google;

    final JsonMapper json = JsonMapper.builder().build();

    String coach;
    String coachId;
    String suffix;

    record Resp(int status, JsonNode body, String location) {}

    @BeforeEach
    void registerCoach() throws Exception {
        suffix = UUID.randomUUID().toString().substring(0, 8);
        Resp r = call(post("/api/auth/register"), null, Map.of("name", "測試教練", "email", "bill-" + suffix + "@example.com", "password", "password123"));
        assertThat(r.status()).isEqualTo(201);
        coach = r.body().get("token").asString();
        coachId = r.body().get("user").get("userId").asString();
        doNothing().when(newebPay).alterAmount(anyString(), anyString(), anyInt(), any());
        doNothing().when(newebPay).terminate(anyString(), anyString(), any());
    }

    // ------------------------------------------------------------------ helpers

    Resp call(MockHttpServletRequestBuilder req, String token, Object body) throws Exception {
        if (token != null) req.header("Authorization", "Bearer " + token);
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        MvcResult res = mvc.perform(req).andReturn();
        String text = res.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        JsonNode parsed = null;
        if (!text.isEmpty() && (text.startsWith("{") || text.startsWith("["))) parsed = json.readTree(text);
        return new Resp(res.getResponse().getStatus(), parsed, res.getResponse().getHeader("Location"));
    }

    /** Posted by the browser leaving NewebPay's page (or by NewebPay's server), so it carries NewebPay's origin. */
    Resp form(String path, Map<String, String> fields) throws Exception {
        var req = post(path).contentType(MediaType.APPLICATION_FORM_URLENCODED).header("Origin", "https://ccore.newebpay.com");
        fields.forEach(req::param);
        return call(req, null, null);
    }

    JsonNode billing(String token) throws Exception {
        return call(get("/api/bootstrap"), token, null).body().get("billing");
    }

    Resp addStudent(String token, String name, String status) throws Exception {
        return call(post("/api/students"), token, Map.of("name", name, "email", name + "-" + suffix + "@example.com", "gender", "female",
                "goal", "strength", "weeklyFrequency", 2, "status", status));
    }

    void editSubscription(java.util.function.Consumer<Coach> edit) {
        Coach space = db.get(db.doc(Db.COACHES, coachId), Coach.class).orElseThrow();
        edit.accept(space);
        db.set(db.doc(Db.COACHES, coachId), space);
    }

    /** Decrypts the PostData_ / TradeInfo the browser would post to NewebPay. */
    Map<String, String> sentToNewebPay(String encrypted) throws Exception {
        Map<String, String> out = new LinkedHashMap<>();
        for (String pair : newebPay.decrypt(encrypted).split("&")) {
            String[] kv = pair.split("=", 2);
            out.put(java.net.URLDecoder.decode(kv[0], "UTF-8"), java.net.URLDecoder.decode(kv[1], "UTF-8"));
        }
        return out;
    }

    Resp periodCallback(String path, String status, String orderNo, String periodNo, Integer times, int amount) throws Exception {
        Map<String, Object> result = new HashMap<>(Map.of("MerchantID", "MS_TEST", "MerchantOrderNo", orderNo, "PeriodNo", periodNo, "TradeNo", "T" + suffix));
        // Numbers arrive as strings in NewebPay's examples ("AlreadyTimes":"2", "PeriodAmt":"10").
        if (times != null) {
            result.put("AlreadyTimes", String.valueOf(times));
            result.put("AuthAmt", amount);
        } else {
            result.put("PeriodAmt", String.valueOf(amount));
        }
        String payload = json.writeValueAsString(Map.of("Status", status, "Message", "", "Result", result));
        return form(path, Map.of("Period", newebPay.encrypt(payload)));
    }

    /** Subscribes and completes the first charge; returns the PeriodNo. */
    String subscribe(int packs) throws Exception {
        Resp checkout = call(post("/api/billing/subscribe"), coach, Map.of("extraStudentPacks", packs, "extraCoachSeats", 0));
        assertThat(checkout.status()).as(String.valueOf(checkout.body())).isEqualTo(200);
        assertThat(checkout.body().get("action").asString()).endsWith("/MPG/period");
        Map<String, String> sent = sentToNewebPay(checkout.body().get("fields").get("PostData_").asString());
        assertThat(sent.get("PeriodAmt")).isEqualTo(String.valueOf(399 + packs * 99));
        assertThat(sent.get("OrderInfo")).as("no shipping address for a subscription").isEqualTo("N");
        String periodNo = "P" + suffix;
        Resp back = periodCallback("/api/billing/newebpay/period-return", "SUCCESS", sent.get("MerOrderNo"), periodNo, null, 399 + packs * 99);
        assertThat(back.status()).isEqualTo(303);
        assertThat(back.location()).endsWith("/coach/billing?result=success");
        return periodNo;
    }

    // ------------------------------------------------------------------ tests

    @Test
    void newCoachesStartATenDayTrial() throws Exception {
        JsonNode b = billing(coach);
        assertThat(b.get("plan").asString()).isEqualTo("pro");
        assertThat(b.get("status").asString()).isEqualTo("trialing");
        assertThat(b.get("writable").asBoolean()).isTrue();
        assertThat(b.get("studentLimit").asInt()).isEqualTo(30);
        Instant ends = Instant.parse(b.get("trialEndsAt").asString());
        assertThat(Duration.between(Instant.now(), ends).toHours()).isBetween(239L, 240L);
    }

    @Test
    void lapsedTrialIsReadOnlyButKeepsData() throws Exception {
        String sid = addStudent(coach, "ann", "active").body().get("id").asString();
        editSubscription(s -> s.subscription.trialEndsAt = Instant.now().minusSeconds(60));

        assertThat(billing(coach).get("status").asString()).isEqualTo("expired");
        Resp blocked = addStudent(coach, "ben", "active");
        assertThat(blocked.status()).isEqualTo(402);
        assertThat(blocked.body().get("code").asString()).isEqualTo("subscription_required");
        assertThat(call(get("/api/students/" + sid), coach, null).status()).as("reads still work").isEqualTo(200);
        assertThat(call(get("/api/billing"), coach, null).status()).isEqualTo(200);

        subscribe(0);
        assertThat(billing(coach).get("writable").asBoolean()).isTrue();
        assertThat(addStudent(coach, "ben", "active").status()).isEqualTo(201);
    }

    @Test
    void workspacesFromBeforeBillingStartTheirTrialAtLaunch() throws Exception {
        editSubscription(s -> {
            s.subscription = null;
            s.createdAt = Instant.now().minus(Duration.ofDays(90));
        });
        JsonNode b = billing(coach);
        assertThat(b.get("writable").asBoolean()).as("not locked out by an old sign-up date").isTrue();
        assertThat(daysUntil(b.get("trialEndsAt").asString())).isBetween(9L, 10L);
        assertThat(daysUntil(billing(coach).get("trialEndsAt").asString())).as("started once, not on every load").isBetween(9L, 10L);
        assertThat(addStudent(coach, "old", "active").status()).isEqualTo(201);
    }

    static long daysUntil(String iso) {
        return Duration.between(Instant.now(), Instant.parse(iso)).toDays();
    }

    @Test
    void onlyActiveStudentsCountAgainstTheLimit() throws Exception {
        for (int i = 0; i < 30; i++) assertThat(addStudent(coach, "s" + i, "active").status()).isEqualTo(201);
        Resp full = addStudent(coach, "s30", "active");
        assertThat(full.status()).isEqualTo(409);
        assertThat(full.body().get("code").asString()).isEqualTo("student_limit");
        assertThat(addStudent(coach, "archived", "inactive").status()).as("inactive students are free").isEqualTo(201);

        Resp more = call(post("/api/billing/change"), coach, Map.of("plan", "pro", "extraStudentPacks", 1, "extraCoachSeats", 0));
        assertThat(more.body().get("applied").asBoolean()).as("free during the trial").isTrue();
        assertThat(billing(coach).get("studentLimit").asInt()).isEqualTo(40);
        assertThat(addStudent(coach, "s30", "active").status()).isEqualTo(201);
    }

    @Test
    void renewalsExtendThePeriodOnceEach() throws Exception {
        String periodNo = subscribe(1);
        JsonNode b = billing(coach);
        assertThat(b.get("status").asString()).isEqualTo("active");
        assertThat(b.get("subscribed").asBoolean()).isTrue();
        assertThat(b.get("monthlyAmount").asInt()).isEqualTo(498);
        Instant firstEnd = Instant.parse(b.get("currentPeriodEnd").asString());
        String orderNo = db.get(db.doc(Db.COACHES, coachId), Coach.class).orElseThrow().subscription.mandateOrderNo;

        assertThat(periodCallback("/api/billing/newebpay/period-notify", "SUCCESS", orderNo, periodNo, 1, 498).status())
                .as("the first charge again is a no-op").isEqualTo(200);
        assertThat(Instant.parse(billing(coach).get("currentPeriodEnd").asString())).isEqualTo(firstEnd);

        periodCallback("/api/billing/newebpay/period-notify", "SUCCESS", orderNo, periodNo, 2, 498);
        periodCallback("/api/billing/newebpay/period-notify", "SUCCESS", orderNo, periodNo, 2, 498);
        Instant secondEnd = Instant.parse(billing(coach).get("currentPeriodEnd").asString());
        assertThat(Duration.between(firstEnd, secondEnd).toDays()).isBetween(28L, 31L);
        assertThat(call(get("/api/billing"), coach, null).body().get("payments").size()).isEqualTo(2);

        periodCallback("/api/billing/newebpay/period-notify", "FAILED", orderNo, periodNo, 3, 498);
        assertThat(billing(coach).get("status").asString()).isEqualTo("past_due");
        assertThat(billing(coach).get("writable").asBoolean()).as("still inside the paid period").isTrue();
    }

    @Test
    void upgradesArePaidProRataAndDowngradesWaitForRenewal() throws Exception {
        String periodNo = subscribe(0);
        Resp up = call(post("/api/billing/change"), coach, Map.of("plan", "pro", "extraStudentPacks", 2, "extraCoachSeats", 0));
        assertThat(up.body().get("applied").asBoolean()).isFalse();
        JsonNode fields = up.body().get("checkout").get("fields");
        Map<String, String> sent = sentToNewebPay(fields.get("TradeInfo").asString());
        int charge = Integer.parseInt(sent.get("Amt"));
        assertThat(charge).as("about a full month of 2 packs, just paid").isBetween(190, 198);
        assertThat(billing(coach).get("studentLimit").asInt()).as("not before paying").isEqualTo(30);

        String tradeInfo = newebPay.encrypt(json.writeValueAsString(Map.of("Status", "SUCCESS", "Result",
                Map.of("MerchantID", "MS_TEST", "MerchantOrderNo", sent.get("MerchantOrderNo"), "Amt", charge, "TradeNo", "T2"))));
        Map<String, String> notify = Map.of("Status", "SUCCESS", "MerchantID", "MS_TEST", "TradeInfo", tradeInfo, "TradeSha", newebPay.tradeSha(tradeInfo));
        assertThat(form("/api/billing/newebpay/mpg-notify", notify).status()).isEqualTo(200);
        assertThat(form("/api/billing/newebpay/mpg-return", notify).location()).endsWith("result=success");
        assertThat(billing(coach).get("studentLimit").asInt()).isEqualTo(50);
        verify(newebPay).alterAmount(anyString(), eq(periodNo), eq(399 + 2 * 99), any());

        Map<String, String> forged = new HashMap<>(notify);
        forged.put("TradeSha", "0".repeat(64));
        assertThat(form("/api/billing/newebpay/mpg-notify", forged).status()).isEqualTo(400);

        Resp down = call(post("/api/billing/change"), coach, Map.of("plan", "pro", "extraStudentPacks", 0, "extraCoachSeats", 0));
        assertThat(down.body().get("applied").asBoolean()).isTrue();
        JsonNode b = billing(coach);
        assertThat(b.get("studentLimit").asInt()).as("until the next renewal").isEqualTo(50);
        assertThat(b.get("nextExtraStudentPacks").asInt()).isZero();
        assertThat(b.get("monthlyAmount").asInt()).isEqualTo(399);

        String orderNo = db.get(db.doc(Db.COACHES, coachId), Coach.class).orElseThrow().subscription.mandateOrderNo;
        periodCallback("/api/billing/newebpay/period-notify", "SUCCESS", orderNo, periodNo, 2, 399);
        assertThat(billing(coach).get("studentLimit").asInt()).isEqualTo(30);
    }

    @Test
    void cancelingKeepsAccessUntilThePeriodEnds() throws Exception {
        String periodNo = subscribe(0);
        assertThat(call(post("/api/billing/cancel"), coach, null).status()).isEqualTo(204);
        verify(newebPay).terminate(anyString(), eq(periodNo), any());
        JsonNode b = billing(coach);
        assertThat(b.get("status").asString()).isEqualTo("canceled");
        assertThat(b.get("writable").asBoolean()).isTrue();
    }

    @Test
    void studioCoachesNeedSeatsAndCannotManageBilling() throws Exception {
        Resp r = call(post("/api/auth/register-studio"), null, Map.of("name", "經營者", "email", "own-" + suffix + "@example.com", "password", "password123", "studio", "工作室"));
        String owner = r.body().get("token").asString();
        assertThat(billing(owner).get("plan").asString()).isEqualTo("team");
        assertThat(billing(owner).get("coachLimit").asInt()).isEqualTo(3);
        Resp inv = call(post("/api/studio/coaches"), owner, Map.of("name", "c1", "email", "c1-" + suffix + "@example.com"));
        String code = inv.body().get("inviteCode").asString();
        String coachToken = call(post("/api/auth/activate"), null, Map.of("inviteCode", code, "password", "coach12345")).body().get("token").asString();
        call(post("/api/studio/coaches"), owner, Map.of("name", "c2", "email", "c2-" + suffix + "@example.com"));
        assertThat(call(post("/api/studio/coaches"), owner, Map.of("name", "c3", "email", "c3-" + suffix + "@example.com")).body().get("code").asString())
                .isEqualTo("seats_full");

        assertThat(billing(coachToken).get("canManage").asBoolean()).isFalse();
        assertThat(call(post("/api/billing/change"), coachToken, Map.of("plan", "team", "extraStudentPacks", 0, "extraCoachSeats", 1)).status()).isEqualTo(403);
        call(post("/api/billing/change"), owner, Map.of("plan", "team", "extraStudentPacks", 0, "extraCoachSeats", 1));
        assertThat(call(post("/api/studio/coaches"), owner, Map.of("name", "c3", "email", "c3-" + suffix + "@example.com")).status()).isEqualTo(201);
    }

    @Test
    void paidCoachesUpgradeToStudioThroughBilling() throws Exception {
        subscribe(0);
        assertThat(call(post("/api/studio/upgrade"), coach, Map.of("studio", "新工作室")).body().get("code").asString()).isEqualTo("upgrade_via_billing");
        Resp up = call(post("/api/billing/change"), coach, Map.of("plan", "team", "extraStudentPacks", 0, "extraCoachSeats", 0, "studioName", "新工作室"));
        Map<String, String> sent = sentToNewebPay(up.body().get("checkout").get("fields").get("TradeInfo").asString());
        String tradeInfo = newebPay.encrypt(json.writeValueAsString(Map.of("Status", "SUCCESS", "Result",
                Map.of("MerchantID", "MS_TEST", "MerchantOrderNo", sent.get("MerchantOrderNo"), "Amt", Integer.parseInt(sent.get("Amt"))))));
        form("/api/billing/newebpay/mpg-notify", Map.of("TradeInfo", tradeInfo, "TradeSha", newebPay.tradeSha(tradeInfo)));

        Resp refreshed = call(post("/api/auth/refresh"), coach, null);
        assertThat(refreshed.body().get("user").get("role").asString()).isEqualTo("owner");
        JsonNode boot = call(get("/api/bootstrap"), refreshed.body().get("token").asString(), null).body();
        assertThat(boot.get("studio").get("kind").asString()).isEqualTo("studio");
        assertThat(boot.get("billing").get("plan").asString()).isEqualTo("team");
    }

    @Test
    void googleSignInCreatesOrLinksAccounts() throws Exception {
        when(google.verify("new-user")).thenReturn(new GoogleUser("g-new-" + suffix, "g-" + suffix + "@gmail.com", "Google 教練"));
        Resp first = call(post("/api/auth/google"), null, Map.of("credential", "new-user"));
        assertThat(first.status()).isEqualTo(409);
        assertThat(first.body().get("code").asString()).isEqualTo("signup_required");
        Resp created = call(post("/api/auth/google"), null, Map.of("credential", "new-user", "accountType", "coach"));
        assertThat(created.status()).isEqualTo(200);
        assertThat(created.body().get("user").get("name").asString()).isEqualTo("Google 教練");
        assertThat(billing(created.body().get("token").asString()).get("status").asString()).isEqualTo("trialing");
        Resp again = call(post("/api/auth/google"), null, Map.of("credential", "new-user"));
        assertThat(again.body().get("user").get("userId").asString()).isEqualTo(created.body().get("user").get("userId").asString());

        // An existing password account with the same email is linked, not duplicated.
        when(google.verify("existing")).thenReturn(new GoogleUser("g-old-" + suffix, "bill-" + suffix + "@example.com", "X"));
        assertThat(call(post("/api/auth/google"), null, Map.of("credential", "existing")).body().get("user").get("userId").asString()).isEqualTo(coachId);
        when(google.verify("hijack")).thenReturn(new GoogleUser("someone-else", "bill-" + suffix + "@example.com", "X"));
        assertThat(call(post("/api/auth/google"), null, Map.of("credential", "hijack")).status()).isEqualTo(401);

        // An invited student activates by signing in with the invited email.
        String sid = addStudent(coach, "gstu", "active").body().get("id").asString();
        call(post("/api/students/" + sid + "/invite"), coach, null);
        when(google.verify("student")).thenReturn(new GoogleUser("g-stu-" + suffix, "gstu-" + suffix + "@example.com", "S"));
        Resp student = call(post("/api/auth/google"), null, Map.of("credential", "student"));
        assertThat(student.body().get("user").get("role").asString()).isEqualTo("student");
        assertThat(call(get("/api/students/" + sid), coach, null).body().get("activated").asBoolean()).isTrue();
    }

    @Test
    void studentsOfALapsedWorkspaceCannotWriteEither() throws Exception {
        String sid = addStudent(coach, "lap", "active").body().get("id").asString();
        when(google.verify("lap")).thenReturn(new GoogleUser("g-lap-" + suffix, "lap-" + suffix + "@example.com", "S"));
        String student = call(post("/api/auth/google"), null, Map.of("credential", "lap")).body().get("token").asString();
        editSubscription(s -> s.subscription.trialEndsAt = Instant.now().minusSeconds(60));
        Map<String, Object> workout = Map.of("studentId", sid, "type", "independent", "status", "completed", "title", "A",
                "startedAt", Instant.now().toString(), "notes", "", "exercises", java.util.List.of());
        assertThat(call(put("/api/workouts/wo_lap" + suffix), student, workout).status()).isEqualTo(402);
    }
}
