import os
import json
import asyncio
from typing import Dict, Any, List
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage


# Core logic behind buyer and seller agent functioning
class NegotiationState(BaseModel):
    item_name: str
    quantity: int
    buyer_max_budget: float
    seller_base_price: float
    seller_min_price: float
    current_round: int = 1
    max_rounds: int = 3
    history: List[Dict[str, Any]] = []
    status: str = "NEGOTIATING"  # NEGOTIATING | AGREEMENT_REACHED | DEAL_BROKEN
    final_agreed_price: float = 0.0


class PactPayNegotiator:
    def __init__(self, state: NegotiationState):
        self.state = state
        
        # Initialize Gemini 1.5 Flash via LangChain for fast inference
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.7,
            google_api_key=os.getenv("GEMINI_API_KEY")
        )


    async def run(self):
        """
        Executes the A2A negotiation loop and yields messages 
        to be sent over the WebSocket to the frontend.
        """
        buyer_sys = SystemMessage(content=(
            f"You are a strict procurement agent buying {self.state.quantity}x {self.state.item_name}. "
            f"Your absolute maximum budget is ${self.state.buyer_max_budget}. "
            "Negotiate hard. Propose a starting price lower than your budget. "
            "If the seller's offer is at or below your max budget, you may ACCEPT. "
            "Keep responses under 2 sentences."
        ))
        
        seller_sys = SystemMessage(content=(
            f"You are a merchant selling {self.state.quantity}x {self.state.item_name}. "
            f"Your starting asking price is ${self.state.seller_base_price}. "
            f"Your absolute lowest acceptable price is ${self.state.seller_min_price}. "
            "Try to maximize profit, but you can lower your price slightly each round. "
            "If the buyer offers below your min price, REJECT or COUNTER. "
            "Keep responses under 2 sentences."
        ))


        current_offer = f"I would like to purchase {self.state.quantity} units. What is your best price?"
        
        # Yield initial buyer outreach
        yield {
            "sender": "BUYER",
            "message": current_offer,
            "round": self.state.current_round,
            "status": self.state.status
        }
        await asyncio.sleep(1.5) # Simulate typing delay


        while self.state.current_round <= self.state.max_rounds and self.state.status == "NEGOTIATING":
            # ---------------------------------------------------------
            # MERCHANT TURN
            # ---------------------------------------------------------
            seller_prompt = [seller_sys, HumanMessage(content=f"Buyer says: {current_offer}")]
            seller_response = await self.llm.ainvoke(seller_prompt)
            seller_msg = seller_response.content
            
            yield {
                "sender": "SELLER",
                "message": seller_msg,
                "round": self.state.current_round,
                "status": self.state.status
            }
            await asyncio.sleep(2)
            
            if "ACCEPT" in seller_msg.upper():
                self.state.status = "AGREEMENT_REACHED"
                yield {"sender": "SYSTEM", "message": "Deal closed by Merchant.", "status": "completed"}
                break


            # ---------------------------------------------------------
            # BUYER TURN
            # ---------------------------------------------------------
            buyer_prompt = [buyer_sys, HumanMessage(content=f"Merchant says: {seller_msg}")]
            buyer_response = await self.llm.ainvoke(buyer_prompt)
            buyer_msg = buyer_response.content
            current_offer = buyer_msg
            
            yield {
                "sender": "BUYER",
                "message": buyer_msg,
                "round": self.state.current_round,
                "status": self.state.status
            }
            await asyncio.sleep(2)


            if "ACCEPT" in buyer_msg.upper():
                self.state.status = "AGREEMENT_REACHED"
                yield {"sender": "SYSTEM", "message": "Deal closed by Procurement.", "status": "completed"}
                break
                
            self.state.current_round += 1


        if self.state.status == "NEGOTIATING":
            self.state.status = "DEAL_BROKEN"
            yield {"sender": "SYSTEM", "message": "Max rounds reached. Deal fell through.", "status": "failed"}