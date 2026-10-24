package com.example.backend.store;

import com.example.backend.common.ApiException;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FirestoreException;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.Transaction;
import com.google.cloud.firestore.TransactionOptions;
import io.grpc.Status;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import org.springframework.stereotype.Component;

/**
 * Firestore access helpers and the data layout:
 * <pre>
 * users/{userId}            login identity (role, passwordHash, coachId)
 * emails/{emailLower}       {userId} — enforces unique email
 * invites/{code}            one-time student invite
 * exercises/{id}            shared catalog
 * passwordResets/{sha256}   one-time password reset link (only the token's hash is stored)
 * billingOrders/{orderNo}   one NewebPay checkout (found by order number in payment callbacks)
 * coaches/{coachId}         workspace (with its subscription), with subcollections:
 *   students | plans | workouts | packages | transactions | metrics | appointments | ledgers | payments
 * </pre>
 * Everything a coach owns lives under their document, so tenancy is structural.
 */
@Component
public class Db {

    public static final String USERS = "users";
    public static final String EMAILS = "emails";
    public static final String INVITES = "invites";
    public static final String EXERCISES = "exercises";
    public static final String COACHES = "coaches";
    public static final String BILLING_ORDERS = "billingOrders";
    public static final String PASSWORD_RESETS = "passwordResets";
    public static final String LOGIN_GUARDS = "loginGuards";

    public static final String STUDENTS = "students";
    public static final String PLANS = "plans";
    public static final String WORKOUTS = "workouts";
    public static final String PACKAGES = "packages";
    public static final String TRANSACTIONS = "transactions";
    public static final String METRICS = "metrics";
    public static final String APPOINTMENTS = "appointments";
    public static final String LEDGERS = "ledgers";
    public static final String PAYMENTS = "payments";

    public static final List<String> COACH_SUBCOLLECTIONS =
            List.of(STUDENTS, PLANS, WORKOUTS, PACKAGES, TRANSACTIONS, METRICS, APPOINTMENTS, LEDGERS, PAYMENTS);

    public final Firestore fs;
    private final DocCodec codec;

    public Db(Firestore fs, DocCodec codec) {
        this.fs = fs;
        this.codec = codec;
    }

    // ------------------------------------------------------------------ references

    public DocumentReference doc(String collection, String id) {
        return fs.collection(collection).document(id);
    }

    public CollectionReference coachCol(String coachId, String collection) {
        return fs.collection(COACHES).document(coachId).collection(collection);
    }

    public DocumentReference coachDoc(String coachId, String collection, String id) {
        return coachCol(coachId, collection).document(id);
    }

    // ------------------------------------------------------------------ plain reads/writes

    public <T> Optional<T> get(DocumentReference ref, Class<T> type) {
        return decode(await(ref.get()), type);
    }

    public <T> List<T> list(Query query, Class<T> type) {
        return await(query.get()).getDocuments().stream().map(d -> decode(d, type)).toList();
    }

    public void set(DocumentReference ref, Object value) {
        await(ref.set(codec.encode(value)));
    }

    public void create(DocumentReference ref, Object value) {
        await(ref.create(codec.encode(value)));
    }

    public void delete(DocumentReference ref) {
        await(ref.delete());
    }

    /** Partial update of one field; {@code null} removes the field. */
    public void update(DocumentReference ref, String field, Object value) {
        await(ref.update(field, value == null ? com.google.cloud.firestore.FieldValue.delete() : value));
    }

    public java.util.Map<String, Object> encode(Object value) {
        return codec.encode(value);
    }

    public <T> T decodeDoc(java.util.Map<String, Object> data, Class<T> type) {
        return codec.decode(data, type);
    }

    // ------------------------------------------------------------------ transactions

    @FunctionalInterface
    public interface TxBody<T> {
        T run(Tx tx) throws Exception;
    }

    /** Serializable read-write transaction; all reads must happen before writes. */
    public <T> T transaction(TxBody<T> body) {
        return await(fs.runTransaction(t -> body.run(new Tx(t)), TransactionOptions.createReadWriteOptionsBuilder().setNumberOfAttempts(10).build()));
    }

    public final class Tx {
        public final Transaction t;

        Tx(Transaction t) {
            this.t = t;
        }

        public <T> Optional<T> get(DocumentReference ref, Class<T> type) throws Exception {
            return decode(t.get(ref).get(), type);
        }

        public <T> List<T> list(Query query, Class<T> type) throws Exception {
            return t.get(query).get().getDocuments().stream().map(d -> decode(d, type)).toList();
        }

        public void set(DocumentReference ref, Object value) {
            t.set(ref, codec.encode(value));
        }

        public void create(DocumentReference ref, Object value) {
            t.create(ref, codec.encode(value));
        }

        public void delete(DocumentReference ref) {
            t.delete(ref);
        }

        public void update(DocumentReference ref, String field, Object value) {
            t.update(ref, field, value == null ? com.google.cloud.firestore.FieldValue.delete() : value);
        }
    }

    // ------------------------------------------------------------------ helpers

    private <T> Optional<T> decode(DocumentSnapshot snap, Class<T> type) {
        return snap.exists() && snap.getData() != null ? Optional.of(codec.decode(snap.getData(), type)) : Optional.empty();
    }

    private <T> T decode(QueryDocumentSnapshot snap, Class<T> type) {
        return codec.decode(snap.getData(), type);
    }

    /** Flush and close a BulkWriter, surfacing any write failure. */
    public static void finish(com.google.cloud.firestore.BulkWriter writer) {
        await(writer.flush());
        try {
            writer.close();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        } catch (ExecutionException e) {
            throw new IllegalStateException("Bulk write failed", e.getCause());
        }
    }

    /** Block on a Firestore future, translating Firestore errors into API errors. */
    public static <T> T await(ApiFuture<T> future) {
        try {
            return future.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            while (cause instanceof ExecutionException && cause.getCause() != null) cause = cause.getCause();
            if (cause instanceof ApiException api) throw api;
            Status.Code code = statusOf(cause);
            if (code == Status.Code.ALREADY_EXISTS) throw ApiException.conflict("id_taken", "此 ID 已被使用");
            if (code == Status.Code.ABORTED) throw ApiException.conflict("busy", "資料正在更新中，請再試一次");
            throw new IllegalStateException("Firestore request failed", cause);
        }
    }

    private static Status.Code statusOf(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c instanceof FirestoreException fe && fe.getStatus() != null) return fe.getStatus().getCode();
            if (c instanceof com.google.api.gax.rpc.ApiException ge) {
                return Status.Code.valueOf(ge.getStatusCode().getCode().name());
            }
        }
        return Status.Code.UNKNOWN;
    }
}
