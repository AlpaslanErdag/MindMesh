from app.agents.coder import CoderAgent
from app.agents.critic import CriticAgent
from app.agents.planner import PlannerAgent
from app.agents.researcher import ResearcherAgent
from app.agents.summarizer import SummarizerAgent

AGENT_REGISTRY: dict[str, type] = {
    "planner": PlannerAgent,
    "researcher": ResearcherAgent,
    "coder": CoderAgent,
    "critic": CriticAgent,
    "summarizer": SummarizerAgent,
}
