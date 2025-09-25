import { MarketData, MarketBias } from "@/components/MarketCard";
import { YahooQuoteResponse } from "@/types/yahoo";

// Market symbols for different APIs
const MARKET_SYMBOLS = {
  'NASDAQ': { yahoo: '^NDX', name: 'NASDAQ 100' },
  'SP500': { yahoo: '^GSPC', name: 'S&P 500' },
  'DOW': { yahoo: '^DJI', name: 'Dow Jones' },
  'CRUDE': { yahoo: 'CL=F', name: 'Crude Oil' },
  'GOLD': { yahoo: 'GC=F', name: 'Gold' }
};

interface YahooFinanceData {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: Array<number | null>;
          high: Array<number | null>;
          low: Array<number | null>;
          close: Array<number | null>;
          volume: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
}

// Shape observed for Alpha Vantage Commodities (defensive typing)
interface AlphaCommodityPoint { date?: string; value?: string | number }
interface AlphaCommodityResponse { data?: AlphaCommodityPoint[]; [k: string]: unknown }

class MarketDataService {
  private cache = new Map<string, { data: MarketData; timestamp: number }>();
  private readonly CACHE_DURATION = 60_000; // 1 minute

  private async fetchAlphaCommodity(commodityFn: 'WTI' | 'GOLD', friendlyName: string): Promise<MarketData> {
    // Use dev proxy so API key is appended server-side; keeps key private from browser
    const url = `/avapi?function=${commodityFn}&interval=Daily&datatype=json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json: AlphaCommodityResponse = await res.json();

    const series = Array.isArray(json?.data) ? json.data : [];
    if (!series.length) {
      throw new Error('No data array in Alpha Vantage commodity response');
    }

    // Sort by date ascending to identify last two points
    const sanitized = series
      .filter(p => p && typeof p.value !== 'undefined' && p.date)
      .map(p => ({
        date: new Date(p.date as string),
        value: typeof p.value === 'string' ? parseFloat(p.value) : Number(p.value)
      }))
      .filter(p => !Number.isNaN(p.value) && p.date instanceof Date && !Number.isNaN(p.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (!sanitized.length) {
      throw new Error('Alpha Vantage commodity response contains no valid points');
    }

    const last = sanitized[sanitized.length - 1];
    const prev = sanitized[sanitized.length - 2] ?? sanitized[sanitized.length - 1];

    const close = last.value;
    const priorClose = prev.value;
    const price = close;
    const change = price - priorClose;
    const changePercent = priorClose !== 0 ? (change / priorClose) * 100 : 0;

    // Alpha Vantage commodity series is single-price per date; infer OHLC conservatively
    const open = priorClose; // assume open equals previous close as a proxy
    const high = Math.max(open, close);
    const low = Math.min(open, close);

    const data: MarketData = {
      symbol: commodityFn,
      name: friendlyName,
      price,
      change,
      changePercent,
      high,
      low,
      open,
      close,
      previousHigh: priorClose,
      previousLow: priorClose,
      lastUpdated: new Date().toISOString(),
      source: 'alpha',
      isFallback: false,
    };

    return data;
  }

  private async fetchYahooSeries(yahooSymbol: string, friendlyName: string): Promise<MarketData> {
    // Build once and try the redirect alias first, then fall back to the direct function URL
    const pathSuffix = `v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=10d&interval=1d&includePrePost=false`;
    const primaryUrl = `/yapi/${pathSuffix}`;
    const fallbackUrl = `/.netlify/functions/yahoo/${pathSuffix}`;

    let res: Response;
    try {
      res = await fetch(primaryUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn(`Primary Yahoo fetch failed for ${friendlyName} (${yahooSymbol}). Error:`, err);
      // Try direct function path as a fallback in production if redirect misbehaves
      res = await fetch(fallbackUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }

    const json: YahooFinanceData = await res.json();
    const result = json.chart?.result?.[0];
    if (!result || !result.indicators?.quote?.[0] || !result.timestamp?.length) {
      throw new Error("Invalid data structure from Yahoo Finance");
    }

    const quote = result.indicators.quote[0];
    const ts = result.timestamp;

    // Find last index with valid close
    let lastIdx = ts.length - 1;
    while (lastIdx >= 0 && (quote.close[lastIdx] == null || isNaN(Number(quote.close[lastIdx])))) {
      lastIdx--;
    }
    if (lastIdx < 0) throw new Error("No valid close values in series");

    // Prior index for previous day
    let prevIdx = lastIdx - 1;
    while (prevIdx >= 0 && (quote.close[prevIdx] == null || isNaN(Number(quote.close[prevIdx])))) {
      prevIdx--;
    }

    // Current day OHLC (last available complete day)
    const open = Number(quote.open[lastIdx] ?? 0);
    const high = Number(quote.high[lastIdx] ?? 0);
    const low = Number(quote.low[lastIdx] ?? 0);
    const close = Number(quote.close[lastIdx] ?? 0);

    // Previous day high/low for inside bar detection
    const previousHigh = prevIdx >= 0 ? Number(quote.high[prevIdx] ?? undefined) : undefined;
    const previousLow = prevIdx >= 0 ? Number(quote.low[prevIdx] ?? undefined) : undefined;

    // Price and change based on last two closes (if available)
    const priorClose = prevIdx >= 0 ? Number(quote.close[prevIdx] ?? close) : close;
    const price = close;
    const change = price - priorClose;
    const changePercent = priorClose !== 0 ? (change / priorClose) * 100 : 0;

    const data: MarketData = {
      symbol: yahooSymbol,
      name: friendlyName,
      price,
      change,
      changePercent,
      high,
      low,
      open,
      close,
      previousHigh,
      previousLow,
      lastUpdated: new Date().toISOString(),
      source: 'yahoo',
      isFallback: false,
    };

    return data;
  }

  // Fetch real market data from Yahoo Finance (via dev proxy) or Alpha Vantage for commodities
  async fetchMarketData(symbol: string): Promise<MarketData> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    const marketInfo = MARKET_SYMBOLS[symbol as keyof typeof MARKET_SYMBOLS];
    const yahooSymbol = marketInfo?.yahoo || symbol;

    // Always use Yahoo for all symbols (including Gold/Crude)
    try {
      const data = await this.fetchYahooSeries(yahooSymbol, marketInfo?.name || symbol);
      this.cache.set(symbol, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.warn(`Primary Yahoo fetch failed for ${symbol} (${yahooSymbol}).`, error);
      // For GOLD only, attempt spot gold as an alternative source
      if (symbol === 'GOLD') {
        try {
          const spotSymbol = 'XAUUSD=X';
          const spotData = await this.fetchYahooSeries(spotSymbol, marketInfo?.name || 'Gold');
          spotData.source = 'yahoo-spot';
          spotData.isFallback = true;
          this.cache.set(symbol, { data: spotData, timestamp: Date.now() });
          return spotData;
        } catch (spotErr) {
          console.error(`Gold spot fallback also failed:`, spotErr);
        }
      }
      console.error(`Error fetching market data for ${symbol}:`, error);
      throw new Error(`Failed to fetch market data for ${symbol}`);
    }
  }


  calculateBias(data: MarketData): MarketBias {
    // Check for inside bar first
    if (data.previousHigh && data.previousLow) {
      const isInsideBar = data.high < data.previousHigh && data.low > data.previousLow;
      
      if (isInsideBar) {
        return {
          type: 'neutral',
          reason: 'Inside bar detected - No signal for next trading session',
          isInsideBar: true
        };
      }
    }

    // Calculate average price: (High + Low + Open + Close) / 4
    const averagePrice = (data.high + data.low + data.open + data.close) / 4;
    
    if (averagePrice > data.close) {
      return {
        type: 'bullish',
        reason: 'Average price above closing price - Expecting bullish momentum',
        averagePrice,
        isInsideBar: false
      };
    } else {
      return {
        type: 'bearish',
        reason: 'Average price below closing price - Expecting bearish momentum',
        averagePrice,
        isInsideBar: false
      };
    }
  }

  async getAllMarketData(): Promise<Array<{ data: MarketData; bias: MarketBias }>> {
    const symbols = Object.keys(MARKET_SYMBOLS);
    const settled = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const data = await this.fetchMarketData(symbol);
        const bias = this.calculateBias(data);
        return { data, bias };
      })
    );

    const successes = settled
      .filter((r): r is PromiseFulfilledResult<{ data: MarketData; bias: MarketBias }> => r.status === 'fulfilled')
      .map((r) => r.value);

    if (successes.length === 0) {
      throw new Error('Failed to fetch all market data');
    }

    return successes;
  }
}

export const marketDataService = new MarketDataService();