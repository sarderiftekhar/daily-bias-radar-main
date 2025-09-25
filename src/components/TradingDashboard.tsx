import { useState, useEffect, useRef } from "react";
import { MarketCard } from "./MarketCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { marketDataService } from "@/services/marketDataService";
import { MarketData, MarketBias } from "./MarketCard";
import { RefreshCw, Clock, TrendingUp, TrendingDown, Minus, AlertCircle, Calendar, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WeeklyData {
  symbol: string;
  name: string;
  weeklyChange: number;
  weeklyChangePercent: number;
  weeklyHigh: number;
  weeklyLow: number;
  weeklyOpen: number;
  weeklyClose: number;
  status: 'bullish' | 'bearish' | 'neutral';
  trend: string;
  weekStartDate: string;
  weekEndDate: string;
  lastUpdated: string;
  source?: "alpha" | "yahoo" | "yahoo-spot";
  isFallback?: boolean;
}

export const TradingDashboard = () => {
  const [marketData, setMarketData] = useState<Array<{ data: MarketData; bias: MarketBias }>>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showBias, setShowBias] = useState(false);
  const [ukTime, setUkTime] = useState<string>("");
  const [predictionDateUK, setPredictionDateUK] = useState<string>("");
  const dailyTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();

  const generateWeeklyData = (dailyData: Array<{ data: MarketData; bias: MarketBias }>): WeeklyData[] => {
    const now = new Date();
    
    // Calculate week start (Monday) and end (Friday) dates
    const getWeekStart = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(d.setDate(diff));
    };
    
    const getWeekEnd = (date: Date) => {
      const start = getWeekStart(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 4); // Friday
      return end;
    };
    
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);
    
    return dailyData.map(({ data }) => {
      // Simulate weekly data based on daily data
      const weeklyChange = data.change * 5; // Simulate 5-day change
      const weeklyChangePercent = data.changePercent * 5;
      const weeklyHigh = data.high * (1 + Math.random() * 0.05); // Add some variation
      const weeklyLow = data.low * (1 - Math.random() * 0.05);
      const weeklyOpen = data.open;
      const weeklyClose = data.close;
      
      let status: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (weeklyChangePercent > 2) status = 'bullish';
      else if (weeklyChangePercent < -2) status = 'bearish';
      
      const trend = weeklyChangePercent > 0 ? 'Upward' : weeklyChangePercent < 0 ? 'Downward' : 'Sideways';
      
      return {
        symbol: data.symbol,
        name: data.name,
        weeklyChange,
        weeklyChangePercent,
        weeklyHigh,
        weeklyLow,
        weeklyOpen,
        weeklyClose,
        status,
        trend,
        weekStartDate: weekStart.toLocaleDateString('en-GB', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        }),
        weekEndDate: weekEnd.toLocaleDateString('en-GB', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        }),
        lastUpdated: new Date().toISOString(),
        source: data.source,
        isFallback: data.isFallback
      };
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await marketDataService.getAllMarketData();
      setMarketData(data);
      setWeeklyData(generateWeeklyData(data));
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
            <div className="flex items-center justify-center flex-1">
              <div className="inline-flex items-center gap-2 rounded-md border border-blue-500/50 bg-blue-500/10 px-3 py-1.5 shadow-sm">
                <Clock className="h-5 w-5 text-blue-400" />
                <span className="text-foreground font-semibold">UK Time:</span>
                <span className="font-mono tabular-nums text-lg text-foreground">{ukTime}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
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

        {/* Tabs Section */}
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-card/50 border border-border/50">
            <TabsTrigger 
              value="daily" 
              className="flex items-center gap-2 data-[state=active]:bg-bullish data-[state=active]:text-bullish-foreground data-[state=active]:border-bullish data-[state=active]:shadow-lg data-[state=active]:shadow-bullish/25 transition-all duration-300"
            >
              <Calendar className="h-4 w-4" />
              Daily
            </TabsTrigger>
            <TabsTrigger 
              value="weekly" 
              className="flex items-center gap-2 data-[state=active]:bg-bearish data-[state=active]:text-bearish-foreground data-[state=active]:border-bearish data-[state=active]:shadow-lg data-[state=active]:shadow-bearish/25 transition-all duration-300"
            >
              <BarChart3 className="h-4 w-4" />
              Weekly
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="mt-6">
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
          </TabsContent>
          
          <TabsContent value="weekly" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {weeklyData.map((item) => {
                const getStatusIcon = () => {
                  switch (item.status) {
                    case 'bullish':
                      return <TrendingUp className="h-5 w-5" />;
                    case 'bearish':
                      return <TrendingDown className="h-5 w-5" />;
                    default:
                      return <Minus className="h-5 w-5" />;
                  }
                };

                const getStatusStyles = () => {
                  switch (item.status) {
                    case 'bullish':
                      return {
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

                const styles = getStatusStyles();
                const isPositive = item.weeklyChange >= 0;
                const sourceLabel = item.source === 'alpha' ? 'Alpha Vantage' : item.source === 'yahoo-spot' ? 'Yahoo (Spot)' : 'Yahoo';

                return (
                  <div key={item.symbol} className={`relative p-0 overflow-hidden bg-gradient-trading transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border border-white/60 ${styles.glow}`}>
                    {/* Decorative header gradient */}
                    <div className={`h-2 w-full bg-gradient-to-r ${styles.header}`} />
                    
                    {/* Status Indicator */}
                    <div className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full border-2 border-white/70 bg-transparent pointer-events-none drop-shadow-sm">
                      {item.status === 'bullish' ? (
                        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="fill-bullish">
                          <path d="M12 3l9 18H3z" shapeRendering="geometricPrecision" />
                        </svg>
                      ) : item.status === 'bearish' ? (
                        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="fill-bearish rotate-180">
                          <path d="M12 3l9 18H3z" shapeRendering="geometricPrecision" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="fill-neutral">
                          <circle cx="12" cy="12" r="9" shapeRendering="geometricPrecision" />
                        </svg>
                      )}
                    </div>
                    
                    <div className="p-6 space-y-4 bg-card/40">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-foreground">{item.name}</h3>
                            <Badge className={`flex items-center gap-1.5 px-3 py-1 border font-semibold ${styles.badge}`}>
                              {getStatusIcon()}
                              <span className="font-semibold capitalize">{item.status}</span>
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground tracking-wider">{item.symbol}</p>
                            {item.isFallback && (
                              <Badge className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-200 border-amber-400/40 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Fallback Source
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Price Information */}
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-bold text-foreground">
                            ${item.weeklyClose.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={`text-lg font-semibold flex items-center gap-1 ${
                            isPositive ? "text-price-up" : "text-price-down"
                          }`}>
                            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {isPositive ? '+' : ''}{item.weeklyChange.toFixed(2)} ({item.weeklyChangePercent.toFixed(2)}%)
                          </span>
                        </div>

                        {/* Weekly OHLC Data */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Weekly Open:</span>
                              <span className="text-foreground font-medium">${item.weeklyOpen.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Weekly High:</span>
                              <span className="text-price-up font-medium">${item.weeklyHigh.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Weekly Close:</span>
                              <span className="text-foreground font-medium">${item.weeklyClose.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Weekly Low:</span>
                              <span className="text-price-down font-medium">${item.weeklyLow.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Weekly Period Information */}
                      <div className="pt-4 border-t border-border/50">
                        <div className="space-y-3">
                          <div className="flex items-center flex-wrap gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Weekly Period:</span>
                            <Badge variant="secondary" className="text-xs">{item.weekStartDate} - {item.weekEndDate}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Trend:</span>
                            <span className="text-foreground font-medium">{item.trend}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.source ? `Source: ${sourceLabel}` : ''}</span>
                        <span>Last updated: {new Date(item.lastUpdated).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

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