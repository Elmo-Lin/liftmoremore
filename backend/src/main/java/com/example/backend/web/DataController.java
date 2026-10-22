package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.service.BootstrapService;
import com.example.backend.service.Mapper;
import com.example.backend.store.ExerciseCatalog;
import com.example.backend.web.Dtos.AppDataDto;
import com.example.backend.web.Dtos.ExerciseDto;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DataController {

    private final BootstrapService bootstrap;
    private final ExerciseCatalog exercises;

    public DataController(BootstrapService bootstrap, ExerciseCatalog exercises) {
        this.bootstrap = bootstrap;
        this.exercises = exercises;
    }

    /** Everything the caller may see, in the frontend's AppData shape. */
    @GetMapping("/bootstrap")
    public AppDataDto bootstrap(CurrentUser user) {
        return bootstrap.load(user);
    }

    @GetMapping("/exercises")
    public List<ExerciseDto> exercises(CurrentUser user) {
        return exercises.all().stream().map(Mapper::exercise).toList();
    }
}
