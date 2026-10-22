package com.example.backend.common;

import java.security.SecureRandom;
import java.util.regex.Pattern;

/**
 * String IDs in the form {@code prefix_xxxx}. Clients may supply their own IDs (so records
 * created offline keep stable IDs); anything not matching the pattern is rejected.
 */
public final class Ids {

    private static final Pattern VALID = Pattern.compile("^[a-z]{2,8}_[A-Za-z0-9_-]{1,40}$");
    private static final char[] ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private Ids() {}

    public static String newId(String prefix) {
        StringBuilder sb = new StringBuilder(prefix).append('_');
        for (int i = 0; i < 12; i++) sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        return sb.toString();
    }

    /** Use the client-provided ID when present and well-formed, otherwise generate one. */
    public static String orNew(String clientId, String prefix) {
        if (clientId == null || clientId.isBlank()) return newId(prefix);
        if (!VALID.matcher(clientId).matches() || clientId.length() > 40) {
            throw ApiException.badRequest("ID 格式不正確：" + clientId);
        }
        return clientId;
    }

    public static String inviteCode() {
        char[] alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray(); // no 0/O/1/I
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) sb.append(alphabet[RANDOM.nextInt(alphabet.length)]);
        return sb.toString();
    }
}
