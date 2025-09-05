"""
Technical Documentation Agent - Agent 2
Converts ideas into comprehensive technical specifications
"""

from typing import Any, Dict, List, Optional, Tuple
import json
import logging
from datetime import datetime
from enum import Enum

from .base import BaseAgent, AgentType, AgentContext, AgentResult, ConversationalAgent

logger = logging.getLogger(__name__)


class DocumentSection(Enum):
    """Standard sections in technical documentation"""
    EXECUTIVE_SUMMARY = "executive_summary"
    PROBLEM_STATEMENT = "problem_statement"
    SOLUTION_OVERVIEW = "solution_overview"
    TECHNICAL_ARCHITECTURE = "technical_architecture"
    DATA_MODEL = "data_model"
    API_DESIGN = "api_design"
    USER_STORIES = "user_stories"
    SECURITY = "security_considerations"
    DEPLOYMENT = "deployment_strategy"
    TESTING = "testing_strategy"
    TIMELINE = "timeline_milestones"
    RISKS = "risks_mitigation"


class DocumentationStage(Enum):
    """Stages of documentation generation"""
    INITIAL = "initial"
    REQUIREMENTS = "requirements_gathering"
    ARCHITECTURE = "architecture_design"
    DETAILED = "detailed_specification"
    REVIEW = "review_refinement"
    FINAL = "final_documentation"


class TechnicalWriterAgent(ConversationalAgent):
    """
    Agent 2: The Technical Documentation Agent
    Transforms project ideas into comprehensive technical specifications
    """
    
    def __init__(self, model=None):
        system_prompt = """You are Agent 2, The Technical Documentation Agent.

Your purpose is to transform project ideas into comprehensive, actionable technical specifications. 
You are meticulous, thorough, and technical, yet able to communicate clearly to various stakeholders.

Core Principles:
1. **Comprehensive Coverage**: Address all aspects of the project
2. **Technical Precision**: Use accurate technical terminology and specifications
3. **Stakeholder Clarity**: Write for developers, managers, and clients
4. **Interactive Refinement**: Guide users through documentation stages

Documentation Process:
1. **Stage 1: Initial Assessment**
   - Understand the project scope
   - Identify key stakeholders
   - Define success criteria

2. **Stage 2: Requirements Gathering**
   - Functional requirements
   - Non-functional requirements
   - Constraints and dependencies

3. **Stage 3: Architecture Design**
   - System architecture
   - Technology choices
   - Integration points

4. **Stage 4: Detailed Specification**
   - Data models
   - API specifications
   - User flows

5. **Stage 5: Review and Refinement**
   - Validate completeness
   - Ensure consistency
   - Final adjustments

You must generate documentation that is:
- **Structured**: Following industry-standard formats
- **Detailed**: Including all necessary technical details
- **Actionable**: Ready for development teams to implement
- **Maintainable**: Easy to update as requirements evolve

Output structured documentation in markdown format with clear sections and subsections."""
        
        super().__init__(
            name="technical_writer",
            agent_type=AgentType.DOCUMENTATION,
            system_prompt=system_prompt,
            model=model
        )
        
        self.current_stage = DocumentationStage.INITIAL
        self.documentation_state = {}
    
    async def execute(self, input_data: Any, context: AgentContext) -> AgentResult:
        """
        Execute the Technical Writer Agent
        
        Args:
            input_data: Project idea or requirements (string or dict)
            context: Execution context with session information
        """
        try:
            # Parse input
            project_info = self._parse_input(input_data)
            
            # Determine documentation stage
            stage = self._determine_stage(project_info, context)
            
            # Generate documentation for current stage
            documentation = await self.generate_documentation(project_info, stage, context)
            
            # Format output with navigation
            output = self.format_documentation(documentation, stage)
            
            return AgentResult(
                success=True,
                output=output,
                metadata={
                    "stage": stage.value,
                    "sections_completed": len(documentation.get("sections", [])),
                    "next_stage": self._get_next_stage(stage).value if self._get_next_stage(stage) else "complete",
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"Technical Writer Agent execution failed: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=str(e)
            )
    
    def _parse_input(self, input_data: Any) -> Dict[str, Any]:
        """Parse input data into structured format"""
        
        if isinstance(input_data, dict):
            return input_data
        
        # Parse string input
        return {
            "description": str(input_data),
            "raw_input": True
        }
    
    def _determine_stage(self, project_info: Dict[str, Any], context: AgentContext) -> DocumentationStage:
        """Determine the current documentation stage"""
        
        # Check if stage is explicitly provided
        if "stage" in project_info:
            try:
                return DocumentationStage(project_info["stage"])
            except ValueError:
                pass
        
        # Check context for previous stage
        if "documentation_stage" in context.variables:
            previous_stage = DocumentationStage(context.variables["documentation_stage"])
            return self._get_next_stage(previous_stage)
        
        # Analyze input completeness to determine stage
        if project_info.get("raw_input"):
            return DocumentationStage.INITIAL
        elif "requirements" in project_info:
            return DocumentationStage.ARCHITECTURE
        elif "architecture" in project_info:
            return DocumentationStage.DETAILED
        else:
            return DocumentationStage.INITIAL
    
    def _get_next_stage(self, current_stage: DocumentationStage) -> Optional[DocumentationStage]:
        """Get the next documentation stage"""
        
        stage_flow = {
            DocumentationStage.INITIAL: DocumentationStage.REQUIREMENTS,
            DocumentationStage.REQUIREMENTS: DocumentationStage.ARCHITECTURE,
            DocumentationStage.ARCHITECTURE: DocumentationStage.DETAILED,
            DocumentationStage.DETAILED: DocumentationStage.REVIEW,
            DocumentationStage.REVIEW: DocumentationStage.FINAL,
            DocumentationStage.FINAL: None
        }
        
        return stage_flow.get(current_stage)
    
    async def generate_documentation(
        self,
        project_info: Dict[str, Any],
        stage: DocumentationStage,
        context: AgentContext
    ) -> Dict[str, Any]:
        """Generate documentation for the current stage"""
        
        if self.model:
            return await self._generate_with_llm(project_info, stage, context)
        else:
            return self._generate_with_templates(project_info, stage)
    
    async def _generate_with_llm(
        self,
        project_info: Dict[str, Any],
        stage: DocumentationStage,
        context: AgentContext
    ) -> Dict[str, Any]:
        """Generate documentation using the language model"""
        
        stage_prompts = {
            DocumentationStage.INITIAL: self._get_initial_prompt,
            DocumentationStage.REQUIREMENTS: self._get_requirements_prompt,
            DocumentationStage.ARCHITECTURE: self._get_architecture_prompt,
            DocumentationStage.DETAILED: self._get_detailed_prompt,
            DocumentationStage.REVIEW: self._get_review_prompt,
            DocumentationStage.FINAL: self._get_final_prompt
        }
        
        prompt_generator = stage_prompts.get(stage, self._get_initial_prompt)
        prompt = prompt_generator(project_info)
        
        try:
            response = await self.model.generate_content_async(prompt)
            return self._parse_llm_response(response.text, stage)
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return self._generate_with_templates(project_info, stage)
    
    def _generate_with_templates(
        self,
        project_info: Dict[str, Any],
        stage: DocumentationStage
    ) -> Dict[str, Any]:
        """Generate documentation using templates"""
        
        generators = {
            DocumentationStage.INITIAL: self._generate_initial_doc,
            DocumentationStage.REQUIREMENTS: self._generate_requirements_doc,
            DocumentationStage.ARCHITECTURE: self._generate_architecture_doc,
            DocumentationStage.DETAILED: self._generate_detailed_doc,
            DocumentationStage.REVIEW: self._generate_review_doc,
            DocumentationStage.FINAL: self._generate_final_doc
        }
        
        generator = generators.get(stage, self._generate_initial_doc)
        return generator(project_info)
    
    def _generate_initial_doc(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate initial documentation assessment"""
        
        description = project_info.get("description", "")
        
        return {
            "title": "Project Technical Specification - Initial Assessment",
            "stage": DocumentationStage.INITIAL.value,
            "sections": [
                {
                    "name": "Executive Summary",
                    "content": f"""## Executive Summary

### Project Overview
{description}

### Documentation Objectives
This technical specification will define:
- Complete system architecture
- Detailed requirements and specifications
- Implementation roadmap
- Testing and deployment strategies

### Key Stakeholders
- Development Team
- Product Management
- Quality Assurance
- Operations/DevOps"""
                },
                {
                    "name": "Problem Statement",
                    "content": f"""## Problem Statement

### Current Situation
Based on the project description, we need to address the following challenges:
- Define clear technical requirements
- Establish system boundaries
- Identify integration points

### Proposed Solution Approach
We will develop a comprehensive solution that:
- Meets all functional requirements
- Ensures scalability and maintainability
- Follows industry best practices"""
                }
            ],
            "questions": [
                "What are the primary business objectives?",
                "Who are the end users of this system?",
                "What are the performance requirements?",
                "Are there any regulatory or compliance requirements?"
            ],
            "next_steps": "Proceed to requirements gathering phase"
        }
    
    def _generate_requirements_doc(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate requirements documentation"""
        
        return {
            "title": "Requirements Specification",
            "stage": DocumentationStage.REQUIREMENTS.value,
            "sections": [
                {
                    "name": "Functional Requirements",
                    "content": """## Functional Requirements

### Core Features
1. **User Management**
   - User registration and authentication
   - Role-based access control
   - Profile management

2. **Data Processing**
   - Input validation
   - Data transformation
   - Output generation

3. **Reporting**
   - Real-time dashboards
   - Scheduled reports
   - Data export capabilities"""
                },
                {
                    "name": "Non-Functional Requirements",
                    "content": """## Non-Functional Requirements

### Performance
- Response time: < 200ms for API calls
- Throughput: 1000 requests per second
- Availability: 99.9% uptime

### Security
- HTTPS/TLS encryption
- JWT-based authentication
- Input sanitization
- Rate limiting

### Scalability
- Horizontal scaling capability
- Load balancing support
- Database sharding ready"""
                },
                {
                    "name": "User Stories",
                    "content": """## User Stories

### As a User
- I want to register an account so that I can access the system
- I want to log in securely so that my data is protected
- I want to view my dashboard so that I can see relevant information

### As an Administrator
- I want to manage users so that I can control access
- I want to view system metrics so that I can monitor performance
- I want to configure settings so that I can customize the system"""
                }
            ],
            "next_steps": "Proceed to architecture design phase"
        }
    
    def _generate_architecture_doc(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate architecture documentation"""
        
        return {
            "title": "System Architecture",
            "stage": DocumentationStage.ARCHITECTURE.value,
            "sections": [
                {
                    "name": "Architecture Overview",
                    "content": """## System Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────┐
│          Frontend (React/Vue)            │
├─────────────────────────────────────────┤
│         API Gateway (Node.js)            │
├─────────────────────────────────────────┤
│     Business Logic (Python/Java)         │
├─────────────────────────────────────────┤
│      Data Layer (PostgreSQL)             │
└─────────────────────────────────────────┘
```

### Architecture Pattern
- Microservices architecture
- RESTful API design
- Event-driven communication
- Container-based deployment"""
                },
                {
                    "name": "Technology Stack",
                    "content": """## Technology Stack

### Frontend
- Framework: React 18 / Vue 3
- State Management: Redux / Pinia
- UI Library: Material-UI / Vuetify
- Build Tool: Vite

### Backend
- Runtime: Node.js 18 LTS
- Framework: Express / Fastify
- Language: TypeScript
- ORM: Prisma / TypeORM

### Database
- Primary: PostgreSQL 14
- Cache: Redis 7
- Search: Elasticsearch (optional)

### Infrastructure
- Container: Docker
- Orchestration: Kubernetes
- CI/CD: GitHub Actions
- Monitoring: Prometheus + Grafana"""
                },
                {
                    "name": "System Components",
                    "content": """## System Components

### API Gateway
- Request routing
- Authentication/Authorization
- Rate limiting
- Request/Response transformation

### Application Services
- User Service: User management and authentication
- Data Service: Core business logic
- Notification Service: Email and push notifications
- Analytics Service: Metrics and reporting

### Data Layer
- Primary database for transactional data
- Cache layer for performance
- Message queue for async processing"""
                }
            ],
            "next_steps": "Proceed to detailed specification phase"
        }
    
    def _generate_detailed_doc(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate detailed specification documentation"""
        
        return {
            "title": "Detailed Technical Specification",
            "stage": DocumentationStage.DETAILED.value,
            "sections": [
                {
                    "name": "Data Model",
                    "content": """## Data Model

### Entity Relationship Diagram
```sql
-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions Table
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Data Table
CREATE TABLE data_entries (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    content JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```"""
                },
                {
                    "name": "API Specification",
                    "content": """## API Specification

### Authentication Endpoints

#### POST /api/auth/register
```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response (201):
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "jwt-token"
}
```

#### POST /api/auth/login
```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response (200):
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "jwt-token"
}
```

### Data Endpoints

#### GET /api/data
- Description: Retrieve user data
- Auth: Required (Bearer token)
- Query params: page, limit, sort

#### POST /api/data
- Description: Create new data entry
- Auth: Required (Bearer token)
- Body: JSON data object"""
                },
                {
                    "name": "Security Specifications",
                    "content": """## Security Specifications

### Authentication & Authorization
- JWT-based authentication
- Token expiration: 24 hours
- Refresh token mechanism
- Role-based access control (RBAC)

### Data Protection
- Passwords hashed with bcrypt (12 rounds)
- Sensitive data encrypted at rest
- TLS 1.3 for data in transit
- Input validation and sanitization

### Security Headers
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security"""
                }
            ],
            "next_steps": "Proceed to review and refinement phase"
        }
    
    def _generate_review_doc(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate review and validation documentation"""
        
        return {
            "title": "Documentation Review",
            "stage": DocumentationStage.REVIEW.value,
            "sections": [
                {
                    "name": "Completeness Check",
                    "content": """## Documentation Completeness Review

### Sections Completed
- ✅ Executive Summary
- ✅ Problem Statement
- ✅ Requirements (Functional & Non-functional)
- ✅ System Architecture
- ✅ Technology Stack
- ✅ Data Model
- ✅ API Specification
- ✅ Security Considerations

### Validation Checklist
- [ ] All requirements are documented
- [ ] Architecture supports all use cases
- [ ] API contracts are complete
- [ ] Security measures are adequate
- [ ] Performance requirements are achievable"""
                },
                {
                    "name": "Risk Assessment",
                    "content": """## Risk Assessment

### Technical Risks
1. **Scalability Challenges**
   - Risk: System may not scale as expected
   - Mitigation: Load testing, horizontal scaling design

2. **Security Vulnerabilities**
   - Risk: Potential security breaches
   - Mitigation: Security audit, penetration testing

3. **Integration Complexity**
   - Risk: Third-party integration issues
   - Mitigation: Thorough API testing, fallback mechanisms"""
                }
            ],
            "questions": [
                "Are there any missing requirements?",
                "Do the technical choices align with team expertise?",
                "Are the timelines realistic?"
            ],
            "next_steps": "Finalize documentation"
        }
    
    def _generate_final_doc(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate final comprehensive documentation"""
        
        return {
            "title": "Final Technical Specification",
            "stage": DocumentationStage.FINAL.value,
            "sections": [
                {
                    "name": "Complete Documentation",
                    "content": """## Final Technical Specification

This document represents the complete technical specification for the project.

### Document Version
- Version: 1.0.0
- Date: {datetime.utcnow().isoformat()}
- Status: Final

### Approval
- Technical Lead: [Pending]
- Product Manager: [Pending]
- Stakeholders: [Pending]"""
                },
                {
                    "name": "Implementation Timeline",
                    "content": """## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- Environment setup
- Database schema implementation
- Basic authentication

### Phase 2: Core Features (Weeks 3-6)
- API development
- Frontend implementation
- Integration testing

### Phase 3: Enhancement (Weeks 7-8)
- Performance optimization
- Security hardening
- Documentation

### Phase 4: Deployment (Week 9)
- Production deployment
- Monitoring setup
- Launch preparation"""
                },
                {
                    "name": "Success Criteria",
                    "content": """## Success Criteria

### Functional Success
- All documented features implemented
- All user stories satisfied
- Acceptance tests passing

### Performance Success
- Response times meet requirements
- System handles expected load
- 99.9% uptime achieved

### Quality Success
- Code coverage > 80%
- No critical security vulnerabilities
- Documentation complete and accurate"""
                }
            ],
            "next_steps": "Ready for implementation"
        }
    
    def format_documentation(self, documentation: Dict[str, Any], stage: DocumentationStage) -> Dict[str, Any]:
        """Format documentation with proper structure and navigation"""
        
        # Combine sections into markdown document
        markdown_content = f"# {documentation['title']}\n\n"
        
        for section in documentation.get("sections", []):
            markdown_content += f"{section['content']}\n\n"
        
        # Add navigation and metadata
        output = {
            "documentation": markdown_content,
            "stage": stage.value,
            "stage_name": stage.name.replace("_", " ").title(),
            "progress": self._calculate_progress(stage),
            "sections": [s["name"] for s in documentation.get("sections", [])],
            "questions": documentation.get("questions", []),
            "next_steps": documentation.get("next_steps", "Documentation complete"),
            "actions": self._get_stage_actions(stage)
        }
        
        return output
    
    def _calculate_progress(self, stage: DocumentationStage) -> int:
        """Calculate documentation progress percentage"""
        
        progress_map = {
            DocumentationStage.INITIAL: 15,
            DocumentationStage.REQUIREMENTS: 30,
            DocumentationStage.ARCHITECTURE: 50,
            DocumentationStage.DETAILED: 70,
            DocumentationStage.REVIEW: 85,
            DocumentationStage.FINAL: 100
        }
        
        return progress_map.get(stage, 0)
    
    def _get_stage_actions(self, stage: DocumentationStage) -> List[Dict[str, str]]:
        """Get available actions for current stage"""
        
        actions = [
            {"action": "continue", "label": "Continue to Next Stage"},
            {"action": "refine", "label": "Refine Current Section"},
            {"action": "export", "label": "Export Documentation"}
        ]
        
        if stage == DocumentationStage.FINAL:
            actions = [
                {"action": "export", "label": "Export Final Documentation"},
                {"action": "approve", "label": "Mark as Approved"},
                {"action": "revise", "label": "Request Revisions"}
            ]
        
        return actions
    
    def _get_initial_prompt(self, project_info: Dict[str, Any]) -> str:
        """Generate prompt for initial stage"""
        return f"""Create an initial technical documentation assessment for:
{project_info.get('description', '')}

Include executive summary and problem statement."""
    
    def _get_requirements_prompt(self, project_info: Dict[str, Any]) -> str:
        """Generate prompt for requirements stage"""
        return f"""Generate detailed requirements documentation including:
- Functional requirements
- Non-functional requirements
- User stories
- Acceptance criteria

For project: {project_info.get('description', '')}"""
    
    def _get_architecture_prompt(self, project_info: Dict[str, Any]) -> str:
        """Generate prompt for architecture stage"""
        return f"""Design system architecture including:
- High-level architecture diagram
- Technology stack selection
- Component breakdown
- Integration points

For project: {project_info.get('description', '')}"""
    
    def _get_detailed_prompt(self, project_info: Dict[str, Any]) -> str:
        """Generate prompt for detailed specification stage"""
        return f"""Create detailed technical specifications including:
- Complete data model
- API specifications
- Security implementation
- Error handling

For project: {project_info.get('description', '')}"""
    
    def _get_review_prompt(self, project_info: Dict[str, Any]) -> str:
        """Generate prompt for review stage"""
        return f"""Review and validate the documentation for completeness:
- Check all requirements are covered
- Validate technical feasibility
- Identify risks and mitigation strategies

For project: {project_info.get('description', '')}"""
    
    def _get_final_prompt(self, project_info: Dict[str, Any]) -> str:
        """Generate prompt for final documentation"""
        return f"""Finalize the technical documentation with:
- Implementation timeline
- Success criteria
- Deployment strategy
- Maintenance plan

For project: {project_info.get('description', '')}"""
    
    def _parse_llm_response(self, response: str, stage: DocumentationStage) -> Dict[str, Any]:
        """Parse LLM response into structured documentation"""
        
        # Basic parsing - can be enhanced
        sections = []
        current_section = None
        current_content = []
        
        for line in response.split('\n'):
            if line.startswith('##'):
                if current_section:
                    sections.append({
                        "name": current_section,
                        "content": '\n'.join(current_content)
                    })
                current_section = line.replace('#', '').strip()
                current_content = [line]
            elif current_section:
                current_content.append(line)
        
        # Add last section
        if current_section:
            sections.append({
                "name": current_section,
                "content": '\n'.join(current_content)
            })
        
        return {
            "title": f"Technical Documentation - {stage.name}",
            "stage": stage.value,
            "sections": sections if sections else [{"name": "Content", "content": response}],
            "next_steps": f"Continue to {self._get_next_stage(stage).name}" if self._get_next_stage(stage) else "Complete"
        }