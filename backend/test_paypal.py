import os
import base64
import httpx
import asyncio
from dotenv import load_dotenv


load_dotenv()


CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
BASE_URL = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")


async def verify_paypal():
    print("Testing PayPal Sandbox connection...")
    
    # 1. Exchange credentials for OAuth2 access token
    auth_str = f"{CLIENT_ID}:{CLIENT_SECRET}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {b64_auth}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"grant_type": "client_credentials"}
    
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(f"{BASE_URL}/v1/oauth2/token", headers=headers, data=data)
        
        if token_resp.status_code != 200:
            print("Authentication failed:", token_resp.text)
            return
            
        token = token_resp.json()["access_token"]
        print("OAuth2 Token acquired successfully!")
        
        # 2. Create a dummy test order
        order_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        order_payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": "PACTPAY_TEST_001",
                    "description": "PactPay Sandbox Handshake",
                    "amount": {
                        "currency_code": "USD",
                        "value": "25.00"
                    }
                }
            ]
        }
        
        order_resp = await client.post(f"{BASE_URL}/v2/checkout/orders", headers=order_headers, json=order_payload)
        
        if order_resp.status_code in (200, 201):
            res = order_resp.json()
            print("Order created successfully!")
            print(f"Order ID: {res['id']}")
            print(f"Status: {res['status']}")
        else:
            print("Order creation failed:", order_resp.text)


if __name__ == "__main__":
    asyncio.run(verify_paypal())