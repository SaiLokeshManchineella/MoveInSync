from typing import TypedDict, List
from langchain_core.messages import BaseMessage


class FleetAgentState(TypedDict):
    # raw user input
    user_msg: str
    current_page: str
    
    # chat history for LLM
    messages: List[BaseMessage]
    
    # image analysis (optional)
    image_base64: str | None       # Input: base64 encoded image from frontend
    image_content: str | None      # Output: LLM's description/analysis of the image

    # intent classification
    intent: str | None
    tool_name: str | None
    entities: dict | None

    # missing info / next-step requirements
    needs_user_input: bool         # <---- new and important

    # consequence / confirmation flags
    consequences: dict | None
    awaiting_confirmation: bool

    # results
    tool_result: dict | None
