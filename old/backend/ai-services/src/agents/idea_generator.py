"""
Idea Generation Agent - Agent 1
Transforms vague concepts into structured project ideas
"""

from typing import Any, Dict, List, Optional
import json
import logging
from datetime import datetime
from enum import Enum

from .base import BaseAgent, AgentType, AgentContext, AgentResult, ConversationalAgent

logger = logging.getLogger(__name__)


class IdeaComplexity(Enum):
    """Complexity levels for generated ideas"""
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    ENTERPRISE = "enterprise"


class IdeaCategory(Enum):
    """Categories for project ideas"""
    WEB_APP = "web_application"
    MOBILE_APP = "mobile_application"
    API_SERVICE = "api_service"
    DATA_PIPELINE = "data_pipeline"
    AUTOMATION = "automation"
    AI_ML = "ai_ml"
    BLOCKCHAIN = "blockchain"
    IOT = "iot"
    GAME = "game"
    TOOL = "developer_tool"


class IdeaGeneratorAgent(ConversationalAgent):
    """
    Agent 1: The Idea Generation Agent
    Transforms vague concepts into structured, actionable project ideas
    """
    
    def __init__(self, model=None):
        system_prompt = """You are Agent 1, The Idea Generation Agent.

Your purpose is to transform vague, incomplete, or ambitious ideas into structured, actionable project concepts. 
You are creative yet practical, innovative yet grounded in reality.

Core Principles:
1. **Clarify and Expand**: Take simple ideas and expand them into comprehensive concepts
2. **Multiple Perspectives**: Generate variations to give users options
3. **Practical Feasibility**: Balance innovation with implementation reality
4. **User-Centric**: Always consider the end-user experience

When generating ideas, you must:

1. **Understand the Core Intent**
   - Extract the fundamental problem being solved
   - Identify the target audience
   - Recognize constraints and requirements

2. **Generate Structured Ideas**
   - Provide clear project titles
   - Write compelling descriptions
   - Define core features
   - Identify technical requirements
   - Estimate complexity and timeline

3. **Offer Variations**
   - Minimum Viable Product (MVP) version
   - Standard implementation
   - Advanced/Enterprise version

4. **Ask Clarifying Questions**
   - What specific problem are you solving?
   - Who is your target audience?
   - What is your technical expertise level?
   - What is your timeline and budget?

Output Format:
{
    "ideas": [
        {
            "title": "Project Title",
            "category": "Category",
            "description": "Detailed description",
            "core_features": ["Feature 1", "Feature 2"],
            "technical_stack": ["Tech 1", "Tech 2"],
            "complexity": "simple|moderate|complex",
            "estimated_time": "X weeks/months",
            "target_audience": "Description",
            "unique_value": "What makes this special"
        }
    ],
    "questions": ["Clarifying question 1", "Question 2"],
    "recommendations": "Overall recommendation"
}"""
        
        super().__init__(
            name="idea_generator",
            agent_type=AgentType.CREATIVE,
            system_prompt=system_prompt,
            model=model
        )
        
        self.idea_templates = self._load_idea_templates()
    
    async def execute(self, input_data: str, context: AgentContext) -> AgentResult:
        """
        Execute the Idea Generator Agent
        
        Args:
            input_data: User's raw idea or concept
            context: Execution context
        """
        try:
            # Validate input
            if not input_data or len(input_data.strip()) < 3:
                return AgentResult(
                    success=False,
                    output=None,
                    error="Please provide a more detailed description of your idea"
                )
            
            # Analyze the input to determine category and complexity
            analysis = await self.analyze_idea(input_data, context)
            
            # Generate structured ideas
            ideas = await self.generate_ideas(input_data, analysis, context)
            
            # Format the output
            output = self.format_ideas(ideas, analysis)
            
            return AgentResult(
                success=True,
                output=output,
                metadata={
                    "idea_count": len(ideas),
                    "primary_category": analysis.get("category"),
                    "complexity": analysis.get("complexity"),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"Idea Generator Agent execution failed: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=str(e)
            )
    
    async def analyze_idea(self, input_data: str, context: AgentContext) -> Dict[str, Any]:
        """Analyze the input to understand intent and requirements"""
        
        # Simple keyword-based analysis (can be enhanced with NLP)
        analysis = {
            "category": self._determine_category(input_data),
            "complexity": self._estimate_complexity(input_data),
            "keywords": self._extract_keywords(input_data),
            "has_technical_details": self._has_technical_details(input_data),
            "is_specific": len(input_data.split()) > 10
        }
        
        return analysis
    
    async def generate_ideas(
        self,
        input_data: str,
        analysis: Dict[str, Any],
        context: AgentContext
    ) -> List[Dict[str, Any]]:
        """Generate structured project ideas"""
        
        ideas = []
        
        if self.model:
            # Use LLM to generate ideas
            ideas = await self._generate_with_llm(input_data, analysis, context)
        else:
            # Use template-based generation
            ideas = self._generate_from_templates(input_data, analysis)
        
        # Always generate at least 3 variations
        if len(ideas) < 3:
            ideas.extend(self._generate_variations(ideas[0] if ideas else None, analysis))
        
        return ideas[:5]  # Limit to 5 ideas maximum
    
    async def _generate_with_llm(
        self,
        input_data: str,
        analysis: Dict[str, Any],
        context: AgentContext
    ) -> List[Dict[str, Any]]:
        """Generate ideas using the language model"""
        
        prompt = f"""
Based on this idea: "{input_data}"

Analysis:
- Category: {analysis['category']}
- Complexity: {analysis['complexity']}
- Keywords: {', '.join(analysis['keywords'])}

Generate 3 structured project ideas with variations (MVP, Standard, Advanced).
Include specific features, technical requirements, and implementation details.
Format as JSON with the structure defined in your system prompt.
"""
        
        try:
            response = await self.model.generate_content_async(prompt)
            
            # Parse the response
            import re
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result.get("ideas", [])
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
        
        # Fallback to template generation
        return self._generate_from_templates(input_data, analysis)
    
    def _generate_from_templates(
        self,
        input_data: str,
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate ideas from predefined templates"""
        
        category = analysis['category']
        complexity = analysis['complexity']
        
        ideas = []
        
        # MVP Version
        ideas.append({
            "title": f"MVP: {self._generate_title(input_data, 'MVP')}",
            "category": category,
            "description": f"A minimal implementation focusing on core functionality: {input_data}",
            "core_features": self._get_mvp_features(category),
            "technical_stack": self._get_tech_stack(category, "simple"),
            "complexity": "simple",
            "estimated_time": "2-4 weeks",
            "target_audience": "Early adopters and beta testers",
            "unique_value": "Quick to market, validates core concept"
        })
        
        # Standard Version
        ideas.append({
            "title": f"{self._generate_title(input_data, 'Standard')}",
            "category": category,
            "description": f"A full-featured implementation with polished user experience: {input_data}",
            "core_features": self._get_standard_features(category),
            "technical_stack": self._get_tech_stack(category, "moderate"),
            "complexity": "moderate",
            "estimated_time": "2-3 months",
            "target_audience": "General users seeking a complete solution",
            "unique_value": "Balance of features and development time"
        })
        
        # Advanced Version
        ideas.append({
            "title": f"Enterprise: {self._generate_title(input_data, 'Advanced')}",
            "category": category,
            "description": f"An enterprise-grade solution with advanced features and scalability: {input_data}",
            "core_features": self._get_advanced_features(category),
            "technical_stack": self._get_tech_stack(category, "complex"),
            "complexity": "complex",
            "estimated_time": "4-6 months",
            "target_audience": "Enterprise clients and power users",
            "unique_value": "Comprehensive solution with enterprise features"
        })
        
        return ideas
    
    def _generate_variations(
        self,
        base_idea: Optional[Dict[str, Any]],
        analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate variations of a base idea"""
        
        variations = []
        
        if not base_idea:
            base_idea = {
                "title": "Innovative Solution",
                "category": analysis['category'],
                "core_features": ["Core Feature 1", "Core Feature 2"]
            }
        
        # Different focus variations
        focuses = ["mobile-first", "API-centric", "AI-powered"]
        
        for focus in focuses:
            variation = base_idea.copy()
            variation["title"] = f"{focus.title()} {base_idea['title']}"
            variation["unique_value"] = f"Specialized {focus} approach"
            variations.append(variation)
        
        return variations
    
    def format_ideas(self, ideas: List[Dict[str, Any]], analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Format the generated ideas for output"""
        
        # Generate clarifying questions based on analysis
        questions = self._generate_questions(analysis)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(ideas, analysis)
        
        return {
            "ideas": ideas,
            "questions": questions,
            "recommendations": recommendations,
            "metadata": {
                "total_ideas": len(ideas),
                "primary_category": analysis['category'],
                "complexity_range": f"{ideas[0]['complexity']} to {ideas[-1]['complexity']}" if ideas else "N/A"
            }
        }
    
    def _determine_category(self, input_data: str) -> str:
        """Determine project category from input"""
        
        input_lower = input_data.lower()
        
        category_keywords = {
            IdeaCategory.WEB_APP.value: ["website", "web", "portal", "dashboard", "frontend"],
            IdeaCategory.MOBILE_APP.value: ["mobile", "app", "ios", "android", "phone"],
            IdeaCategory.API_SERVICE.value: ["api", "service", "backend", "rest", "graphql"],
            IdeaCategory.DATA_PIPELINE.value: ["data", "pipeline", "etl", "analytics", "processing"],
            IdeaCategory.AUTOMATION.value: ["automate", "workflow", "bot", "script", "task"],
            IdeaCategory.AI_ML.value: ["ai", "ml", "machine learning", "neural", "prediction"],
            IdeaCategory.BLOCKCHAIN.value: ["blockchain", "crypto", "smart contract", "defi"],
            IdeaCategory.IOT.value: ["iot", "sensor", "device", "embedded", "arduino"],
            IdeaCategory.GAME.value: ["game", "gaming", "play", "entertainment"],
            IdeaCategory.TOOL.value: ["tool", "utility", "cli", "developer", "productivity"]
        }
        
        for category, keywords in category_keywords.items():
            if any(keyword in input_lower for keyword in keywords):
                return category
        
        return IdeaCategory.WEB_APP.value  # Default
    
    def _estimate_complexity(self, input_data: str) -> str:
        """Estimate project complexity from input"""
        
        word_count = len(input_data.split())
        
        complex_keywords = ["enterprise", "scalable", "distributed", "real-time", "ml", "ai", "blockchain"]
        simple_keywords = ["simple", "basic", "mvp", "prototype", "demo"]
        
        input_lower = input_data.lower()
        
        if any(keyword in input_lower for keyword in complex_keywords):
            return IdeaComplexity.COMPLEX.value
        elif any(keyword in input_lower for keyword in simple_keywords):
            return IdeaComplexity.SIMPLE.value
        elif word_count > 20:
            return IdeaComplexity.COMPLEX.value
        elif word_count > 10:
            return IdeaComplexity.MODERATE.value
        else:
            return IdeaComplexity.SIMPLE.value
    
    def _extract_keywords(self, input_data: str) -> List[str]:
        """Extract key terms from input"""
        
        # Simple keyword extraction (can be enhanced with NLP)
        stop_words = {"a", "an", "the", "is", "it", "and", "or", "but", "for", "with", "to", "that"}
        words = input_data.lower().split()
        keywords = [w for w in words if w not in stop_words and len(w) > 3]
        
        return list(set(keywords))[:10]
    
    def _has_technical_details(self, input_data: str) -> bool:
        """Check if input contains technical specifications"""
        
        tech_terms = ["api", "database", "frontend", "backend", "react", "python", "node", "docker"]
        return any(term in input_data.lower() for term in tech_terms)
    
    def _generate_title(self, input_data: str, variant: str) -> str:
        """Generate a project title"""
        
        # Extract first few meaningful words
        words = [w for w in input_data.split()[:5] if len(w) > 2]
        base_title = " ".join(words).title()
        
        if len(base_title) > 30:
            base_title = base_title[:30] + "..."
        
        return base_title
    
    def _get_mvp_features(self, category: str) -> List[str]:
        """Get MVP features for a category"""
        
        features_map = {
            IdeaCategory.WEB_APP.value: [
                "User registration and login",
                "Basic dashboard",
                "Core functionality",
                "Responsive design"
            ],
            IdeaCategory.API_SERVICE.value: [
                "RESTful endpoints",
                "Basic authentication",
                "Core data operations",
                "JSON responses"
            ]
        }
        
        return features_map.get(category, ["Core feature 1", "Core feature 2", "Basic UI"])
    
    def _get_standard_features(self, category: str) -> List[str]:
        """Get standard features for a category"""
        
        mvp = self._get_mvp_features(category)
        additional = [
            "Advanced user management",
            "Analytics dashboard",
            "API integrations",
            "Email notifications",
            "Data export/import"
        ]
        
        return mvp + additional[:3]
    
    def _get_advanced_features(self, category: str) -> List[str]:
        """Get advanced features for a category"""
        
        standard = self._get_standard_features(category)
        enterprise = [
            "Multi-tenancy support",
            "Advanced security (SSO, 2FA)",
            "Audit logging",
            "Custom workflows",
            "API rate limiting",
            "Horizontal scaling",
            "Real-time collaboration"
        ]
        
        return standard + enterprise[:4]
    
    def _get_tech_stack(self, category: str, complexity: str) -> List[str]:
        """Get appropriate tech stack"""
        
        stacks = {
            ("web_application", "simple"): ["HTML/CSS", "JavaScript", "SQLite"],
            ("web_application", "moderate"): ["React", "Node.js", "PostgreSQL", "Redis"],
            ("web_application", "complex"): ["React", "Node.js", "PostgreSQL", "Redis", "Docker", "Kubernetes"],
            ("api_service", "simple"): ["FastAPI", "SQLite"],
            ("api_service", "moderate"): ["FastAPI", "PostgreSQL", "Redis", "Docker"],
            ("api_service", "complex"): ["FastAPI", "PostgreSQL", "Redis", "RabbitMQ", "Kubernetes"]
        }
        
        default = ["Python", "PostgreSQL", "Docker"]
        return stacks.get((category, complexity), default)
    
    def _generate_questions(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate clarifying questions"""
        
        questions = []
        
        if not analysis['is_specific']:
            questions.append("What specific problem are you trying to solve?")
        
        if not analysis['has_technical_details']:
            questions.append("Do you have any technical preferences or constraints?")
        
        questions.extend([
            "Who is your primary target audience?",
            "What is your expected timeline for this project?",
            "Are there any existing solutions you'd like to improve upon?"
        ])
        
        return questions[:3]
    
    def _generate_recommendations(self, ideas: List[Dict[str, Any]], analysis: Dict[str, Any]) -> str:
        """Generate recommendations based on ideas and analysis"""
        
        if analysis['complexity'] == IdeaComplexity.SIMPLE.value:
            return "Start with the MVP version to validate your concept quickly. You can always add features based on user feedback."
        elif analysis['complexity'] == IdeaComplexity.COMPLEX.value:
            return "Consider breaking this into phases. Start with core features and gradually add complexity based on user needs and resources."
        else:
            return "The standard implementation provides a good balance of features and development time. Consider your specific requirements to choose the right approach."
    
    def _load_idea_templates(self) -> Dict[str, Any]:
        """Load predefined idea templates"""
        
        return {
            "templates": {
                "web_app": {
                    "features": ["User management", "Dashboard", "Data visualization"],
                    "stack": ["React", "Node.js", "PostgreSQL"]
                },
                "api_service": {
                    "features": ["RESTful API", "Authentication", "Rate limiting"],
                    "stack": ["FastAPI", "PostgreSQL", "Redis"]
                }
            }
        }