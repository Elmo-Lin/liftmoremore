package com.example.backend.store;

import com.google.cloud.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Object ⇄ Firestore document. Fields named {@code *At} or {@code purchaseDate} are stored as
 * native Firestore Timestamps (queryable, readable in the console); nulls are omitted.
 */
@Component
public class DocCodec {

    private final JsonMapper mapper = JsonMapper.builder()
            .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    @SuppressWarnings("unchecked")
    public Map<String, Object> encode(Object value) {
        return (Map<String, Object>) toFirestore(mapper.convertValue(value, Map.class), null);
    }

    public <T> T decode(Map<String, Object> data, Class<T> type) {
        return mapper.convertValue(fromFirestore(data), type);
    }

    private static boolean isTimestampField(String key) {
        return key != null && (key.endsWith("At") || key.equals("purchaseDate"));
    }

    private static Object toFirestore(Object v, String key) {
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> out = new LinkedHashMap<>();
            m.forEach((k, val) -> {
                if (val != null) out.put((String) k, toFirestore(val, (String) k));
            });
            return out;
        }
        if (v instanceof List<?> l) {
            List<Object> out = new ArrayList<>(l.size());
            for (Object item : l) out.add(toFirestore(item, null));
            return out;
        }
        if (v instanceof String s && isTimestampField(key)) {
            Instant i = Instant.parse(s);
            return Timestamp.ofTimeSecondsAndNanos(i.getEpochSecond(), i.getNano());
        }
        return v;
    }

    private static Object fromFirestore(Object v) {
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> out = new LinkedHashMap<>();
            m.forEach((k, val) -> out.put((String) k, fromFirestore(val)));
            return out;
        }
        if (v instanceof List<?> l) {
            List<Object> out = new ArrayList<>(l.size());
            for (Object item : l) out.add(fromFirestore(item));
            return out;
        }
        if (v instanceof Timestamp t) return Instant.ofEpochSecond(t.getSeconds(), t.getNanos()).toString();
        return v;
    }
}
