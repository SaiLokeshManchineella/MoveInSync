# MoveInSync Backend API

A FastAPI-based backend service with LangGraph AI agent for fleet management operations. Features RESTful APIs, WebSocket support, and an intelligent AI assistant with human-in-the-loop capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Application                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ REST API     │  │ WebSocket    │  │ AI Agent     │  │
│  │ Endpoints    │  │ Voice Chat   │  │ (LangGraph)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼──────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                    LangGraph Agent                       │
│  Request Analyzer → Safety Validator → Action Executor   │
│  → Reply Generator → END                                │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                            │
│  CRUD Operations → SQLAlchemy Models → SQLite/PostgreSQL│
└─────────────────────────────────────────────────────────┘
```

### Key Components

- **FastAPI**: RESTful API framework with automatic OpenAPI documentation
- **LangGraph**: AI agent orchestration with 4-node architecture
- **SQLAlchemy**: ORM for database operations
- **OpenAI**: GPT-4o for vision, GPT-4o-mini for text, Whisper for STT, TTS for voice
- **WebSocket**: Real-time voice chat support

---

## Setup and Installation

### Prerequisites

- Python 3.10+
- OpenAI API Key
- (Optional) LangSmith API Key for monitoring
- (Optional) LiveKit credentials for voice chat

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/SaiLokeshManchineella/MoveInSync.git
   cd MoveInSync/backend
   ```

2. **Create virtual environment** (recommended)
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   
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

5. **Initialize database**
   ```bash
   python seed_data.py
   ```
   This creates the database schema and populates it with sample data.

6. **Run the server**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

7. **Access the API**
   - API Base URL: `http://localhost:8000`
   - Interactive API Docs: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/health`

---

## How It Works

### API Endpoints

The backend exposes RESTful endpoints for fleet management:

- **Vehicles**: `/vehicles/*` - Vehicle CRUD operations
- **Drivers**: `/drivers/*` - Driver management
- **Stops**: `/stops/*` - Bus stop management
- **Paths**: `/paths/*` - Route path configuration
- **Routes**: `/routes/*` - Route management
- **Trips**: `/daily-trips/*` - Daily trip operations
- **Deployments**: `/deployments/*` - Vehicle-driver assignments
- **Movi AI**: `/movi/chat` - AI assistant chat endpoint
- **Voice**: `/movi/voice` - WebSocket voice chat endpoint

### Database Schema

The system uses a relational database with the following entities:

- **Stops**: Geographic locations (latitude, longitude)
- **Paths**: Ordered sequences of stops
- **Routes**: Paths with scheduling (shift time, direction, status)
- **Vehicles**: Fleet vehicles (license plate, type, capacity)
- **Drivers**: Driver information
- **DailyTrips**: Scheduled trips with booking status
- **Deployments**: Vehicle-driver-trip assignments

---

## Workflow

### LangGraph Agent Flow

The AI agent follows a 4-node architecture with human-in-the-loop:

```
User Input
    ↓
┌─────────────────────────────────────┐
│ 1. Request Analyzer Node            │
│    - Analyzes user intent           │
│    - Extracts entities              │
│    - Selects appropriate tool       │
│    - Handles image analysis (GPT-4o) │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. Safety Validator Node            │
│    - Checks if tool is high-impact  │
│    - Fetches consequences from DB   │
│    - Triggers interrupt() if needed │
│    - Waits for user confirmation    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. Action Executor Node             │
│    - Executes selected tool          │
│    - Performs database operations   │
│    - Returns tool result             │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 4. Reply Generator Node             │
│    - Generates natural language     │
│    - Uses GPT-4o-mini               │
│    - Provides user-friendly response│
└──────────────┬──────────────────────┘
               ↓
            END Node
    (State saved, response returned)
```

### Request Processing Flow

1. **User sends request** → FastAPI endpoint receives it
2. **Request Analyzer** → Classifies intent, extracts entities, selects tool
3. **Safety Validator** → Checks consequences, may interrupt for confirmation
4. **Action Executor** → Executes tool, performs database operations
5. **Reply Generator** → Creates natural language response
6. **Response** → Streamed back to frontend

### Human-in-the-Loop (HITL)

High-impact actions (deletions, critical updates) trigger an interrupt:

1. Safety Validator detects high-impact tool
2. Fetches real consequences from database
3. Calls `interrupt()` to pause execution
4. Frontend receives confirmation request
5. User approves/rejects via natural language ("yes"/"no")
6. Graph resumes with `Command(resume=True/False)`
7. Action proceeds or is cancelled

### Available Tools

The agent has access to 24+ tools organized by page context:

- **Bus Dashboard Tools** (12): Trip management, vehicle assignment, deployments
- **Stops & Paths Tools** (7): Stop creation, path configuration
- **Routes Tools** (5): Route management, status updates

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
│   ├── vehicle.py         # Vehicle endpoints
│   ├── driver.py          # Driver endpoints
│   ├── stop.py            # Stop endpoints
│   ├── path.py            # Path endpoints
│   ├── route.py           # Route endpoints
│   ├── daily_trip.py      # Trip endpoints
│   ├── deployment.py      # Deployment endpoints
│   ├── movi.py            # AI chat endpoint
│   └── voice.py           # WebSocket voice endpoint
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
│   └── tools.py           # 24+ agent tools
│
└── utils/                  # Utility functions
    └── audio_processing.py # STT/TTS using OpenAI
```

### Key Files

- **`main.py`**: FastAPI app initialization, CORS configuration, router registration
- **`intelligence/graph.py`**: LangGraph agent graph construction
- **`intelligence/nodes.py`**: Four agent nodes (analyzer, validator, executor, generator)
- **`intelligence/tools.py`**: Tool definitions for database operations
- **`endpoints/movi.py`**: Main AI chat endpoint with streaming support
- **`endpoints/voice.py`**: WebSocket endpoint for voice chat

---

## Author

**Sai Lokesh Manchineella**

- GitHub: [@SaiLokeshManchineella](https://github.com/SaiLokeshManchineella)
- Repository: [MoveInSync](https://github.com/SaiLokeshManchineella/MoveInSync)

---

## License

MIT


