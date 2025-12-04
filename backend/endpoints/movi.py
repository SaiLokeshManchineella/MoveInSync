"""
Movi API Endpoint
FastAPI routes for Movi AI assistant
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from langchain_core.messages import HumanMessage
from langgraph.types import Command
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from intelligence.graph import app as agent_graph

router = APIRouter(prefix="/movi", tags=["movi"])

class ChatRequest(BaseModel):
    message: str
    session_id: str
    context_page: Optional[str] = "unknown"
    image_base64: Optional[str] = None  # For vision analysis
    audio_base64: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    requires_confirmation: bool = False
    awaiting_confirmation: bool = False
    audio_base64: Optional[str] = None

from fastapi.responses import StreamingResponse
import json

@router.post("/chat")
async def chat_with_movi(request: ChatRequest):
    """
    Handle chat with Movi using LangGraph agent with Human-in-the-Loop support.
    Returns a StreamingResponse with JSON-lines format:
    - {"type": "token", "content": "..."} -> Text chunks
    - {"type": "confirmation", "payload": {...}} -> HITL confirmation request
    - {"type": "error", "content": "..."} -> Errors
    """
    if agent_graph is None:
        raise HTTPException(status_code=503, detail="Movi agent unavailable")

    # Config with thread_id for state persistence
    config = {"configurable": {"thread_id": request.session_id}}
    
    async def event_generator():
        try:
            # Check if there's an ongoing interrupt waiting for resume
            state = agent_graph.get_state(config)
            
            # Determine input for the graph
            if state.next:
                # User is responding to an interrupt/confirmation request
                user_approved = request.message.lower().strip() in [
                    "yes", "y", "proceed", "confirm", "ok", "okay", "yeah", "yep", "sure", "approve"
                ]
                
                # For resume, use invoke instead of astream (more reliable)
                try:
                    # Small delay to ensure state is ready
                    import asyncio
                    await asyncio.sleep(0.1)
                    
                    result = agent_graph.invoke(Command(resume=user_approved), config=config)
                    
                    # Small delay before checking state
                    await asyncio.sleep(0.1)
                    
                    # Get final state after resume
                    final_state_after_resume = agent_graph.get_state(config)
                    
                    # Extract response from result or final state
                    final_response = None
                    
                    # Try result first (invoke returns the final state values)
                    if isinstance(result, dict):
                        if "response" in result:
                            final_response = result["response"]
                        elif "tool_result" in result:
                            # If no response but we have tool_result, generate a simple response
                            tool_result = result["tool_result"]
                            final_response = f"✅ {tool_result}" if user_approved else f"❌ Action cancelled: {tool_result}"
                    
                    # Try final state if result didn't have response
                    if not final_response and final_state_after_resume.values:
                        if "response" in final_state_after_resume.values:
                            final_response = final_state_after_resume.values["response"]
                        elif "tool_result" in final_state_after_resume.values:
                            tool_result = final_state_after_resume.values["tool_result"]
                            final_response = f"✅ {tool_result}" if user_approved else f"❌ Action cancelled: {tool_result}"
                    
                    # Fallback response
                    if not final_response:
                        final_response = "✅ Action completed successfully." if user_approved else "❌ Action cancelled by user."
                    
                    # Stream the response
                    if final_response:
                        chunk_size = 15
                        for i in range(0, len(final_response), chunk_size):
                            chunk = final_response[i:i+chunk_size]
                            yield json.dumps({"type": "token", "content": chunk}) + "\n"
                            import asyncio
                            await asyncio.sleep(0.01)
                    else:
                        yield json.dumps({"type": "error", "content": "No response after resume"}) + "\n"
                    
                    return  # Exit early after resume
                except Exception as resume_error:
                    import traceback
                    traceback.print_exc()
                    yield json.dumps({"type": "error", "content": f"Error resuming: {str(resume_error)}"}) + "\n"
                    return
            else:
                # Normal flow: new conversation
                existing_messages = state.values.get("messages", []) if state.values else []
                if len(existing_messages) > 10:
                    existing_messages = existing_messages[-10:]
                
                input_data = {
                    "user_msg": request.message,
                    "current_page": request.context_page or "unknown",
                    "messages": existing_messages,
                    "image_base64": request.image_base64,
                    "image_content": None,
                    "intent": None,
                    "tool_name": None,
                    "entities": None,
                    "needs_user_input": False,
                    "consequences": None,
                    "awaiting_confirmation": False,
                    "tool_result": None
                }

            # Execute the graph and collect the final response
            # Use astream to execute the graph step by step
            final_response = None
            
            try:
                async for state_update in agent_graph.astream(input_data, config=config):
                    # state_update is a dict where keys are node names
                    # The response node will have the final response
                    if "response" in state_update:
                        node_output = state_update["response"]
                        if isinstance(node_output, dict) and "response" in node_output:
                            final_response = node_output["response"]
            except Exception as stream_error:
                import traceback
                traceback.print_exc()

            # Get final state to check for response or interrupt
            try:
                final_state = agent_graph.get_state(config)
            except Exception as state_error:
                yield json.dumps({"type": "error", "content": f"Error retrieving agent state: {str(state_error)}"}) + "\n"
                return
            
            # IMPORTANT: Check for interrupt FIRST before trying to stream response
            if final_state.next:
                # We are interrupted (HITL) - need to generate AI alert
                # Extract consequence data from interrupt payload
                consequence_data = None
                
                # Try multiple ways to extract interrupt data
                if hasattr(final_state, "tasks") and final_state.tasks:
                    for task in final_state.tasks:
                        if hasattr(task, "interrupts") and task.interrupts:
                            consequence_data = task.interrupts[0].value
                            break
                
                # Alternative: check if consequence_data is in state values
                if not consequence_data and final_state.values:
                    if "consequences" in final_state.values and final_state.values["consequences"]:
                        consequence_data = final_state.values["consequences"]
                
                # Fallback: construct from state if available
                if not consequence_data and final_state.values:
                    tool_name = final_state.values.get("tool_name")
                    entities = final_state.values.get("entities", {})
                    if tool_name:
                        consequence_data = {
                            "type": "confirmation_required",
                            "tool_name": tool_name,
                            "entities": entities,
                            "has_consequences": True,
                            "details": f"Action '{tool_name}' requires confirmation."
                        }
                
                # Generate AI alert based on consequences
                if consequence_data and consequence_data.get("has_consequences"):
                    # Use AI to generate a natural, context-aware confirmation message
                    from langchain_openai import ChatOpenAI
                    
                    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
                    
                    details = consequence_data.get("details", "")
                    tool_name = consequence_data.get("tool_name", "this action")
                    affected_entity = consequence_data.get("affected_entity", "")
                    
                    prompt = f"""You are a helpful assistant generating a confirmation alert for a user action.
                    
The user is about to: {tool_name}
Affected entity: {affected_entity}

Consequences:
{details}

Generate a clear, concise, and friendly confirmation message that:
1. Explains what will happen if they proceed
2. Highlights the key consequences
3. Asks if they want to continue

Keep it under 3-4 sentences. Be direct but respectful."""

                    ai_alert = llm.invoke(prompt).content
                    
                    payload = {
                        "requires_confirmation": True,
                        "message": ai_alert
                    }
                else:
                    # Fallback for tools without specific consequences
                    tool_name = consequence_data.get("tool_name", "this action") if consequence_data else "this action"
                    payload = {
                        "requires_confirmation": True,
                        "message": f"You are about to execute: {tool_name}\n\nDo you want to proceed? (yes/no)"
                    }
                
                yield json.dumps({"type": "confirmation", "payload": payload}) + "\n"
                return  # Exit early when interrupt is detected
            else:
                # No interrupt - check for response in final state
                if not final_response and final_state.values:
                    if "response" in final_state.values:
                        final_response = final_state.values["response"]
                
                # Stream the response if we have one
                if final_response:
                    # Stream in chunks for better UX
                    chunk_size = 15
                    for i in range(0, len(final_response), chunk_size):
                        chunk = final_response[i:i+chunk_size]
                        yield json.dumps({"type": "token", "content": chunk}) + "\n"
                        # Small delay to simulate streaming
                        import asyncio
                        await asyncio.sleep(0.01)
                else:
                    yield json.dumps({"type": "error", "content": "No response generated from agent"}) + "\n"
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield json.dumps({"type": "error", "content": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


# ========== VOICE CHAT TOKEN ==========
class VoiceTokenRequest(BaseModel):
    session_id: str
    context_page: Optional[str] = "busDashboard"


class VoiceTokenResponse(BaseModel):
    token: str
    room_name: str
    url: str


@router.post("/voice/token", response_model=VoiceTokenResponse)
async def get_voice_token(request: VoiceTokenRequest):
    """
    Get LiveKit room token for voice chat.
    
    Creates a room for this session and returns a token for the user to join.
    """
    try:
        from livekit import api
        import os
        
        # Get LiveKit credentials
        livekit_url = os.getenv("LIVEKIT_URL")
        livekit_api_key = os.getenv("LIVEKIT_API_KEY")
        livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")
        
        if not all([livekit_url, livekit_api_key, livekit_api_secret]):
            raise HTTPException(
                status_code=500,
                detail="LiveKit credentials not configured"
            )
        
        # Room name based on session ID
        room_name = f"movi-{request.session_id}"
        
        # Create token with room metadata
        token = api.AccessToken(livekit_api_key, livekit_api_secret) \
            .with_identity(f"user-{request.session_id}") \
            .with_name("Movi User") \
            .with_grants(api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )) \
            .with_metadata(f'{{"context_page": "{request.context_page}", "session_id": "{request.session_id}"}}') \
            .to_jwt()
        
        return VoiceTokenResponse(
            token=token,
            room_name=room_name,
            url=livekit_url
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating voice token: {str(e)}"
        )


# ========== HEALTH CHECK ==========
@router.get("/health")
def movi_health_check():
    """Check if Movi service is running"""
    return {"status": "healthy", "service": "Movi AI Assistant"}
