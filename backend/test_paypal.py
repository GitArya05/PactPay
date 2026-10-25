import uuid


def create_paypal_order(item_name: str, quantity: int, final_price: float):
    # Simulates creating a PayPal Sandbox order and returning a checkout link
    order_id = f"PAYID-{uuid.uuid4().hex[:10].upper()}"
    approval_url = f"https://www.sandbox.paypal.com/checkoutnow?token={order_id}"
    
    return {
        "order_id": order_id,
        "approval_url": approval_url,
        "status": "CREATED",
        "amount": final_price,
        "description": f"{quantity}x {item_name}"
    }

import os
import asyncio
from typing import Dict, Any, List
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage


class NegotiationState(BaseModel):
    item_name: str
    quantity: int
    buyer_max_budget: float
    seller_base_price: float = 0.0
    seller_min_price: float = 0.0
    current_round: int = 1
    max_rounds: int = 3
    history: List[Dict[str, Any]] = []
    status: str = "NEGOTIATING"
    final_agreed_price: float = 0.0


def extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
        return " ".join(parts) if parts else str(content)
    return str(content)


class PactPayNegotiator:
    def __init__(self, state: NegotiationState):
        self.state = state
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-flash-lite-latest",
            temperature=0.4,
            max_retries=2,
            google_api_key=os.getenv("GEMINI_API_KEY")
        )


    async def run(self):
        buyer_max = float(self.state.buyer_max_budget)
        buyer_open = round(buyer_max * 0.7, 2)
        seller_ask = round(buyer_max * 1.3, 2)
        seller_floor = round(buyer_max * 0.8, 2)


        buyer_sys = SystemMessage(content=(
            f"You are a corporate procurement agent buying {self.state.quantity}x {self.state.item_name}. "
            f"Your absolute MAX BUDGET is ${buyer_max}.\n"
            "RULES:\n"
            "1. If the seller's price is HIGHER than your max budget, counter-offer a lower price.\n"
            "2. If the seller offers ANY price EQUAL TO OR LOWER than your max budget, you MUST accept it.\n"
            "3. To accept, your response MUST contain the exact phrase 'DEAL_ACCEPTED'. Do not forget this token."
        ))
        
        seller_sys = SystemMessage(content=(
            f"You are a B2B supplier selling {self.state.quantity}x {self.state.item_name}. "
            f"Your starting asking price is ${seller_ask}. Your absolute FLOOR PRICE is ${seller_floor}.\n"
            "RULES:\n"
            "1. Concede and drop your price significantly each round to reach an agreement.\n"
            "2. If the buyer offers ANY price EQUAL TO OR HIGHER than your floor price, you MUST accept it immediately.\n"
            "3. To accept, your response MUST contain the exact phrase 'DEAL_ACCEPTED'. Do not forget this token."
        ))


        current_offer = f"We are looking to procure {self.state.quantity}x {self.state.item_name}. Our opening offer is ${buyer_open}. Can you fulfill this?"
        
        yield {
            "sender": "BUYER",
            "message": current_offer,
            "round": self.state.current_round,
            "status": self.state.status
        }
        await asyncio.sleep(1.5)


        while self.state.current_round <= self.state.max_rounds and self.state.status == "NEGOTIATING":
            seller_prompt = [seller_sys, HumanMessage(content=f"Buyer says: {current_offer}")]
            seller_response = await asyncio.to_thread(self.llm.invoke, seller_prompt)
            
            seller_msg = extract_text(seller_response.content)
            
            yield {
                "sender": "SELLER",
                "message": seller_msg,
                "round": self.state.current_round,
                "status": self.state.status
            }
            await asyncio.sleep(2)
            
            if "DEAL_ACCEPTED" in seller_msg.upper():
                self.state.status = "AGREEMENT_REACHED"
                yield {
                    "sender": "SYSTEM", 
                    "message": "✅ Deal Closed! Merchant accepted the offer. Initiating PayPal Sandbox Escrow...", 
                    "status": "completed"
                }
                break


            buyer_prompt = [buyer_sys, HumanMessage(content=f"Merchant says: {seller_msg}")]
            buyer_response = await asyncio.to_thread(self.llm.invoke, buyer_prompt)
            
            buyer_msg = extract_text(buyer_response.content)
            current_offer = buyer_msg
            
            yield {
                "sender": "BUYER",
                "message": buyer_msg,
                "round": self.state.current_round,
                "status": self.state.status
            }
            await asyncio.sleep(2)


            if "DEAL_ACCEPTED" in buyer_msg.upper():
                self.state.status = "AGREEMENT_REACHED"
                yield {
                    "sender": "SYSTEM", 
                    "message": "✅ Deal Closed! Buyer accepted the terms. Initiating PayPal Sandbox settlement...", 
                    "status": "completed"
                }
                break
                
            self.state.current_round += 1


        if self.state.status == "NEGOTIATING":
            self.state.status = "DEAL_BROKEN"
            yield {
                "sender": "SYSTEM", 
                "message": "❌ Max negotiation rounds reached without an agreement. Deal terminated.", 
                "status": "failed"
            }