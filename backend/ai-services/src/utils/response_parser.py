"""
Response Parser for converting AI responses into widget-based JSON
"""

import json
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class WidgetType(Enum):
    """Widget types matching frontend implementation"""
    MCQ = "mcq"
    CHECKBOX = "checkbox"
    TEXT_INPUT = "text_input"
    TEXTAREA = "textarea"
    SELECT = "select"
    RADIO = "radio"
    PROGRESS = "progress"
    CODE_EDITOR = "code_editor"
    FILE_UPLOAD = "file_upload"
    DIAGRAM = "diagram"
    TIMELINE = "timeline"
    DECISION_TREE = "decision_tree"


@dataclass
class Widget:
    """Widget data structure"""
    id: str
    type: str
    config: Dict[str, Any]
    data: Dict[str, Any]
    
    def to_dict(self):
        return asdict(self)


class ResponseParser:
    """Parse AI responses and convert to widget-based JSON"""
    
    def __init__(self):
        self.widget_patterns = {
            'questions': self._detect_questions,
            'options': self._detect_options,
            'code': self._detect_code,
            'steps': self._detect_steps,
            'requirements': self._detect_requirements
        }
    
    def parse_response(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Parse AI text response and convert to structured JSON with widgets
        """
        # Detect the type of response
        response_type = self._detect_response_type(text)
        
        # Generate widgets based on response type
        widgets = self._generate_widgets(text, response_type, context)
        
        # Build structured response
        return {
            "type": "structured_response",
            "widgets": [w.to_dict() for w in widgets],
            "metadata": {
                "response_type": response_type,
                "requires_input": len(widgets) > 0,
                "original_text": text
            }
        }
    
    def _detect_response_type(self, text: str) -> str:
        """Detect what type of response this is"""
        text_lower = text.lower()
        
        if any(q in text_lower for q in ['could you tell me', 'what is', 'what kind of', 'do you have']):
            return 'information_gathering'
        elif 'step' in text_lower or 'approach' in text_lower:
            return 'guidance'
        elif 'code' in text_lower or '```' in text:
            return 'code_example'
        elif any(w in text_lower for w in ['option', 'choice', 'select']):
            return 'selection'
        else:
            return 'general'
    
    def _generate_widgets(self, text: str, response_type: str, context: Optional[Dict[str, Any]] = None) -> List[Widget]:
        """Generate appropriate widgets based on response type"""
        widgets = []
        
        if response_type == 'information_gathering':
            widgets = self._create_information_gathering_widgets(text)
        elif response_type == 'guidance':
            widgets = self._create_guidance_widgets(text)
        elif response_type == 'code_example':
            widgets = self._create_code_widgets(text)
        elif response_type == 'selection':
            widgets = self._create_selection_widgets(text)
        
        return widgets
    
    def _create_information_gathering_widgets(self, text: str) -> List[Widget]:
        """Create widgets for gathering information from user"""
        widgets = []
        widget_id = 0
        
        # Parse the questions from the text
        questions = self._extract_questions(text)
        
        for question in questions:
            widget_id += 1
            
            if 'purpose' in question.lower() or 'idea' in question.lower():
                # Text area for project description
                widgets.append(Widget(
                    id=f"widget_{widget_id}",
                    type=WidgetType.TEXTAREA.value,
                    config={
                        "label": "Project Description",
                        "placeholder": "Describe your application idea and its primary purpose...",
                        "rows": 4,
                        "required": True
                    },
                    data={"question": question}
                ))
                
            elif 'features' in question.lower():
                # Checkbox list for features
                widgets.append(Widget(
                    id=f"widget_{widget_id}",
                    type=WidgetType.CHECKBOX.value,
                    config={
                        "label": "Desired Features",
                        "multiple": True
                    },
                    data={
                        "question": question,
                        "options": [
                            {"id": "auth", "label": "User Authentication", "description": "Login/signup system"},
                            {"id": "realtime", "label": "Real-time Updates", "description": "WebSocket/live data"},
                            {"id": "files", "label": "File Uploads", "description": "Handle user files"},
                            {"id": "api", "label": "REST API", "description": "API endpoints"},
                            {"id": "dashboard", "label": "Admin Dashboard", "description": "Management interface"},
                            {"id": "notifications", "label": "Notifications", "description": "Email/push notifications"},
                            {"id": "search", "label": "Search & Filtering", "description": "Advanced search"},
                            {"id": "payments", "label": "Payment Integration", "description": "Payment processing"}
                        ]
                    }
                ))
                
            elif 'technologies' in question.lower() or 'stack' in question.lower():
                # MCQ for technology stack
                widgets.append(Widget(
                    id=f"widget_{widget_id}",
                    type=WidgetType.MCQ.value,
                    config={
                        "label": "Technology Stack",
                        "multiSection": True
                    },
                    data={
                        "question": question,
                        "sections": [
                            {
                                "title": "Frontend Framework",
                                "options": [
                                    {"id": "react", "label": "React", "description": "Component-based UI library"},
                                    {"id": "vue", "label": "Vue.js", "description": "Progressive framework"},
                                    {"id": "angular", "label": "Angular", "description": "Full-featured framework"},
                                    {"id": "svelte", "label": "Svelte", "description": "Compile-time framework"}
                                ]
                            },
                            {
                                "title": "Backend Framework",
                                "options": [
                                    {"id": "node", "label": "Node.js/Express", "description": "JavaScript runtime"},
                                    {"id": "python", "label": "Python/FastAPI", "description": "Modern Python API"},
                                    {"id": "django", "label": "Django", "description": "Python web framework"},
                                    {"id": "rails", "label": "Ruby on Rails", "description": "Convention over configuration"},
                                    {"id": "spring", "label": "Spring Boot", "description": "Java framework"}
                                ]
                            },
                            {
                                "title": "Database",
                                "options": [
                                    {"id": "postgres", "label": "PostgreSQL", "description": "Relational database"},
                                    {"id": "mongodb", "label": "MongoDB", "description": "Document database"},
                                    {"id": "mysql", "label": "MySQL", "description": "Popular relational DB"},
                                    {"id": "redis", "label": "Redis", "description": "In-memory cache"}
                                ]
                            }
                        ]
                    }
                ))
                
            elif 'experience' in question.lower():
                # Radio buttons for experience level
                widgets.append(Widget(
                    id=f"widget_{widget_id}",
                    type=WidgetType.RADIO.value,
                    config={
                        "label": "Experience Level",
                        "required": True
                    },
                    data={
                        "question": question,
                        "options": [
                            {"id": "beginner", "label": "Beginner", "description": "New to full-stack development"},
                            {"id": "intermediate", "label": "Intermediate", "description": "Some experience with web development"},
                            {"id": "advanced", "label": "Advanced", "description": "Comfortable with full-stack concepts"},
                            {"id": "expert", "label": "Expert", "description": "Experienced professional developer"}
                        ]
                    }
                ))
                
            elif 'challenges' in question.lower() or 'focus' in question.lower():
                # Text input for specific areas
                widgets.append(Widget(
                    id=f"widget_{widget_id}",
                    type=WidgetType.TEXT_INPUT.value,
                    config={
                        "label": "Focus Areas",
                        "placeholder": "e.g., Architecture, Testing, Performance, Security...",
                        "helper": "Enter areas you'd like to focus on"
                    },
                    data={"question": question}
                ))
        
        # Add a submit button widget
        widgets.append(Widget(
            id="submit_button",
            type="action_button",
            config={
                "label": "Start Building",
                "action": "submit_requirements",
                "style": "primary"
            },
            data={}
        ))
        
        return widgets
    
    def _create_guidance_widgets(self, text: str) -> List[Widget]:
        """Create widgets for showing guidance/steps"""
        widgets = []
        
        # Create a timeline widget for steps
        steps = self._extract_steps(text)
        if steps:
            widgets.append(Widget(
                id="guidance_timeline",
                type=WidgetType.TIMELINE.value,
                config={
                    "title": "Development Roadmap"
                },
                data={
                    "steps": [
                        {
                            "id": f"step_{i}",
                            "title": f"Step {i+1}",
                            "description": step,
                            "status": "pending" if i > 0 else "active"
                        }
                        for i, step in enumerate(steps)
                    ]
                }
            ))
        
        return widgets
    
    def _create_code_widgets(self, text: str) -> List[Widget]:
        """Create widgets for code examples"""
        widgets = []
        
        # Extract code blocks
        code_blocks = re.findall(r'```(\w+)?\n(.*?)```', text, re.DOTALL)
        
        for i, (language, code) in enumerate(code_blocks):
            widgets.append(Widget(
                id=f"code_{i}",
                type=WidgetType.CODE_EDITOR.value,
                config={
                    "language": language or "javascript",
                    "readOnly": False,
                    "showLineNumbers": True
                },
                data={
                    "code": code.strip()
                }
            ))
        
        return widgets
    
    def _create_selection_widgets(self, text: str) -> List[Widget]:
        """Create widgets for selection options"""
        widgets = []
        
        # Extract options from text
        options = self._extract_options(text)
        
        if options:
            widgets.append(Widget(
                id="selection_widget",
                type=WidgetType.SELECT.value,
                config={
                    "label": "Choose an option",
                    "placeholder": "Select..."
                },
                data={
                    "options": [
                        {"id": f"opt_{i}", "label": opt}
                        for i, opt in enumerate(options)
                    ]
                }
            ))
        
        return widgets
    
    def _extract_questions(self, text: str) -> List[str]:
        """Extract questions from text"""
        # Split by numbered points or bullet points
        lines = text.split('\n')
        questions = []
        
        for line in lines:
            line = line.strip()
            if line and ('?' in line or line.startswith(('1', '2', '3', '4', '5', '-', '•'))):
                # Clean up the line
                line = re.sub(r'^\d+\.?\s*', '', line)  # Remove numbers
                line = re.sub(r'^[-•]\s*', '', line)    # Remove bullets
                if line:
                    questions.append(line)
        
        return questions
    
    def _extract_steps(self, text: str) -> List[str]:
        """Extract steps from text"""
        steps = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if 'step' in line.lower() or re.match(r'^\d+\.', line):
                steps.append(line)
        
        return steps
    
    def _extract_options(self, text: str) -> List[str]:
        """Extract options from text"""
        options = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if line and (line.startswith(('-', '•', '*')) or re.match(r'^\d+\.', line)):
                option = re.sub(r'^[-•*\d.]\s*', '', line)
                if option:
                    options.append(option)
        
        return options
    
    def _detect_questions(self, text: str) -> bool:
        """Detect if text contains questions"""
        return '?' in text
    
    def _detect_options(self, text: str) -> bool:
        """Detect if text contains options/lists"""
        return bool(re.search(r'^\s*[-•*]\s+', text, re.MULTILINE))
    
    def _detect_code(self, text: str) -> bool:
        """Detect if text contains code"""
        return '```' in text or 'code' in text.lower()
    
    def _detect_steps(self, text: str) -> bool:
        """Detect if text contains steps"""
        return 'step' in text.lower() or bool(re.search(r'^\s*\d+\.', text, re.MULTILINE))
    
    def _detect_requirements(self, text: str) -> bool:
        """Detect if text is asking for requirements"""
        keywords = ['requirement', 'need', 'feature', 'functionality', 'capability']
        return any(kw in text.lower() for kw in keywords)