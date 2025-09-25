import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  close: number;
  previousHigh?: number;
  previousLow?: number;
  lastUpdated: string;
  // New fields for transparency
  source?: "alpha" | "yahoo" | "yahoo-spot";
  isFallback?: boolean;
}

export interface MarketBias {
  type: 'bullish' | 'bearish' | 'neutral';
  reason: string;
  averagePrice?: number;
  isInsideBar?: boolean;
}

interface MarketCardProps {
  data: MarketData;
  bias: MarketBias;
  showBias: boolean;
  predictionDate?: string;
}

export const MarketCard = ({ data, bias, showBias, predictionDate }: MarketCardProps) => {
  const getBiasIndicator = () => {
    // Position indicator fully inside the card to avoid clipping
    const wrapperCls = "absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full border-2 border-white/70 bg-transparent pointer-events-none drop-shadow-sm";
    switch (bias.type) {
      case 'bullish':
        return (
          <div className={wrapperCls}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="fill-bullish">
              <path d="M12 3l9 18H3z" shapeRendering="geometricPrecision" />
            </svg>
          </div>
        );
      case 'bearish':
        return (
          <div className={wrapperCls}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="fill-bearish rotate-180">
              <path d="M12 3l9 18H3z" shapeRendering="geometricPrecision" />
            </svg>
          </div>
        );
      default:
        return (
          <div className={wrapperCls}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="fill-neutral">
              <circle cx="12" cy="12" r="9" shapeRendering="geometricPrecision" />
            </svg>
          </div>
        );
    }
  };

  const getBiasIcon = () => {
    switch (bias.type) {
      case 'bullish':
        return <TrendingUp className="h-5 w-5" />;
      case 'bearish':
        return <TrendingDown className="h-5 w-5" />;
      default:
        return <Minus className="h-5 w-5" />;
    }
  };

  const getBiasStyles = () => {
    switch (bias.type) {
      case 'bullish':
        return {
          // Make the badge always prominent (same color as hover)
          badge: "bg-bullish text-bullish-foreground border-bullish hover:bg-bullish",
          glow: "shadow-glow-bullish",
          header: "from-bullish/30 to-transparent"
        };
      case 'bearish':
        return {
          badge: "bg-gradient-bearish text-bearish-foreground border-bearish/50",
          glow: "shadow-glow-bearish",
          header: "from-bearish/30 to-transparent"
        };
      default:
        return {
          badge: "bg-gradient-neutral text-neutral-foreground border-neutral/50",
          glow: "shadow-glow-neutral",
          header: "from-neutral/30 to-transparent"
        };
    }
  };

  const styles = getBiasStyles();
  const isPositive = data.change >= 0;
  const sourceLabel = data.source === 'alpha' ? 'Alpha Vantage' : data.source === 'yahoo-spot' ? 'Yahoo (Spot)' : 'Yahoo';

  return (
    <Card className={cn(
      "relative p-0 overflow-hidden bg-gradient-trading transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border border-white/60",
      showBias && styles.glow
    )}>
      {/* Decorative header gradient */}
      <div className={cn("h-2 w-full bg-gradient-to-r", styles.header)} />

      {/* Bias Indicator */}
      {getBiasIndicator()}
      
      <div className="p-6 space-y-4 bg-card/40">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-foreground">{data.name}</h3>
              {showBias && (
                <Badge className={cn("flex items-center gap-1.5 px-3 py-1 border font-semibold", styles.badge)}>
                  {getBiasIcon()}
                  <span className="font-semibold capitalize">{bias.type}</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground tracking-wider">{data.symbol}</p>
              {/* Fallback badge for transparency */}
              {data.isFallback && (
                <Badge className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-200 border-amber-400/40 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Fallback Source
                </Badge>
              )}
            </div>
          </div>
          {/* Right header column removed: Source moved to footer */}
        </div>

        {/* Price Information */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-foreground">
              ${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={cn(
              "text-lg font-semibold flex items-center gap-1",
              isPositive ? "text-price-up" : "text-price-down"
            )}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? '+' : ''}{data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)
            </span>
          </div>

          {/* OHLC Data */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open:</span>
                <span className="text-foreground font-medium">${data.open.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">High:</span>
                <span className="text-price-up font-medium">${data.high.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Close:</span>
                <span className="text-foreground font-medium">${data.close.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Low:</span>
                <span className="text-price-down font-medium">${data.low.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bias Information */}
        {showBias && (
          <div className="pt-4 border-t border-border/50">
            <div className="space-y-3">
              <div className="flex items-center flex-wrap gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Next Day Bias:</span>
                {predictionDate && (
                  <Badge variant="secondary" className="text-xs">{predictionDate}</Badge>
                )}
              </div>
              <p className="text-sm text-foreground">{bias.reason}</p>
              {bias.averagePrice && (
                <p className="text-xs text-muted-foreground">
                  Average Price: ${bias.averagePrice.toFixed(2)} vs Close: ${data.close.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{data.source ? `Source: ${sourceLabel}` : ''}</span>
          <span>Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>
    </Card>
  );
};