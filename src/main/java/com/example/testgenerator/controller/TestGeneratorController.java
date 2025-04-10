package com.example.testgenerator.controller;

import com.example.testgenerator.service.TestGeneratorService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/test-generator")
@CrossOrigin(origins = "*")
public class TestGeneratorController {

    private final TestGeneratorService testGeneratorService;

    public TestGeneratorController(TestGeneratorService testGeneratorService) {
        this.testGeneratorService = testGeneratorService;
    }

    @PostMapping("/generate")
    public String generateTests(@RequestBody String sourceCode) {
        return testGeneratorService.generateTests(sourceCode);
    }
}