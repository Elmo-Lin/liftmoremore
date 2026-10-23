package com.example.backend.service;

import com.example.backend.auth.CurrentUser;
import com.example.backend.common.ApiException;
import com.example.backend.common.Domain;
import com.example.backend.common.Ids;
import com.example.backend.domain.Exercise;
import com.example.backend.store.Db;
import com.example.backend.store.ExerciseCatalog;
import com.example.backend.web.Dtos.ExerciseDto;
import com.example.backend.web.Dtos.ExerciseInput;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Custom exercises: coaches add them for their whole workspace (studio coaches and students see
 * them too); a self-tracker's are only theirs. Students cannot add any.
 */
@Service
public class ExerciseService {

    /** Smallest practical weight jump for a new custom exercise, by equipment. */
    private static final Map<String, Double> INCREMENT = Map.of(
            "barbell", 2.5, "dumbbell", 2.0, "machine", 2.5, "cable", 2.5, "kettlebell", 4.0, "bodyweight", 1.0, "other", 1.0);

    private final Db db;
    private final ExerciseCatalog catalog;

    public ExerciseService(Db db, ExerciseCatalog catalog) {
        this.db = db;
        this.catalog = catalog;
    }

    public List<ExerciseDto> list(CurrentUser user) {
        return catalog.forWorkspace(user.coachId()).stream().map(Mapper::exercise).toList();
    }

    public ExerciseDto create(CurrentUser user, ExerciseInput in) {
        requireAuthor(user);
        Exercise e = new Exercise();
        e.id = Ids.orNew(in.id(), "cex");
        if (catalog.knownIds(user.coachId()).contains(e.id)) throw ApiException.conflict("id_taken", "此 ID 已被使用");
        apply(user, e, in);
        e.createdBy = user.userId();
        e.createdAt = Instant.now();
        db.create(db.coachDoc(user.coachId(), Db.EXERCISES, e.id), e);
        return Mapper.exercise(e);
    }

    public ExerciseDto update(CurrentUser user, String id, ExerciseInput in) {
        requireAuthor(user);
        Exercise e = custom(user, id);
        apply(user, e, in);
        db.set(db.coachDoc(user.coachId(), Db.EXERCISES, id), e);
        return Mapper.exercise(e);
    }

    /** Hides it from pickers; workouts and plans that used it keep showing its name. */
    public void archive(CurrentUser user, String id) {
        requireAuthor(user);
        custom(user, id);
        db.update(db.coachDoc(user.coachId(), Db.EXERCISES, id), "archived", true);
    }

    private void apply(CurrentUser user, Exercise e, ExerciseInput in) {
        String name = in.name().trim();
        Domain.require(Domain.MUSCLE_GROUPS, in.muscleGroup(), "muscleGroup");
        Domain.require(Domain.EQUIPMENT, in.equipment(), "equipment");
        String key = name.toLowerCase(Locale.ROOT);
        boolean taken = catalog.forWorkspace(user.coachId()).stream()
                .anyMatch(x -> !x.id.equals(e.id) && !Boolean.TRUE.equals(x.archived) && x.name.toLowerCase(Locale.ROOT).equals(key));
        if (taken) throw ApiException.conflict("name_taken", "已經有叫「" + name + "」的動作了");
        e.name = name;
        e.nameEn = in.nameEn() == null ? "" : in.nameEn().trim();
        e.muscleGroup = in.muscleGroup();
        e.equipment = in.equipment();
        e.increment = INCREMENT.get(in.equipment());
    }

    private Exercise custom(CurrentUser user, String id) {
        return db.get(db.coachDoc(user.coachId(), Db.EXERCISES, id), Exercise.class)
                .orElseThrow(() -> ApiException.notFound("找不到此自訂動作（內建動作無法修改）"));
    }

    private static void requireAuthor(CurrentUser user) {
        if (!user.isCoach() && !user.isSelf()) throw ApiException.forbidden("只有教練可以新增或修改動作");
    }
}
