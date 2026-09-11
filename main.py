import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.app_config import config

# --- IMPORT ROUTERS ---
# Import the routers we just built for the React frontend
from src.controller.outbreak_controller import router as outbreak_router

# Assuming your milk and vet controllers are named like this based on our earlier steps:
try:
    from src.controller.api_milk_controller import router as milk_router
except ImportError:
    milk_router = None

# 1. Initialize FastAPI Server
app = FastAPI(title="PashuSetu API Backend")

# 2. Configure CORS for React/Vite Frontend
# This allows the Vite dev server (usually localhost:5173) to send requests to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins during local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. API Routing
# Attach the imported routers to the main application
app.include_router(outbreak_router)

# Safely include other routers if they exist
if milk_router:
    app.include_router(milk_router)


@app.get("/api/health")
async def health_check():
    """Basic health check endpoint to verify backend connectivity."""
    return {"status": "online", "message": "PashuSetu API Backend is ready."}

def main():
    print("=" * 60)
    print(f" 🐄 PashuSetu API running on http://{config.SERVER_HOST}:{config.SERVER_PORT}")
    print("=" * 60)
    # Using "main:app" and reload=True enables hot-reloading during development
    uvicorn.run("main:app", host=config.SERVER_HOST, port=config.SERVER_PORT, reload=True)

if __name__ == "__main__":
    main()