import json
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

async def query_channel3_catalog(query: str):
    """Simulated Channel3 Sponsor API for real-time B2B product sourcing."""
    await asyncio.sleep(1) 
    query_lower = query.lower()
    
    if "bottle" in query_lower:
        return {"sku": "CH3-BOT-SS-32", "name": "32oz Stainless Steel Bottle", "msrp": 15.00, "min_wholesale": 9.50}
    elif "shirt" in query_lower or "hoodie" in query_lower:
        return {"sku": "CH3-APP-PREM", "name": "Premium Corporate Apparel", "msrp": 25.00, "min_wholesale": 14.00}
    elif "keyboard" in query_lower or "mouse" in query_lower:
        return {"sku": "CH3-PERIPH-MECH", "name": "Mechanical Office Peripherals", "msrp": 65.00, "min_wholesale": 42.00}
    else:
        return {"sku": "CH3-GEN-BULK", "name": f"Wholesale {query.title()}", "msrp": 30.00, "min_wholesale": 18.00}

@app.websocket("/ws/negotiate")
async def websocket_negotiate(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        request = json.loads(data)
        
        raw_item_name = request.get("item_name", "Custom Corporate Hoodies")
        quantity = int(request.get("quantity", 200))
        buyer_max_budget = float(request.get("buyer_max_budget", 4000.0))

        await websocket.send_json({"type": "SYSTEM", "message": f"Sourcing '{raw_item_name}' via Channel3 B2B Marketplace API..."})
        channel3_product = await query_channel3_catalog(raw_item_name)
        
        real_item_name = f"[{channel3_product['sku']}] {channel3_product['name']}"
        seller_base_price = channel3_product['msrp']
        seller_min_price = channel3_product['min_wholesale']
        
        state = NegotiationState(
            item_name=real_item_name,
            quantity=quantity,
            buyer_max_budget=buyer_max_budget,
            seller_base_price=seller_base_price,
            seller_min_price=seller_min_price,
        )
        negotiator = PactPayNegotiator(state)
        
        await websocket.send_json({"type": "SYSTEM", "message": f"Channel3 Match Found. Initiating negotiation for {quantity}x {real_item_name}..."})
        
        while state.status == "NEGOTIATING":
            # Execution is now awaited since the engine is fully async
            turn_result = await negotiator.execute_turn()
            
            await websocket.send_json({
                "type": "BUYER_AGENT",
                "round": turn_result["current_round"],
                "message": f"Offer: ${turn_result['turn_data']['buyer_offer']:.2f} — {turn_result['turn_data']['buyer_notes']}"
            })
            
            await asyncio.sleep(1.5)
            
            await websocket.send_json({
                "type": "SELLER_AGENT",
                "round": turn_result["current_round"],
                "accepted": turn_result['turn_data']['seller_accepted'],
                "message": f"Counter: ${turn_result['turn_data']['seller_counter']:.2f} — {turn_result['turn_data']['notes']}"
            })
        
        if state.status == "AGREEMENT_REACHED":
            # The tool already fired during execute_turn! We just read the result.
            await websocket.send_json({"type": "SYSTEM", "message": "Nash Equilibrium reached. Autonomous PayPal settlement successfully executed by Agent Toolkit."})
            
            await websocket.send_json({
                "type": "SETTLEMENT_COMPLETE",
                "paypal_order_id": turn_result["order_id"],
                "status": "CREATED",
                "final_price": turn_result["final_price"],
                "item_name": state.item_name,
                "quantity": state.quantity,
                "approve_url": turn_result["approve_url"]
            })
        else:
            await websocket.send_json({"type": "SYSTEM", "message": "Negotiation concluded without mutual agreement."})
            
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
