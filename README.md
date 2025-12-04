# MoveInSync Backend API

A FastAPI-based backend service with LangGraph AI agent for fleet management operations. Features RESTful APIs, WebSocket support, and an intelligent AI assistant with human-in-the-loop capabilities.

---
🔗 #Live Demo

##Deploy Link:

http://13.126.22.77:8080


## Architecture

### Overall System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  React + TypeScript (Vite)                                  │
│  - Dashboard UI                                              │
│  - Movi AI Chat Interface                                   │
│  - Voice Chat Component                                      │
│  - Route Maps (Mapbox)                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST + WebSocket
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  FastAPI (Python)                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ REST API     │  │ WebSocket    │  │ LangGraph    │      │
│  │ Endpoints    │  │ Voice Chat   │  │ AI Agent     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE                                  │
│  SQLite (Development) / PostgreSQL (Production)             │
│  SQLAlchemy ORM                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

- **Frontend**: React + TypeScript application with real-time chat and voice capabilities
- **Backend**: FastAPI REST API with WebSocket support for voice chat
- **AI Agent**: LangGraph-based agent with 4-node architecture and human-in-the-loop
- **Database**: SQLAlchemy ORM with SQLite (dev) or PostgreSQL (production)
- **External Services**: OpenAI (GPT-4o, Whisper, TTS), Mapbox, LiveKit, LangSmith

---

## LangGraph Graph Explanation

### Graph Architecture

The LangGraph agent uses a **4-node linear architecture** with an **interrupt mechanism** for human-in-the-loop (HITL) confirmation. Unlike traditional conditional edges, this system uses LangGraph's `interrupt()` function to pause execution and wait for user approval.

```
┌─────────────────────────────────────────────────────────────┐
│                    LangGraph Agent Flow                      │
└─────────────────────────────────────────────────────────────┘

    START
      │
      ▼
┌─────────────────────────────────────┐
│  1. REQUEST ANALYZER NODE            │
│  - Receives user input (text/image) │
│  - Analyzes intent using GPT-4o      │
│  - Extracts entities                 │
│  - Selects tool from 26 available   │
│  - Handles multimodal input          │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. SAFETY VALIDATOR NODE            │
│  - Checks if tool is high-impact     │
│  - Fetches consequences from DB     │
│  - Calls interrupt() if needed      │
│  ⚠️ EXECUTION PAUSES HERE            │
│  - Waits for user confirmation      │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. ACTION EXECUTOR NODE             │
│  - Executes selected tool            │
│  - Performs database operations      │
│  - Returns tool result               │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. REPLY GENERATOR NODE             │
│  - Generates natural language        │
│  - Uses GPT-4o-mini                  │
│  - Provides user-friendly response  │
└──────────────┬────────────────────────┘
               │
               ▼
            END NODE
    (State saved to checkpointer)
```

### Agent State (FleetAgentState)

The agent state is a TypedDict that flows through all nodes, maintaining conversation context and execution state:

```python
class FleetAgentState(TypedDict):
    # User Input
    user_msg: str                    # Raw user message
    current_page: str                # UI context (busDashboard, routes, etc.)
    messages: List[BaseMessage]      # Chat history for LLM context
    
    # Multimodal Support
    image_base64: str | None         # Base64 encoded image (input)
    image_content: str | None        # LLM's analysis of image (output)
    
    # Intent Classification (from Request Analyzer)
    intent: str | None               # Classified intent
    tool_name: str | None            # Selected tool name
    entities: dict | None             # Extracted entities (trip names, etc.)
    
    # User Input Requirements
    needs_user_input: bool           # Flag if more info needed
    
    # Consequence & Confirmation (from Safety Validator)
    consequences: dict | None        # Consequence details from DB
    awaiting_confirmation: bool     # Whether waiting for user approval
    
    # Execution Results (from Action Executor)
    tool_result: dict | None         # Tool execution result
```

**State Flow:**
- **Request Analyzer** populates: `intent`, `tool_name`, `entities`, `image_content`
- **Safety Validator** populates: `consequences`, `awaiting_confirmation`
- **Action Executor** populates: `tool_result`
- **Reply Generator** uses all state to generate response

### Main Nodes

#### 1. Request Analyzer Node

**Purpose**: Intent classification, entity extraction, and tool selection

**Process**:
1. Receives `user_msg`, `current_page`, and optional `image_base64`
2. **Multimodal Handling**: If image provided, uses GPT-4o for vision analysis
   - Extracts text via OCR
   - Identifies highlighted/circled items
   - Analyzes visual emphasis (arrows, circles)
3. Filters available tools based on `current_page` context
4. Uses GPT-4o-mini to classify intent and extract entities
5. Selects appropriate tool from 26 available tools
6. Updates state with `tool_name`, `entities`, `intent`

**Key Features**:
- **Page-aware tool filtering**: Only shows relevant tools for current UI page
- **Vision support**: GPT-4o analyzes images for OCR and visual emphasis
- **Entity normalization**: Handles variations in entity names

#### 2. Safety Validator Node

**Purpose**: Validates high-impact actions and implements "Tribal Knowledge" flow

**Process**:
1. Checks if `tool_name` is in `HIGH_IMPACT_TOOLS` set
2. If high-impact:
   - Fetches real consequences from database
   - Prepares interrupt payload with consequence details
   - **Calls `interrupt(interrupt_payload)`** - **EXECUTION PAUSES**
3. Frontend receives confirmation request
4. User responds with "yes"/"no"
5. Graph resumes with `Command(resume=True/False)`
6. If approved: continues to Action Executor
7. If rejected: cancels action, updates state

**High-Impact Tools** (require confirmation):
- `remove_vehicle_from_trip`
- `delete_trip`
- `update_route_status`
- `update_route`
- `delete_path`

**Tribal Knowledge Implementation**:
- Checks actual database state (booking percentages, route dependencies)
- Generates contextual warnings based on real data
- Example: "Trip has 75% bookings - removing vehicle will affect employees"

#### 3. Action Executor Node

**Purpose**: Executes the selected tool and performs database operations

**Process**:
1. Receives `tool_name` and `entities` from state
2. Normalizes entity parameters to match tool expectations
3. Looks up tool in registry
4. Executes tool with extracted entities
5. Tool performs CRUD operations via SQLAlchemy
6. Returns `tool_result` with success/error message
7. Updates state with `tool_result`

**Error Handling**:
- Validates tool exists
- Handles missing entities gracefully
- Returns descriptive error messages

#### 4. Reply Generator Node

**Purpose**: Generates natural language response for the user

**Process**:
1. Receives `tool_result` and full conversation history
2. Uses GPT-4o-mini to generate user-friendly response
3. Explains what happened in natural language
4. Provides relevant follow-up suggestions
5. Updates `messages` list with AI response
6. Returns final response to frontend

### Interrupt Mechanism (Human-in-the-Loop)

**How It Works**:

Instead of conditional edges, the system uses LangGraph's `interrupt()` function:

```python
# In safety_validator_node:
user_approved = interrupt(interrupt_payload)
```

**Flow**:
1. **Interrupt Triggered**: `safety_validator_node` calls `interrupt()`
2. **Execution Pauses**: Graph execution stops at this node
3. **State Saved**: Current state saved to checkpointer
4. **Frontend Notification**: Frontend receives confirmation request via streaming
5. **User Response**: User sends "yes" or "no"
6. **Graph Resumes**: Backend calls `graph.invoke(Command(resume=True/False))`
7. **Execution Continues**: Based on user response, proceeds or cancels

**Advantages**:
- No need for separate confirmation nodes
- State persistence across interruptions
- Natural conversation flow
- Can resume from any point

### Multimodal Flow

**Image Processing Flow**:

```
User uploads image
    ↓
Frontend sends image_base64 in request
    ↓
Request Analyzer Node:
    ↓
1. Detects image_base64 in state
    ↓
2. Uses GPT-4o (vision model) for analysis
    ↓
3. Extracts:
   - Text via OCR
   - Highlighted/circled items
   - Visual emphasis (arrows, marks)
    ↓
4. Stores analysis in image_content
    ↓
5. Appends to user_msg: "[Image Analysis: ...]"
    ↓
6. Continues with normal intent classification
    ↓
Tool selection considers image context
```

**Key Features**:
- **GPT-4o for Vision**: Better OCR and visual understanding
- **Emphasis Detection**: Identifies what user highlighted
- **Context Integration**: Image analysis merged with text query

### Conditional Logic (Implicit)

While the graph uses linear edges, conditional logic exists **within nodes**:

1. **Request Analyzer**: 
   - Conditional: If `image_base64` exists → use GPT-4o vision
   - Conditional: Filter tools based on `current_page`

2. **Safety Validator**:
   - Conditional: If `tool_name in HIGH_IMPACT_TOOLS` → trigger interrupt
   - Conditional: If `user_approved == False` → cancel action

3. **Action Executor**:
   - Conditional: If tool not found → return error
   - Conditional: If entities missing → request clarification

---

## Setup Instructions

### Prerequisites

- Python 3.10 or higher
- OpenAI API Key (required)
- (Optional) LangSmith API Key for monitoring
- (Optional) LiveKit credentials for voice chat
- (Optional) Mapbox API Token for frontend maps

### Step 1: Clone the Repository

```bash
git clone https://github.com/SaiLokeshManchineella/MoveInSync.git
cd MoveInSync/backend
```

### Step 2: Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

**Key Dependencies**:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `langgraph` - Agent orchestration
- `langchain-openai` - LLM integration
- `sqlalchemy` - Database ORM
- `openai` - Vision, STT, TTS
- `python-dotenv` - Environment variables

### Step 4: Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional - LangSmith Monitoring
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_api_key_here
LANGCHAIN_PROJECT=MoveInSync

# Optional - Voice Chat (LiveKit)
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

### Step 5: Initialize Database

```bash
python seed_data.py
```

This script will:
- Create all database tables
- Populate with sample data:
  - 6 stops
  - 1 path with 4 stops
  - 1 route
  - 5 vehicles
  - 5 drivers
  - 4 trips
  - 3 deployments

### Step 6: Run the Server

```bash
uvicorn main:app --reload --port 8000
```

**Expected Output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Step 7: Access the API

- **API Base URL**: `http://localhost:8000`
- **Interactive API Docs**: `http://localhost:8000/docs` (Swagger UI)
- **Alternative Docs**: `http://localhost:8000/redoc`
- **Health Check**: `http://localhost:8000/health`

### Step 8: Test the AI Agent

Send a POST request to `/movi/chat`:

```bash
curl -X POST "http://localhost:8000/movi/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "List all trips",
    "session_id": "test-session-1",
    "context_page": "busDashboard"
  }'
```

---

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── database.py             # Database configuration (SQLAlchemy)
├── models.py               # SQLAlchemy ORM models
├── schemas.py              # Pydantic schemas for validation
├── seed_data.py           # Database seeding script
├── requirements.txt        # Python dependencies
│
├── endpoints/              # FastAPI route handlers
│   ├── vehicle.py         # Vehicle CRUD endpoints
│   ├── driver.py          # Driver CRUD endpoints
│   ├── stop.py            # Stop CRUD endpoints
│   ├── path.py            # Path CRUD endpoints
│   ├── route.py           # Route CRUD endpoints
│   ├── daily_trip.py      # Trip CRUD endpoints
│   ├── deployment.py      # Deployment CRUD endpoints
│   ├── movi.py            # AI chat endpoint (streaming)
│   └── voice.py           # WebSocket voice chat endpoint
│
├── crud/                   # Database CRUD operations
│   ├── vehicle.py
│   ├── driver.py
│   ├── stop.py
│   ├── path.py
│   ├── route.py
│   ├── daily_trip.py
│   └── deployment.py
│
├── intelligence/           # LangGraph AI agent
│   ├── graph.py           # Graph definition and compilation
│   ├── nodes.py           # Agent node implementations
│   ├── state.py           # State schema (FleetAgentState)
│   └── tools.py           # 26 agent tools
│
└── utils/                  # Utility functions
    └── audio_processing.py # STT/TTS using OpenAI
```

---

## Author

**Sai Lokesh Manchineella**

- GitHub: [@SaiLokeshManchineella](https://github.com/SaiLokeshManchineella)
- Repository: [MoveInSync](https://github.com/SaiLokeshManchineella/MoveInSync)

---

## License

MIT
