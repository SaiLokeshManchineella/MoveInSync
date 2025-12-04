from langchain_openai import ChatOpenAI
from intelligence.nodes import request_analyzer_node, reply_generator_node, safety_validator_node, action_executor_node
from intelligence.tools import ALL_TOOLS
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from intelligence.state import FleetAgentState
from dotenv import load_dotenv
import os

load_dotenv()

# Configure LangSmith tracing
# Supports both old and new environment variable formats
# Old format (for compatibility):
#   LANGCHAIN_TRACING_V2=true
#   LANGCHAIN_API_KEY=your_langsmith_api_key
#   LANGCHAIN_PROJECT=MoveInSync
# New format (preferred for newer versions):
#   LANGSMITH_TRACING=true
#   LANGSMITH_API_KEY=your_langsmith_api_key
#   LANGSMITH_PROJECT=MoveInSync

# Check for tracing enabled (either format)
langsmith_tracing = (
    os.getenv("LANGSMITH_TRACING", "").lower() == "true" or
    os.getenv("LANGCHAIN_TRACING_V2", "").lower() == "true"
)

# Get API key (either format)
langsmith_api_key = os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY")

# Get project name (either format)
langsmith_project = os.getenv("LANGSMITH_PROJECT") or os.getenv("LANGCHAIN_PROJECT", "MoveInSync")

if langsmith_tracing and langsmith_api_key:
    # Set both formats for maximum compatibility
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = langsmith_api_key
    os.environ["LANGSMITH_API_KEY"] = langsmith_api_key
    if langsmith_project:
        os.environ["LANGCHAIN_PROJECT"] = langsmith_project
        os.environ["LANGSMITH_PROJECT"] = langsmith_project


def create_fleet_agent_graph(llm, ALL_TOOLS):
    """
    Builds the Movi agent graph with LangGraph's interrupt mechanism.
    
    The graph now uses interrupt() in the safety_validator_node to pause execution
    and wait for human approval. No separate confirmation nodes needed.
    """

    graph = StateGraph(dict)

    # 1. Add nodes
    graph.add_node("request_analyzer", lambda s: request_analyzer_node(s, llm, ALL_TOOLS))
    graph.add_node("safety_validator", safety_validator_node)
    graph.add_node("action_executor", lambda s: action_executor_node(s, ALL_TOOLS))
    graph.add_node("reply_generator", lambda s: reply_generator_node(s, llm))

    # 2. Entry → Request Analyzer
    graph.set_entry_point("request_analyzer")

    # 3. Request Analyzer → Safety Validator (check for high-impact tools)
    graph.add_edge("request_analyzer", "safety_validator")

    # 4. Safety Validator → Action Executor
    # Note: If safety_validator_node calls interrupt(), execution pauses here
    # The interrupt() returns when user calls graph.invoke(Command(resume=...))
    graph.add_edge("safety_validator", "action_executor")

    # 5. Action Executor → Reply Generator
    graph.add_edge("action_executor", "reply_generator")

    # 6. Final node
    graph.set_finish_point("reply_generator")

    # 7. Compile with checkpointer for interrupt support
    # MemorySaver is for development - use a durable checkpointer in production
    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)

# Initialize LLM and build the graph
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
app = create_fleet_agent_graph(llm, ALL_TOOLS)