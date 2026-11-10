#  PactPay A2A — Autonomous B2B Procurement Protocol

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![PayPal](https://img.shields.io/badge/PayPal_Sandbox-00457C?style=for-the-badge&logo=paypal&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**PactPay** is an end-to-end autonomous Agent-to-Agent (A2A) B2B procurement platform. It eliminates manual negotiation bottlenecks by deploying AI-driven Buyer and Supplier agents that source live inventory from the **Channel 3 Marketplace API**, negotiate bulk pricing in real-time over WebSockets using **Google Gemini**, and autonomously initiate escrow settlements via the **PayPal Checkout REST API**.

---

##  Key Features

* ** Live B2B Catalog Integration (Channel 3 API):** Dynamically query and browse real-world commercial inventory, base pricing, and stock availability directly within an interactive **AG Grid** data table.
* ** Autonomous Agent-to-Agent (A2A) Negotiation:** Powered by **Google Gemini (`gemini-flash-lite-latest`)** and **LangChain**. The Buyer Agent (constrained by a maximum budget cap) and the Supplier Agent (operating with a dynamic hidden floor price) exchange multi-round offers and counter-offers in real time.
* ** Real-Time WebSocket Streaming:** Watch the negotiation unfold live on the dashboard as agents evaluate margins, justify bulk discounts, and converge on an agreement.
* ** Automated PayPal Sandbox Escrow:** The moment an agreement (`DEAL_ACCEPTED`) is reached, PactPay automatically deducts inventory and triggers the **PayPal Orders REST API** to generate a secure Sandbox checkout link for the exact negotiated settlement amount.
* ** Settlement & Deal History:** Automatically logs completed procurement contracts, per-unit final pricing, and order statuses in a persistent AG Grid dashboard.

---

##  System Architecture & Workflow

1. **Product Sourcing:** The user searches for a product category (e.g., sneakers, laptops, corporate apparel) via the Next.js frontend. The FastAPI backend proxies the request to the **Channel 3 `/v1/search` API**, normalizing nested offer schemas into a clean grid format.
2. **Parameter Configuration:** Selecting a catalog row auto-populates the item description and calculates a baseline budget based on the required unit quantity.
3. **Agent Dispatch:** Clicking **Dispatch Agents** opens a bidirectional WebSocket connection (`/ws/negotiate`) to the FastAPI backend and initializes the `PactPayNegotiator` engine.
4. **Multi-Round LLM Negotiation:**
   * **Buyer Agent** opens below the maximum budget cap to maximize corporate savings.
   * **Merchant Agent** counters from an initial asking price,逐步 dropping its price across rounds while protecting its minimum floor price.
5. **Settlement & Checkout:** Once either agent outputs the `DEAL_ACCEPTED` token, the system records the deal, triggers an inventory deduction call, and creates a PayPal Sandbox order (`/api/paypal/create-order`) for immediate one-click escrow funding.

---

##  Tech Stack

### **Frontend**
* **Framework:** Next.js (App Router, React, TypeScript)
* **Data Grid:** AG Grid (`ag-grid-react`, `ag-grid-community` with `ClientSideRowModelModule` & `RowSelectionModule`)
* **Styling & Icons:** Tailwind CSS, Lucide React

### **Backend**
* **Framework:** FastAPI (Python), Uvicorn ASGI Server
* **Communication:** FastAPI WebSockets & RESTful endpoints
* **AI Orchestration:** LangChain (`langchain-google-genai`, `langchain-core`)
* **LLM Model:** Google Gemini (`gemini-flash-lite-latest`)

### **External APIs & Integrations**
* **PayPal Developer Platform:** PayPal Checkout Orders API v2 (Sandbox Environment)
* **Channel 3 Marketplace API:** Live product search and inventory deduction

---

##  Project Structure

```text
PactPay/
├── backend/
│   ├── main.py              # FastAPI server, Channel 3 proxy, WebSocket & PayPal routes
│   ├── agent_engine.py      # LangChain + Gemini A2A negotiation state machine
│   ├── test_paypal.py       # PayPal Sandbox OAuth2 token & Order creation logic
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Backend environment variables (API keys)
│
└── frontend/
    ├── app/
    │   ├── page.tsx         # Main PactPay dashboard, AG Grids, and WebSocket client
    │   ├── layout.tsx       # Root layout
    │   └── globals.css      # Global Tailwind styles
    ├── package.json         # Node.js dependencies
    └── tsconfig.json        # TypeScript configuration
```

---

##  Getting Started

### **Prerequisites**
* **Python** 3.9 or higher
* **Node.js** 18.x or higher & `npm`
* **API Keys:**
  * Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))
  * PayPal Sandbox Client ID & Secret ([PayPal Developer Dashboard](https://developer.paypal.com/))
  * Channel 3 API Key ([Channel 3 Portal](https://trychannel3.com/))

---

### **1. Backend Setup**

Navigate to the `backend` directory, create a virtual environment, and install the dependencies:

```bash
cd backend
python -m venv venv

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Activate virtual environment (macOS/Linux)
source venv/bin/activate

pip install fastapi uvicorn requests pydantic python-dotenv langchain-google-genai langchain-core
```

Create a `.env` file inside the `backend/` directory:

```env
# Google Gemini AI
GEMINI_API_KEY=your_google_gemini_api_key_here

# Channel 3 Live Catalog API
CHANNEL3_API_URL=https://api.trychannel3.com/v1/search
CHANNEL3_API_KEY=your_channel3_api_key_here

# PayPal Sandbox Credentials
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret_here
PAYPAL_MODE=sandbox
```

Start the FastAPI server on port `8000`:

```bash
python -m uvicorn main:app --reload --port 8000
```

---

### **2. Frontend Setup**

Open a new terminal, navigate to the `frontend` directory, and start the Next.js development server:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to launch the **PactPay A2A Dashboard**.

---

##  How to Use

1. **Search the Catalog:** Use the search bar in the **Channel 3 Live Catalog** section to query live products (e.g., `sneakers`, `watch`, `laptop`, `hoodie`), or browse the default loaded inventory.
2. **Select an Item:** Click any product row in the AG Grid to automatically populate the **Item Description** and calculate the initial **Max Budget (USD)**.
3. **Adjust Procurement Targets:** Modify the **Units Required** and **Max Budget** as needed for your bulk order.
4. **Dispatch Agents:** Click **Dispatch Agents** to initiate the real-time negotiation between the Buyer Agent and Merchant Agent.
5. **Fund Escrow:** Once the agents reach an agreement, scroll down to the **Deal History / Agreement Reached** section and click **Fund Escrow with PayPal** to complete the checkout in the PayPal Sandbox environment.

---

##  License

This project was built for hackathon submission and educational demonstration. Licensed under the MIT License.
