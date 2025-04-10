package com.example.testgenerator.service;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.AnnotationExpr;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class TestGeneratorService {

    public String generateTests(String sourceCode) {
        try {
            CompilationUnit cu = StaticJavaParser.parse(sourceCode);
            ClassOrInterfaceDeclaration mainClass = cu.findFirst(ClassOrInterfaceDeclaration.class).orElseThrow();
            
            StringBuilder testClass = new StringBuilder();
            String className = mainClass.getNameAsString();
            
            // Generate test class header with appropriate imports
            generateTestClassHeader(testClass, mainClass);
            
            // Add class declaration with appropriate extensions
            testClass.append("@ExtendWith(MockitoExtension.class)\n");
            testClass.append("class ").append(className).append("Test {\n\n");
            
            // Add mocks and inject class under test
            generateMocksAndInjects(testClass, mainClass);
            
            // Generate test methods
            List<MethodDeclaration> methods = mainClass.getMethods();
            for (MethodDeclaration method : methods) {
                generateTestMethod(testClass, method, mainClass);
            }
            
            testClass.append("}\n");
            return testClass.toString();
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate tests: " + e.getMessage());
        }
    }

    private void generateTestClassHeader(StringBuilder testClass, ClassOrInterfaceDeclaration mainClass) {
        testClass.append("import org.junit.jupiter.api.Test;\n");
        testClass.append("import org.junit.jupiter.api.extension.ExtendWith;\n");
        testClass.append("import org.mockito.InjectMocks;\n");
        testClass.append("import org.mockito.Mock;\n");
        testClass.append("import org.mockito.Mockito;\n");
        testClass.append("import org.mockito.junit.jupiter.MockitoExtension;\n");
        testClass.append("import static org.mockito.Mockito.*;\n");
        testClass.append("import static org.junit.jupiter.api.Assertions.*;\n\n");
        
        // Add imports for Spring annotations if present
        if (hasSpringAnnotations(mainClass)) {
            testClass.append("import org.springframework.boot.test.context.SpringBootTest;\n");
            testClass.append("import org.springframework.boot.test.mock.mockito.MockBean;\n");
        }
        testClass.append("\n");
    }

    private void generateMocksAndInjects(StringBuilder testClass, ClassOrInterfaceDeclaration mainClass) {
        // Add @InjectMocks for the main class
        testClass.append("    @InjectMocks\n");
        testClass.append("    private ").append(mainClass.getNameAsString()).append(" ")
                .append(toLowerCase(mainClass.getNameAsString())).append(";\n\n");
        
        // Add mocks for dependencies
        mainClass.getFields().forEach(field -> {
            String fieldType = field.getElementType().toString();
            testClass.append("    @Mock\n");
            testClass.append("    private ").append(fieldType).append(" ")
                    .append(field.getVariables().get(0).getNameAsString())
                    .append(";\n\n");
        });
    }

    private void generateTestMethod(StringBuilder testClass, MethodDeclaration method, ClassOrInterfaceDeclaration mainClass) {
        String methodName = method.getNameAsString();
        String returnType = method.getType().toString();
        
        testClass.append("    @Test\n");
        testClass.append("    void ").append(methodName).append("_ShouldSucceed() {\n");
        
        // Generate method-specific test logic based on return type and parameters
        if (isRepositoryMethod(methodName)) {
            generateRepositoryMethodTest(testClass, method, returnType);
        } else if (isServiceMethod(mainClass)) {
            generateServiceMethodTest(testClass, method, returnType);
        } else {
            generateDefaultMethodTest(testClass, method, returnType);
        }
        
        testClass.append("    }\n\n");
    }

    private void generateRepositoryMethodTest(StringBuilder testClass, MethodDeclaration method, String returnType) {
        testClass.append("        // Given\n");
        if (method.getNameAsString().startsWith("findBy")) {
            testClass.append("        var expectedEntity = new ").append(returnType).append("();\n");
            testClass.append("        when(").append(toLowerCase(method.getNameAsString())).append("(any()))\n");
            testClass.append("            .thenReturn(Optional.of(expectedEntity));\n\n");
        }
        
        testClass.append("        // When\n");
        testClass.append("        var result = ").append(toLowerCase(method.getNameAsString())).append("();\n\n");
        
        testClass.append("        // Then\n");
        testClass.append("        assertNotNull(result);\n");
    }

    private void generateServiceMethodTest(StringBuilder testClass, MethodDeclaration method, String returnType) {
        testClass.append("        // Given\n");
        if (!returnType.equals("void")) {
            testClass.append("        var expectedResult = new ").append(returnType).append("();\n");
            method.getParameters().forEach(param -> 
                testClass.append("        var ").append(param.getNameAsString())
                        .append(" = new ").append(param.getType()).append("();\n")
            );
        }
        
        testClass.append("        // When\n");
        StringBuilder methodCall = new StringBuilder(method.getNameAsString()).append("(");
        methodCall.append(method.getParameters().stream()
                .map(p -> p.getNameAsString())
                .reduce((a, b) -> a + ", " + b)
                .orElse(""));
        methodCall.append(")");
        
        if (!returnType.equals("void")) {
            testClass.append("        var result = ");
        } else {
            testClass.append("        ");
        }
        testClass.append(toLowerCase(method.getNameAsString())).append(";\n\n");
        
        testClass.append("        // Then\n");
        if (!returnType.equals("void")) {
            testClass.append("        assertNotNull(result);\n");
        }
        testClass.append("        verify(mockDependency, times(1)).someMethod();\n");
    }

    private void generateDefaultMethodTest(StringBuilder testClass, MethodDeclaration method, String returnType) {
        testClass.append("        // Given\n");
        testClass.append("        // TODO: Set up test data\n\n");
        
        testClass.append("        // When\n");
        testClass.append("        // TODO: Call method under test\n\n");
        
        testClass.append("        // Then\n");
        testClass.append("        // TODO: Add assertions\n");
    }

    private boolean isRepositoryMethod(String methodName) {
        return methodName.startsWith("findBy") || methodName.startsWith("save") || 
               methodName.startsWith("delete") || methodName.equals("findAll");
    }

    private boolean isServiceMethod(ClassOrInterfaceDeclaration clazz) {
        return clazz.getAnnotations().stream()
                .anyMatch(a -> a.getNameAsString().equals("Service"));
    }

    private boolean hasSpringAnnotations(ClassOrInterfaceDeclaration clazz) {
        return clazz.getAnnotations().stream()
                .anyMatch(this::isSpringAnnotation);
    }

    private boolean isSpringAnnotation(AnnotationExpr annotation) {
        String name = annotation.getNameAsString();
        return name.equals("Service") || name.equals("Repository") || 
               name.equals("Component") || name.equals("Controller");
    }

    private String toLowerCase(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }
        return Character.toLowerCase(str.charAt(0)) + str.substring(1);
    }
}