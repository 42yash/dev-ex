"""
Code Review Agent - Analyzes code quality and suggests improvements
"""

import os
import json
import logging
import ast
import re
import math
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import asyncio
from datetime import datetime
from collections import defaultdict

from .base import BaseAgent, AgentContext, AgentStatus, AgentType
from .execution_limiter import ExecutionLimiter
from ..config import Config

logger = logging.getLogger(__name__)


class SeverityLevel(Enum):
    """Issue severity levels"""
    CRITICAL = "critical"  # Security vulnerabilities, data loss risks
    HIGH = "high"         # Bugs, performance issues
    MEDIUM = "medium"     # Code quality issues
    LOW = "low"           # Style issues, minor improvements
    INFO = "info"         # Suggestions, best practices


class IssueCategory(Enum):
    """Categories of code issues"""
    SECURITY = "security"
    PERFORMANCE = "performance"
    MAINTAINABILITY = "maintainability"
    RELIABILITY = "reliability"
    STYLE = "style"
    DOCUMENTATION = "documentation"
    TESTING = "testing"
    COMPLEXITY = "complexity"
    DUPLICATION = "duplication"


@dataclass
class CodeIssue:
    """Represents a code issue found during review"""
    file: str
    line: int
    column: Optional[int]
    severity: SeverityLevel
    category: IssueCategory
    message: str
    suggestion: Optional[str] = None
    code_snippet: Optional[str] = None
    rule: Optional[str] = None


@dataclass
class CodeMetrics:
    """Code quality metrics"""
    lines_of_code: int = 0
    comment_lines: int = 0
    blank_lines: int = 0
    cyclomatic_complexity: int = 0
    cognitive_complexity: int = 0
    maintainability_index: float = 0.0
    test_coverage: float = 0.0
    duplicate_lines: int = 0
    code_smells: int = 0
    halstead_volume: float = 0.0
    halstead_difficulty: float = 0.0
    halstead_effort: float = 0.0
    functions: int = 0
    classes: int = 0
    max_nesting_depth: int = 0


@dataclass
class ReviewResult:
    """Complete code review result"""
    files_reviewed: int
    issues: List[CodeIssue]
    metrics: CodeMetrics
    score: float  # 0-100
    summary: str
    recommendations: List[str]
    passed: bool


class ComplexityAnalyzer:
    """Advanced complexity analysis for code"""
    
    @staticmethod
    def calculate_cyclomatic_complexity(node: ast.AST) -> int:
        """Calculate cyclomatic complexity using McCabe's algorithm"""
        complexity = 1  # Base complexity
        
        # Decision points that add to complexity
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.ExceptHandler)):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                # Each AND/OR adds a path
                complexity += len(child.values) - 1
            elif isinstance(child, ast.Assert):
                complexity += 1
            elif isinstance(child, ast.comprehension):
                # List/dict/set comprehensions with conditions
                complexity += len(child.ifs)
            elif isinstance(child, ast.Try):
                # Each except handler adds a path
                complexity += len(child.handlers)
            elif isinstance(child, ast.With):
                # Context managers can have multiple items
                complexity += len(child.items) - 1 if len(child.items) > 1 else 0
                
        return complexity
    
    @staticmethod
    def calculate_cognitive_complexity(node: ast.AST, depth: int = 0) -> int:
        """Calculate cognitive complexity (how hard code is to understand)"""
        complexity = 0
        nesting_increment = 0
        
        if isinstance(node, (ast.If, ast.For, ast.While)):
            # Control flow structures add complexity
            complexity += 1 + depth  # Nesting penalty
            nesting_increment = 1
        elif isinstance(node, ast.BoolOp):
            # Logical operators add complexity
            complexity += 1
            # Nested boolean operators are harder to understand
            for value in node.values:
                if isinstance(value, ast.BoolOp):
                    complexity += 1
        elif isinstance(node, ast.ExceptHandler):
            complexity += 1 + depth
            nesting_increment = 1
        elif isinstance(node, ast.Lambda):
            # Lambdas add cognitive load
            complexity += 1
        elif isinstance(node, (ast.ListComp, ast.DictComp, ast.SetComp)):
            # Comprehensions can be complex
            complexity += 1
            if hasattr(node, 'ifs') and len(node.ifs) > 0:
                complexity += len(node.ifs)
        elif isinstance(node, ast.Try):
            # Try blocks with multiple handlers
            if len(node.handlers) > 1:
                complexity += len(node.handlers) - 1
                
        # Recursively calculate for child nodes
        for child in ast.iter_child_nodes(node):
            complexity += ComplexityAnalyzer.calculate_cognitive_complexity(
                child, depth + nesting_increment
            )
            
        return complexity
    
    @staticmethod
    def calculate_halstead_metrics(node: ast.AST) -> Dict[str, float]:
        """Calculate Halstead complexity metrics"""
        operators = set()
        operands = set()
        operator_count = 0
        operand_count = 0
        
        # Collect operators and operands
        for child in ast.walk(node):
            if isinstance(child, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod,
                                ast.Pow, ast.LShift, ast.RShift, ast.BitOr,
                                ast.BitXor, ast.BitAnd, ast.FloorDiv)):
                operators.add(type(child).__name__)
                operator_count += 1
            elif isinstance(child, (ast.And, ast.Or, ast.Not)):
                operators.add(type(child).__name__)
                operator_count += 1
            elif isinstance(child, (ast.Eq, ast.NotEq, ast.Lt, ast.LtE,
                                  ast.Gt, ast.GtE, ast.Is, ast.IsNot,
                                  ast.In, ast.NotIn)):
                operators.add(type(child).__name__)
                operator_count += 1
            elif isinstance(child, ast.Name):
                operands.add(child.id)
                operand_count += 1
            elif isinstance(child, (ast.Num, ast.Str, ast.Constant)):
                if hasattr(child, 'value'):
                    operands.add(str(child.value))
                elif hasattr(child, 'n'):
                    operands.add(str(child.n))
                elif hasattr(child, 's'):
                    operands.add(child.s)
                operand_count += 1
                
        # Calculate Halstead metrics
        n1 = len(operators)  # Unique operators
        n2 = len(operands)   # Unique operands
        N1 = operator_count  # Total operators
        N2 = operand_count   # Total operands
        
        # Vocabulary
        n = n1 + n2
        # Program length
        N = N1 + N2
        
        if n == 0 or N == 0:
            return {
                'volume': 0,
                'difficulty': 0,
                'effort': 0,
                'time': 0,
                'bugs': 0
            }
        
        # Volume (how much information)
        volume = N * math.log2(n) if n > 0 else 0
        
        # Difficulty (how hard to write/understand)
        difficulty = (n1 / 2) * (N2 / n2) if n2 > 0 else 0
        
        # Effort (mental effort to write/understand)
        effort = volume * difficulty
        
        # Time to program (in seconds)
        time_to_program = effort / 18
        
        # Predicted bugs
        bugs = volume / 3000
        
        return {
            'volume': volume,
            'difficulty': difficulty,
            'effort': effort,
            'time': time_to_program,
            'bugs': bugs
        }
    
    @staticmethod
    def calculate_nesting_depth(node: ast.AST, current_depth: int = 0) -> int:
        """Calculate maximum nesting depth"""
        max_depth = current_depth
        
        # Nodes that increase nesting
        nesting_nodes = (ast.If, ast.For, ast.While, ast.With, ast.Try,
                        ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
        
        for child in ast.iter_child_nodes(node):
            if isinstance(child, nesting_nodes):
                child_depth = ComplexityAnalyzer.calculate_nesting_depth(
                    child, current_depth + 1
                )
                max_depth = max(max_depth, child_depth)
            else:
                child_depth = ComplexityAnalyzer.calculate_nesting_depth(
                    child, current_depth
                )
                max_depth = max(max_depth, child_depth)
                
        return max_depth


class CodeReviewAgent(BaseAgent):
    """
    Agent responsible for code review and quality analysis
    """
    
    def __init__(self, config: Config, execution_limiter: Optional[ExecutionLimiter] = None):
        super().__init__(
            name="code_reviewer",
            agent_type=AgentType.ANALYSIS,
            system_prompt="""You are a Code Review Agent. Your role is to analyze code quality,
            identify security vulnerabilities, suggest performance improvements, ensure best practices,
            and maintain high code standards. You provide constructive feedback and actionable suggestions.""",
            model=None,
            config={}
        )
        self.config = config
        self.execution_limiter = execution_limiter
        self.language_analyzers = self._initialize_analyzers()
        self.complexity_analyzer = ComplexityAnalyzer()
    
    def _initialize_analyzers(self) -> Dict[str, Any]:
        """Initialize language-specific analyzers"""
        return {
            ".py": self._analyze_python,
            ".js": self._analyze_javascript,
            ".ts": self._analyze_typescript,
            ".jsx": self._analyze_javascript,
            ".tsx": self._analyze_typescript,
            ".vue": self._analyze_vue,
            ".go": self._analyze_go,
            ".rs": self._analyze_rust,
            ".java": self._analyze_java,
            ".cpp": self._analyze_cpp,
            ".c": self._analyze_c,
        }
    
    async def review_file(self, file_path: str) -> List[CodeIssue]:
        """Review a single file"""
        logger.info(f"Reviewing file: {file_path}")
        issues = []
        
        # Check if file exists
        if not Path(file_path).exists():
            logger.error(f"File not found: {file_path}")
            return issues
        
        # Get file extension
        ext = Path(file_path).suffix.lower()
        
        # Read file content
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.splitlines()
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return issues
        
        # Common checks for all file types
        issues.extend(self._check_common_issues(file_path, content, lines))
        
        # Language-specific analysis
        if ext in self.language_analyzers:
            analyzer = self.language_analyzers[ext]
            language_issues = await analyzer(file_path, content, lines)
            issues.extend(language_issues)
        else:
            # Generic analysis for unsupported languages
            issues.extend(self._analyze_generic(file_path, content, lines))
        
        return issues
    
    def _check_common_issues(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Check for common issues across all languages"""
        issues = []
        
        # Check for sensitive information
        sensitive_patterns = [
            (r'(?i)(api[_-]?key|apikey)\s*=\s*["\'][\w\-]+["\']', "API key exposed"),
            (r'(?i)(secret|password|passwd|pwd)\s*=\s*["\'][^"\']+["\']', "Password/secret exposed"),
            (r'(?i)token\s*=\s*["\'][\w\-\.]+["\']', "Token exposed"),
            (r'(?i)private[_-]?key\s*=\s*["\'][^"\']+["\']', "Private key exposed"),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, message in sensitive_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        file=file_path,
                        line=line_num,
                        column=None,
                        severity=SeverityLevel.CRITICAL,
                        category=IssueCategory.SECURITY,
                        message=message,
                        suggestion="Move sensitive data to environment variables or secure configuration",
                        code_snippet=line.strip()
                    ))
        
        # Check for TODO/FIXME comments
        for line_num, line in enumerate(lines, 1):
            if re.search(r'\b(TODO|FIXME|HACK|XXX)\b', line, re.IGNORECASE):
                issues.append(CodeIssue(
                    file=file_path,
                    line=line_num,
                    column=None,
                    severity=SeverityLevel.INFO,
                    category=IssueCategory.DOCUMENTATION,
                    message="Unresolved TODO/FIXME comment",
                    suggestion="Address the TODO or create a tracking issue",
                    code_snippet=line.strip()
                ))
        
        # Check line length
        max_line_length = 120
        for line_num, line in enumerate(lines, 1):
            if len(line) > max_line_length:
                issues.append(CodeIssue(
                    file=file_path,
                    line=line_num,
                    column=max_line_length,
                    severity=SeverityLevel.LOW,
                    category=IssueCategory.STYLE,
                    message=f"Line too long ({len(line)} > {max_line_length} characters)",
                    suggestion="Break long lines for better readability",
                    code_snippet=line[:50] + "..."
                ))
        
        # Check for trailing whitespace
        for line_num, line in enumerate(lines, 1):
            if line.endswith((' ', '\t')):
                issues.append(CodeIssue(
                    file=file_path,
                    line=line_num,
                    column=len(line.rstrip()),
                    severity=SeverityLevel.LOW,
                    category=IssueCategory.STYLE,
                    message="Trailing whitespace",
                    suggestion="Remove trailing whitespace",
                    rule="no-trailing-spaces"
                ))
        
        return issues
    
    async def _analyze_python(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze Python code"""
        issues = []
        
        try:
            tree = ast.parse(content)
            
            # Analyze functions and methods
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    # Cyclomatic complexity
                    cyclomatic = self.complexity_analyzer.calculate_cyclomatic_complexity(node)
                    if cyclomatic > 10:
                        issues.append(CodeIssue(
                            file=file_path,
                            line=node.lineno,
                            column=None,
                            severity=SeverityLevel.HIGH if cyclomatic > 15 else SeverityLevel.MEDIUM,
                            category=IssueCategory.COMPLEXITY,
                            message=f"High cyclomatic complexity ({cyclomatic}) for function '{node.name}'",
                            suggestion="Consider breaking this function into smaller, more focused functions",
                            rule="cyclomatic-complexity"
                        ))
                    
                    # Cognitive complexity
                    cognitive = self.complexity_analyzer.calculate_cognitive_complexity(node)
                    if cognitive > 15:
                        issues.append(CodeIssue(
                            file=file_path,
                            line=node.lineno,
                            column=None,
                            severity=SeverityLevel.HIGH if cognitive > 25 else SeverityLevel.MEDIUM,
                            category=IssueCategory.COMPLEXITY,
                            message=f"High cognitive complexity ({cognitive}) for function '{node.name}'",
                            suggestion="Simplify the logic to make it easier to understand",
                            rule="cognitive-complexity"
                        ))
                    
                    # Nesting depth
                    nesting = self.complexity_analyzer.calculate_nesting_depth(node)
                    if nesting > 4:
                        issues.append(CodeIssue(
                            file=file_path,
                            line=node.lineno,
                            column=None,
                            severity=SeverityLevel.MEDIUM,
                            category=IssueCategory.COMPLEXITY,
                            message=f"Deep nesting level ({nesting}) in function '{node.name}'",
                            suggestion="Reduce nesting by using early returns or extracting nested logic",
                            rule="max-nesting-depth"
                        ))
                    
                    # Function length
                    func_lines = node.end_lineno - node.lineno if hasattr(node, 'end_lineno') else 0
                    if func_lines > 50:
                        issues.append(CodeIssue(
                            file=file_path,
                            line=node.lineno,
                            column=None,
                            severity=SeverityLevel.MEDIUM if func_lines <= 100 else SeverityLevel.HIGH,
                            category=IssueCategory.MAINTAINABILITY,
                            message=f"Function '{node.name}' is too long ({func_lines} lines)",
                            suggestion="Consider splitting into smaller functions",
                            rule="max-function-length"
                        ))
                    
                    # Check for missing docstring
                    if not ast.get_docstring(node):
                        issues.append(CodeIssue(
                            file=file_path,
                            line=node.lineno,
                            column=None,
                            severity=SeverityLevel.LOW,
                            category=IssueCategory.DOCUMENTATION,
                            message=f"Missing docstring for function '{node.name}'",
                            suggestion="Add a docstring describing the function's purpose, parameters, and return value",
                            rule="missing-docstring"
                        ))
                
                # Check classes
                elif isinstance(node, ast.ClassDef):
                    # Class complexity
                    methods = [n for n in node.body if isinstance(n, ast.FunctionDef)]
                    if len(methods) > 20:
                        issues.append(CodeIssue(
                            file=file_path,
                            line=node.lineno,
                            column=None,
                            severity=SeverityLevel.HIGH,
                            category=IssueCategory.MAINTAINABILITY,
                            message=f"Class '{node.name}' has too many methods ({len(methods)})",
                            suggestion="Consider splitting into multiple classes or using composition",
                            rule="max-class-methods"
                        ))
                    
                    # Check for missing class docstring
                    if not ast.get_docstring(node):
                        issues.append(CodeIssue(
                            file=file_path,
                            line=node.lineno,
                            column=None,
                            severity=SeverityLevel.LOW,
                            category=IssueCategory.DOCUMENTATION,
                            message=f"Missing docstring for class '{node.name}'",
                            suggestion="Add a docstring describing the class purpose and usage",
                            rule="missing-class-docstring"
                        ))
            
            # Python-specific issues
            issues.extend(self._check_python_specific_issues(tree, file_path))
            
        except SyntaxError as e:
            issues.append(CodeIssue(
                file=file_path,
                line=e.lineno or 1,
                column=e.offset,
                severity=SeverityLevel.CRITICAL,
                category=IssueCategory.RELIABILITY,
                message=f"Syntax error: {e.msg}",
                suggestion="Fix the syntax error before proceeding"
            ))
        
        return issues
    
    def _check_python_specific_issues(self, tree: ast.AST, file_path: str) -> List[CodeIssue]:
        """Check for Python-specific code issues"""
        issues = []
        
        for node in ast.walk(tree):
            # Check for bare except
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                issues.append(CodeIssue(
                    file=file_path,
                    line=node.lineno,
                    column=None,
                    severity=SeverityLevel.MEDIUM,
                    category=IssueCategory.RELIABILITY,
                    message="Bare except clause catches all exceptions",
                    suggestion="Specify the exception types you want to catch",
                    rule="bare-except"
                ))
            
            # Check for eval usage
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id in ['eval', 'exec']:
                    issues.append(CodeIssue(
                        file=file_path,
                        line=node.lineno,
                        column=None,
                        severity=SeverityLevel.CRITICAL,
                        category=IssueCategory.SECURITY,
                        message=f"Use of {node.func.id}() is a security risk",
                        suggestion="Avoid eval/exec or use ast.literal_eval for safe evaluation",
                        rule="no-eval"
                    ))
            
            # Check for mutable default arguments
            elif isinstance(node, ast.FunctionDef):
                for default in node.args.defaults:
                    if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                        issues.append(CodeIssue(
                            file=file_path,
                            line=node.lineno,
                            column=None,
                            severity=SeverityLevel.HIGH,
                            category=IssueCategory.RELIABILITY,
                            message=f"Mutable default argument in function '{node.name}'",
                            suggestion="Use None as default and create the mutable object inside the function",
                            rule="mutable-default-argument"
                        ))
        
        return issues
    
    async def _analyze_javascript(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze JavaScript/TypeScript code"""
        issues = []
        
        # JavaScript-specific patterns
        js_patterns = [
            (r'==(?!=)', "Use === for strict equality", SeverityLevel.MEDIUM),
            (r'!=(?!=)', "Use !== for strict inequality", SeverityLevel.MEDIUM),
            (r'\bvar\s+', "Use 'const' or 'let' instead of 'var'", SeverityLevel.LOW),
            (r'console\.(log|debug|info)', "Remove console statements", SeverityLevel.LOW),
            (r'debugger;', "Remove debugger statement", SeverityLevel.HIGH),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, message, severity in js_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        file=file_path,
                        line=line_num,
                        column=None,
                        severity=severity,
                        category=IssueCategory.STYLE if severity == SeverityLevel.LOW else IssueCategory.RELIABILITY,
                        message=message,
                        code_snippet=line.strip()
                    ))
        
        # Complexity analysis for JavaScript (simplified without AST)
        issues.extend(self._analyze_javascript_complexity(file_path, content, lines))
        
        return issues
    
    def _analyze_javascript_complexity(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze JavaScript complexity using pattern matching"""
        issues = []
        
        # Find functions and analyze their complexity
        function_pattern = r'(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))'
        
        for match in re.finditer(function_pattern, content):
            func_name = match.group(1) or match.group(2)
            func_start = content[:match.start()].count('\n') + 1
            
            # Find the function body (simplified)
            brace_count = 0
            func_end = func_start
            in_function = False
            
            for i, line in enumerate(lines[func_start - 1:], func_start):
                if '{' in line:
                    brace_count += line.count('{')
                    in_function = True
                if '}' in line and in_function:
                    brace_count -= line.count('}')
                    if brace_count <= 0:
                        func_end = i
                        break
            
            # Calculate complexity for this function
            func_lines = lines[func_start - 1:func_end]
            func_content = '\n'.join(func_lines)
            
            # Count complexity indicators
            complexity = 1
            complexity_patterns = [
                r'\bif\b', r'\belse\s+if\b', r'\bwhile\b', r'\bfor\b',
                r'\bdo\b', r'\bswitch\b', r'\bcase\b', r'\bcatch\b',
                r'\?\s*[^:]+\s*:', r'&&', r'\|\|'
            ]
            
            for pattern in complexity_patterns:
                complexity += len(re.findall(pattern, func_content))
            
            if complexity > 10:
                issues.append(CodeIssue(
                    file=file_path,
                    line=func_start,
                    column=None,
                    severity=SeverityLevel.HIGH if complexity > 15 else SeverityLevel.MEDIUM,
                    category=IssueCategory.COMPLEXITY,
                    message=f"High complexity ({complexity}) in function '{func_name}'",
                    suggestion="Consider refactoring to reduce complexity",
                    rule="cyclomatic-complexity"
                ))
            
            # Check function length
            if func_end - func_start > 50:
                issues.append(CodeIssue(
                    file=file_path,
                    line=func_start,
                    column=None,
                    severity=SeverityLevel.MEDIUM,
                    category=IssueCategory.MAINTAINABILITY,
                    message=f"Function '{func_name}' is too long ({func_end - func_start} lines)",
                    suggestion="Consider splitting into smaller functions"
                ))
        
        return issues
    
    async def _analyze_typescript(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze TypeScript code"""
        # Start with JavaScript analysis
        issues = await self._analyze_javascript(file_path, content, lines)
        
        # Add TypeScript-specific checks
        ts_patterns = [
            (r'\bany\b(?!\s*\])', "Avoid using 'any' type", SeverityLevel.MEDIUM),
            (r'@ts-ignore', "Avoid using @ts-ignore", SeverityLevel.MEDIUM),
            (r'@ts-nocheck', "Avoid using @ts-nocheck", SeverityLevel.HIGH),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, message, severity in ts_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        file=file_path,
                        line=line_num,
                        column=None,
                        severity=severity,
                        category=IssueCategory.MAINTAINABILITY,
                        message=message,
                        suggestion="Use proper typing instead",
                        code_snippet=line.strip()
                    ))
        
        return issues
    
    async def _analyze_vue(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze Vue component files"""
        issues = []
        
        # Extract script section
        script_match = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
        if script_match:
            script_content = script_match.group(1)
            script_lines = script_content.splitlines()
            
            # Determine if TypeScript or JavaScript
            if 'lang="ts"' in script_match.group(0) or 'lang="typescript"' in script_match.group(0):
                issues.extend(await self._analyze_typescript(file_path, script_content, script_lines))
            else:
                issues.extend(await self._analyze_javascript(file_path, script_content, script_lines))
        
        # Vue-specific checks
        if not re.search(r'<template>', content):
            issues.append(CodeIssue(
                file=file_path,
                line=1,
                column=None,
                severity=SeverityLevel.HIGH,
                category=IssueCategory.RELIABILITY,
                message="Missing <template> section in Vue component",
                suggestion="Add a template section"
            ))
        
        return issues
    
    async def _analyze_go(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze Go code"""
        issues = []
        
        # Go-specific patterns
        go_patterns = [
            (r'panic\(', "Avoid using panic in production code", SeverityLevel.HIGH),
            (r'fmt\.Print', "Use proper logging instead of fmt.Print", SeverityLevel.LOW),
            (r'if\s+err\s*!=\s*nil\s*{\s*}', "Empty error handling", SeverityLevel.HIGH),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, message, severity in go_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        file=file_path,
                        line=line_num,
                        column=None,
                        severity=severity,
                        category=IssueCategory.RELIABILITY,
                        message=message,
                        code_snippet=line.strip()
                    ))
        
        return issues
    
    async def _analyze_rust(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze Rust code"""
        issues = []
        
        # Rust-specific patterns
        rust_patterns = [
            (r'unwrap\(\)', "Avoid using unwrap() - handle errors properly", SeverityLevel.MEDIUM),
            (r'expect\(', "Consider proper error handling instead of expect()", SeverityLevel.LOW),
            (r'unsafe\s*{', "Unsafe code block detected", SeverityLevel.HIGH),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, message, severity in rust_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        file=file_path,
                        line=line_num,
                        column=None,
                        severity=severity,
                        category=IssueCategory.RELIABILITY if 'unsafe' not in pattern else IssueCategory.SECURITY,
                        message=message,
                        code_snippet=line.strip()
                    ))
        
        return issues
    
    async def _analyze_java(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze Java code"""
        issues = []
        
        # Java-specific patterns
        java_patterns = [
            (r'System\.out\.print', "Use proper logging instead of System.out", SeverityLevel.LOW),
            (r'catch\s*\(\s*Exception\s+\w+\s*\)', "Avoid catching generic Exception", SeverityLevel.MEDIUM),
            (r'@SuppressWarnings', "Avoid suppressing warnings", SeverityLevel.LOW),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, message, severity in java_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        file=file_path,
                        line=line_num,
                        column=None,
                        severity=severity,
                        category=IssueCategory.MAINTAINABILITY,
                        message=message,
                        code_snippet=line.strip()
                    ))
        
        return issues
    
    async def _analyze_cpp(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze C++ code"""
        issues = []
        
        # C++ specific patterns
        cpp_patterns = [
            (r'\bnew\s+', "Consider using smart pointers instead of raw new", SeverityLevel.MEDIUM),
            (r'using\s+namespace\s+std;', "Avoid 'using namespace std' in headers", SeverityLevel.MEDIUM),
            (r'#define\s+', "Consider using const or constexpr instead of #define", SeverityLevel.LOW),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, message, severity in cpp_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        file=file_path,
                        line=line_num,
                        column=None,
                        severity=severity,
                        category=IssueCategory.MAINTAINABILITY,
                        message=message,
                        code_snippet=line.strip()
                    ))
        
        return issues
    
    async def _analyze_c(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Analyze C code"""
        issues = []
        
        # C specific patterns
        c_patterns = [
            (r'gets\(', "Never use gets() - use fgets() instead", SeverityLevel.CRITICAL),
            (r'strcpy\(', "Consider using strncpy() instead of strcpy()", SeverityLevel.HIGH),
            (r'malloc\(.*\)\s*;(?!.*free\()', "Potential memory leak - missing free()", SeverityLevel.HIGH),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, message, severity in c_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        file=file_path,
                        line=line_num,
                        column=None,
                        severity=severity,
                        category=IssueCategory.SECURITY if severity == SeverityLevel.CRITICAL else IssueCategory.RELIABILITY,
                        message=message,
                        code_snippet=line.strip()
                    ))
        
        return issues
    
    def _analyze_generic(self, file_path: str, content: str, lines: List[str]) -> List[CodeIssue]:
        """Generic analysis for unsupported file types"""
        issues = []
        
        # Just do basic checks already done in _check_common_issues
        # Additional generic checks could go here
        
        return issues
    
    def calculate_metrics(self, content: str, lines: List[str]) -> CodeMetrics:
        """Calculate code metrics"""
        metrics = CodeMetrics()
        
        # Count lines
        metrics.lines_of_code = len(lines)
        metrics.blank_lines = sum(1 for line in lines if not line.strip())
        metrics.comment_lines = sum(1 for line in lines if line.strip().startswith(('#', '//', '/*', '*')))
        
        # Try to parse as Python for detailed metrics
        try:
            tree = ast.parse(content)
            
            # Count functions and classes
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    metrics.functions += 1
                    
                    # Calculate complexity for each function
                    func_complexity = self.complexity_analyzer.calculate_cyclomatic_complexity(node)
                    metrics.cyclomatic_complexity += func_complexity
                    
                    func_cognitive = self.complexity_analyzer.calculate_cognitive_complexity(node)
                    metrics.cognitive_complexity += func_cognitive
                    
                    # Calculate Halstead metrics
                    halstead = self.complexity_analyzer.calculate_halstead_metrics(node)
                    metrics.halstead_volume += halstead['volume']
                    metrics.halstead_difficulty += halstead['difficulty']
                    metrics.halstead_effort += halstead['effort']
                    
                elif isinstance(node, ast.ClassDef):
                    metrics.classes += 1
            
            # Calculate max nesting depth
            metrics.max_nesting_depth = self.complexity_analyzer.calculate_nesting_depth(tree)
            
        except:
            # For non-Python files, use simpler heuristics
            # Count complexity keywords
            complexity_keywords = ['if', 'elif', 'else', 'for', 'while', 'except', 'catch', 'case', 'default']
            for line in lines:
                for keyword in complexity_keywords:
                    if re.search(r'\b' + keyword + r'\b', line):
                        metrics.cyclomatic_complexity += 1
        
        # Calculate maintainability index
        # MI = 171 - 5.2 * ln(V) - 0.23 * G - 16.2 * ln(L)
        if metrics.lines_of_code > 0:
            # Use Halstead volume if available, otherwise estimate
            volume = metrics.halstead_volume if metrics.halstead_volume > 0 else metrics.lines_of_code * 2
            metrics.maintainability_index = max(0, min(100, 
                171 - 5.2 * math.log(max(1, volume)) 
                - 0.23 * metrics.cyclomatic_complexity 
                - 16.2 * math.log(max(1, metrics.lines_of_code))))
        
        return metrics
    
    def calculate_review_score(self, issues: List[CodeIssue], metrics: CodeMetrics) -> float:
        """Calculate overall review score (0-100)"""
        score = 100.0
        
        # Deduct points based on issue severity
        severity_penalties = {
            SeverityLevel.CRITICAL: 20,
            SeverityLevel.HIGH: 10,
            SeverityLevel.MEDIUM: 5,
            SeverityLevel.LOW: 2,
            SeverityLevel.INFO: 0
        }
        
        for issue in issues:
            score -= severity_penalties[issue.severity]
        
        # Factor in complexity
        if metrics.cyclomatic_complexity > 30:
            score -= 15
        elif metrics.cyclomatic_complexity > 20:
            score -= 10
        elif metrics.cyclomatic_complexity > 10:
            score -= 5
        
        # Factor in cognitive complexity
        if metrics.cognitive_complexity > 40:
            score -= 15
        elif metrics.cognitive_complexity > 25:
            score -= 10
        elif metrics.cognitive_complexity > 15:
            score -= 5
        
        # Factor in maintainability
        if metrics.maintainability_index < 30:
            score -= 15
        elif metrics.maintainability_index < 50:
            score -= 10
        elif metrics.maintainability_index < 70:
            score -= 5
        
        # Factor in nesting depth
        if metrics.max_nesting_depth > 6:
            score -= 10
        elif metrics.max_nesting_depth > 4:
            score -= 5
        
        # Ensure score is within bounds
        return max(0, min(100, score))
    
    async def review_project(self, project_path: str, file_patterns: Optional[List[str]] = None) -> ReviewResult:
        """Review an entire project"""
        logger.info(f"Reviewing project: {project_path}")
        
        # Default file patterns
        if not file_patterns:
            file_patterns = ['*.py', '*.js', '*.ts', '*.jsx', '*.tsx', '*.vue', 
                           '*.go', '*.rs', '*.java', '*.cpp', '*.c']
        
        all_issues = []
        total_metrics = CodeMetrics()
        files_reviewed = 0
        
        # Find all matching files
        for pattern in file_patterns:
            for file_path in Path(project_path).rglob(pattern):
                # Skip common directories to ignore
                if any(skip in str(file_path) for skip in ['node_modules', '__pycache__', '.git', 'dist', 'build']):
                    continue
                
                # Review the file
                issues = await self.review_file(str(file_path))
                all_issues.extend(issues)
                
                # Calculate metrics
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        lines = content.splitlines()
                        file_metrics = self.calculate_metrics(content, lines)
                        
                        # Aggregate metrics
                        total_metrics.lines_of_code += file_metrics.lines_of_code
                        total_metrics.comment_lines += file_metrics.comment_lines
                        total_metrics.blank_lines += file_metrics.blank_lines
                        total_metrics.cyclomatic_complexity += file_metrics.cyclomatic_complexity
                        total_metrics.cognitive_complexity += file_metrics.cognitive_complexity
                        total_metrics.functions += file_metrics.functions
                        total_metrics.classes += file_metrics.classes
                        total_metrics.code_smells += len([i for i in issues if i.severity in [SeverityLevel.MEDIUM, SeverityLevel.LOW]])
                        total_metrics.max_nesting_depth = max(total_metrics.max_nesting_depth, file_metrics.max_nesting_depth)
                        
                        files_reviewed += 1
                except Exception as e:
                    logger.error(f"Error processing file {file_path}: {e}")
        
        # Calculate average maintainability index
        if files_reviewed > 0:
            total_metrics.maintainability_index = self.calculate_metrics("", []).maintainability_index
        
        # Calculate overall score
        score = self.calculate_review_score(all_issues, total_metrics)
        
        # Generate summary
        critical_issues = len([i for i in all_issues if i.severity == SeverityLevel.CRITICAL])
        high_issues = len([i for i in all_issues if i.severity == SeverityLevel.HIGH])
        
        summary = f"Reviewed {files_reviewed} files. Found {len(all_issues)} issues: "
        summary += f"{critical_issues} critical, {high_issues} high priority. "
        summary += f"Overall score: {score:.1f}/100"
        
        # Generate recommendations
        recommendations = []
        if critical_issues > 0:
            recommendations.append("Address critical security issues immediately")
        if high_issues > 5:
            recommendations.append("Fix high-priority issues before deployment")
        if total_metrics.cyclomatic_complexity / max(1, files_reviewed) > 10:
            recommendations.append("Refactor complex functions to improve maintainability")
        if total_metrics.cognitive_complexity / max(1, files_reviewed) > 15:
            recommendations.append("Simplify complex logic to improve readability")
        if total_metrics.comment_lines / max(1, total_metrics.lines_of_code) < 0.1:
            recommendations.append("Add more documentation and comments")
        if total_metrics.max_nesting_depth > 5:
            recommendations.append("Reduce nesting depth to improve code readability")
        
        # Determine if review passed
        passed = score >= 70 and critical_issues == 0
        
        return ReviewResult(
            files_reviewed=files_reviewed,
            issues=all_issues,
            metrics=total_metrics,
            score=score,
            summary=summary,
            recommendations=recommendations,
            passed=passed
        )
    
    async def process(self, context: AgentContext) -> Dict[str, Any]:
        """Process a code review request"""
        self.context = context
        result = {"status": "success"}
        
        try:
            if self.execution_limiter:
                await self.execution_limiter.check_and_increment(context.session_id)
            
            task = context.current_task
            
            if task.get("action") == "review_file":
                file_path = task.get("file_path")
                issues = await self.review_file(file_path)
                
                # Calculate metrics
                with open(file_path, 'r') as f:
                    content = f.read()
                    lines = content.splitlines()
                    metrics = self.calculate_metrics(content, lines)
                
                score = self.calculate_review_score(issues, metrics)
                
                result.update({
                    "file": file_path,
                    "issues": [
                        {
                            "line": issue.line,
                            "severity": issue.severity.value,
                            "category": issue.category.value,
                            "message": issue.message,
                            "suggestion": issue.suggestion
                        } for issue in issues
                    ],
                    "metrics": {
                        "lines_of_code": metrics.lines_of_code,
                        "cyclomatic_complexity": metrics.cyclomatic_complexity,
                        "cognitive_complexity": metrics.cognitive_complexity,
                        "maintainability_index": metrics.maintainability_index,
                        "max_nesting_depth": metrics.max_nesting_depth
                    },
                    "score": score,
                    "passed": score >= 70 and not any(i.severity == SeverityLevel.CRITICAL for i in issues)
                })
                
            elif task.get("action") == "review_project":
                project_path = task.get("project_path")
                file_patterns = task.get("file_patterns")
                
                review_result = await self.review_project(project_path, file_patterns)
                
                result.update({
                    "files_reviewed": review_result.files_reviewed,
                    "total_issues": len(review_result.issues),
                    "critical_issues": len([i for i in review_result.issues if i.severity == SeverityLevel.CRITICAL]),
                    "high_issues": len([i for i in review_result.issues if i.severity == SeverityLevel.HIGH]),
                    "metrics": {
                        "total_lines": review_result.metrics.lines_of_code,
                        "comment_lines": review_result.metrics.comment_lines,
                        "blank_lines": review_result.metrics.blank_lines,
                        "cyclomatic_complexity": review_result.metrics.cyclomatic_complexity,
                        "cognitive_complexity": review_result.metrics.cognitive_complexity,
                        "maintainability": review_result.metrics.maintainability_index,
                        "code_smells": review_result.metrics.code_smells,
                        "max_nesting_depth": review_result.metrics.max_nesting_depth,
                        "functions": review_result.metrics.functions,
                        "classes": review_result.metrics.classes
                    },
                    "score": review_result.score,
                    "summary": review_result.summary,
                    "recommendations": review_result.recommendations,
                    "passed": review_result.passed
                })
                
            else:
                result["status"] = "error"
                result["error"] = f"Unknown action: {task.get('action')}"
                
        except Exception as e:
            logger.error(f"Error in code review agent: {e}")
            result["status"] = "error"
            result["error"] = str(e)
        
        return result