import { useState, useEffect, useRef } from "react";
import { MarketCard } from "./MarketCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { marketDataService } from "@/services/marketDataService";
import { MarketData, MarketBias } from "./MarketCard";
import { RefreshCw, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const TradingDashboard = () => {
  const [marketData, setMarketData] = useState<Array<{ data: MarketData; bias: MarketBias }>>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showBias, setShowBias] = useState(false);
  const [ukTime, setUkTime] = useState<string>("");
  const [predictionDateUK, setPredictionDateUK] = useState<string>("");
  const dailyTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await marketDataService.getAllMarketData();
      setMarketData(data);
      setLastUpdated(new Date());
      
      toast({
        title: "Market Data Updated",
        description: "Latest market data and bias calculations loaded",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error fetching market data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch market data. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTime = () => {
    const now = new Date();

    // Get London time parts without parsing localized strings
    const partsFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'long',
      hour12: false,
    });
    const parts = partsFmt.formatToParts(now);
    const num = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
    const year = num('year');
    const month = num('month');
    const day = num('day');
    const hour = num('hour');
    const minute = num('minute');
    const second = num('second');

    // Nice display string for UK time
    const ukTimeString = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(now);
    setUkTime(ukTimeString);

    // Bias window (11:01 PM to 6 AM UK time)
    const biasWindow = (hour === 23 && minute >= 1) || hour < 6;
    setShowBias(biasWindow);

    // Compute prediction date/day using a UTC-anchored date built from London Y-M-D
    let target = new Date(Date.UTC(year, month - 1, day));
    // Roll to next trading day starting at 23:01 UK
    if (hour === 23 && minute >= 1) {
      target.setUTCDate(target.getUTCDate() + 1);
    }

    // Skip weekends in London timezone
    const isWeekendLondon = (d: Date) => {
      const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(d);
      return wd === 'Sat' || wd === 'Sun';
    };
    while (isWeekendLondon(target)) {
      target.setUTCDate(target.getUTCDate() + 1);
    }

    const formattedTarget = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(target);
    setPredictionDateUK(formattedTarget);
  };

  useEffect(() => {
    fetchData();
    updateTime();
    
    // Update time every second
    const timeInterval = setInterval(updateTime, 1000);

    // Schedule a single daily fetch at 23:01 UK time
    const scheduleDailyFetch = () => {
      const now = new Date();
      const londonNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));

      // Compute next 23:01:00 London time
      const next = new Date(londonNow);
      next.setHours(23, 1, 0, 0);
      if (londonNow >= next) {
        // If it's already past 23:01, schedule for tomorrow
        next.setDate(next.getDate() + 1);
      }

      const delayMs = next.getTime() - londonNow.getTime();
      return setTimeout(async () => {
        await fetchData();
        // After executing, schedule the next day's fetch
        dailyTimeoutRef.current = scheduleDailyFetch();
      }, delayMs);
    };

    // Keep a ref to clear timeout on unmount
    dailyTimeoutRef.current = scheduleDailyFetch();

    return () => {
      clearInterval(timeInterval);
      if (dailyTimeoutRef.current) clearTimeout(dailyTimeoutRef.current);
    };
  }, []);

  const bullishCount = marketData.filter(item => item.bias.type === 'bullish').length;
  const bearishCount = marketData.filter(item => item.bias.type === 'bearish').length;
  const neutralCount = marketData.filter(item => item.bias.type === 'neutral').length;

  return (
    <div className="min-h-screen bg-gradient-trading p-6">
      <div className="max-w-7xl mx-auto space-y-8 pt-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <TrendingUp className="h-8 w-8 text-bullish" />
            <h1 className="text-4xl font-bold text-foreground">Market Bias Terminal</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Professional trading bias predictions for major markets - available after 11:01 PM UK time.
          </p>
          {showBias && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Predictions shown for: {predictionDateUK}</span>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="bg-card/50 border border-border/50 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <div className="inline-flex items-center gap-2 rounded-md border border-blue-500/50 bg-blue-500/10 px-3 py-1.5 shadow-sm">
                <Clock className="h-5 w-5 text-blue-400" />
                <span className="text-foreground font-semibold">UK Time:</span>
                <span className="font-mono tabular-nums text-lg text-foreground">{ukTime}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                Bullish: {bullishCount}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Bearish: {bearishCount}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Neutral: {neutralCount}
              </Badge>
              <Button
                onClick={fetchData}
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Bias Status Alert */}
        {!showBias && (
          <div className="bg-card/50 border border-amber-500/50 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-medium text-foreground">Bias Predictions Not Available</h3>
                <p className="text-sm text-muted-foreground">
                  Trading bias predictions are only shown after 11:01 PM UK time for the next trading day.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Market Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {marketData.map((item) => (
            <MarketCard
              key={item.data.symbol}
              data={item.data}
              bias={item.bias}
              showBias={showBias}
              predictionDate={predictionDateUK}
            />
          ))}
        </div>

        {/* Loading State */}
        {loading && marketData.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading market data...</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center space-y-2 pt-8 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
          </p>
          <p className="text-xs text-muted-foreground">
            Market data is for informational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
};