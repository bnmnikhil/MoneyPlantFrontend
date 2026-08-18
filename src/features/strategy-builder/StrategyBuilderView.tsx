import { useEffect, useState, useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Plus,
  Trash2,
  Layers,
  Sliders,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { useStrategyMetadata } from "@/features/payoff/hooks";
import { api } from "@/lib/api";
import { formatINR, formatINRWhole, formatNumber, formatSignedINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  SimulatedLeg,
  StrategySimulationResponse,
  UnderlyingConfig,
  PayoffLeg,
} from "@/types/api";

interface EditableLeg extends SimulatedLeg {
  id: string;
  enabled: boolean;
}

interface StrategyBuilderProps {
  initialUnderlying?: string;
  initialLegs?: PayoffLeg[];
  onBackToLive?: () => void;
}

const DEFAULT_UNDERLYING = "NIFTY";

/**
 * A plausible seed premium for a generated leg.
 *
 * This is a placeholder, not a pricing model. Nothing in the stack can quote a
 * single strike yet -- Alice Blue's option chain is still unverified -- so a
 * template has to seed *something* the user can then overwrite. Do not tune it:
 * replace the call sites with real quotes the moment a chain feed lands.
 */
function estimateOptionPrice(
  spot: number,
  strike: number,
  type: "CE" | "PE"
): number {
  const intrinsic =
    type === "CE" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const timeVal = Math.max(10, spot * 0.012 - Math.abs(spot - strike) * 0.05);
  return Math.round((intrinsic + timeVal) * 10) / 10;
}

export function StrategyBuilderView({
  initialUnderlying,
  initialLegs,
  onBackToLive,
}: StrategyBuilderProps) {
  const { data: metadata } = useStrategyMetadata();

  const [selectedUnderlying, setSelectedUnderlying] = useState(
    initialUnderlying || DEFAULT_UNDERLYING
  );
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [activeTemplate, setActiveTemplate] = useState<string>("BULL_CALL_SPREAD");
  const [legs, setLegs] = useState<EditableLeg[]>([]);
  const [simulation, setSimulation] = useState<StrategySimulationResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [targetSpot, setTargetSpot] = useState<number | null>(null);
  // The spot the current template's strikes were generated around. Needed
  // because the first template is necessarily built before any live spot is
  // known -- see the re-centring effect below.
  const [templateSpot, setTemplateSpot] = useState<number | null>(null);

  // Active underlying configuration
  const currentConfig: UnderlyingConfig = useMemo(() => {
    if (!metadata?.underlyings) {
      return {
        code: selectedUnderlying,
        label: selectedUnderlying,
        isIndex: true,
        lotSize: 75,
        strikeStep: 50,
        defaultSpot: 24500,
      };
    }
    return (
      metadata.underlyings.find((u) => u.code === selectedUnderlying) ||
      metadata.underlyings[0]
    );
  }, [metadata, selectedUnderlying]);

  // Set default expiry when metadata loads
  useEffect(() => {
    if (metadata?.expiries && metadata.expiries.length > 0 && !selectedExpiry) {
      setSelectedExpiry(metadata.expiries[0]);
    }
  }, [metadata, selectedExpiry]);

  // Helper to generate template legs
  const loadTemplateLegs = useCallback(
    (templateId: string, underlying: string, expiryDate?: string) => {
      const uConfig =
        metadata?.underlyings?.find((u) => u.code === underlying) || currentConfig;
      const spot = simulation?.spot || uConfig.defaultSpot;
      const step = uConfig.strikeStep;
      const lot = uConfig.lotSize;
      const exp = expiryDate || selectedExpiry || metadata?.expiries?.[0] || "";

      const atm = Math.round(spot / step) * step;

      const estimatePrice = (strike: number, type: "CE" | "PE") =>
        estimateOptionPrice(spot, strike, type);

      let newLegs: EditableLeg[] = [];

      switch (templateId) {
        case "BULL_CALL_SPREAD":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "CE",
              qty: lot,
              price: estimatePrice(atm, "CE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm + step,
              type: "CE",
              qty: -lot,
              price: estimatePrice(atm + step, "CE"),
              enabled: true,
            },
          ];
          break;
        case "BULL_PUT_SPREAD":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "PE",
              qty: -lot,
              price: estimatePrice(atm, "PE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm - step,
              type: "PE",
              qty: lot,
              price: estimatePrice(atm - step, "PE"),
              enabled: true,
            },
          ];
          break;
        case "BEAR_PUT_SPREAD":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "PE",
              qty: lot,
              price: estimatePrice(atm, "PE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm - step,
              type: "PE",
              qty: -lot,
              price: estimatePrice(atm - step, "PE"),
              enabled: true,
            },
          ];
          break;
        case "BEAR_CALL_SPREAD":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "CE",
              qty: -lot,
              price: estimatePrice(atm, "CE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm + step,
              type: "CE",
              qty: lot,
              price: estimatePrice(atm + step, "CE"),
              enabled: true,
            },
          ];
          break;
        case "SHORT_STRADDLE":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "CE",
              qty: -lot,
              price: estimatePrice(atm, "CE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm,
              type: "PE",
              qty: -lot,
              price: estimatePrice(atm, "PE"),
              enabled: true,
            },
          ];
          break;
        case "LONG_STRADDLE":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "CE",
              qty: lot,
              price: estimatePrice(atm, "CE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm,
              type: "PE",
              qty: lot,
              price: estimatePrice(atm, "PE"),
              enabled: true,
            },
          ];
          break;
        case "SHORT_STRANGLE":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm + step,
              type: "CE",
              qty: -lot,
              price: estimatePrice(atm + step, "CE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm - step,
              type: "PE",
              qty: -lot,
              price: estimatePrice(atm - step, "PE"),
              enabled: true,
            },
          ];
          break;
        case "LONG_STRANGLE":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm + step,
              type: "CE",
              qty: lot,
              price: estimatePrice(atm + step, "CE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm - step,
              type: "PE",
              qty: lot,
              price: estimatePrice(atm - step, "PE"),
              enabled: true,
            },
          ];
          break;
        case "IRON_CONDOR":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm - step,
              type: "PE",
              qty: -lot,
              price: estimatePrice(atm - step, "PE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm - 2 * step,
              type: "PE",
              qty: lot,
              price: estimatePrice(atm - 2 * step, "PE"),
              enabled: true,
            },
            {
              id: "3",
              underlying,
              expiry: exp,
              strike: atm + step,
              type: "CE",
              qty: -lot,
              price: estimatePrice(atm + step, "CE"),
              enabled: true,
            },
            {
              id: "4",
              underlying,
              expiry: exp,
              strike: atm + 2 * step,
              type: "CE",
              qty: lot,
              price: estimatePrice(atm + 2 * step, "CE"),
              enabled: true,
            },
          ];
          break;
        case "IRON_BUTTERFLY":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "CE",
              qty: -lot,
              price: estimatePrice(atm, "CE"),
              enabled: true,
            },
            {
              id: "2",
              underlying,
              expiry: exp,
              strike: atm,
              type: "PE",
              qty: -lot,
              price: estimatePrice(atm, "PE"),
              enabled: true,
            },
            {
              id: "3",
              underlying,
              expiry: exp,
              strike: atm + step,
              type: "CE",
              qty: lot,
              price: estimatePrice(atm + step, "CE"),
              enabled: true,
            },
            {
              id: "4",
              underlying,
              expiry: exp,
              strike: atm - step,
              type: "PE",
              qty: lot,
              price: estimatePrice(atm - step, "PE"),
              enabled: true,
            },
          ];
          break;
        case "LONG_CALL":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "CE",
              qty: lot,
              price: estimatePrice(atm, "CE"),
              enabled: true,
            },
          ];
          break;
        case "LONG_PUT":
          newLegs = [
            {
              id: "1",
              underlying,
              expiry: exp,
              strike: atm,
              type: "PE",
              qty: lot,
              price: estimatePrice(atm, "PE"),
              enabled: true,
            },
          ];
          break;
        default:
          break;
      }

      // CUSTOM -- and any id this switch does not know -- produces no legs, and
      // an empty result must NOT be written through. Every manual edit sets
      // activeTemplate to CUSTOM, so the underlying and expiry handlers used to
      // call this with "CUSTOM" and silently delete the whole strategy. A
      // template that generates nothing means "I have nothing to say about
      // these legs", never "clear them".
      if (newLegs.length === 0) return;
      setTemplateSpot(spot);
      setLegs(newLegs);
    },
    [metadata, currentConfig, simulation?.spot, selectedExpiry]
  );

  /**
   * Moves a hand-built strategy to another expiry or underlying, keeping its shape.
   *
   * A CUSTOM strategy has no recipe to regenerate from, so the alternative to
   * this is discarding the user's work. Changing expiry alone leaves strikes and
   * sizes meaning exactly what they meant. Changing underlying does not: a
   * NIFTY 24500 strike is nonsense on BANKNIFTY, so each leg is re-expressed by
   * its offset from ATM *in strike steps* and its size in *lots* -- which is
   * what the structure actually was. A 2-step-wide condor stays a 2-step-wide
   * condor. Seed premiums are re-estimated because the old ones priced a
   * different instrument.
   */
  const retargetCustomLegs = useCallback(
    (fromCode: string, toCode: string, nextExpiry: string) => {
      const find = (code: string) =>
        metadata?.underlyings?.find((u) => u.code === code);
      const from = find(fromCode) || currentConfig;
      const to = find(toCode) || currentConfig;

      setLegs((prev) => {
        if (prev.length === 0) return prev;

        if (from.code === to.code) {
          return prev.map((l) => ({ ...l, expiry: nextExpiry }));
        }

        const fromSpot = simulation?.spot || from.defaultSpot;
        const toSpot = to.defaultSpot;
        const fromAtm =
          Math.round(fromSpot / from.strikeStep) * from.strikeStep;
        const toAtm = Math.round(toSpot / to.strikeStep) * to.strikeStep;

        return prev.map((l) => {
          const offsetSteps = Math.round((l.strike - fromAtm) / from.strikeStep);
          const strike = toAtm + offsetSteps * to.strikeStep;
          const lots = Math.max(1, Math.round(Math.abs(l.qty) / from.lotSize));
          const direction = l.qty < 0 ? -1 : 1;
          return {
            ...l,
            underlying: to.code,
            expiry: nextExpiry,
            strike,
            qty: direction * lots * to.lotSize,
            price:
              l.type === "CE" || l.type === "PE"
                ? estimateOptionPrice(toSpot, strike, l.type)
                : toSpot,
          };
        });
      });
    },
    [metadata, currentConfig, simulation?.spot]
  );

  // Initialize legs on mount (or when imported from live position)
  useEffect(() => {
    if (initialLegs && initialLegs.length > 0) {
      const imported: EditableLeg[] = initialLegs.map((l, idx) => ({
        id: `imported-${idx}`,
        underlying: selectedUnderlying,
        expiry: selectedExpiry || metadata?.expiries?.[0] || "",
        strike: l.strike,
        type: l.type,
        qty: l.qty,
        price: l.avgPrice,
        enabled: true,
      }));
      setLegs(imported);
      setActiveTemplate("CUSTOM");
    } else if (legs.length === 0 && metadata) {
      loadTemplateLegs("BULL_CALL_SPREAD", selectedUnderlying);
    }
  }, [initialLegs, metadata]);

  // Run simulation whenever legs, underlying, or expiry change
  useEffect(() => {
    const activeLegs = legs.filter((l) => l.enabled && l.qty !== 0);
    if (activeLegs.length === 0) {
      setSimulation(null);
      return;
    }

    let isMounted = true;
    setIsSimulating(true);

    // `spot` is deliberately omitted rather than sent.
    //
    // Sending currentConfig.defaultSpot here anchored every simulation to a
    // hardcoded literal (NIFTY 24500), because simulateStrategy prefers the
    // request's spot whenever it is > 0 -- so SpotPriceService was never
    // consulted and margins, ATM strikes and breakevens were all computed
    // around an invented underlying price. Omitting the field lets the server
    // resolve live spot, and fall back to its own default only when no broker
    // can quote. The fallback belongs there, beside the live source.
    //
    // Send a spot from here only for an explicit what-if ("price this at
    // 25,000"), which is a different feature from "price this now".
    const payload = {
      underlying: selectedUnderlying,
      legs: activeLegs.map((l) => ({
        underlying: l.underlying,
        expiry: l.expiry,
        strike: l.strike,
        type: l.type,
        qty: l.qty,
        price: l.price,
      })),
    };

    api
      .simulateStrategy(payload)
      .then((res) => {
        if (isMounted) {
          setSimulation(res);
          if (targetSpot === null && res.spot > 0) {
            setTargetSpot(res.spot);
          }
        }
      })
      .catch((err) => {
        console.error("Strategy simulation failed:", err);
      })
      .finally(() => {
        if (isMounted) setIsSimulating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [legs, selectedUnderlying]);

  // Re-centre an untouched template once the real spot is known.
  //
  // The first template has to be generated before any simulation has run, so it
  // is necessarily built around the server's default spot. When the response
  // comes back carrying the live one, strikes generated around the placeholder
  // are stale -- a "Bull Call Spread on NIFTY" centred on 24500 while NIFTY is
  // at 24870 is centred two strikes away from the money.
  //
  // Only pristine templates are re-centred: CUSTOM means the user has edited
  // something, and moving their strikes under them would be worse than a stale
  // ATM. Converges in one extra roundtrip -- after the rebuild templateSpot
  // equals the live spot, so the ATMs match and this does not fire again.
  useEffect(() => {
    const live = simulation?.spot ?? 0;
    if (live <= 0 || templateSpot === null) return;
    if (activeTemplate === "CUSTOM") return;

    const step = currentConfig.strikeStep;
    if (Math.round(live / step) === Math.round(templateSpot / step)) return;

    loadTemplateLegs(activeTemplate, selectedUnderlying);
  }, [simulation?.spot, templateSpot, activeTemplate, currentConfig.strikeStep]);

  // Leg editor handlers
  const handleUnderlyingChange = (code: string) => {
    const fromCode = selectedUnderlying;
    setSelectedUnderlying(code);
    if (activeTemplate === "CUSTOM") {
      retargetCustomLegs(fromCode, code, selectedExpiry);
    } else {
      loadTemplateLegs(activeTemplate, code);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setActiveTemplate(templateId);
    loadTemplateLegs(templateId, selectedUnderlying);
  };

  const handleAddLeg = () => {
    const spot = simulation?.spot || currentConfig.defaultSpot;
    const atm = Math.round(spot / currentConfig.strikeStep) * currentConfig.strikeStep;
    const newLeg: EditableLeg = {
      id: Date.now().toString(),
      underlying: selectedUnderlying,
      expiry: selectedExpiry || metadata?.expiries?.[0] || "",
      strike: atm,
      type: "CE",
      qty: currentConfig.lotSize,
      price: 100.0,
      enabled: true,
    };
    setLegs([...legs, newLeg]);
    setActiveTemplate("CUSTOM");
  };

  const handleRemoveLeg = (id: string) => {
    setLegs(legs.filter((l) => l.id !== id));
    setActiveTemplate("CUSTOM");
  };

  const handleToggleLeg = (id: string) => {
    setLegs(
      legs.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l))
    );
  };

  const handleUpdateLeg = (id: string, updates: Partial<EditableLeg>) => {
    setLegs(
      legs.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
    setActiveTemplate("CUSTOM");
  };

  const handleStrikeStep = (id: string, delta: number) => {
    const leg = legs.find((l) => l.id === id);
    if (!leg) return;
    const newStrike = Math.max(
      currentConfig.strikeStep,
      leg.strike + delta * currentConfig.strikeStep
    );
    handleUpdateLeg(id, { strike: newStrike });
  };

  const handleLotStep = (id: string, deltaLots: number) => {
    const leg = legs.find((l) => l.id === id);
    if (!leg) return;
    const isShort = leg.qty < 0;
    const currentLots = Math.max(1, Math.round(Math.abs(leg.qty) / currentConfig.lotSize));
    const newLots = Math.max(1, currentLots + deltaLots);
    const newQty = (isShort ? -1 : 1) * (newLots * currentConfig.lotSize);
    handleUpdateLeg(id, { qty: newQty });
  };

  const handleToggleDirection = (id: string) => {
    const leg = legs.find((l) => l.id === id);
    if (!leg) return;
    handleUpdateLeg(id, { qty: -leg.qty });
  };

  // Calculate target spot expected P&L
  const targetSpotPnl = useMemo(() => {
    if (!simulation || targetSpot === null || targetSpot <= 0) return 0;
    let totalPnl = 0;
    for (const leg of legs.filter((l) => l.enabled)) {
      let intrinsic = 0;
      if (leg.type === "CE") {
        intrinsic = Math.max(0, targetSpot - leg.strike);
      } else if (leg.type === "PE") {
        intrinsic = Math.max(0, leg.strike - targetSpot);
      } else if (leg.type === "FUT") {
        intrinsic = targetSpot - leg.strike;
      }
      totalPnl += (intrinsic - leg.price) * leg.qty;
    }
    return Math.round(totalPnl);
  }, [simulation, targetSpot, legs]);

  const spotVal = simulation?.spot || currentConfig.defaultSpot;

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Underlying Chips */}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Underlying:
          </span>
          {metadata?.underlyings?.slice(0, 6).map((u) => (
            <button
              key={u.code}
              type="button"
              onClick={() => handleUnderlyingChange(u.code)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                selectedUnderlying === u.code
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-secondary/40 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {u.code}
            </button>
          ))}
        </div>

        {/* Spot and Expiry Details */}
        <div className="flex items-center gap-4">
          {metadata?.expiries && metadata.expiries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Expiry:</span>
              <select
                value={selectedExpiry}
                onChange={(e) => {
                  const next = e.target.value;
                  setSelectedExpiry(next);
                  if (activeTemplate === "CUSTOM") {
                    retargetCustomLegs(selectedUnderlying, selectedUnderlying, next);
                  } else {
                    loadTemplateLegs(activeTemplate, selectedUnderlying, next);
                  }
                }}
                className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {metadata.expiries.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-md bg-accent/40 px-3 py-1 text-xs">
            <span className="text-muted-foreground">Spot:</span>
            <span className="font-semibold text-foreground">{formatINR(spotVal)}</span>
          </div>

          {onBackToLive && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToLive}
              className="text-xs font-medium"
            >
              Back to Live Book
            </Button>
          )}
        </div>
      </div>

      {/* Template Quick Selection */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Preset Recipes:</span>
        {metadata?.templates?.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => handleTemplateChange(tpl.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeTemplate === tpl.id
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title={tpl.description}
          >
            {tpl.label}
          </button>
        ))}
      </div>

      {/* Main Workspace: 2-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Strategy Legs Builder (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Strategy Legs</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {legs.filter((l) => l.enabled).length} active leg(s) · Lot size:{" "}
                  {currentConfig.lotSize}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLegs([])}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddLeg}
                  className="h-8 px-3 text-xs font-medium"
                >
                  <Plus className="mr-1 size-3.5" />
                  Add Leg
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-0">
              {legs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
                  <Layers className="size-8 opacity-40" />
                  <p className="mt-2 text-sm">No legs added yet.</p>
                  <p className="text-xs text-muted-foreground/80">
                    Pick a strategy recipe above or click "+ Add Leg" to build your custom trade.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {legs.map((leg, idx) => {
                    const isShort = leg.qty < 0;
                    const lots = Math.max(
                      1,
                      Math.round(Math.abs(leg.qty) / currentConfig.lotSize)
                    );
                    const breakdown = simulation?.margin?.legs?.[idx];

                    return (
                      <div
                        key={leg.id}
                        className={cn(
                          "flex flex-col gap-3 py-3 transition-opacity",
                          !leg.enabled && "opacity-40"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {/* Enable Checkbox */}
                            <input
                              type="checkbox"
                              checked={leg.enabled}
                              onChange={() => handleToggleLeg(leg.id)}
                              className="size-4 rounded border-border text-primary focus:ring-primary"
                              title="Toggle leg in simulation"
                            />

                            {/* Buy / Sell Pill Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleDirection(leg.id)}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-colors",
                                isShort
                                  ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                                  : "bg-profit/15 text-profit hover:bg-profit/25"
                              )}
                            >
                              {isShort ? "SELL" : "BUY"}
                            </button>

                            {/* Option Right (CE / PE) */}
                            <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs font-medium">
                              <button
                                type="button"
                                onClick={() => handleUpdateLeg(leg.id, { type: "CE" })}
                                className={cn(
                                  "rounded px-2 py-0.5 transition-colors",
                                  leg.type === "CE"
                                    ? "bg-profit text-profit-foreground font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                CE
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateLeg(leg.id, { type: "PE" })}
                                className={cn(
                                  "rounded px-2 py-0.5 transition-colors",
                                  leg.type === "PE"
                                    ? "bg-destructive text-destructive-foreground font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                PE
                              </button>
                            </div>
                          </div>

                          {/* Strike Stepper */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Strike:</span>
                            <div className="flex items-center rounded-md border border-border bg-background px-1">
                              <button
                                type="button"
                                onClick={() => handleStrikeStep(leg.id, -1)}
                                className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                              >
                                −
                              </button>
                              <span className="min-w-[60px] text-center text-xs font-semibold">
                                {formatNumber(leg.strike)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStrikeStep(leg.id, 1)}
                                className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Lots Stepper */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Lots:</span>
                            <div className="flex items-center rounded-md border border-border bg-background px-1">
                              <button
                                type="button"
                                onClick={() => handleLotStep(leg.id, -1)}
                                className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                              >
                                −
                              </button>
                              <span className="min-w-[28px] text-center text-xs font-semibold">
                                {lots}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleLotStep(leg.id, 1)}
                                className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Entry Price Input */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Price:</span>
                            <input
                              type="number"
                              step="0.5"
                              value={leg.price}
                              onChange={(e) =>
                                handleUpdateLeg(leg.id, {
                                  price: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-16 rounded-md border border-border bg-background px-2 py-0.5 text-right text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          {/* Delete Leg Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveLeg(leg.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Remove leg"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        {/* Leg Margin Breakdown Footer */}
                        {breakdown && breakdown.standaloneMargin > 0 && (
                          <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground/80 bg-accent/20 px-2.5 py-1 rounded">
                            <span>
                              Standalone Margin:{" "}
                              <strong className="text-foreground">
                                {formatINRWhole(breakdown.standaloneMargin)}
                              </strong>
                            </span>
                            {breakdown.hedgeBenefit > 0 && (
                              <span className="text-profit">
                                Hedge Benefit:{" "}
                                <strong>-{formatINRWhole(breakdown.hedgeBenefit)}</strong>
                              </span>
                            )}
                            <span>
                              Hedged Obligation:{" "}
                              <strong className="text-foreground">
                                {formatINRWhole(breakdown.hedgedMargin)}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Capital & Margin Requirements Card */}
          {simulation?.margin && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-primary" />
                    Margin & Capital Breakdown (Bottom-Up SEBI Engine)
                  </span>
                  {simulation.margin.hedgeBenefit > 0 && (
                    <Badge variant="success" className="font-semibold text-[11px]">
                      Saved {formatINRWhole(simulation.margin.hedgeBenefit)} Hedge Benefit
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-muted-foreground">Final Margin</p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {formatINRWhole(simulation.margin.withBenefitMargin)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-muted-foreground">Initial Unhedged</p>
                  <p className="mt-1 text-base font-medium text-muted-foreground">
                    {formatINRWhole(simulation.margin.initialMargin)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-muted-foreground">Net Premium</p>
                  <p
                    className={cn(
                      "mt-1 text-base font-bold",
                      simulation.metrics.netPremium >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    {simulation.metrics.netPremium >= 0 ? "+" : ""}
                    {formatINR(simulation.metrics.netPremium)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-primary/10 p-3">
                  <p className="font-medium text-primary">Total Funds Needed</p>
                  <p className="mt-1 text-base font-extrabold text-foreground">
                    {formatINRWhole(simulation.metrics.totalFundsRequired)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Real-Time Payoff Chart & Analytics (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Key Strategy Metrics Banner */}
          {simulation?.payoff && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="Max Profit"
                value={
                  simulation.payoff.unboundedProfit
                    ? "Unlimited"
                    : formatSignedINR(simulation.payoff.maxProfit)
                }
                valueClassName="text-profit"
                icon={<TrendingUp />}
              />
              <StatCard
                label="Max Loss"
                // maxLoss is a signed P&L and is already negative, so the old
                // manual "-" prefix rendered "--₹8,250.00". formatSignedINR
                // carries the sign for both tiles.
                value={
                  simulation.payoff.unboundedLoss
                    ? "Unlimited"
                    : formatSignedINR(simulation.payoff.maxLoss)
                }
                valueClassName="text-loss"
                icon={<TrendingDown />}
              />
              <StatCard
                label="Risk : Reward"
                value={simulation.metrics.riskRewardRatio}
                icon={<Target />}
              />
            </div>
          )}

          {/* Payoff Chart Canvas */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Payoff Curve at Expiry</CardTitle>
                  {isSimulating && (
                    <span className="text-[10px] text-muted-foreground animate-pulse">
                      Updating...
                    </span>
                  )}
                </div>
                {simulation?.payoff?.breakevens && simulation.payoff.breakevens.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Breakeven:{" "}
                    <strong className="text-foreground">
                      {simulation.payoff.breakevens.map((b) => formatNumber(b)).join(", ")}
                    </strong>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              {simulation?.payoff ? (
                <PayoffChart payoff={simulation.payoff} spot={spotVal} />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-xs text-muted-foreground">
                  Add or enable legs to visualize the strategy payoff curve.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Target Price & P&L Interactive Probe Slider */}
          {simulation?.payoff && spotVal > 0 && (
            <Card className="border-border bg-card/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-primary" />
                    Target Spot Inspector:
                  </span>
                  <span className="font-bold text-foreground">
                    {formatINR(targetSpot || spotVal)}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({(((targetSpot || spotVal) - spotVal) / spotVal * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>

                <input
                  type="range"
                  min={Math.round(spotVal * 0.9)}
                  max={Math.round(spotVal * 1.1)}
                  step={currentConfig.strikeStep}
                  value={targetSpot || spotVal}
                  onChange={(e) => setTargetSpot(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />

                <div className="flex items-center justify-between rounded-lg bg-background p-2.5 text-xs">
                  <span className="text-muted-foreground">Expected P&amp;L at Expiry:</span>
                  <span
                    className={cn(
                      "font-extrabold text-sm",
                      targetSpotPnl >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    {targetSpotPnl >= 0 ? "+" : ""}
                    {formatINR(targetSpotPnl)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
