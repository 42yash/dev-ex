"""
Agent Darwin - Evolution and Optimization System
Monitors agent performance and evolves their prompts and behaviors
"""

import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import asyncio
from datetime import datetime, timedelta
import statistics
import random

from .base import BaseAgent, AgentContext, AgentStatus, AgentType
from .execution_limiter import ExecutionLimiter
from ..config import Config

logger = logging.getLogger(__name__)


class EvolutionStrategy(Enum):
    """Evolution strategies for agent optimization"""
    MUTATION = "mutation"  # Random small changes
    CROSSOVER = "crossover"  # Combine successful patterns
    REINFORCEMENT = "reinforcement"  # Learn from feedback
    PRUNING = "pruning"  # Remove ineffective parts
    EXPANSION = "expansion"  # Add new capabilities


@dataclass
class PromptVersion:
    """Version of an agent's prompt"""
    version_id: str
    agent_id: str
    prompt_template: str
    performance_score: float = 0.0
    success_rate: float = 0.0
    average_time: float = 0.0
    usage_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "agent_id": self.agent_id,
            "prompt_template": self.prompt_template,
            "performance_score": self.performance_score,
            "success_rate": self.success_rate,
            "average_time": self.average_time,
            "usage_count": self.usage_count,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata
        }


@dataclass
class PerformanceMetrics:
    """Performance metrics for an agent"""
    agent_id: str
    task_completion_rate: float = 0.0
    error_rate: float = 0.0
    average_response_time: float = 0.0
    quality_score: float = 0.0
    user_satisfaction: float = 0.0
    resource_usage: float = 0.0
    collaboration_score: float = 0.0
    samples: List[float] = field(default_factory=list)
    
    def calculate_overall_score(self) -> float:
        """Calculate overall performance score"""
        weights = {
            "completion": 0.3,
            "quality": 0.25,
            "speed": 0.15,
            "satisfaction": 0.2,
            "efficiency": 0.1
        }
        
        # Normalize speed (lower is better)
        speed_score = max(0, 1 - (self.average_response_time / 60))  # Normalize to 60 seconds
        
        # Calculate weighted score
        score = (
            weights["completion"] * self.task_completion_rate +
            weights["quality"] * self.quality_score +
            weights["speed"] * speed_score +
            weights["satisfaction"] * self.user_satisfaction +
            weights["efficiency"] * (1 - self.resource_usage)
        )
        
        return min(1.0, max(0.0, score))


@dataclass
class EvolutionCandidate:
    """Candidate for evolution"""
    agent_id: str
    current_prompt: str
    proposed_prompt: str
    strategy: EvolutionStrategy
    expected_improvement: float
    risk_level: str  # low, medium, high
    

class AgentDarwin(BaseAgent):
    """
    Agent Darwin - Evolves and optimizes other agents based on performance
    """
    
    def __init__(self, config: Config, execution_limiter: Optional[ExecutionLimiter] = None):
        super().__init__(
            name="agent_darwin",
            agent_type=AgentType.META,
            system_prompt="""You are Agent Darwin, the evolution system of the Dev-Ex AI ecosystem.
            Your role is to monitor agent performance, identify patterns of success and failure,
            and evolve agent prompts and configurations to improve overall system performance.
            You use evolutionary algorithms to optimize the agent ecosystem.""",
            model=None,  # We'll use specialized logic
            config={}
        )
        self.agent_id = "agent-darwin"  # Store separately
        self.config = config
        self.execution_limiter = execution_limiter
        
        self.prompt_versions: Dict[str, List[PromptVersion]] = {}
        self.performance_history: Dict[str, PerformanceMetrics] = {}
        self.evolution_candidates: List[EvolutionCandidate] = []
        self.learning_rate = 0.1
        self.mutation_rate = 0.2
        self.evolution_threshold = 0.7  # Minimum performance to avoid evolution
        
    async def monitor_agent_performance(self, agent_id: str, execution_result: Dict[str, Any]) -> PerformanceMetrics:
        """Monitor and record agent performance"""
        logger.info(f"Monitoring performance for agent {agent_id}")
        
        # Get or create metrics
        if agent_id not in self.performance_history:
            self.performance_history[agent_id] = PerformanceMetrics(agent_id=agent_id)
        
        metrics = self.performance_history[agent_id]
        
        # Update metrics based on execution result
        success = execution_result.get("status") == "success"
        execution_time = execution_result.get("execution_time", 30.0)
        error_occurred = execution_result.get("error") is not None
        
        # Update running averages
        metrics.samples.append(1.0 if success else 0.0)
        if len(metrics.samples) > 100:  # Keep last 100 samples
            metrics.samples.pop(0)
        
        metrics.task_completion_rate = statistics.mean(metrics.samples)
        metrics.average_response_time = (metrics.average_response_time * 0.9 + execution_time * 0.1)
        metrics.error_rate = (metrics.error_rate * 0.9 + (1.0 if error_occurred else 0.0) * 0.1)
        
        # Estimate quality score (would need actual quality metrics in production)
        metrics.quality_score = max(0.5, metrics.task_completion_rate * 0.8 + random.uniform(-0.1, 0.1))
        
        # Calculate overall score
        overall_score = metrics.calculate_overall_score()
        
        logger.info(f"Agent {agent_id} performance: {overall_score:.2f} (completion: {metrics.task_completion_rate:.2f})")
        
        return metrics
    
    def analyze_performance_trends(self, agent_id: str) -> Dict[str, Any]:
        """Analyze performance trends for an agent"""
        if agent_id not in self.performance_history:
            return {"status": "no_data", "message": "No performance data available"}
        
        metrics = self.performance_history[agent_id]
        
        # Calculate trend (improving, stable, declining)
        if len(metrics.samples) < 10:
            trend = "insufficient_data"
        else:
            recent = statistics.mean(metrics.samples[-10:])
            older = statistics.mean(metrics.samples[-20:-10]) if len(metrics.samples) >= 20 else metrics.samples[0]
            
            if recent > older + 0.1:
                trend = "improving"
            elif recent < older - 0.1:
                trend = "declining"
            else:
                trend = "stable"
        
        return {
            "agent_id": agent_id,
            "overall_score": metrics.calculate_overall_score(),
            "trend": trend,
            "completion_rate": metrics.task_completion_rate,
            "average_time": metrics.average_response_time,
            "samples_count": len(metrics.samples)
        }
    
    async def generate_prompt_variation(self, current_prompt: str, strategy: EvolutionStrategy, context: AgentContext) -> str:
        """Generate a variation of a prompt using the specified strategy"""
        logger.info(f"Generating prompt variation using {strategy.value} strategy")
        
        if strategy == EvolutionStrategy.MUTATION:
            # Small random changes
            mutation_prompt = f"""
            Make small improvements to the following prompt while keeping its core functionality:
            
            Current Prompt:
            {current_prompt}
            
            Improvements to consider:
            1. Clarity and conciseness
            2. Better error handling instructions
            3. More specific output format requirements
            4. Enhanced context awareness
            
            Return the improved prompt only, no explanations.
            """
            
        elif strategy == EvolutionStrategy.EXPANSION:
            # Add new capabilities
            mutation_prompt = f"""
            Expand the following prompt with additional capabilities while maintaining backward compatibility:
            
            Current Prompt:
            {current_prompt}
            
            Consider adding:
            1. Edge case handling
            2. Additional output options
            3. Performance optimization hints
            4. Better collaboration instructions
            
            Return the expanded prompt only, no explanations.
            """
            
        elif strategy == EvolutionStrategy.PRUNING:
            # Remove ineffective parts
            mutation_prompt = f"""
            Simplify the following prompt by removing redundant or ineffective parts:
            
            Current Prompt:
            {current_prompt}
            
            Focus on:
            1. Removing redundancy
            2. Simplifying complex instructions
            3. Keeping only essential requirements
            4. Improving readability
            
            Return the simplified prompt only, no explanations.
            """
            
        else:
            # Default to reinforcement learning
            mutation_prompt = f"""
            Optimize the following prompt based on successful patterns:
            
            Current Prompt:
            {current_prompt}
            
            Optimization goals:
            1. Increase success rate
            2. Reduce response time
            3. Improve output quality
            4. Enhance reliability
            
            Return the optimized prompt only, no explanations.
            """
        
        response = await self._call_llm(mutation_prompt, context)
        return response.strip()
    
    def select_evolution_strategy(self, metrics: PerformanceMetrics) -> EvolutionStrategy:
        """Select the best evolution strategy based on current performance"""
        score = metrics.calculate_overall_score()
        
        if score < 0.3:
            # Poor performance - try major changes
            return EvolutionStrategy.EXPANSION
        elif score < 0.5:
            # Below average - try mutations
            return EvolutionStrategy.MUTATION
        elif score < 0.7:
            # Average - try pruning
            return EvolutionStrategy.PRUNING
        elif metrics.error_rate > 0.2:
            # High error rate - reinforce successful patterns
            return EvolutionStrategy.REINFORCEMENT
        else:
            # Good performance - small mutations only
            return EvolutionStrategy.MUTATION
    
    async def evolve_agent(self, agent_id: str, current_prompt: str, context: AgentContext) -> EvolutionCandidate:
        """Evolve an agent's prompt based on performance"""
        logger.info(f"Evolving agent {agent_id}")
        
        # Get performance metrics
        metrics = self.performance_history.get(agent_id)
        if not metrics:
            logger.warning(f"No performance data for agent {agent_id}")
            return None
        
        # Check if evolution is needed
        score = metrics.calculate_overall_score()
        if score > self.evolution_threshold:
            logger.info(f"Agent {agent_id} performing well (score: {score:.2f}), skipping evolution")
            return None
        
        # Select evolution strategy
        strategy = self.select_evolution_strategy(metrics)
        
        # Generate prompt variation
        proposed_prompt = await self.generate_prompt_variation(current_prompt, strategy, context)
        
        # Estimate improvement (simplified - would need A/B testing in production)
        expected_improvement = random.uniform(0.05, 0.25) * (1 - score)
        
        # Determine risk level
        if strategy in [EvolutionStrategy.EXPANSION, EvolutionStrategy.CROSSOVER]:
            risk_level = "high"
        elif strategy == EvolutionStrategy.MUTATION:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        candidate = EvolutionCandidate(
            agent_id=agent_id,
            current_prompt=current_prompt,
            proposed_prompt=proposed_prompt,
            strategy=strategy,
            expected_improvement=expected_improvement,
            risk_level=risk_level
        )
        
        self.evolution_candidates.append(candidate)
        
        logger.info(f"Created evolution candidate for {agent_id} with {strategy.value} strategy")
        return candidate
    
    def create_prompt_version(self, agent_id: str, prompt: str) -> PromptVersion:
        """Create a new prompt version"""
        import uuid
        
        version = PromptVersion(
            version_id=str(uuid.uuid4()),
            agent_id=agent_id,
            prompt_template=prompt
        )
        
        if agent_id not in self.prompt_versions:
            self.prompt_versions[agent_id] = []
        
        self.prompt_versions[agent_id].append(version)
        
        logger.info(f"Created prompt version {version.version_id} for agent {agent_id}")
        return version
    
    def update_prompt_performance(self, agent_id: str, version_id: str, success: bool, execution_time: float):
        """Update performance metrics for a prompt version"""
        if agent_id not in self.prompt_versions:
            return
        
        for version in self.prompt_versions[agent_id]:
            if version.version_id == version_id:
                version.usage_count += 1
                version.success_rate = (version.success_rate * (version.usage_count - 1) + (1.0 if success else 0.0)) / version.usage_count
                version.average_time = (version.average_time * (version.usage_count - 1) + execution_time) / version.usage_count
                version.performance_score = version.success_rate * 0.7 + (1 - min(version.average_time / 60, 1)) * 0.3
                
                logger.info(f"Updated prompt version {version_id} performance: {version.performance_score:.2f}")
                break
    
    def get_best_prompt_version(self, agent_id: str) -> Optional[PromptVersion]:
        """Get the best performing prompt version for an agent"""
        if agent_id not in self.prompt_versions or not self.prompt_versions[agent_id]:
            return None
        
        # Filter versions with sufficient usage
        valid_versions = [v for v in self.prompt_versions[agent_id] if v.usage_count >= 5]
        
        if not valid_versions:
            # Return most recent if no version has enough usage
            return self.prompt_versions[agent_id][-1]
        
        # Return best performing version
        return max(valid_versions, key=lambda v: v.performance_score)
    
    async def _call_llm(self, prompt: str, context: AgentContext) -> str:
        """Mock LLM call for testing - returns sensible defaults"""
        # In production, this would call the actual LLM
        # For now, return mock evolution suggestions
        return json.dumps({
            "strategy": "expansion",
            "suggestions": [
                "Add more specific error handling",
                "Include examples in responses",
                "Be more concise in explanations"
            ],
            "reasoning": "Agent performance shows room for improvement in error handling"
        })
    
    async def optimize_collaboration(self, agent_ids: List[str], context: AgentContext) -> Dict[str, Any]:
        """Optimize collaboration between multiple agents"""
        logger.info(f"Optimizing collaboration between {len(agent_ids)} agents")
        
        prompt = f"""
        Analyze and optimize collaboration between the following agents:
        {json.dumps(agent_ids, indent=2)}
        
        Consider:
        1. Communication protocols
        2. Data handoff formats
        3. Parallel vs sequential execution
        4. Dependency management
        5. Conflict resolution
        
        Provide optimization recommendations in JSON format.
        """
        
        response = await self._call_llm(prompt, context)
        
        try:
            recommendations = self._extract_json(response)
            return {
                "status": "success",
                "agents": agent_ids,
                "recommendations": recommendations
            }
        except:
            return {
                "status": "error",
                "message": "Failed to generate collaboration optimizations"
            }
    
    async def execute(self, input_data: str, context: AgentContext) -> Dict[str, Any]:
        """Execute Agent Darwin's evolution process"""
        logger.info(f"Agent Darwin executing for session {context.session_id}")
        
        # Parse input to determine action
        try:
            data = json.loads(input_data) if input_data.startswith("{") else {"action": "analyze", "target": input_data}
        except:
            data = {"action": "analyze", "target": input_data}
        
        action = data.get("action", "analyze")
        
        if action == "monitor":
            # Monitor specific agent
            agent_id = data.get("agent_id")
            execution_result = data.get("result", {})
            metrics = await self.monitor_agent_performance(agent_id, execution_result)
            
            return {
                "status": "success",
                "agent": self.name,
                "action": "monitor",
                "metrics": {
                    "agent_id": agent_id,
                    "overall_score": metrics.calculate_overall_score(),
                    "completion_rate": metrics.task_completion_rate,
                    "average_time": metrics.average_response_time
                }
            }
            
        elif action == "evolve":
            # Evolve specific agent
            agent_id = data.get("agent_id")
            current_prompt = data.get("prompt", "")
            
            candidate = await self.evolve_agent(agent_id, current_prompt, context)
            
            if candidate:
                return {
                    "status": "success",
                    "agent": self.name,
                    "action": "evolve",
                    "candidate": {
                        "agent_id": candidate.agent_id,
                        "strategy": candidate.strategy.value,
                        "expected_improvement": candidate.expected_improvement,
                        "risk_level": candidate.risk_level,
                        "new_prompt": candidate.proposed_prompt
                    }
                }
            else:
                return {
                    "status": "success",
                    "agent": self.name,
                    "action": "evolve",
                    "message": f"Agent {agent_id} performing well, no evolution needed"
                }
                
        elif action == "optimize_collaboration":
            # Optimize multi-agent collaboration
            agent_ids = data.get("agent_ids", [])
            result = await self.optimize_collaboration(agent_ids, context)
            
            return {
                "status": "success",
                "agent": self.name,
                "action": "optimize_collaboration",
                "result": result
            }
            
        else:
            # Analyze all agents
            analysis = {}
            for agent_id in self.performance_history:
                analysis[agent_id] = self.analyze_performance_trends(agent_id)
            
            return {
                "status": "success",
                "agent": self.name,
                "action": "analyze",
                "analysis": analysis,
                "evolution_candidates": len(self.evolution_candidates),
                "message": f"Analyzed {len(analysis)} agents"
            }
    
    def get_evolution_report(self) -> Dict[str, Any]:
        """Generate a comprehensive evolution report"""
        report = {
            "total_agents_monitored": len(self.performance_history),
            "total_prompt_versions": sum(len(versions) for versions in self.prompt_versions.values()),
            "evolution_candidates": len(self.evolution_candidates),
            "agents_performance": {}
        }
        
        for agent_id, metrics in self.performance_history.items():
            report["agents_performance"][agent_id] = {
                "overall_score": metrics.calculate_overall_score(),
                "trend": self.analyze_performance_trends(agent_id)["trend"],
                "best_prompt_version": None
            }
            
            best_version = self.get_best_prompt_version(agent_id)
            if best_version:
                report["agents_performance"][agent_id]["best_prompt_version"] = {
                    "version_id": best_version.version_id,
                    "performance_score": best_version.performance_score,
                    "success_rate": best_version.success_rate
                }
        
        return report