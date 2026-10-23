package com.example.backend.billing;

import com.example.backend.common.ApiException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * NewebPay (藍新金流): monthly credit-card mandates (信用卡定期定額) for subscriptions and one-time
 * MPG payments for prorated upgrades. Every payload is AES-256-CBC encrypted with the shop's
 * HashKey/HashIV, so a callback that decrypts and names our MerchantID really came from NewebPay.
 *
 * Checked against 信用卡定期定額技術串接手冊 NDNP-1.0.6 and 幕前支付技術串接手冊 NDNF-1.0.8
 * (docs/newebpay). Changing or terminating a mandate (NPA-B051 / NPA-B052) must be enabled by
 * NewebPay first (error PER10074 until then) and may be limited to registered server IPs
 * (PER10073). Run the whole flow on the sandbox (ccore.newebpay.com) before switching
 * NEWEBPAY_BASE_URL to production (core.newebpay.com).
 */
@Component
public class NewebPay {

    private static final Logger log = LoggerFactory.getLogger(NewebPay.class);

    static final String PERIOD_VERSION = "1.5";
    static final String ALTER_STATUS_VERSION = "1.0";
    static final String ALTER_AMT_VERSION = "1.2";
    static final String MPG_VERSION = "2.0";

    private final String merchantId;
    private final String hashKey;
    private final String hashIv;
    private final String baseUrl;
    private final JsonMapper json = JsonMapper.builder().build();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public NewebPay(
            @Value("${coachlog.newebpay.merchant-id}") String merchantId,
            @Value("${coachlog.newebpay.hash-key}") String hashKey,
            @Value("${coachlog.newebpay.hash-iv}") String hashIv,
            @Value("${coachlog.newebpay.base-url}") String baseUrl) {
        this.merchantId = merchantId;
        this.hashKey = hashKey;
        this.hashIv = hashIv;
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    public boolean configured() {
        return !merchantId.isBlank() && hashKey.length() == 32 && hashIv.length() == 16;
    }

    /** A form the browser posts to NewebPay; the shopper enters their card there, never on our site. */
    public record Form(String action, Map<String, String> fields) {}

    /** Starts a monthly mandate whose first charge happens right away. */
    public Form periodForm(String orderNo, int monthlyAmount, String description, String email, Instant now, String returnUrl, String notifyUrl, String backUrl) {
        requireConfigured();
        Map<String, String> p = new LinkedHashMap<>();
        p.put("RespondType", "JSON");
        p.put("TimeStamp", String.valueOf(now.getEpochSecond()));
        p.put("Version", PERIOD_VERSION);
        p.put("LangType", "zh-Tw");
        p.put("MerOrderNo", orderNo);
        p.put("ProdDesc", description);
        p.put("PeriodAmt", String.valueOf(monthlyAmount));
        p.put("PeriodType", "M");
        // Day of the month to charge; capped at 28 so every month has it.
        p.put("PeriodPoint", String.format("%02d", Math.min(28, now.atZone(Plans.ZONE).getDayOfMonth())));
        p.put("PeriodStartType", "2"); // charge the first month now
        p.put("PeriodTimes", "99");
        p.put("PayerEmail", email == null ? "" : email);
        p.put("EmailModify", "0");
        // A digital subscription: no payer details or shipping address on the payment page (both default to Y).
        p.put("PaymentInfo", "N");
        p.put("OrderInfo", "N");
        p.put("ReturnURL", returnUrl);
        p.put("NotifyURL", notifyUrl);
        p.put("BackURL", backUrl);
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("MerchantID_", merchantId);
        fields.put("PostData_", encrypt(query(p)));
        return new Form(baseUrl + "/MPG/period", fields);
    }

    /** A one-time credit-card payment (MPG). */
    public Form mpgForm(String orderNo, int amount, String description, String email, Instant now, String returnUrl, String notifyUrl, String backUrl) {
        requireConfigured();
        Map<String, String> p = new LinkedHashMap<>();
        p.put("MerchantID", merchantId);
        p.put("RespondType", "JSON");
        p.put("TimeStamp", String.valueOf(now.getEpochSecond()));
        p.put("Version", MPG_VERSION);
        p.put("LangType", "zh-tw");
        p.put("MerchantOrderNo", orderNo);
        p.put("Amt", String.valueOf(amount));
        p.put("ItemDesc", description);
        p.put("Email", email == null ? "" : email);
        p.put("LoginType", "0");
        p.put("CREDIT", "1");
        p.put("ReturnURL", returnUrl);
        p.put("NotifyURL", notifyUrl);
        p.put("ClientBackURL", backUrl);
        String tradeInfo = encrypt(query(p));
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("MerchantID", merchantId);
        fields.put("TradeInfo", tradeInfo);
        fields.put("TradeSha", tradeSha(tradeInfo));
        fields.put("Version", MPG_VERSION);
        return new Form(baseUrl + "/MPG/mpg_gateway", fields);
    }

    /** Changes what the mandate charges from its next period on. */
    public void alterAmount(String mandateOrderNo, String periodNo, int monthlyAmount, Instant now) {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("RespondType", "JSON");
        p.put("Version", ALTER_AMT_VERSION);
        p.put("TimeStamp", String.valueOf(now.getEpochSecond()));
        p.put("MerOrderNo", mandateOrderNo);
        p.put("PeriodNo", periodNo);
        p.put("AlterAmt", String.valueOf(monthlyAmount));
        callAlter("/MPG/period/AlterAmt", p);
    }

    /** Stops the mandate; no further charges. */
    public void terminate(String mandateOrderNo, String periodNo, Instant now) {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("RespondType", "JSON");
        p.put("Version", ALTER_STATUS_VERSION);
        p.put("TimeStamp", String.valueOf(now.getEpochSecond()));
        p.put("MerOrderNo", mandateOrderNo);
        p.put("PeriodNo", periodNo);
        p.put("AlterType", "terminate");
        callAlter("/MPG/period/AlterStatus", p);
    }

    private void callAlter(String path, Map<String, String> params) {
        requireConfigured();
        String body = query(Map.of("MerchantID_", merchantId, "PostData_", encrypt(query(params))));
        try {
            HttpResponse<String> res = http.send(
                    HttpRequest.newBuilder(URI.create(baseUrl + path))
                            .timeout(Duration.ofSeconds(20))
                            .header("Content-Type", "application/x-www-form-urlencoded")
                            .POST(HttpRequest.BodyPublishers.ofString(body))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
            JsonNode outer = json.readTree(res.body());
            JsonNode period = outer.has("period") ? outer.get("period") : outer.get("Period");
            JsonNode result = period != null && period.isString() ? decryptJson(period.asString()) : outer;
            if (!"SUCCESS".equals(result.path("Status").asString(""))) {
                throw gatewayError("藍新金流回應：" + result.path("Message").asString(result.toString()));
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw gatewayError("無法連線到藍新金流，請稍後再試");
        }
    }

    // ------------------------------------------------------------------ callbacks

    /** Decrypts a callback payload (定期定額 {@code Period}, or MPG {@code TradeInfo}). */
    public JsonNode decryptJson(String hex) {
        String plain;
        try {
            plain = decrypt(hex);
        } catch (Exception e) {
            throw ApiException.badRequest("無法解析金流通知");
        }
        try {
            return parse(plain);
        } catch (Exception e) {
            // Never log the content (it holds payment details); its shape is enough to diagnose.
            log.error("NewebPay payload could not be parsed: {} chars, starts with '{}', ends with bytes {}", plain.length(),
                    plain.isEmpty() ? "" : plain.substring(0, 1), HexFormat.of().formatHex(plain.substring(Math.max(0, plain.length() - 8)).getBytes(StandardCharsets.UTF_8)), e);
            throw ApiException.badRequest("無法解析金流通知");
        }
    }

    /**
     * A decrypted payload: JSON (RespondType=JSON), possibly followed by stray bytes, or the
     * {@code Status=…&Message=…&…} form NewebPay can send instead; the latter is reshaped into
     * the JSON layout ({@code Status}, {@code Message}, {@code Result{…}}).
     */
    JsonNode parse(String plain) throws Exception {
        String text = plain.strip();
        if (text.startsWith("{")) return json.readTree(text.substring(0, text.lastIndexOf('}') + 1));
        Map<String, String> fields = new LinkedHashMap<>();
        for (String pair : text.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv[0].isEmpty()) continue;
            fields.put(URLDecoder.decode(kv[0], StandardCharsets.UTF_8), kv.length > 1 ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "");
        }
        if (!fields.containsKey("Status")) throw new IllegalArgumentException("not a NewebPay payload");
        Map<String, Object> shaped = new LinkedHashMap<>();
        shaped.put("Status", fields.remove("Status"));
        shaped.put("Message", fields.remove("Message"));
        shaped.put("Result", fields);
        return json.valueToTree(shaped);
    }

    /** Verifies an MPG callback's TradeSha, then decrypts it. */
    public JsonNode decryptTrade(String tradeInfo, String tradeSha) {
        if (tradeSha == null || !MessageDigest.isEqual(tradeSha(tradeInfo).getBytes(StandardCharsets.US_ASCII), tradeSha.toUpperCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII))) {
            throw ApiException.badRequest("金流通知驗證失敗");
        }
        return decryptJson(tradeInfo);
    }

    public boolean isOurs(JsonNode result) {
        return merchantId.equals(result.path("MerchantID").asString(""));
    }

    // ------------------------------------------------------------------ crypto

    String encrypt(String plain) {
        try {
            Cipher c = Cipher.getInstance("AES/CBC/PKCS5Padding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(hashKey.getBytes(StandardCharsets.UTF_8), "AES"), new IvParameterSpec(hashIv.getBytes(StandardCharsets.UTF_8)));
            return HexFormat.of().formatHex(c.doFinal(plain.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("NewebPay encryption failed", e);
        }
    }

    String decrypt(String hex) throws Exception {
        Cipher c = Cipher.getInstance("AES/CBC/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(hashKey.getBytes(StandardCharsets.UTF_8), "AES"), new IvParameterSpec(hashIv.getBytes(StandardCharsets.UTF_8)));
        byte[] out = c.doFinal(HexFormat.of().parseHex(hex.trim()));
        // PKCS#7 padding; some responses are padded with NULs instead, so strip either.
        int len = out.length;
        int pad = len > 0 ? out[len - 1] : 0;
        if (pad > 0 && pad <= 16) len -= pad;
        while (len > 0 && out[len - 1] == 0) len--;
        return new String(out, 0, len, StandardCharsets.UTF_8);
    }

    String tradeSha(String tradeInfo) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(("HashKey=" + hashKey + "&" + tradeInfo + "&HashIV=" + hashIv).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().withUpperCase().formatHex(d);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String query(Map<String, String> params) {
        return params.entrySet().stream()
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }

    private void requireConfigured() {
        if (!configured()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "billing_unavailable", "線上付款尚未開放，請稍後再試");
    }

    private static ApiException gatewayError(String message) {
        return new ApiException(HttpStatus.BAD_GATEWAY, "gateway_error", message);
    }
}
