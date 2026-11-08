import os
import base64
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
BASE_URL = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")

async def test_connection():
    print("Connecting to PayPal Sandbox...")
    
    if not CLIENT_ID or not CLIENT_SECRET:
        print("Error: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing in .env")
        return

    # 1. Request OAuth2 Bearer Token
    auth_bytes = f"{CLIENT_ID}:{CLIENT_SECRET}".encode("utf-8")
    b64_auth = base64.b64encode(auth_bytes).decode("utf-8")
    
    token_headers = {
        "Authorization": f"Basic {b64_auth}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    token_data = {"grant_type": "client_credentials"}
    
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(f"{BASE_URL}/v1/oauth2/token", headers=token_headers, data=token_data)
        
        if token_resp.status_code != 200:
            print("Failed to obtain OAuth2 token:")
            print(token_resp.text)
            return
            
        token = token_resp.json()["access_token"]
        print("OAuth2 Token successfully obtained!")

        # 2. Test Order Creation (Simulating an Agent Settlement)
        order_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        order_payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": "PACTPAY_INIT_001",
                    "description": "PactPay Sandbox Handshake Test",
                    "amount": {
                        "currency_code": "USD",
                        "value": "10.00"
                    }
                }
            ]
        }
        
        order_resp = await client.post(f"{BASE_URL}/v2/checkout/orders", headers=order_headers, json=order_payload)
        
        if order_resp.status_code in (200, 201):
            data = order_resp.json()
            print("Test Order successfully created in Sandbox!")
            print(f"Order ID: {data['id']}")
            print(f"Status:   {data['status']}")
        else:
            print("Order creation failed:")
            print(order_resp.text)

if __name__ == "__main__":
    asyncio.run(test_connection())
