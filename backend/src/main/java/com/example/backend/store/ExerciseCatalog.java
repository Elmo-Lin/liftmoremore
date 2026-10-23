package com.example.backend.store;

import com.example.backend.domain.Exercise;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

/**
 * Exercises: the built-in catalog (kept in sync with frontend/src/data/exercises.ts; this code is the
 * source of truth, nothing is seeded) plus each workspace's own custom exercises in
 * {@code coaches/{id}/exercises}. Custom ones are never deleted, only archived, so old workouts and
 * progress charts keep their names.
 */
@Component
public class ExerciseCatalog {

    public static final List<Exercise> BUILT_IN = List.of(
            new Exercise("ex_squat", "槓鈴背蹲舉", "Barbell Squat", "legs", "barbell", 2.5),
            new Exercise("ex_deadlift", "傳統硬舉", "Deadlift", "back", "barbell", 2.5),
            new Exercise("ex_bench", "槓鈴臥推", "Bench Press", "chest", "barbell", 2.5),
            new Exercise("ex_ohp", "站姿肩推", "Overhead Press", "shoulders", "barbell", 2.5),
            new Exercise("ex_latpd", "滑輪下拉", "Lat Pulldown", "back", "cable", 2.5),
            new Exercise("ex_seatedrow", "坐姿划船", "Seated Row", "back", "machine", 2.5),
            new Exercise("ex_dbpress", "啞鈴臥推", "Dumbbell Press", "chest", "dumbbell", 2),
            new Exercise("ex_legpress", "腿推舉", "Leg Press", "legs", "machine", 5),
            new Exercise("ex_rdl", "羅馬尼亞硬舉", "Romanian Deadlift", "glutes", "barbell", 2.5),
            new Exercise("ex_cablerow", "繩索划船", "Cable Row", "back", "cable", 2.5),
            new Exercise("ex_hipthrust", "槓鈴臀推", "Hip Thrust", "glutes", "barbell", 5),
            new Exercise("ex_goblet", "高腳杯深蹲", "Goblet Squat", "legs", "dumbbell", 2),
            new Exercise("ex_bss", "保加利亞分腿蹲", "Bulgarian Split Squat", "legs", "dumbbell", 2),
            new Exercise("ex_dbrow", "啞鈴單臂划船", "One-arm Dumbbell Row", "back", "dumbbell", 2),
            new Exercise("ex_incline", "上斜啞鈴臥推", "Incline Dumbbell Press", "chest", "dumbbell", 2),
            new Exercise("ex_lateral", "啞鈴側平舉", "Lateral Raise", "shoulders", "dumbbell", 1),
            new Exercise("ex_facepull", "繩索面拉", "Face Pull", "shoulders", "cable", 2.5),
            new Exercise("ex_legcurl", "腿後勾", "Leg Curl", "legs", "machine", 2.5),
            new Exercise("ex_curl", "啞鈴二頭彎舉", "Dumbbell Curl", "arms", "dumbbell", 1),
            new Exercise("ex_pushdown", "繩索三頭下壓", "Triceps Pushdown", "arms", "cable", 2.5),
            new Exercise("ex_frontsquat", "槓鈴前蹲舉", "Front Squat", "legs", "barbell", 2.5),
            new Exercise("ex_hacksquat", "哈克深蹲", "Hack Squat", "legs", "machine", 5),
            new Exercise("ex_smithsquat", "史密斯深蹲", "Smith Machine Squat", "legs", "machine", 2.5),
            new Exercise("ex_bwsquat", "徒手深蹲", "Bodyweight Squat", "legs", "bodyweight", 1),
            new Exercise("ex_lunge", "啞鈴弓箭步", "Dumbbell Lunge", "legs", "dumbbell", 2),
            new Exercise("ex_walklunge", "行走弓箭步", "Walking Lunge", "legs", "dumbbell", 2),
            new Exercise("ex_stepup", "登階", "Step-up", "legs", "dumbbell", 2),
            new Exercise("ex_legext", "腿伸屈", "Leg Extension", "legs", "machine", 2.5),
            new Exercise("ex_seatedlegcurl", "坐姿腿後勾", "Seated Leg Curl", "legs", "machine", 2.5),
            new Exercise("ex_nordic", "北歐腿彎舉", "Nordic Hamstring Curl", "legs", "bodyweight", 1),
            new Exercise("ex_calfraise", "站姿提踵", "Standing Calf Raise", "legs", "machine", 2.5),
            new Exercise("ex_seatedcalf", "坐姿提踵", "Seated Calf Raise", "legs", "machine", 2.5),
            new Exercise("ex_kbgoblet", "壺鈴高腳杯深蹲", "Kettlebell Goblet Squat", "legs", "kettlebell", 4),
            new Exercise("ex_powerclean", "力量上膊", "Power Clean", "legs", "barbell", 2.5),
            new Exercise("ex_bbrow", "槓鈴划船", "Barbell Row", "back", "barbell", 2.5),
            new Exercise("ex_pendlay", "潘德雷划船", "Pendlay Row", "back", "barbell", 2.5),
            new Exercise("ex_tbarrow", "T 槓划船", "T-Bar Row", "back", "barbell", 2.5),
            new Exercise("ex_machinerow", "器械划船", "Machine Row", "back", "machine", 2.5),
            new Exercise("ex_pullup", "引體向上", "Pull-up", "back", "bodyweight", 2.5),
            new Exercise("ex_chinup", "反手引體向上", "Chin-up", "back", "bodyweight", 2.5),
            new Exercise("ex_assistpullup", "輔助引體向上", "Assisted Pull-up", "back", "machine", 2.5),
            new Exercise("ex_invrow", "反式划船", "Inverted Row", "back", "bodyweight", 1),
            new Exercise("ex_straightarm", "直臂下拉", "Straight-arm Pulldown", "back", "cable", 2.5),
            new Exercise("ex_singlelatpd", "單臂滑輪下拉", "Single-arm Lat Pulldown", "back", "cable", 2.5),
            new Exercise("ex_rackpull", "架上拉", "Rack Pull", "back", "barbell", 2.5),
            new Exercise("ex_backext", "背伸展", "Back Extension", "back", "bodyweight", 2.5),
            new Exercise("ex_shrug", "槓鈴聳肩", "Barbell Shrug", "back", "barbell", 2.5),
            new Exercise("ex_dbshrug", "啞鈴聳肩", "Dumbbell Shrug", "back", "dumbbell", 2),
            new Exercise("ex_inclinebench", "上斜槓鈴臥推", "Incline Bench Press", "chest", "barbell", 2.5),
            new Exercise("ex_declinebench", "下斜槓鈴臥推", "Decline Bench Press", "chest", "barbell", 2.5),
            new Exercise("ex_smithbench", "史密斯臥推", "Smith Machine Bench Press", "chest", "machine", 2.5),
            new Exercise("ex_chestpress", "器械胸推", "Machine Chest Press", "chest", "machine", 2.5),
            new Exercise("ex_dbfly", "啞鈴飛鳥", "Dumbbell Fly", "chest", "dumbbell", 1),
            new Exercise("ex_cablefly", "繩索夾胸", "Cable Fly", "chest", "cable", 2.5),
            new Exercise("ex_lowcablefly", "低位繩索夾胸", "Low-to-high Cable Fly", "chest", "cable", 2.5),
            new Exercise("ex_pecdeck", "蝴蝶機夾胸", "Pec Deck", "chest", "machine", 2.5),
            new Exercise("ex_pushup", "伏地挺身", "Push-up", "chest", "bodyweight", 1),
            new Exercise("ex_dips", "雙槓撐體", "Dips", "chest", "bodyweight", 2.5),
            new Exercise("ex_dbshoulder", "坐姿啞鈴肩推", "Seated Dumbbell Shoulder Press", "shoulders", "dumbbell", 2),
            new Exercise("ex_arnold", "阿諾肩推", "Arnold Press", "shoulders", "dumbbell", 2),
            new Exercise("ex_machineshoulder", "器械肩推", "Machine Shoulder Press", "shoulders", "machine", 2.5),
            new Exercise("ex_pushpress", "借力推", "Push Press", "shoulders", "barbell", 2.5),
            new Exercise("ex_landmine", "地雷管推舉", "Landmine Press", "shoulders", "barbell", 2.5),
            new Exercise("ex_cablelateral", "繩索側平舉", "Cable Lateral Raise", "shoulders", "cable", 2.5),
            new Exercise("ex_frontraise", "啞鈴前平舉", "Front Raise", "shoulders", "dumbbell", 1),
            new Exercise("ex_reardelt", "啞鈴反向飛鳥", "Rear Delt Fly", "shoulders", "dumbbell", 1),
            new Exercise("ex_reversepec", "反向蝴蝶機", "Reverse Pec Deck", "shoulders", "machine", 2.5),
            new Exercise("ex_uprightrow", "直立划船", "Upright Row", "shoulders", "barbell", 2.5),
            new Exercise("ex_bbcurl", "槓鈴二頭彎舉", "Barbell Curl", "arms", "barbell", 2.5),
            new Exercise("ex_hammer", "錘式彎舉", "Hammer Curl", "arms", "dumbbell", 1),
            new Exercise("ex_preacher", "牧師椅彎舉", "Preacher Curl", "arms", "barbell", 2.5),
            new Exercise("ex_inclinecurl", "上斜啞鈴彎舉", "Incline Dumbbell Curl", "arms", "dumbbell", 1),
            new Exercise("ex_cablecurl", "繩索二頭彎舉", "Cable Curl", "arms", "cable", 2.5),
            new Exercise("ex_closegrip", "窄握臥推", "Close-grip Bench Press", "arms", "barbell", 2.5),
            new Exercise("ex_skullcrusher", "仰臥臂屈伸", "Skull Crusher", "arms", "barbell", 2.5),
            new Exercise("ex_ohtriext", "繩索過頭三頭伸展", "Overhead Cable Triceps Extension", "arms", "cable", 2.5),
            new Exercise("ex_kickback", "啞鈴三頭後踢", "Triceps Kickback", "arms", "dumbbell", 1),
            new Exercise("ex_benchdip", "板凳撐體", "Bench Dip", "arms", "bodyweight", 1),
            new Exercise("ex_wristcurl", "腕彎舉", "Wrist Curl", "arms", "dumbbell", 1),
            new Exercise("ex_sumodl", "相撲硬舉", "Sumo Deadlift", "glutes", "barbell", 2.5),
            new Exercise("ex_dbrdl", "啞鈴羅馬尼亞硬舉", "Dumbbell Romanian Deadlift", "glutes", "dumbbell", 2),
            new Exercise("ex_slrdl", "單腳羅馬尼亞硬舉", "Single-leg Romanian Deadlift", "glutes", "dumbbell", 2),
            new Exercise("ex_goodmorning", "早安體前屈", "Good Morning", "glutes", "barbell", 2.5),
            new Exercise("ex_glutebridge", "臀橋", "Glute Bridge", "glutes", "bodyweight", 2.5),
            new Exercise("ex_kbswing", "壺鈴擺盪", "Kettlebell Swing", "glutes", "kettlebell", 4),
            new Exercise("ex_cablekickback", "繩索後踢", "Cable Glute Kickback", "glutes", "cable", 2.5),
            new Exercise("ex_hipabd", "髖外展機", "Hip Abduction", "glutes", "machine", 2.5),
            new Exercise("ex_bandwalk", "彈力帶側走", "Banded Lateral Walk", "glutes", "other", 1),
            new Exercise("ex_plank", "棒式", "Plank", "core", "bodyweight", 1),
            new Exercise("ex_sideplank", "側棒式", "Side Plank", "core", "bodyweight", 1),
            new Exercise("ex_crunch", "捲腹", "Crunch", "core", "bodyweight", 1),
            new Exercise("ex_situp", "仰臥起坐", "Sit-up", "core", "bodyweight", 1),
            new Exercise("ex_hlr", "懸垂舉腿", "Hanging Leg Raise", "core", "bodyweight", 1),
            new Exercise("ex_lyinglegraise", "仰臥抬腿", "Lying Leg Raise", "core", "bodyweight", 1),
            new Exercise("ex_cablecrunch", "繩索跪姿捲腹", "Cable Crunch", "core", "cable", 2.5),
            new Exercise("ex_abwheel", "健腹輪", "Ab Wheel Rollout", "core", "other", 1),
            new Exercise("ex_russiantwist", "俄羅斯轉體", "Russian Twist", "core", "bodyweight", 1),
            new Exercise("ex_deadbug", "死蟲式", "Dead Bug", "core", "bodyweight", 1),
            new Exercise("ex_pallof", "抗旋轉推", "Pallof Press", "core", "cable", 2.5),
            new Exercise("ex_woodchop", "繩索伐木", "Cable Woodchop", "core", "cable", 2.5),
            new Exercise("ex_mountain", "登山者", "Mountain Climber", "core", "bodyweight", 1),
            new Exercise("ex_farmer", "農夫走路", "Farmer's Carry", "core", "dumbbell", 2));

    private final Db db;

    public ExerciseCatalog(Db db) {
        this.db = db;
    }

    /** Built-ins plus the workspace's custom exercises (archived ones included, for history). */
    public List<Exercise> forWorkspace(String spaceId) {
        List<Exercise> all = new ArrayList<>(BUILT_IN);
        all.addAll(custom(spaceId));
        return all;
    }

    public List<Exercise> custom(String spaceId) {
        return db.list(db.coachCol(spaceId, Db.EXERCISES), Exercise.class);
    }

    /** IDs a workout or plan in this workspace may use. */
    public Set<String> knownIds(String spaceId) {
        return Stream.concat(BUILT_IN.stream(), custom(spaceId).stream()).map(e -> e.id).collect(Collectors.toSet());
    }
}
