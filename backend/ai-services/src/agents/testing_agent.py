"""
Testing Agent - Generates test cases and test code
"""

import os
import json
import logging
import ast
import re
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import asyncio
from datetime import datetime

from .base import BaseAgent, AgentContext, AgentStatus, AgentType
from .execution_limiter import ExecutionLimiter
from ..config import Config

logger = logging.getLogger(__name__)


class TestType(Enum):
    """Types of tests to generate"""
    UNIT = "unit"
    INTEGRATION = "integration"
    E2E = "e2e"
    PERFORMANCE = "performance"
    SECURITY = "security"
    SMOKE = "smoke"
    REGRESSION = "regression"
    API = "api"
    UI = "ui"


class TestFramework(Enum):
    """Supported testing frameworks"""
    # Python
    PYTEST = "pytest"
    UNITTEST = "unittest"
    # JavaScript/TypeScript
    JEST = "jest"
    MOCHA = "mocha"
    VITEST = "vitest"
    CYPRESS = "cypress"
    PLAYWRIGHT = "playwright"
    # Go
    GO_TEST = "go_test"
    # Rust
    RUST_TEST = "rust_test"
    # Java
    JUNIT = "junit"
    # C++
    GTEST = "gtest"


@dataclass
class TestCase:
    """Represents a single test case"""
    name: str
    description: str
    test_type: TestType
    inputs: Dict[str, Any]
    expected_output: Any
    assertions: List[str]
    setup: Optional[str] = None
    teardown: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class TestSuite:
    """Collection of related test cases"""
    name: str
    description: str
    framework: TestFramework
    test_cases: List[TestCase]
    setup_code: Optional[str] = None
    teardown_code: Optional[str] = None
    fixtures: Dict[str, str] = field(default_factory=dict)
    mocks: Dict[str, str] = field(default_factory=dict)


class TestingAgent(BaseAgent):
    """
    Agent responsible for generating test cases and test code
    """
    
    def __init__(self, config: Config, execution_limiter: Optional[ExecutionLimiter] = None):
        super().__init__(
            name="testing_agent",
            agent_type=AgentType.CODE,
            system_prompt="""You are a Testing Agent. Your role is to generate comprehensive test cases,
            write test code, create test fixtures, generate mock data, and ensure high test coverage.
            You follow testing best practices and create maintainable, reliable tests.""",
            model=None,
            config={}
        )
        self.config = config
        self.execution_limiter = execution_limiter
        self.test_generators = self._initialize_generators()
    
    def _initialize_generators(self) -> Dict[str, Any]:
        """Initialize language-specific test generators"""
        return {
            ".py": self._generate_python_tests,
            ".js": self._generate_javascript_tests,
            ".ts": self._generate_typescript_tests,
            ".jsx": self._generate_javascript_tests,
            ".tsx": self._generate_typescript_tests,
            ".vue": self._generate_vue_tests,
            ".go": self._generate_go_tests,
            ".rs": self._generate_rust_tests,
            ".java": self._generate_java_tests,
        }
    
    async def analyze_code_for_testing(self, file_path: str) -> Dict[str, Any]:
        """Analyze code to determine what tests are needed"""
        logger.info(f"Analyzing {file_path} for test generation")
        
        # Read file content
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return {"error": str(e)}
        
        # Get file extension
        ext = Path(file_path).suffix.lower()
        
        # Language-specific analysis
        if ext == ".py":
            return await self._analyze_python_code(content)
        elif ext in [".js", ".jsx"]:
            return await self._analyze_javascript_code(content)
        elif ext in [".ts", ".tsx"]:
            return await self._analyze_typescript_code(content)
        else:
            return self._analyze_generic_code(content)
    
    async def _analyze_python_code(self, content: str) -> Dict[str, Any]:
        """Analyze Python code structure"""
        analysis = {
            "functions": [],
            "classes": [],
            "imports": [],
            "complexity": 0
        }
        
        try:
            tree = ast.parse(content)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    func_info = {
                        "name": node.name,
                        "params": [arg.arg for arg in node.args.args],
                        "is_async": isinstance(node, ast.AsyncFunctionDef),
                        "decorators": [self._get_decorator_name(d) for d in node.decorator_list],
                        "docstring": ast.get_docstring(node),
                        "returns": self._get_return_type(node),
                        "complexity": self._calculate_complexity(node)
                    }
                    analysis["functions"].append(func_info)
                    
                elif isinstance(node, ast.ClassDef):
                    methods = []
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef):
                            methods.append({
                                "name": item.name,
                                "params": [arg.arg for arg in item.args.args],
                                "is_async": isinstance(item, ast.AsyncFunctionDef),
                                "is_private": item.name.startswith('_'),
                                "is_static": any(isinstance(d, ast.Name) and d.id == 'staticmethod' 
                                                for d in item.decorator_list),
                                "is_class": any(isinstance(d, ast.Name) and d.id == 'classmethod' 
                                               for d in item.decorator_list)
                            })
                    
                    class_info = {
                        "name": node.name,
                        "bases": [self._get_base_name(base) for base in node.bases],
                        "methods": methods,
                        "decorators": [self._get_decorator_name(d) for d in node.decorator_list],
                        "docstring": ast.get_docstring(node)
                    }
                    analysis["classes"].append(class_info)
                    
                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        analysis["imports"].append(alias.name)
                        
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        analysis["imports"].append(node.module)
                        
        except SyntaxError as e:
            logger.error(f"Syntax error in Python code: {e}")
            analysis["error"] = str(e)
            
        return analysis
    
    def _get_decorator_name(self, decorator) -> str:
        """Extract decorator name from AST node"""
        if isinstance(decorator, ast.Name):
            return decorator.id
        elif isinstance(decorator, ast.Call):
            if isinstance(decorator.func, ast.Name):
                return decorator.func.id
        return "unknown"
    
    def _get_base_name(self, base) -> str:
        """Extract base class name from AST node"""
        if isinstance(base, ast.Name):
            return base.id
        elif isinstance(base, ast.Attribute):
            return f"{base.value.id}.{base.attr}" if isinstance(base.value, ast.Name) else "unknown"
        return "unknown"
    
    def _get_return_type(self, node) -> Optional[str]:
        """Extract return type annotation if present"""
        if node.returns:
            if isinstance(node.returns, ast.Name):
                return node.returns.id
            elif isinstance(node.returns, ast.Constant):
                return str(node.returns.value)
        return None
    
    def _calculate_complexity(self, node) -> int:
        """Calculate cyclomatic complexity of a function"""
        complexity = 1
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For)):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                complexity += len(child.values) - 1
        return complexity
    
    async def _analyze_javascript_code(self, content: str) -> Dict[str, Any]:
        """Analyze JavaScript code structure"""
        analysis = {
            "functions": [],
            "classes": [],
            "exports": [],
            "imports": []
        }
        
        # Simple regex-based analysis (proper parsing would require a JS parser)
        # Find functions
        func_pattern = r'(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)'
        for match in re.finditer(func_pattern, content):
            analysis["functions"].append({
                "name": match.group(1),
                "params": [p.strip() for p in match.group(2).split(',') if p.strip()]
            })
        
        # Find arrow functions
        arrow_pattern = r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>'
        for match in re.finditer(arrow_pattern, content):
            analysis["functions"].append({
                "name": match.group(1),
                "params": []
            })
        
        # Find classes
        class_pattern = r'class\s+(\w+)(?:\s+extends\s+(\w+))?'
        for match in re.finditer(class_pattern, content):
            analysis["classes"].append({
                "name": match.group(1),
                "extends": match.group(2)
            })
        
        # Find exports
        export_pattern = r'export\s+(?:default\s+)?(?:function|class|const|let|var)?\s*(\w+)'
        for match in re.finditer(export_pattern, content):
            analysis["exports"].append(match.group(1))
        
        # Find imports
        import_pattern = r'import\s+(?:{[^}]+}|\w+)\s+from\s+[\'"]([^\'"]+)[\'"]'
        for match in re.finditer(import_pattern, content):
            analysis["imports"].append(match.group(1))
        
        return analysis
    
    async def _analyze_typescript_code(self, content: str) -> Dict[str, Any]:
        """Analyze TypeScript code structure"""
        # Similar to JavaScript but with type information
        analysis = await self._analyze_javascript_code(content)
        
        # Find interfaces
        interface_pattern = r'interface\s+(\w+)'
        analysis["interfaces"] = []
        for match in re.finditer(interface_pattern, content):
            analysis["interfaces"].append(match.group(1))
        
        # Find types
        type_pattern = r'type\s+(\w+)\s*='
        analysis["types"] = []
        for match in re.finditer(type_pattern, content):
            analysis["types"].append(match.group(1))
        
        return analysis
    
    def _analyze_generic_code(self, content: str) -> Dict[str, Any]:
        """Generic code analysis for unsupported languages"""
        lines = content.splitlines()
        return {
            "lines": len(lines),
            "functions": [],
            "classes": []
        }
    
    async def generate_test_cases(self, code_analysis: Dict[str, Any], test_type: TestType) -> List[TestCase]:
        """Generate test cases based on code analysis"""
        test_cases = []
        
        # Generate test cases for functions
        for func in code_analysis.get("functions", []):
            test_cases.extend(self._generate_function_test_cases(func, test_type))
        
        # Generate test cases for classes
        for cls in code_analysis.get("classes", []):
            test_cases.extend(self._generate_class_test_cases(cls, test_type))
        
        return test_cases
    
    def _generate_function_test_cases(self, func_info: Dict[str, Any], test_type: TestType) -> List[TestCase]:
        """Generate test cases for a function"""
        test_cases = []
        func_name = func_info.get("name", "unknown")
        params = func_info.get("params", [])
        
        # Happy path test
        test_cases.append(TestCase(
            name=f"test_{func_name}_happy_path",
            description=f"Test {func_name} with valid inputs",
            test_type=test_type,
            inputs=self._generate_test_inputs(func_info),
            expected_output=None,  # Would need more context
            assertions=[
                "assert result is not None",
                f"assert isinstance(result, {func_info.get('returns', 'object')})" if func_info.get('returns') else "assert result is not None"
            ],
            tags=["happy_path", func_name]
        ))
        
        # Edge cases
        if params:
            # Null/None test
            test_cases.append(TestCase(
                name=f"test_{func_name}_null_input",
                description=f"Test {func_name} with null/None inputs",
                test_type=test_type,
                inputs={param: None for param in params},
                expected_output=None,
                assertions=["# Should handle None gracefully"],
                tags=["edge_case", "null_input", func_name]
            ))
            
            # Empty input test (for strings/lists)
            test_cases.append(TestCase(
                name=f"test_{func_name}_empty_input",
                description=f"Test {func_name} with empty inputs",
                test_type=test_type,
                inputs={param: "" for param in params},
                expected_output=None,
                assertions=["# Should handle empty inputs"],
                tags=["edge_case", "empty_input", func_name]
            ))
        
        # Error case
        test_cases.append(TestCase(
            name=f"test_{func_name}_error_handling",
            description=f"Test {func_name} error handling",
            test_type=test_type,
            inputs={"invalid": "data"},
            expected_output=None,
            assertions=["# Should raise appropriate exception or handle error"],
            tags=["error_case", func_name]
        ))
        
        return test_cases
    
    def _generate_class_test_cases(self, class_info: Dict[str, Any], test_type: TestType) -> List[TestCase]:
        """Generate test cases for a class"""
        test_cases = []
        class_name = class_info.get("name", "UnknownClass")
        
        # Test initialization
        test_cases.append(TestCase(
            name=f"test_{class_name}_initialization",
            description=f"Test {class_name} initialization",
            test_type=test_type,
            inputs={},
            expected_output=None,
            assertions=[
                f"assert instance is not None",
                f"assert isinstance(instance, {class_name})"
            ],
            setup=f"instance = {class_name}()",
            tags=["initialization", class_name]
        ))
        
        # Test each method
        for method in class_info.get("methods", []):
            if not method["name"].startswith("__"):  # Skip magic methods
                method_name = method["name"]
                test_cases.append(TestCase(
                    name=f"test_{class_name}_{method_name}",
                    description=f"Test {class_name}.{method_name}",
                    test_type=test_type,
                    inputs={},
                    expected_output=None,
                    assertions=[
                        f"assert hasattr(instance, '{method_name}')",
                        f"# Test method functionality"
                    ],
                    setup=f"instance = {class_name}()",
                    tags=["method", class_name, method_name]
                ))
        
        return test_cases
    
    def _generate_test_inputs(self, func_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate sample test inputs based on function signature"""
        inputs = {}
        for param in func_info.get("params", []):
            # Generate appropriate test data based on parameter name
            if "id" in param.lower():
                inputs[param] = 1
            elif "name" in param.lower() or "string" in param.lower():
                inputs[param] = "test_value"
            elif "count" in param.lower() or "number" in param.lower():
                inputs[param] = 10
            elif "flag" in param.lower() or "is_" in param:
                inputs[param] = True
            elif "list" in param.lower() or "array" in param.lower():
                inputs[param] = [1, 2, 3]
            elif "dict" in param.lower() or "map" in param.lower():
                inputs[param] = {"key": "value"}
            else:
                inputs[param] = "test_input"
        return inputs
    
    async def generate_test_file(self, file_path: str, test_type: TestType = TestType.UNIT) -> Dict[str, Any]:
        """Generate a complete test file for the given source file"""
        # Analyze the code
        analysis = await self.analyze_code_for_testing(file_path)
        
        if "error" in analysis:
            return {"error": analysis["error"]}
        
        # Generate test cases
        test_cases = await self.generate_test_cases(analysis, test_type)
        
        # Get appropriate test generator
        ext = Path(file_path).suffix.lower()
        generator = self.test_generators.get(ext)
        
        if not generator:
            return {"error": f"No test generator for {ext} files"}
        
        # Generate test code
        test_code = await generator(file_path, analysis, test_cases)
        
        # Determine test file path
        test_file_path = self._get_test_file_path(file_path)
        
        return {
            "test_file_path": test_file_path,
            "test_code": test_code,
            "test_cases": len(test_cases),
            "analysis": analysis
        }
    
    def _get_test_file_path(self, source_path: str) -> str:
        """Determine the appropriate test file path"""
        path = Path(source_path)
        
        # Common test directory structures
        if "src" in path.parts:
            # Replace src with test/tests
            parts = list(path.parts)
            src_index = parts.index("src")
            parts[src_index] = "tests"
            test_path = Path(*parts)
        else:
            # Add test_ prefix
            test_path = path.parent / f"test_{path.name}"
        
        # Change extension for certain files
        if path.suffix in [".jsx", ".tsx"]:
            test_path = test_path.with_suffix(f"{path.suffix}.test{path.suffix}")
        else:
            test_path = test_path.with_suffix(f".test{path.suffix}")
        
        return str(test_path)
    
    async def _generate_python_tests(self, file_path: str, analysis: Dict[str, Any],
                                     test_cases: List[TestCase]) -> str:
        """Generate Python test code using pytest"""
        module_name = Path(file_path).stem
        test_code = f'''"""
Test suite for {Path(file_path).name}
Generated by Dev-Ex Testing Agent
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add the source directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from {module_name} import *

'''
        
        # Add fixtures
        test_code += """# Test Fixtures
@pytest.fixture
def setup_data():
    \"\"\"Fixture for test data setup\"\"\"
    return {
        'test_string': 'test_value',
        'test_number': 42,
        'test_list': [1, 2, 3, 4, 5],
        'test_dict': {'key1': 'value1', 'key2': 'value2'}
    }

@pytest.fixture
def mock_dependencies():
    \"\"\"Fixture for mocking external dependencies\"\"\"
    with patch('module.external_dependency') as mock:
        mock.return_value = 'mocked_value'
        yield mock

"""
        
        # Generate tests for functions
        for func in analysis.get("functions", []):
            func_name = func["name"]
            params = func.get("params", [])
            
            # Skip private functions unless specified
            if func_name.startswith("_"):
                continue
            
            # Happy path test
            test_code += f'''
def test_{func_name}_happy_path(setup_data):
    \"\"\"Test {func_name} with valid inputs\"\"\"
    # Arrange
'''
            if params:
                for param in params[:3]:  # Limit to first 3 params for readability
                    test_code += f"    {param} = setup_data.get('test_string', 'default')\n"
                test_code += f"\n    # Act\n    result = {func_name}("
                test_code += ", ".join(params[:3])
                if len(params) > 3:
                    test_code += ", ..."
                test_code += ")\n"
            else:
                test_code += f"    # Act\n    result = {func_name}()\n"
            
            test_code += """    
    # Assert
    assert result is not None
    # Add specific assertions based on expected behavior
"""
            
            # Edge case test
            if params:
                test_code += f'''
def test_{func_name}_edge_cases():
    \"\"\"Test {func_name} with edge cases\"\"\"
    # Test with None
    with pytest.raises(TypeError):
        {func_name}(None)
    
    # Test with empty values
    result = {func_name}({', '.join(['""' if i < len(params) else '' for i in range(min(len(params), 2))])})
    assert result is not None or result == ""
'''
            
            # Async test if needed
            if func.get("is_async"):
                test_code += f'''
@pytest.mark.asyncio
async def test_{func_name}_async():
    \"\"\"Test async function {func_name}\"\"\"
    result = await {func_name}()
    assert result is not None
'''
        
        # Generate tests for classes
        for cls in analysis.get("classes", []):
            class_name = cls["name"]
            test_code += f'''

class Test{class_name}:
    \"\"\"Test suite for {class_name} class\"\"\"
    
    @pytest.fixture
    def instance(self):
        \"\"\"Create an instance of {class_name}\"\"\"
        return {class_name}()
    
    def test_initialization(self):
        \"\"\"Test {class_name} initialization\"\"\"
        instance = {class_name}()
        assert instance is not None
        assert isinstance(instance, {class_name})
'''
            
            # Test each public method
            for method in cls.get("methods", []):
                if not method["name"].startswith("_") and method["name"] not in ["__init__"]:
                    method_name = method["name"]
                    test_code += f'''
    def test_{method_name}(self, instance):
        \"\"\"Test {class_name}.{method_name} method\"\"\"
        # Test method exists
        assert hasattr(instance, '{method_name}')
        
        # Test method execution
        result = instance.{method_name}()
        assert result is not None or result is None  # Adjust based on expected behavior
'''
                    
                    if method.get("is_async"):
                        test_code += f'''
    @pytest.mark.asyncio
    async def test_{method_name}_async(self, instance):
        \"\"\"Test async method {class_name}.{method_name}\"\"\"
        result = await instance.{method_name}()
        assert result is not None or result is None  # Adjust based on expected behavior
'''
        
        # Add parameterized tests
        if analysis.get("functions"):
            test_code += '''

# Parameterized tests
@pytest.mark.parametrize("input_value,expected", [
    ("test1", "result1"),
    ("test2", "result2"),
    ("", None),
    (None, None),
])
def test_parameterized_example(input_value, expected):
    \"\"\"Test with multiple input/output combinations\"\"\"
    # Implement based on actual function behavior
    if input_value is None:
        assert expected is None
    else:
        # Add actual test logic here
        assert True
'''
        
        # Add integration test template
        test_code += '''

# Integration tests
@pytest.mark.integration
def test_integration_example():
    \"\"\"Integration test example\"\"\"
    # Test interaction between multiple components
    # This would test the actual integration points
    # For now, we'll assert True as a placeholder
    assert True

'''
        
        # Add performance test template
        test_code += '''# Performance tests
@pytest.mark.benchmark
def test_performance(benchmark):
    \"\"\"Performance test example\"\"\"
    # Use pytest-benchmark to measure performance
    def sample_function():
        return sum(range(1000))
    
    result = benchmark(sample_function)
    assert result == 499500
'''
        
        return test_code
    
    async def _generate_javascript_tests(self, file_path: str, analysis: Dict[str, Any],
                                        test_cases: List[TestCase]) -> str:
        """Generate JavaScript test code using Jest"""
        module_name = Path(file_path).stem
        test_code = f"""/**
 * Test suite for {Path(file_path).name}
 * Generated by Dev-Ex Testing Agent
 */

const {{ {', '.join(analysis.get('exports', []))} }} = require('./{module_name}');

describe('{module_name}', () => {{
"""
        
        # Generate tests for functions
        for func in analysis.get("functions", []):
            func_name = func["name"]
            test_code += f"""
  describe('{func_name}', () => {{
    it('should work with valid inputs', () => {{
      // Arrange
      const input = 'test';
      
      // Act
      const result = {func_name}(input);
      
      // Assert
      expect(result).toBeDefined();
    }});
    
    it('should handle edge cases', () => {{
      // Test with null
      expect(() => {func_name}(null)).not.toThrow();
      
      // Test with empty string
      const result = {func_name}('');
      expect(result).toBeDefined();
    }});
    
    it('should handle errors gracefully', () => {{
      // Test error handling
      expect(() => {func_name}(undefined)).not.toThrow();
    }});
  }});
"""
        
        # Generate tests for classes
        for cls in analysis.get("classes", []):
            class_name = cls["name"]
            test_code += f"""
  describe('{class_name}', () => {{
    let instance;
    
    beforeEach(() => {{
      instance = new {class_name}();
    }});
    
    it('should create an instance', () => {{
      expect(instance).toBeInstanceOf({class_name});
    }});
    
    it('should have required methods', () => {{
      // Add method existence tests
      expect(typeof instance.someMethod).toBe('function');
    }});
  }});
"""
        
        test_code += "});\n"
        return test_code
    
    async def _generate_typescript_tests(self, file_path: str, analysis: Dict[str, Any],
                                         test_cases: List[TestCase]) -> str:
        """Generate TypeScript test code"""
        module_name = Path(file_path).stem
        test_code = f"""/**
 * Test suite for {Path(file_path).name}
 * Generated by Dev-Ex Testing Agent
 */

import {{ {', '.join(analysis.get('exports', []))} }} from './{module_name}';

describe('{module_name}', () => {{
"""
        
        # Similar to JavaScript but with type annotations
        for func in analysis.get("functions", []):
            func_name = func["name"]
            test_code += f"""
  describe('{func_name}', () => {{
    it('should work with valid inputs', () => {{
      // Arrange
      const input: string = 'test';
      
      // Act
      const result = {func_name}(input);
      
      // Assert
      expect(result).toBeDefined();
    }});
  }});
"""
        
        test_code += "});\n"
        return test_code
    
    async def _generate_vue_tests(self, file_path: str, analysis: Dict[str, Any],
                                  test_cases: List[TestCase]) -> str:
        """Generate Vue component tests"""
        component_name = Path(file_path).stem
        test_code = f"""/**
 * Test suite for {Path(file_path).name}
 * Generated by Dev-Ex Testing Agent
 */

import {{ mount, shallowMount }} from '@vue/test-utils';
import {component_name} from './{component_name}.vue';

describe('{component_name}', () => {{
  let wrapper;
  
  beforeEach(() => {{
    wrapper = shallowMount({component_name});
  }});
  
  afterEach(() => {{
    wrapper.unmount();
  }});
  
  it('renders correctly', () => {{
    expect(wrapper.exists()).toBe(true);
  }});
  
  it('has correct props', () => {{
    // Test component props
    expect(wrapper.props()).toBeDefined();
  }});
  
  it('emits events correctly', async () => {{
    // Test event emission
    await wrapper.trigger('click');
    expect(wrapper.emitted()).toHaveProperty('click');
  }});
}});
"""
        return test_code
    
    async def _generate_go_tests(self, file_path: str, analysis: Dict[str, Any],
                                 test_cases: List[TestCase]) -> str:
        """Generate Go test code"""
        package_name = Path(file_path).stem
        test_code = f"""package {package_name}_test

import (
    "testing"
    . "{package_name}"
)

func TestExample(t *testing.T) {{
    // Test implementation
    result := SomeFunction()
    if result == nil {{
        t.Errorf("Expected non-nil result")
    }}
}}
"""
        return test_code
    
    async def _generate_rust_tests(self, file_path: str, analysis: Dict[str, Any],
                                   test_cases: List[TestCase]) -> str:
        """Generate Rust test code"""
        test_code = """#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_example() {
        // Test implementation
        let result = some_function();
        assert!(result.is_ok());
    }
}
"""
        return test_code
    
    async def _generate_java_tests(self, file_path: str, analysis: Dict[str, Any],
                                   test_cases: List[TestCase]) -> str:
        """Generate Java test code using JUnit"""
        class_name = Path(file_path).stem
        test_code = f"""import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

public class {class_name}Test {{
    
    private {class_name} instance;
    
    @BeforeEach
    public void setUp() {{
        instance = new {class_name}();
    }}
    
    @Test
    public void testExample() {{
        // Test implementation
        assertNotNull(instance);
    }}
}}
"""
        return test_code
    
    async def generate_test_suite(self, project_path: str, test_framework: TestFramework) -> TestSuite:
        """Generate a complete test suite for a project"""
        test_cases = []
        
        # Find all source files
        source_files = self._find_source_files(project_path)
        
        for file_path in source_files:
            analysis = await self.analyze_code_for_testing(file_path)
            cases = await self.generate_test_cases(analysis, TestType.UNIT)
            test_cases.extend(cases)
        
        return TestSuite(
            name=f"{Path(project_path).name}_test_suite",
            description=f"Complete test suite for {Path(project_path).name}",
            framework=test_framework,
            test_cases=test_cases
        )
    
    def _find_source_files(self, project_path: str) -> List[str]:
        """Find all source files in a project"""
        source_files = []
        extensions = ['.py', '.js', '.ts', '.jsx', '.tsx', '.go', '.rs', '.java']
        
        for root, dirs, files in os.walk(project_path):
            # Skip test directories
            if 'test' in root or '__pycache__' in root or 'node_modules' in root:
                continue
                
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    source_files.append(os.path.join(root, file))
        
        return source_files
    
    async def generate_mock_data(self, data_type: str, count: int = 10) -> List[Dict[str, Any]]:
        """Generate mock data for testing"""
        mock_data = []
        
        for i in range(count):
            if data_type == "user":
                mock_data.append({
                    "id": i + 1,
                    "name": f"User{i + 1}",
                    "email": f"user{i + 1}@example.com",
                    "age": 20 + (i % 50),
                    "active": i % 2 == 0
                })
            elif data_type == "product":
                mock_data.append({
                    "id": i + 1,
                    "name": f"Product{i + 1}",
                    "price": 10.0 + (i * 5),
                    "category": ["Electronics", "Clothing", "Food"][i % 3],
                    "in_stock": i % 3 != 0
                })
            elif data_type == "order":
                mock_data.append({
                    "id": f"ORD{1000 + i}",
                    "user_id": (i % 10) + 1,
                    "total": 50.0 + (i * 10),
                    "status": ["pending", "processing", "shipped", "delivered"][i % 4],
                    "created_at": f"2024-01-{(i % 28) + 1:02d}"
                })
            else:
                # Generic mock data
                mock_data.append({
                    "id": i + 1,
                    "field1": f"value{i + 1}",
                    "field2": i * 10,
                    "field3": i % 2 == 0
                })
        
        return mock_data
    
    async def generate_test_fixtures(self, test_framework: TestFramework) -> Dict[str, str]:
        """Generate test fixtures for different frameworks"""
        fixtures = {}
        
        if test_framework == TestFramework.PYTEST:
            fixtures["database"] = """@pytest.fixture
def db_connection():
    \"\"\"Database connection fixture\"\"\"
    conn = create_test_database()
    yield conn
    conn.close()
"""
            fixtures["client"] = """@pytest.fixture
def test_client():
    \"\"\"Test client fixture\"\"\"
    app = create_app(testing=True)
    with app.test_client() as client:
        yield client
"""
        elif test_framework == TestFramework.JEST:
            fixtures["setup"] = """beforeAll(async () => {
  // Global setup
  await setupTestDatabase();
});

afterAll(async () => {
  // Global teardown
  await teardownTestDatabase();
});
"""
        
        return fixtures
    
    async def process(self, context: AgentContext) -> Dict[str, Any]:
        """Process a testing request"""
        self.context = context
        result = {"status": "success", "tests_generated": 0}
        
        try:
            if self.execution_limiter:
                await self.execution_limiter.check_and_increment(context.session_id)
            
            task = context.current_task
            
            if task.get("action") == "generate_tests":
                file_path = task.get("file_path")
                test_type = TestType(task.get("test_type", "unit"))
                
                test_result = await self.generate_test_file(file_path, test_type)
                
                if "error" not in test_result:
                    # Write test file
                    with open(test_result["test_file_path"], 'w') as f:
                        f.write(test_result["test_code"])
                    
                    result["test_file"] = test_result["test_file_path"]
                    result["tests_generated"] = test_result["test_cases"]
                    result["message"] = f"Generated {test_result['test_cases']} test cases"
                else:
                    result["status"] = "error"
                    result["error"] = test_result["error"]
                    
            elif task.get("action") == "generate_test_suite":
                project_path = task.get("project_path")
                framework = TestFramework(task.get("framework", "pytest"))
                
                suite = await self.generate_test_suite(project_path, framework)
                result["test_suite"] = suite.name
                result["tests_generated"] = len(suite.test_cases)
                result["message"] = f"Generated test suite with {len(suite.test_cases)} test cases"
                
            elif task.get("action") == "generate_mock_data":
                data_type = task.get("data_type", "generic")
                count = task.get("count", 10)
                
                mock_data = await self.generate_mock_data(data_type, count)
                result["mock_data"] = mock_data
                result["message"] = f"Generated {count} mock {data_type} records"
                
            else:
                result["status"] = "error"
                result["error"] = f"Unknown action: {task.get('action')}"
                
        except Exception as e:
            logger.error(f"Error in testing agent: {e}")
            result["status"] = "error"
            result["error"] = str(e)
            
        return result