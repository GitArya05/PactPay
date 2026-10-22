'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, Play, Tag, Package, DollarSign } from 'lucide-react';

interface Log {
  sender: string;
  message: string;
  round?: number;
  status?: string;
}

export default function Home() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [item, setItem] = useState('Titan watch');
  const [units, setUnits] = useState(100);
  const [budget, setBudget] = useState(6000);
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const buyerEndRef = useRef<HTMLDivElement>(null);
  const sellerEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll feeds to the bottom when new logs arrive
  useEffect(() => {
    buyerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    sellerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const dispatchAgents = () => {
    wsRef.current?.close();
    setIsNegotiating(true);
    setLogs([
      { sender: 'SYSTEM', message: `Starting A2A negotiation for ${units}x ${item}...` },
    ]);

    // Fall back to 127.0.0.1 for local testing if no env URL is set
    const wsUrl =
      process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://127.0.0.1:8000/ws/negotiate';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('Connected');
      ws.send(JSON.stringify({ item, units, budget }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const entry: Log = {
          sender: data.sender ?? 'SYSTEM',
          message: data.message ?? '',
          round: data.round,
          status: data.status,
        };
        setLogs((prev) => [...prev, entry]);

        if (data.status === 'completed' || data.status === 'failed') {
          setIsNegotiating(false);
          ws.close();
        }
      } catch {
        setLogs((prev) => [
          ...prev,
          { sender: 'SYSTEM', message: `Error parsing message: ${event.data}` },
        ]);
      }
    };

    ws.onerror = () => {
      setLogs((prev) => [
        ...prev,
        { sender: 'SYSTEM', message: 'Connection error. Is the backend running on port 8000?' },
      ]);
      setIsNegotiating(false);
    };

    ws.onclose = () => {
      setConnectionStatus('Disconnected');
      setIsNegotiating(false);
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <header className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              PactPay <span className="text-blue-600">A2A</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Autonomous B2B Procurement Protocol on PayPal
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold border border-emerald-200">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'Connected' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {connectionStatus === 'Connected' ? 'Backend Connected' : 'Ready to Connect'}
          </div>
        </header>

        {/* Input Controls */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Tag size={14} /> Item Description
            </label>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Package size={14} /> Units Required
            </label>
            <input
              type="number"
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <DollarSign size={14} /> Max Budget Cap (USD)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={dispatchAgents}
            disabled={isNegotiating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors h-[50px]"
          >
            <Play size={18} />
            {isNegotiating ? 'Negotiating...' : 'Dispatch Agents'}
          </button>
        </section>

        {/* AI Agent Feeds */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
          {/* Buyer Agent Column */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <div className="bg-slate-900 text-white p-4 text-sm font-semibold flex items-center gap-2">
              <Bot size={18} className="text-blue-400" /> Buyer Agent (Procurement)
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50/50">
              {logs
                .filter((l) => l.sender === 'BUYER' || l.sender === 'SYSTEM')
                .map((log, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl text-sm ${
                      log.sender === 'SYSTEM'
                        ? 'bg-slate-200 text-slate-600 italic text-center text-xs'
                        : 'bg-blue-50 border border-blue-200 text-blue-900'
                    }`}
                  >
                    {log.round && (
                      <div className="text-xs font-bold text-blue-700 mb-1">
                        Round {log.round} Offer:
                      </div>
                    )}
                    {log.message}
                  </div>
                ))}
              <div ref={buyerEndRef} />
            </div>
          </div>

          {/* Merchant Agent Column */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <div className="bg-slate-900 text-white p-4 text-sm font-semibold flex items-center gap-2">
              <Bot size={18} className="text-emerald-400" /> Merchant Agent (Supplier)
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50/50">
              {logs
                .filter((l) => l.sender === 'SELLER')
                .map((log, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl text-sm bg-emerald-50 border border-emerald-200 text-emerald-900"
                  >
                    {log.round && (
                      <div className="text-xs font-bold text-emerald-700 mb-1">
                        Round {log.round} Counter:
                      </div>
                    )}
                    {log.message}
                  </div>
                ))}
              <div ref={sellerEndRef} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}