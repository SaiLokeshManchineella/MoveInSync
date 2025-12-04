from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langgraph.types import interrupt, Command
import json
from intelligence.tools import ALL_TOOLS, get_tools_for_page
from database import SessionLocal
from database import get_db
from intelligence.state import FleetAgentState

def request_analyzer_node(state, llm, ALL_TOOLS):
    """
    First Node: Request Analysis and Intent Classification

    Inputs in state:
        - user_msg
        - current_page
        - messages (history)

    Outputs added to state:
        - intent
        - tool_name
        - entities
        - messages (updated)
    """

    user_msg = state["user_msg"]
    current_page = state["current_page"]
    image_base64 = state.get("image_base64")  # Optional image input

    # Initialize history if missing
    messages = state.get("messages", [])
    if messages is None:
        messages = []
    
    # ---- Image Analysis (if provided) ----
    if image_base64:
        # Use GPT-4o (full model) for better vision and OCR capabilities
        vision_llm = ChatOpenAI(model="gpt-4o", temperature=0)
        
        vision_message = HumanMessage(
            content=[
                {
                    "type": "text", 
                    "text": """Analyze this image carefully and extract ALL text and information visible.

Pay special attention to:
1. ANY highlighted, circled, or marked items (these are MOST IMPORTANT)
2. Trip names, IDs, and identifiers
3. Status indicators (SCHEDULED, IN-PROGRESS, UNKNOWN, etc.)
4. Booking percentages
5. Times and schedules
6. Any arrows or visual emphasis

Provide a detailed description focusing on what the user wants to highlight or draw attention to. If there are circles, arrows, or highlighting, mention those items FIRST and PROMINENTLY."""
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                }
            ]
        )
        
        # Call vision-capable LLM (gpt-4o for better OCR)
        vision_response = vision_llm.invoke([vision_message])
        image_description = vision_response.content
        
        # Store the text description and clear the base64 (save memory)
        state["image_content"] = image_description
        state["image_base64"] = None  # Clear base64 after processing
        
        # Append image analysis to user message
        user_msg = f"{user_msg}\n\n[Image Analysis: {image_description}]"
    else:
        state["image_content"] = None

    # 1. Add user message to chat history
    messages.append(HumanMessage(content=user_msg))

    # 2. Prepare tool descriptions
    # Filter tools based on current page context
    available_tools = get_tools_for_page(current_page)
    
    tool_descriptions = "\n".join([
        f"- {tool.name}: {tool.description}"
        for tool in available_tools
    ])

    # 3. System prompt for LLM - conditionally include image instructions
    if image_base64 or state.get("image_content"):
        # Include image-specific instructions only when image is present
        system_prompt = f"""
You are Movi's request analyzer.

You receive:
- user_msg: the user's query (includes image analysis)
- current_page: UI context
- available tools

IMPORTANT: The user message includes [Image Analysis: ...]. Pay VERY CLOSE ATTENTION to:
- Items that are highlighted, circled, or marked with arrows
- Trip names that are emphasized or visually called out
- These highlighted items are what the user wants to work with

Your job:
1. Identify the user's intent.
2. Select EXACT tool_name matching the tools list.
3. Extract entities (dict) - prioritize highlighted/emphasized items from images.

Respond ONLY with JSON:

{{
  "intent": "...",
  "tool_name": "...",
  "entities": {{ ... }}
}}

Current Page: {current_page}

Available Tools:
{tool_descriptions}
"""
    else:
        # Standard prompt without image instructions
        system_prompt = f"""
You are Movi's request analyzer.

You receive:
- user_msg: the user's query
- current_page: UI context
- available tools

Your job:
1. Identify the user's intent.
2. Select EXACT tool_name matching the tools list.
3. Extract entities (dict).

Respond ONLY with JSON:

{{
  "intent": "...",
  "tool_name": "...",
  "entities": {{ ... }}
}}

Current Page: {current_page}

Available Tools:
{tool_descriptions}
"""

    # 4. LLM input
    llm_messages = [
        SystemMessage(content=system_prompt),
        *messages
    ]

    # 5. Call the LLM
    llm_response = llm.invoke(llm_messages)

    # 6. Parse safely
    try:
        parsed = json.loads(llm_response.content)
    except Exception:
        parsed = {"intent": None, "tool_name": None, "entities": {}}

    # 7. Update state
    state["intent"] = parsed.get("intent")
    state["tool_name"] = parsed.get("tool_name")
    state["entities"] = parsed.get("entities", {})

    # 8. Update chat history
    messages.append(AIMessage(content=llm_response.content))
    state["messages"] = messages

    return state



from sqlalchemy.orm import Session

# import your DB session + models + check functions
from database import SessionLocal
from models import DailyTrip, Route
from intelligence.tools import (
    check_trip_consequences,
    check_route_deactivation_consequences,
    check_path_deletion_consequences,
)

# High-impact tool list (tools that require user confirmation)
HIGH_IMPACT_TOOLS = {
    "remove_vehicle_from_trip",
    "update_route_status",
    "update_route",
    "update_trip",
    "delete_trip",
    "delete_deployment",
    "delete_path",
}


# Helper function: Extract entity value by multiple possible keys
def _extract_entity_value(entities, possible_keys, default=None):
    """Extract entity value using multiple possible key names."""
    for key in possible_keys:
        if key in entities and entities[key]:
            return entities[key]
    return default

# Helper function: Determine consequence checker based on tool type
def _get_consequence_checker(tool_name):
    """Map tool names to their corresponding consequence checker functions."""
    consequence_checkers = {
        "remove_vehicle_from_trip": check_trip_consequences,
        "delete_trip": check_trip_consequences,
        "update_route_status": check_route_deactivation_consequences,
        "update_route": check_route_deactivation_consequences,
        "delete_path": check_path_deletion_consequences,
    }
    return consequence_checkers.get(tool_name)

# Helper function: Fetch consequences from database
def _fetch_consequence_details(tool_name, entities, db):
    """Fetch detailed consequences from database for high-impact actions."""
    # Map tool to entity extraction keys
    tool_entity_mapping = {
        "remove_vehicle_from_trip": (["trip_display_name", "trip_name", "trip"], "trip"),
        "delete_trip": (["trip_display_name", "trip_name", "trip"], "trip"),
        "update_route_status": (["route_display_name", "route_name", "route"], "route"),
        "update_route": (["route_display_name", "route_name", "route"], "route"),
        "delete_path": (["path_name", "path"], "path"),
    }
    
    keys, entity_type = tool_entity_mapping.get(tool_name, ([], None))
    entity_value = _extract_entity_value(entities, keys)
    
    if not entity_value:
        return None
    
    # Get appropriate checker function
    checker_func = _get_consequence_checker(tool_name)
    if not checker_func:
        return None
    
    # Execute consequence check
    try:
        result = checker_func(entity_value, db)
        if result.get("has_consequences"):
            return {
                "has_consequences": True,
                "details": result.get("details"),
                "tool_name": tool_name,
                "affected_entity": entity_value,
                "entity_type": entity_type
            }
    except Exception:
        # If check fails, still require confirmation
        pass
    
    return None

# Helper function: Handle user rejection
def _handle_user_rejection(state):
    """Process user rejection of high-impact action."""
    state["tool_name"] = None
    state["tool_result"] = "Action cancelled by user."
    state["consequences"] = None
    state["awaiting_confirmation"] = False
    return state

def safety_validator_node(state):
    """
    Safety Validator Node - Validates high-impact actions and requires user confirmation.
    
    Process:
    1. Initialize state flags
    2. Check if tool requires validation
    3. Fetch consequence details from database
    4. Trigger interrupt for user confirmation
    5. Handle user response (approve/reject)
    """
    
    # Initialize state
    state["consequences"] = None
    state["awaiting_confirmation"] = False
    
    tool_name = state.get("tool_name")
    entities = state.get("entities", {})

    # Skip validation for non-high-impact tools
    if tool_name not in HIGH_IMPACT_TOOLS:
        return state

    # Fetch consequence details from database
    db: Session = SessionLocal()
    consequence_data = None
    
    try:
        consequence_data = _fetch_consequence_details(tool_name, entities, db)
    except Exception:
        # On error, still require confirmation but without details
        consequence_data = None
    finally:
        db.close()

    # Store consequences in state
    state["consequences"] = consequence_data
    
    # Prepare interrupt payload
    interrupt_payload = consequence_data if consequence_data else {
        "type": "confirmation_required",
        "tool_name": tool_name,
        "entities": entities
    }
    
    # Trigger interrupt for user confirmation
    user_approved = interrupt(interrupt_payload)

    # Process user response
    if not user_approved:
        return _handle_user_rejection(state)

    # User approved - continue execution
    state["awaiting_confirmation"] = False
    return state


# Helper function: Create tool registry for faster lookup
def _build_tool_registry(ALL_TOOLS):
    """Build a dictionary mapping tool names to tool objects for O(1) lookup."""
    return {tool.name: tool for tool in ALL_TOOLS}

# Helper function: Normalize entity names to match tool parameter expectations
def _normalize_entity_parameters(entities):
    """
    Normalize entity parameter names to match tool expectations.
    Maps common variations to standard parameter names.
    """
    normalized = entities.copy() if entities else {}
    
    # Parameter name mapping rules
    param_mappings = [
        (["trip_name", "trip"], "trip_display_name"),
        (["route_name", "route"], "route_display_name"),
        (["path_name", "path"], "path_name"),
    ]
    
    for source_names, target_name in param_mappings:
        # Only map if target doesn't already exist
        if target_name not in normalized:
            for source_name in source_names:
                if source_name in normalized:
                    normalized[target_name] = normalized.pop(source_name)
                    break
    
    return normalized

# Helper function: Validate tool execution prerequisites
def _validate_tool_execution(tool_name, tool_registry):
    """Validate that tool exists and can be executed."""
    if not tool_name:
        return None, "No tool specified for execution"
    
    tool = tool_registry.get(tool_name)
    if tool is None:
        return None, f"Tool '{tool_name}' not found in registry"
    
    return tool, None

def action_executor_node(state, ALL_TOOLS):
    """
    Action Executor Node - Executes tools with validation and error handling.
    
    Process:
    1. Build tool registry for efficient lookup
    2. Validate tool exists
    3. Normalize entity parameters
    4. Execute tool with error handling
    5. Store result in state
    """
    
    # Initialize result
    state["tool_result"] = None
    tool_name = state.get("tool_name")
    entities = state.get("entities", {})

    # Early return if no tool specified
    if not tool_name:
        return state

    # Build tool registry (could be cached, but keeping it simple for now)
    tool_registry = _build_tool_registry(ALL_TOOLS)
    
    # Validate tool exists
    tool, validation_error = _validate_tool_execution(tool_name, tool_registry)
    if validation_error:
        state["tool_result"] = f"Validation Error: {validation_error}"
        return state

    # Normalize entity parameters
    normalized_entities = _normalize_entity_parameters(entities)
    
    # Execute tool with comprehensive error handling
    try:
        execution_result = tool.invoke(normalized_entities)
        state["tool_result"] = execution_result
    except TypeError as type_error:
        # Handle parameter mismatch errors
        state["tool_result"] = f"Parameter Error: Tool '{tool_name}' received invalid parameters. {str(type_error)}"
    except Exception as execution_error:
        # Handle general execution errors
        state["tool_result"] = f"Execution Error: Tool '{tool_name}' failed. {str(execution_error)}"
    
    return state


# NOTE: confirmation_response_node and human_confirmation_node have been removed
# They are replaced by the interrupt() mechanism in consequence_node
# The interrupt() pauses execution and waits for Command(resume=True/False)


from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

def reply_generator_node(state, llm):
    """
    Final Reply Generator Node
    Uses the LLM to generate the assistant's final reply to the user.

    Input State:
        - messages (chat history)
        - tool_result (optional)
        - consequences (optional)
        - current_page
        - intent

    Output:
        - LLM reply appended to state.messages
        - state["response"] (string)
    """

    messages = state.get("messages", [])

    # 1. Build system instructions
    system_prompt = f"""
You are Movi, the MoveInSync internal admin assistant.
Generate a clear, helpful response for the user.

Available Info:
- Current Page: {state.get("current_page")}
- Last Intent: {state.get("intent")}
- Tool Result: {state.get("tool_result")}
- Consequences: {state.get("consequences")}

Rules:
- If tool_result exists, summarize it naturally.
- If consequences exist AND awaiting_confirmation is False (user cancelled), summarize cancellation.
- Be clear and to the point.
- The answer should be Structured
- No JSON, only natural language.
    """

    # 2. Build LLM messages
    llm_messages = [
        SystemMessage(content=system_prompt),
        *messages
    ]

    # 3. Invoke LLM
    output = llm.invoke(llm_messages)

    # 4. Save final assistant message
    assistant_msg = AIMessage(content=output.content)
    messages.append(assistant_msg)

    state["messages"] = messages
    state["response"] = output.content

    return state
