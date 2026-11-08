"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { motion, AnimatePresence } from "framer-motion";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ArrowUpRight, Play, Check, Sparkles, Loader2 } from "lucide-react";

type LogEntry = {
  id: number;
  sender: "SYSTEM" | "BUYER" | "SELLER";
  cleanText: string;
  price?: number;
  accepted?: boolean;
  round?: number;
};

export default function Home() {
  const [itemName, setItemName] = useState("Macbook Air M1");
  const [quantity, setQuantity] = useState<number>(100);
  const [budget, setBudget] = useState<number>(2000);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [rowData, setRowData] = useState<any[]>([]);
  const [isNegotiating, setIsNegotiating] = useState(false);

  const logCounter = useRef(0);
  const feedScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedScrollRef.current) {
      feedScrollRef.current.scrollTop = feedScrollRef.current.scrollHeight;
    }
  }, [logs]);

  const parseAgentMessage = (raw: string) => {
    const priceMatch = raw.match(/\$([0-9]+(?:\.[0-9]+)?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
    const parts = raw.split(" — ");
    const cleanText = parts.length > 1 ? parts.slice(1).join(" — ") : raw;
    return { price, cleanText };
  };

  const startNegotiation = () => {
    if (!itemName || quantity <= 0 || budget <= 0) return;
    setIsNegotiating(true);
    setLogs([]);
    logCounter.current = 0;

    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000/ws/negotiate";
    const ws = new WebSocket(wsUrl);


    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          item_name: itemName,
          quantity: quantity,
          buyer_max_budget: budget,
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      logCounter.current += 1;
      const currentId = logCounter.current;

      if (data.type === "SYSTEM") {
        if (data.message.includes("without mutual agreement")) {
          setIsNegotiating(false);
        }
        setLogs((prev) => [
          ...prev,
          { id: currentId, sender: "SYSTEM", cleanText: data.message },
        ]);
      } else if (data.type === "BUYER_AGENT") {
        const { price, cleanText } = parseAgentMessage(data.message);
        setLogs((prev) => [
          ...prev,
          {
            id: currentId,
            sender: "BUYER",
            cleanText,
            price,
            round: data.round,
          },
        ]);
      } else if (data.type === "SELLER_AGENT") {
        const { price, cleanText } = parseAgentMessage(data.message);
        setLogs((prev) => [
          ...prev,
          {
            id: currentId,
            sender: "SELLER",
            cleanText,
            price,
            accepted: data.accepted,
            round: data.round,
          },
        ]);
      } else if (data.type === "SETTLEMENT_COMPLETE") {
        setIsNegotiating(false);
        setLogs((prev) => [
          ...prev,
          {
            id: currentId + 1,
            sender: "SYSTEM",
            cleanText: "Order settled via PayPal Sandbox.",
          },
        ]);

        setRowData((prev) => [
          {
            order_id: data.paypal_order_id,
            status: data.status,
            item: `${data.quantity} × ${data.item_name}`,
            price: `$${data.final_price.toFixed(2)}`,
            approve_url: data.approve_url,
          },
          ...prev,
        ]);
      }
    };

    ws.onclose = () => setIsNegotiating(false);
  };

  const colDefs = useMemo(
    () => [
      {
        field: "order_id",
        headerName: "Order ID",
        flex: 1.5,
        cellClass: "font-mono text-zinc-300",
      },
      {
        field: "item",
        headerName: "Procured Item",
        flex: 2.5,
        cellClass: "text-zinc-200 font-medium",
      },
      {
        field: "price",
        headerName: "Total Settled",
        flex: 1,
        cellClass: "font-mono font-semibold text-amber-400",
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        cellRenderer: (params: any) => (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <Check size={14} /> {params.value}
          </span>
        ),
      },
      {
        field: "approve_url",
        headerName: "Checkout",
        flex: 1.2,
        cellRenderer: (params: any) =>
          params.value ? (
            <a
              href={params.value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              Open PayPal <ArrowUpRight size={14} />
            </a>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-[#09090B] text-zinc-100 py-10 px-6 font-sans antialiased selection:bg-amber-500/20">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Minimal Header */}
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              PactPay
            </h1>
            <span className="text-zinc-600">/</span>
            <span className="text-sm text-zinc-400">Autonomous B2B Procurement</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            PayPal Sandbox
          </div>
        </header>

        {/* Clean Control Bar */}
        <section className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Product</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. keyboard, bottle, hoodie"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-500/60 outline-none transition-colors"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Units</label>
              <input
                type="number"
                value={quantity || ""}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 font-mono focus:border-amber-500/60 outline-none transition-colors"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Budget ($)</label>
              <input
                type="number"
                value={budget || ""}
                onChange={(e) => setBudget(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 font-mono focus:border-amber-500/60 outline-none transition-colors"
              />
            </div>

            <div className="md:col-span-3">
              <button
                onClick={startNegotiation}
                disabled={isNegotiating}
                className="w-full h-[42px] bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-zinc-950 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isNegotiating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Negotiating
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" /> Dispatch
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Uncluttered Negotiation Stream */}
        <section className="bg-[#121215] border border-zinc-800/80 rounded-2xl overflow-hidden">
          <div className="px-6 py-3.5 border-b border-zinc-800/80 flex justify-between items-center">
            <span className="text-xs font-medium text-zinc-400">Live Negotiation</span>
            <div className="flex items-center gap-5 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Buyer
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-400" /> Supplier
              </span>
            </div>
          </div>

          <div
            ref={feedScrollRef}
            className="p-6 h-[380px] overflow-y-auto space-y-4 scroll-smooth custom-scrollbar"
          >
            <AnimatePresence initial={false}>
              {logs.length === 0 && !isNegotiating && (
                <div className="h-full flex items-center justify-center text-sm text-zinc-600">
                  Ready to dispatch procurement agents.
                </div>
              )}

              {logs.map((log) => {
                if (log.sender === "SYSTEM") {
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="flex justify-center py-1"
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900/80 border border-zinc-800/60 px-3 py-1 rounded-full">
                        <Sparkles size={11} className="text-amber-500" />
                        {log.cleanText}
                      </span>
                    </motion.div>
                  );
                }

                const isBuyer = log.sender === "BUYER";

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className={`flex ${isBuyer ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-5 py-4 border ${isBuyer
                        ? "bg-amber-500/[0.06] border-amber-500/20"
                        : log.accepted
                          ? "bg-emerald-500/[0.06] border-emerald-500/25"
                          : "bg-zinc-900/90 border-zinc-800"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1.5">
                        <span
                          className={`text-xs font-semibold ${isBuyer
                            ? "text-amber-400"
                            : log.accepted
                              ? "text-emerald-400"
                              : "text-zinc-300"
                            }`}
                        >
                          {isBuyer ? "Buyer Agent" : "Supplier Agent"}
                          {log.round ? ` · Round ${log.round}` : ""}
                        </span>

                        {log.price !== undefined && (
                          <span className="font-mono text-xs font-semibold text-zinc-100 bg-zinc-950/80 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                            ${log.price.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {log.cleanText}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* Minimal Settlement Table */}
        <section className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-medium text-zinc-400">Settlements</h2>
            <span className="text-xs text-zinc-500 font-mono">
              {rowData.length} completed
            </span>
          </div>

          <div className="ag-theme-alpine minimal-dark-grid w-full h-40 rounded-xl overflow-hidden border border-zinc-800/80">
            <AgGridReact
              rowData={rowData}
              columnDefs={colDefs}
              animateRows={true}
              rowHeight={44}
              headerHeight={38}
            />
          </div>
        </section>

      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .minimal-dark-grid.ag-theme-alpine {
          --ag-background-color: #09090B !important;
          --ag-header-background-color: #121215 !important;
          --ag-odd-row-background-color: #0c0c0f !important;
          --ag-row-hover-color: rgba(245, 158, 11, 0.05) !important;
          --ag-border-color: #27272a !important;
          --ag-header-foreground-color: #71717a !important;
          --ag-foreground-color: #e4e4e7 !important;
          --ag-font-family: inherit !important;
          --ag-font-size: 13px !important;
        }
        .minimal-dark-grid .ag-root-wrapper {
          border: none !important;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
      `,
        }}
      />
    </main>
  );
}
