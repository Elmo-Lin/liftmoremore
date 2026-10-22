package com.example.backend.store;

import com.example.backend.domain.Exercise;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Seeds the built-in exercise catalog (kept in sync with frontend/src/data/exercises.ts). */
@Component
public class ExerciseCatalog implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ExerciseCatalog.class);

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
            new Exercise("ex_pushdown", "繩索三頭下壓", "Triceps Pushdown", "arms", "cable", 2.5));

    private final Db db;

    public ExerciseCatalog(Db db) {
        this.db = db;
    }

    /** All exercises (catalog is small; read fully). */
    public List<Exercise> all() {
        return db.list(db.fs.collection(Db.EXERCISES), Exercise.class);
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!Db.await(db.fs.collection(Db.EXERCISES).limit(1).get()).isEmpty()) return;
        var batch = db.fs.batch();
        for (Exercise e : BUILT_IN) batch.set(db.doc(Db.EXERCISES, e.id), db.encode(e));
        Db.await(batch.commit());
        log.info("Seeded {} built-in exercises", BUILT_IN.size());
    }
}
