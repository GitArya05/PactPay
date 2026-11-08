import os
import time
import httpx
import base64

class PayPalToolkit:
    """Native implementation of the PayPal Agent Toolkit pattern."""
    
    def __init__(self):
        self.client_id = os.getenv("PAYPAL_CLIENT_ID")
        self.client_secret = os.getenv("PAYPAL_CLIENT_SECRET")
        self.base_url = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")

    async def _get_token(self) -> str:
        """Handles the OAuth2 handshake."""
        auth_str = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v1/oauth2/token", 
                headers=headers, 
                data={"grant_type": "client_credentials"}
            )
            return resp.json()["access_token"]

    async def create_order(self, item_name: str, quantity: int, agreed_price: float) -> dict:
        """Constructs and executes the checkout payload."""
        token = await self._get_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [{
                "reference_id": f"PACTPAY_{int(time.time())}",
                "description": f"B2B Bulk Order: {quantity}x {item_name}",
                "amount": {
                    "currency_code": "USD",
                    "value": f"{agreed_price:.2f}"
                }
            }],
            "application_context": {
                "brand_name": "PactPay Protocol",
                "user_action": "PAY_NOW",
                "return_url": "http://localhost:3000/success",
                "cancel_url": "http://localhost:3000/cancel"
            }
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base_url}/v2/checkout/orders", headers=headers, json=payload)
            return resp.json()import os
import time
import httpx
import base64

class PayPalToolkit:
    """Native implementation of the PayPal Agent Toolkit pattern."""
    
    def __init__(self):
        self.client_id = os.getenv("PAYPAL_CLIENT_ID")
        self.client_secret = os.getenv("PAYPAL_CLIENT_SECRET")
        self.base_url = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")

    async def _get_token(self) -> str:
        """Handles the OAuth2 handshake."""
        auth_str = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v1/oauth2/token", 
                headers=headers, 
                data={"grant_type": "client_credentials"}
            )
            return resp.json()["access_token"]

    async def create_order(self, item_name: str, quantity: int, agreed_price: float) -> dict:
        """Constructs and executes the checkout payload."""
        token = await self._get_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [{
                "reference_id": f"PACTPAY_{int(time.time())}",
                "description": f"B2B Bulk Order: {quantity}x {item_name}",
                "amount": {
                    "currency_code": "USD",
                    "value": f"{agreed_price:.2f}"
                }
            }],
            "application_context": {
                "brand_name": "PactPay Protocol",
                "user_action": "PAY_NOW",
                "return_url": "http://localhost:3000/success",
                "cancel_url": "http://localhost:3000/cancel"
            }
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base_url}/v2/checkout/orders", headers=headers, json=payload)
            return resp.json()
