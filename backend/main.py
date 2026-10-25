import os
import json
import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv


load_dotenv()


from agent_engine import PactPayNegotiator, NegotiationState
from test_paypal import create_paypal_order


app = FastAPI(title="PactPay API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/channel3/catalog")
def get_channel3_catalog(q: str = ""):
    try:
        url = os.getenv("CHANNEL3_API_URL", "https://api.trychannel3.com/v1/search")
        api_key = os.getenv("CHANNEL3_API_KEY", "OXS2tmKWm9aoT63PQw7W15ivLun65zDk4jSikZi4")
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json"
        }
        
        # If the frontend passes a search query, use it. Otherwise, load a default mix.
        search_terms = [q] if q.strip() else ["sneakers", "laptop", "watch", "bags", "shoes", "headphones", "notebooks", "clothing", "stationary"]
        formatted_catalog = []
        
        for term in search_terms:
            payload = {"query": term, "limit": 20} 
            response = requests.post(url, headers=headers, json=payload, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                raw_products = data.get("products", [])
                
                for p in raw_products:
                    first_offer = p.get("offers", [{}])[0]
                    
                    price_data = first_offer.get("price", 0.0)
                    if isinstance(price_data, dict):
                        price = float(price_data.get("value", price_data.get("amount", 0.0)))
                    else:
                        try:
                            price = float(price_data)
                        except (ValueError, TypeError):
                            price = 0.0
                            
                    stock = 100 if first_offer.get("availability") == "InStock" else 0
                    
                    formatted_catalog.append({
                        "id": p.get("id", "UNKNOWN"),
                        "name": p.get("title", "Unnamed Product"),
                        "price": round(price, 2),
                        "stock": stock
                    })
                    
        return formatted_catalog


    except Exception as e:
        print(f"Channel 3 API Error: {e}")
        return []


@app.websocket("/ws/negotiate")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        params = json.loads(data)
        
        state = NegotiationState(
            item_name=params.get("item"),
            quantity=params.get("units"),
            buyer_max_budget=params.get("budget")
        )
        
        negotiator = PactPayNegotiator(state)
        async for log in negotiator.run():
            await websocket.send_json(log)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"sender": "SYSTEM", "message": f"Error: {str(e)}", "status": "failed"})


class OrderRequest(BaseModel):
    item_name: str
    quantity: int
    final_price: float


@app.post("/api/paypal/create-order")
async def create_order(request: OrderRequest):
    return create_paypal_order(request.item_name, request.quantity, request.final_price)