package com.example.backend.billing;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** Our AES code against the sample in NewebPay's spec (信用卡定期定額技術串接手冊 NDNP-1.0.6, 4.2). */
class NewebPayTest {

    final NewebPay specSample = new NewebPay("TEK1682407426", "IaWudQJsuOT994cpHRWzv7Ge67yC1cE3", "C1dLm3nxZRVlmBSP", "http://127.0.0.1:9");

    static final String SPEC_PERIOD =
            "e88f62186b6d5dd96a9f6dbc57a84547957e8cb8534d81cbed42dcffa93783a30fad037c450ed467d60f44e51b3525829e204ae0d3792a9f2c7e8af7df196ddc678579b76f76f64f0322f7e41587076372b69023b1681d022d219f78deced25f941e5902905f4f5009d84aa35f1c4dc0cee9bbd4ba9a67228775927a14ff86f46259388845ba59a1c59c3007bf5534bae63616e1e705a63dc9615d3be00d4bf04f04af1ebc229f34e34c80b31d14d39f519099650bfaa7f9228ad15c7f79797d3ada0ba648bb33a8fd82937061e83b2916b92510617d52cff39adb1b0d1204d9e07b3f79d709344852579671c68d8844348b80f4a35450d860b232f3aeb7728c24135e438f0893089e445bdc62429126a5b37c7e09b1226e05d53127498fbcf407f241c8d752298a29642df3671f8277b9849370d2234a69fbfd415ab3449953233a4eaa2e1aa5827f30c482cf8efcdecff5587f75045f60336eb2133b658834736642f99305f0d245c0714696a238b1d9364659f7240c25a1e66d04af35f7f077498dad65b82256342549ba34e2ff75880ef9fb1e025999ee619eef10388642a09eacebe3c19be1d8077ee1a73d53a7168e835a13361248a54d83d944b33ace6f8159aa38b9ab0b408bbab3bedb9affcf43a3ae4415c5a657a66ab026f7c53ada3b2920e741fa19c62bf19d21932239a3116ae3ccf0aabf06bb99ddcefb3976dbb75c45599a17f24fdedbb30e232c969fa2a1d5d1e21258ed21705ae969d97c756e742be64c7f4c6ed520b35fa5fa1689c40b3f8929f7ee082076cbcf585536e1f2e2ff1042934eaf57577efd7c403c562b1ea106aaea3e36f69e3eeba8e0ea";

    @Test
    void decryptsTheSpecSample() {
        JsonNode r = specSample.decryptJson(SPEC_PERIOD);
        assertThat(r.path("Status").asString()).isEqualTo("SUCCESS");
        assertThat(specSample.isOurs(r.path("Result"))).isTrue();
        assertThat(r.path("Result").path("PeriodNo").asString()).isEqualTo("P231115153213aMDNWZ");
        assertThat(r.path("Result").path("PeriodAmt").asInt()).as("numbers arrive as strings").isEqualTo(10);
    }

    @Test
    void readsTheStringFormAndToleratesStrayBytes() throws Exception {
        JsonNode form = specSample.parse("Status=SUCCESS&Message=%E6%8E%88%E6%AC%8A%E6%88%90%E5%8A%9F&MerchantID=TEK1682407426&Amt=99&MerchantOrderNo=LM1");
        assertThat(form.path("Status").asString()).isEqualTo("SUCCESS");
        assertThat(form.path("Message").asString()).isEqualTo("授權成功");
        assertThat(form.path("Result").path("Amt").asInt()).isEqualTo(99);
        assertThat(specSample.isOurs(form.path("Result"))).isTrue();

        JsonNode trailing = specSample.parse("{\"Status\":\"SUCCESS\",\"Result\":{\"Amt\":99}}\u0003\u0003 ");
        assertThat(trailing.path("Result").path("Amt").asInt()).isEqualTo(99);
    }

    @Test
    void encryptionRoundTrips() throws Exception {
        String plain = "RespondType=JSON&ProdDesc=" + java.net.URLEncoder.encode("自由教練 Pro 月費", "UTF-8");
        assertThat(specSample.decrypt(specSample.encrypt(plain))).isEqualTo(plain);
    }
}
