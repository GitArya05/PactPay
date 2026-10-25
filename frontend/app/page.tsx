/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Play, Tag, Package, DollarSign, Search } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, ClientSideRowModelModule, RowSelectionModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([ClientSideRowModelModule, RowSelectionModule]);

interface Log {
  sender: string;
  message: any;
  round?: number;
  status?: string;
}

const renderMessage = (msg: any): string => {
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg[0]?.text || JSON.stringify(msg);
  if (typeof msg === 'object' && msg !== null) return msg.text || JSON.stringify(msg);
  return String(msg);
};

export default function Home() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [item, setItem] = useState('');
  const [units, setUnits] = useState(100);
  const [budget, setBudget] = useState(6000);
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [dealAgreed, setDealAgreed] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [catalogData, setCatalogData] = useState<any[]>([]);
  const [catalogColDefs] = useState([
    { field: 'id', headerName: 'Product ID', flex: 1 },
    { field: 'name', headerName: 'Item Name', flex: 2 },
    { field: 'price', headerName: 'Base Price', flex: 1, valueFormatter: (p: any) => `$${p.value}` },
    { field: 'stock', headerName: 'Available Units', flex: 1 },
  ]);

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyColDefs] = useState([
    { field: 'id', headerName: 'Agreement ID', flex: 1 },
    { field: 'name', headerName: 'Negotiated Item', flex: 2 },
    { field: 'price', headerName: 'Final Per-Unit Price', flex: 1, valueFormatter: (p: any) => `$${p.value}` },
    { field: 'stock', headerName: 'Units Secured', flex: 1 },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const buyerEndRef = useRef<HTMLDivElement>(null);
  const sellerEndRef = useRef<HTMLDivElement>(null);

  const fetchCatalog = useCallback(async (query = '') => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/channel3/catalog?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        setCatalogData(data);
      }
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialCatalog = async () => {
      // Awaiting first means setState isn't called synchronously in the effect body
      await Promise.resolve();
      fetchCatalog(); // Fetch default mix on initial load
    };
    loadInitialCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    const loadHistory = async () => {
      // Awaiting first means setState isn't called synchronously in the effect body
      await Promise.resolve();
      const savedHistory = localStorage.getItem('pactpay_deals');
      if (!savedHistory) return;
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistoryData(parsed);
          setDealAgreed(true);
        }
      } catch {
        console.error('Could not parse history');
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    buyerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    sellerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const dispatchAgents = () => {
    if (!item.trim()) {
      alert('Please select an item from the catalog first.');
      return;
    }

    setIsNegotiating(true);
    setLogs([{ sender: 'SYSTEM', message: `Starting A2A negotiation for ${units}x ${item}...` }]);

    const ws = new WebSocket('ws://127.0.0.1:8000/ws/negotiate');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('Connected');
      ws.send(JSON.stringify({ item, units, budget }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => [...prev, data]);

        if (data.status === 'completed' || data.status === 'failed') {
          setIsNegotiating(false);
          ws.close();
          if (renderMessage(data.message).includes('✅ Deal Closed!')) {
            setDealAgreed(true);
            const calculatedPrice = (budget / units).toFixed(2);
            const newDeal = {
              id: `PACT-${Date.now().toString().slice(-4)}`,
              name: item,
              price: calculatedPrice,
              stock: units,
            };
            setHistoryData((prev) => {
              const updated = [newDeal, ...prev];
              localStorage.setItem('pactpay_deals', JSON.stringify(updated));
              return updated;
            });
          }
        }
      } catch {
        setLogs((prev) => [...prev, { sender: 'SYSTEM', message: 'Error parsing message' }]);
      }
    };

    ws.onerror = () => {
      setLogs((prev) => [...prev, { sender: 'SYSTEM', message: 'Connection error. Is Python backend running?' }]);
      setIsNegotiating(false);
    };

    ws.onclose = () => {
      setConnectionStatus('Disconnected');
      setIsNegotiating(false);
    };
  };

  const handlePayPalCheckout = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: item, quantity: units, final_price: budget }),
      });
      const data = await response.json();
      if (data.approval_url) {
        window.location.href = data.approval_url;
      }
    } catch {
      alert('Failed to reach backend PayPal route.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              PactPay <span className="text-blue-600">A2A</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">Autonomous B2B Procurement Protocol</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold border border-emerald-200">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'Connected' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {connectionStatus === 'Connected' ? 'System Connected' : 'Ready'}
          </div>
        </header>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package size={16} className="text-blue-600" /> Channel 3 Live Catalog
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search catalog (e.g., drone, jacket)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchCatalog(searchQuery)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 w-64 transition-colors"
              />
              <button
                onClick={() => fetchCatalog(searchQuery)}
                disabled={isSearching}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Search size={14} />
                {isSearching ? '...' : 'Search'}
              </button>
            </div>
          </div>
          <div className="ag-theme-alpine w-full h-[200px]">
            <AgGridReact
              theme="legacy"
              rowData={catalogData}
              columnDefs={catalogColDefs}
              rowSelection={{ mode: 'singleRow' }}
              onRowSelected={(e) => {
                if (e.node.isSelected()) {
                  setItem(e.data.name);
                  setBudget(e.data.price * units);
                }
              }}
            />
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Tag size={14} /> Item Description
            </label>
            <input
              type="text"
              value={item}
              placeholder="Select from catalog above..."
              onChange={(e) => setItem(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Package size={14} /> Units Required
            </label>
            <input
              type="number"
              value={units}
              onChange={(e) => {
                const newUnits = Number(e.target.value);
                setUnits(newUnits);
                const selectedRow = catalogData.find((row) => row.name === item);
                if (selectedRow) setBudget(selectedRow.price * newUnits);
              }}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <DollarSign size={14} /> Max Budget (USD)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>
          <button
            onClick={dispatchAgents}
            disabled={isNegotiating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 h-[50px]"
          >
            <Play size={18} />
            {isNegotiating ? 'Negotiating...' : 'Dispatch Agents'}
          </button>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <div className="bg-slate-900 text-white p-4 text-sm font-semibold flex items-center gap-2">
              <Bot size={18} className="text-blue-400" /> Buyer Agent
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50/50">
              {logs
                .filter((l) => l.sender === 'BUYER' || l.sender === 'SYSTEM')
                .map((log, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl text-sm ${
                      log.sender === 'SYSTEM'
                        ? 'bg-slate-200 text-slate-700 font-medium text-center text-xs'
                        : 'bg-blue-50 border border-blue-200 text-blue-900'
                    }`}
                  >
                    {log.round && <div className="text-xs font-bold text-blue-700 mb-1">Round {log.round}:</div>}
                    {renderMessage(log.message)}
                  </div>
                ))}
              <div ref={buyerEndRef} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <div className="bg-slate-900 text-white p-4 text-sm font-semibold flex items-center gap-2">
              <Bot size={18} className="text-emerald-400" /> Merchant Agent
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50/50">
              {logs
                .filter((l) => l.sender === 'SELLER')
                .map((log, i) => (
                  <div key={i} className="p-3 rounded-xl text-sm bg-emerald-50 border border-emerald-200 text-emerald-900">
                    {log.round && <div className="text-xs font-bold text-emerald-700 mb-1">Round {log.round}:</div>}
                    {renderMessage(log.message)}
                  </div>
                ))}
              <div ref={sellerEndRef} />
            </div>
          </div>
        </section>

        {dealAgreed && (
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Package size={16} className="text-blue-600" /> Deal History
              </h2>
              <div className="ag-theme-alpine w-full h-[200px]">
                <AgGridReact theme="legacy" rowData={historyData} columnDefs={historyColDefs} />
              </div>
            </section>
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
              <h3 className="text-xl font-bold text-emerald-900 mb-2">Agreement Reached</h3>
              <p className="text-emerald-700 mb-6">Proceed to fund the PayPal Sandbox Escrow.</p>
              <button
                onClick={handlePayPalCheckout}
                className="bg-[#003087] hover:bg-[#002266] text-white px-8 py-3 rounded-xl font-bold shadow-md"
              >
                Fund Escrow with PayPal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}