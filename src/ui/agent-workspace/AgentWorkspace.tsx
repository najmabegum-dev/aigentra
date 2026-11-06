"use client";

import React, { useState, useEffect } from "react";
import { Search, ShoppingCart, Sparkles, Plus, Minus, Trash2, ArrowRight, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { Product } from "@/rooms/propose/catalog/types";
import { formatMoney } from "@/lib/money";
import { DecisionCard, DecisionCardProps } from "./DecisionCard";

interface CartEntry {
  product: Product;
  quantity: number;
}

export function AgentWorkspace() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string>("Seeded");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<DecisionCardProps | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedGoal, setParsedGoal] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(null);

  // Initial catalog load on mount
  useEffect(() => {
    fetchProducts("");
  }, []);

  const fetchProducts = async (searchQuery: string) => {
    setLoading(true);
    setErrorMsg(null);
    setClarifyingQuestion(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=12`);
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
        setSourceLabel(data.label || "Seeded");
        if (searchQuery.trim()) {
          setParsedGoal(`Search: "${searchQuery}"`);
        }
      } else {
        setErrorMsg("Failed to load products from catalog.");
      }
    } catch (err) {
      setErrorMsg("Error communicating with search API.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(query);
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.sku === product.sku);
      if (existing) {
        return prev.map((item) =>
          item.product.sku === product.sku
            ? { ...item, quantity: Math.min(item.quantity + 1, 99) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (sku: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.sku === sku) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: Math.min(nextQty, 99) } : null;
          }
          return item;
        })
        .filter(Boolean) as CartEntry[]
    );
  };

  const removeFromCart = (sku: string) => {
    setCart((prev) => prev.filter((item) => item.product.sku !== sku));
  };

  const cartTotalCents = cart.reduce(
    (acc, item) => acc + item.product.price_cents * item.quantity,
    0
  );

  const handleBuildProposal = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    setDecision(null);

    try {
      const payload = {
        items: cart.map((item) => ({
          sku: item.product.sku,
          quantity: item.quantity,
          // Sending untrusted client price to demonstrate server recomputation
          unit_price_cents: 1,
        })),
      };

      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.decisionCard) {
        setDecision({
          ...data.decisionCard,
          proposalId: data.proposal.id,
          totalCents: data.proposal.total_cents,
        });
      } else {
        setErrorMsg(data.error || "Failed to build proposal.");
      }
    } catch (err) {
      setErrorMsg("Error communicating with proposal authorization service.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-primary" />
            Agent Workspace
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Search live Channel3 or seeded products, build shopping carts, and evaluate proposals against deterministic policies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            Catalog Source: <strong className="text-primary">{sourceLabel}</strong>
          </span>
        </div>
      </div>

      {/* Natural Language Intent & Search Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E.g. Find an ergonomic wireless keyboard and noise cancelling headphones..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border bg-zinc-50/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>

        {/* Intent Chips Row */}
        {parsedGoal && (
          <div className="mt-3 flex items-center gap-2 flex-wrap pt-3 border-t text-xs">
            <span className="text-zinc-500 font-medium">Parsed Goal:</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium">
              {parsedGoal}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border font-mono">
              Currency: USD
            </span>
          </div>
        )}

        {/* Clarifying Question Banner */}
        {clarifyingQuestion && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>{clarifyingQuestion}</span>
          </div>
        )}
      </div>

      {/* Decision Card (Rendered if evaluation occurred) */}
      {decision && (
        <DecisionCard
          verdict={decision.verdict}
          reasonCodes={decision.reasonCodes}
          ruleResults={decision.ruleResults}
          proposalHash={decision.proposalHash}
          evaluatedAt={decision.evaluatedAt}
          proposalId={decision.proposalId}
          totalCents={decision.totalCents}
          onProceed={async () => {
            if (decision.verdict === "ALLOW" && decision.proposalId) {
              try {
                await fetch(`/api/proposals/${decision.proposalId}/mandate`, {
                  method: "POST",
                });
              } catch (e) {
                console.error("Failed to issue POLICY_AUTO mandate:", e);
              }
            }
            window.location.href = `/checkout?proposal_id=${decision.proposalId}`;
          }}
        />
      )}

      {/* Main Grid: Products (2/3) + Cart (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Products Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Available Catalog Items ({products.length})
            </h2>
            {loading && <span className="text-xs text-zinc-500">Refreshing...</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map((product) => {
              const inCart = cart.some((item) => item.product.sku === product.sku);

              return (
                <div
                  key={product.sku}
                  className="rounded-xl border bg-white dark:bg-zinc-900 p-4 shadow-xs flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                >
                  <div>
                    {/* Image & Price */}
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-3 border">
                      {product.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">
                          No Preview
                        </div>
                      )}
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-zinc-900/80 backdrop-blur-xs text-white text-xs font-bold shadow-xs">
                        ${formatMoney(product.price_cents)}
                      </span>
                    </div>

                    {/* Metadata Header */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5">
                      <span className="font-mono text-zinc-600 dark:text-zinc-400">{product.merchant}</span>
                      {product.category && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 uppercase font-semibold text-[10px]">
                          {product.category}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 mb-1" title={product.title}>
                      {product.title}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-4">
                      {product.description || "No description provided."}
                    </p>
                  </div>

                  {/* Actions & Fetch Time */}
                  <div className="pt-3 border-t flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Fetched: {new Date(product.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => addToCart(product)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        inCart
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                          : "bg-primary text-white hover:bg-primary/90"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {inCart ? "Add More" : "Add to Cart"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart & Proposal Builder Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-5 sticky top-24">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Proposal Cart ({cart.reduce((a, b) => a + b.quantity, 0)})
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-zinc-400 hover:text-rose-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-10 text-center text-zinc-400 text-xs">
                Your cart is empty. Pick items from the catalog to evaluate a proposal.
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.product.sku}
                    className="p-3 rounded-lg border bg-zinc-50/50 dark:bg-zinc-800/40 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {item.product.title}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.sku)}
                        className="text-zinc-400 hover:text-rose-500 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-zinc-500">
                      <span className="font-mono">${formatMoney(item.product.price_cents)} each</span>
                      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded border px-1.5 py-0.5">
                        <button
                          onClick={() => updateQuantity(item.product.sku, -1)}
                          className="hover:text-zinc-800 dark:hover:text-zinc-200"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 min-w-[16px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.sku, 1)}
                          className="hover:text-zinc-800 dark:hover:text-zinc-200"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recomputed Subtotal Note (Golden Rule 5) */}
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500 font-medium">Recomputed Subtotal</span>
                <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  ${formatMoney(cartTotalCents)} USD
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                * Item prices and totals are verified strictly on the server from the official catalog.
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Build Proposal Button */}
            <button
              onClick={handleBuildProposal}
              disabled={cart.length === 0 || submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Authorizing Proposal...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Build & Authorize Proposal
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
