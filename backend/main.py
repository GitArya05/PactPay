import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from agent_engine import NegotiationState, PactPayNegotiator


load_dotenv()


app = FastAPI(title="PactPay A2A Engine")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/negotiate")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        if not os.getenv("GEMINI_API_KEY"):
            await websocket.send_json({"sender": "SYSTEM", "message": "Error: GEMINI_API_KEY is missing from .env"})
            return


        # 1. Receive the initial parameters sent by the Next.js frontend
        initial_data = await websocket.receive_json()
        budget = float(initial_data.get("budget", 6000.0))
        
        # 2. Initialize the Pydantic state exactly matching agent_engine.py
        state = NegotiationState(
            item_name=initial_data.get("item", "Titan watch"),
            quantity=int(initial_data.get("units", 100)),
            buyer_max_budget=budget,
            seller_base_price=budget * 1.2,
            seller_min_price=budget * 0.8
        )
        
        # 3. Initialize the negotiator
        negotiator = PactPayNegotiator(state)
        
        # 4. Smart Execution: Automatically find and run your AI loop
        if hasattr(negotiator, 'run'):
            async for response in negotiator.run():
                await websocket.send_json(response)
        elif hasattr(negotiator, 'start'):
            async for response in negotiator.start():
                await websocket.send_json(response)
        elif hasattr(negotiator, 'negotiate'):
            async for response in negotiator.negotiate():
                await websocket.send_json(response)
        else:
            await websocket.send_json({"sender": "SYSTEM", "message": "Backend Error: Could not find run(), start(), or negotiate() in PactPayNegotiator."})
            
    except WebSocketDisconnect:
        print("Client disconnected gracefully")
    except Exception as e:
        await websocket.send_json({"sender": "SYSTEM", "message": f"Backend Error: {str(e)}"})