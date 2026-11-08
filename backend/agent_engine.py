import asyncio
import os
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
from dotenv import load_dotenv

from paypal_toolkit import PayPalToolkit

load_dotenv()
paypal_client = PayPalToolkit()

# 1. Define the Executable Agent Tools
@tool
async def execute_paypal_settlement(item_name: str, quantity: int, agreed_price: float) -> dict:
    """Call this tool IMMEDIATELY to finalize the transaction if you accept the buyer's offer."""
    return await paypal_client.create_order(item_name, quantity, agreed_price)

@tool
def issue_counter_offer(counter_price: float, reasoning: str) -> dict:
    """Call this tool to reject the buyer's offer and propose a higher counter-price."""
    return {"counter_price": counter_price, "reasoning": reasoning}

class NegotiationState(BaseModel):
    item_name: str
    quantity: int
    buyer_max_budget: float
    seller_base_price: float
    seller_min_price: float
    current_round: int = 1
    max_rounds: int = 3
    history: List[Dict[str, Any]] = []
    status: str = "NEGOTIATING"
    final_agreed_price: float = 0.0
    paypal_order_id: str = ""
    approve_url: str = ""

class BuyerResponse(BaseModel):
    offer_price: float = Field(description="The total price offered for the bulk order")
    reasoning: str = Field(description="A short conversational message explaining the offer")

class PactPayNegotiator:
    def __init__(self, state: NegotiationState):
        self.state = state
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-3.5-flash-lite", 
            temperature=0.7,
            google_api_key=os.getenv("GEMINI_API_KEY")
        )
        self.buyer_llm = self.llm.with_structured_output(BuyerResponse)
        
        # 2. Equip the Merchant Agent with the Toolkit
        self.seller_agent = self.llm.bind_tools([execute_paypal_settlement, issue_counter_offer])

    async def buyer_bid(self) -> BuyerResponse:
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a corporate procurement agent. You need to buy {quantity}x {item_name}. "
                       "Your absolute maximum budget is ${max_budget}. "
                       "Negotiate the best deal. Do not offer your max budget immediately. "
                       "This is round {round} of {max_rounds}. "
                       "Previous history: {history}"),
            ("human", "Generate your next offer and a short persuasive message.")
        ])
        chain = prompt | self.buyer_llm
        return await chain.ainvoke({
            "quantity": self.state.quantity,
            "item_name": self.state.item_name,
            "max_budget": self.state.buyer_max_budget,
            "round": self.state.current_round,
            "max_rounds": self.state.max_rounds,
            "history": self.state.history
        })

    async def execute_turn(self) -> Dict[str, Any]:
        # Buyer thinks and makes an offer
        buyer_res = await self.buyer_bid()
        
        await asyncio.sleep(2)
        
        # Merchant evaluates and routes to the appropriate tool
        prompt = f"""You are a wholesale merchant selling {self.state.quantity}x {self.state.item_name}. 
Your absolute minimum acceptable total price is ${self.state.seller_min_price * self.state.quantity}.
The buyer offered ${buyer_res.offer_price}. They said: '{buyer_res.reasoning}'

If the offer is >= your minimum, you MUST call the `execute_paypal_settlement` tool.
If the offer is below your minimum, you MUST call the `issue_counter_offer` tool.
This is round {self.state.current_round} of {self.state.max_rounds}."""

        response = await self.seller_agent.ainvoke(prompt)
        
        turn_data = {
            "round": self.state.current_round,
            "buyer_offer": buyer_res.offer_price,
            "buyer_notes": buyer_res.reasoning,
            "seller_counter": 0.0,
            "seller_accepted": False,
            "notes": ""
        }

        # 3. Intercept and handle the LLM's Tool Call
        if response.tool_calls:
            tool_call = response.tool_calls[0]
            args = tool_call["args"]
            
            if tool_call["name"] == "execute_paypal_settlement":
                # Autonomous Settlement Execution
                paypal_result = await execute_paypal_settlement.ainvoke(args)
                
                approve_link = ""
                for link in paypal_result.get("links", []):
                    if link.get("rel") == "approve":
                        approve_link = link.get("href")
                        break
                        
                self.state.status = "AGREEMENT_REACHED"
                self.state.final_agreed_price = args["agreed_price"]
                self.state.paypal_order_id = paypal_result.get("id", "")
                self.state.approve_url = approve_link
                
                turn_data["seller_accepted"] = True
                turn_data["seller_counter"] = args["agreed_price"]
                turn_data["notes"] = f"Offer accepted. Initiating autonomous settlement via PayPal Toolkit."
                
            elif tool_call["name"] == "issue_counter_offer":
                # Negotiation Continues
                turn_data["seller_accepted"] = False
                turn_data["seller_counter"] = args["counter_price"]
                turn_data["notes"] = args["reasoning"]
        
        self.state.history.append(turn_data)

        if not turn_data["seller_accepted"]:
            if self.state.current_round >= self.state.max_rounds:
                self.state.status = "DEAL_BROKEN"
            else:
                self.state.current_round += 1

        return {
            "status": self.state.status,
            "current_round": self.state.current_round,
            "turn_data": turn_data,
            "final_price": self.state.final_agreed_price,
            "order_id": self.state.paypal_order_id,
            "approve_url": self.state.approve_url
        }
