package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.BootstrapService;
import com.example.backend.service.ExerciseService;
import com.example.backend.web.Dtos.AppDataDto;
import com.example.backend.web.Dtos.ExerciseDto;
import com.example.backend.web.Dtos.ExerciseInput;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DataController {

    private final BootstrapService bootstrap;
    private final ExerciseService exercises;

    public DataController(BootstrapService bootstrap, ExerciseService exercises) {
        this.bootstrap = bootstrap;
        this.exercises = exercises;
    }

    /** Everything the caller may see, in the frontend's AppData shape. */
    @GetMapping("/bootstrap")
    public AppDataDto bootstrap(CurrentUser user) {
        return bootstrap.load(user);
    }

    /** Built-in exercises plus the workspace's custom ones. */
    @GetMapping("/exercises")
    public List<ExerciseDto> exercises(CurrentUser user) {
        return exercises.list(user);
    }

    @PostMapping("/exercises")
    @ResponseStatus(HttpStatus.CREATED)
    public ExerciseDto createExercise(CurrentUser user, @Valid @RequestBody ExerciseInput in) {
        return exercises.create(user, in);
    }

    @PutMapping("/exercises/{id}")
    public ExerciseDto updateExercise(CurrentUser user, @PathVariable String id, @Valid @RequestBody ExerciseInput in) {
        return exercises.update(user, id, in);
    }

    /** Archives a custom exercise (hidden from pickers, kept for history). */
    @DeleteMapping("/exercises/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archiveExercise(CurrentUser user, @PathVariable String id) {
        exercises.archive(user, id);
    }
}
