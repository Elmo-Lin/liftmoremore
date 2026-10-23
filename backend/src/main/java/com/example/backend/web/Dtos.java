package com.example.backend.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/**
 * Wire format. Field names and shapes intentionally match frontend/src/types/index.ts so the
 * frontend can consume responses directly. Null fields are omitted (TS optional properties).
 */
public final class Dtos {

    private Dtos() {}

    // ------------------------------------------------------------------ read models

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CoachDto(String id, String role, String name, String email, String phone, String title, String studio, Instant createdAt) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record StudentDto(
            String id,
            String role,
            String name,
            String email,
            String phone,
            String gender,
            Integer birthYear,
            Integer heightCm,
            String goal,
            String goalDetail,
            String status,
            int weeklyFrequency,
            String coachNotes,
            String activePlanId,
            Instant joinedAt,
            Instant createdAt,
            /** Whether the student has set a password (coach view only). */
            Boolean activated) {}

    public record RelationshipDto(String id, String coachId, String studentId, String status, Instant startedAt) {}

    public record ExerciseDto(String id, String name, String nameEn, String muscleGroup, String equipment, double increment) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PrescriptionDto(
            String id,
            @NotBlank(message = "缺少動作") String exerciseId,
            @Min(value = 1, message = "組數需為 1–20") @Max(value = 20, message = "組數需為 1–20") int sets,
            @NotNull(message = "請輸入次數") @Pattern(regexp = "^[0-9]{0,3}(-[0-9]{1,3})?$", message = "次數格式不正確") String reps,
            Double targetWeightKg,
            Integer restSec,
            @Size(max = 200) String notes) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TrainingDayDto(
            String id,
            @NotBlank(message = "每個訓練日都需要名稱") @Size(max = 40) String name,
            @Size(max = 60) String focus,
            @NotNull @Valid List<PrescriptionDto> exercises) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PlanDto(
            String id,
            String coachId,
            String authorRole,
            @NotBlank(message = "請輸入計畫名稱") @Size(max = 60) String name,
            @Size(max = 500) String description,
            @NotBlank String goal,
            Integer weeks,
            @NotNull @Size(min = 1, message = "計畫至少需要一個訓練日") @Valid List<TrainingDayDto> days,
            Instant createdAt,
            Instant updatedAt) {}

    public record SetLogDto(
            String id,
            @Min(0) @Max(500) Double weightKg,
            @Min(0) @Max(100) Integer reps,
            @Min(0) @Max(10) Double rpe,
            boolean completed) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ExerciseLogDto(String id, @NotBlank String exerciseId, @NotNull @Valid List<SetLogDto> sets, @Size(max = 200) String notes) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record WorkoutDto(
            String id,
            @NotBlank(message = "請選擇學員") String studentId,
            String coachId,
            @NotBlank String type,
            String createdBy,
            @NotBlank String status,
            @Size(max = 60) String title,
            String planId,
            String trainingDayId,
            @NotNull Instant startedAt,
            Instant completedAt,
            Instant updatedAt,
            @NotNull @Valid List<ExerciseLogDto> exercises,
            @Size(max = 1000) String notes) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PackageDto(
            String id,
            String studentId,
            String coachId,
            String name,
            int totalSessions,
            int priceTwd,
            Instant purchaseDate,
            Instant expiresAt,
            String notes) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TransactionDto(
            String id,
            String packageId,
            String studentId,
            String type,
            int delta,
            String reason,
            String workoutSessionId,
            Instant createdAt,
            String createdBy) {}

    public record MetricDto(String id, String studentId, String type, double value, String unit, Instant recordedAt) {}

    public record AppointmentDto(
            String id,
            String coachId,
            @NotBlank String studentId,
            @NotNull Instant startAt,
            @Min(15) @Max(240) int durationMin,
            @NotBlank @Size(max = 80) String location,
            String status) {}

    /** Everything the signed-in user may see, in the frontend's AppData shape. */
    public record AppDataDto(
            int schemaVersion,
            Instant seededAt,
            CoachDto coach,
            List<StudentDto> students,
            List<RelationshipDto> relationships,
            List<ExerciseDto> exercises,
            List<PlanDto> plans,
            List<WorkoutDto> workouts,
            List<PackageDto> packages,
            List<TransactionDto> transactions,
            List<MetricDto> metrics,
            List<AppointmentDto> appointments,
            /** Coaches only: the workspace and its coaches. */
            StudioDto studio) {}

    /** A coach in a workspace. status: active, invited (has not set a password yet) or inactive. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CoachMemberDto(String id, String role, String name, String email, String title, String status, String inviteCode, Instant createdAt) {}

    /** kind: solo (a free coach), studio, or self. maxCoaches counts the owner. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record StudioDto(String id, String kind, String name, String ownerId, Integer maxCoaches, List<CoachMemberDto> coaches) {}

    public record RegisterStudioInput(
            @NotBlank(message = "請輸入姓名") @Size(max = 30) String name,
            @NotBlank(message = "請輸入 Email") @Email(message = "Email 格式不正確") String email,
            @NotBlank @Size(min = 8, max = 72, message = "密碼需為 8–72 字元") String password,
            @NotBlank(message = "請輸入工作室名稱") @Size(max = 120) String studio) {}

    public record UpgradeStudioInput(@NotBlank(message = "請輸入工作室名稱") @Size(max = 120) String studio) {}

    public record InviteCoachInput(
            @NotBlank(message = "請輸入姓名") @Size(max = 30) String name,
            @NotBlank(message = "請輸入 Email") @Email(message = "Email 格式不正確") String email,
            @Size(max = 60) String title) {}

    public record CoachInviteDto(CoachMemberDto coach, String inviteCode, Instant expiresAt) {}

    /** Where the coach's students go; required when they have any. */
    public record DeactivateCoachInput(String transferTo) {}

    public record TransferStudentInput(@NotBlank(message = "請選擇教練") String coachId) {}

    public record PackageBalanceDto(String packageId, int total, int used, int adjusted, int remaining) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record BalanceDto(String studentId, int remaining, int totalPurchased, int used, List<PackageBalanceDto> packages, String nextPackageId) {}

    /** Result of a ledger write: the new entry plus the recomputed balance. */
    public record LedgerResult(TransactionDto transaction, BalanceDto balance) {}

    // ------------------------------------------------------------------ commands

    public record StudentInput(
            String id,
            /** Studio owner only: the coach responsible for a new student (defaults to the caller). */
            String coachId,
            @NotBlank(message = "請輸入姓名") @Size(max = 30, message = "姓名最多 30 字") String name,
            @NotBlank(message = "請輸入 Email") @Email(message = "Email 格式不正確") @Size(max = 120) String email,
            @Pattern(regexp = "^$|^[0-9+\\-\\s()]{8,15}$", message = "電話格式不正確") String phone,
            @NotBlank String gender,
            @Min(value = 1930, message = "出生年份不合理") Integer birthYear,
            @Min(value = 100, message = "請輸入 100–230 之間") @Max(value = 230, message = "請輸入 100–230 之間") Integer heightCm,
            @NotBlank String goal,
            @Size(max = 200) String goalDetail,
            @Min(value = 1, message = "每週 1–7 次") @Max(value = 7, message = "每週 1–7 次") int weeklyFrequency,
            @Size(max = 2000) String coachNotes,
            @NotBlank String status,
            String activePlanId) {}

    public record PackageInput(
            String id,
            @NotBlank(message = "請輸入方案名稱") @Size(max = 40) String name,
            @Min(value = 1, message = "堂數需為 1–200 的整數") @Max(value = 200, message = "堂數需為 1–200 的整數") int totalSessions,
            @Min(value = 0, message = "金額不可為負數") int priceTwd,
            @NotNull(message = "請選擇購買日期") Instant purchaseDate,
            Instant expiresAt,
            @Size(max = 200) String notes) {}

    public record AdjustmentInput(
            String id,
            @Min(value = -50, message = "單次調整不可超過 50 堂") @Max(value = 50, message = "單次調整不可超過 50 堂") int delta,
            @NotBlank(message = "請輸入調整原因") @Size(max = 120) String reason) {}

    public record DeductionInput(String transactionId) {}

    public record ReversalInput(String transactionId, @NotBlank(message = "請輸入撤銷原因") @Size(max = 120) String reason) {}

    public record AssignInput(@NotNull List<String> studentIds) {}

    public record DuplicateInput(String id) {}

    public record MetricInput(String id, @NotBlank String type, @Min(20) @Max(400) double value, Instant recordedAt) {}

    // ------------------------------------------------------------------ auth

    public record RegisterCoachInput(
            @NotBlank(message = "請輸入姓名") @Size(max = 30) String name,
            @NotBlank(message = "請輸入 Email") @Email(message = "Email 格式不正確") String email,
            @NotBlank @Size(min = 8, max = 72, message = "密碼需為 8–72 字元") String password,
            @Size(max = 120) String studio,
            @Size(max = 60) String title) {}

    public record LoginInput(@NotBlank(message = "請輸入 Email") String email, @NotBlank(message = "請輸入密碼") String password) {}

    public record RegisterSelfInput(
            @NotBlank(message = "請輸入姓名") @Size(max = 30) String name,
            @NotBlank(message = "請輸入 Email") @Email(message = "Email 格式不正確") String email,
            @NotBlank @Size(min = 8, max = 72, message = "密碼需為 8–72 字元") String password) {}

    public record ActivateInput(
            @NotBlank(message = "請輸入邀請碼") String inviteCode,
            @NotBlank @Size(min = 8, max = 72, message = "密碼需為 8–72 字元") String password) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MeDto(String userId, String role, String name, String email, String coachId, String studentId) {}

    public record AuthResponse(String token, Instant expiresAt, MeDto user) {}

    public record InviteDto(String inviteCode, Instant expiresAt) {}

    public record DemoLoginInput(@NotBlank String role, String studentId) {}
}
