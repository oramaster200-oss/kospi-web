export interface MarketIndex {
  value: string;
  change: string;
  percent: string;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
}

export interface MarketIndicesResponse {
  kospi: MarketIndex;
  kosdaq: MarketIndex;
  statusSummary: string;
  updatedAt: string;
  dataSource: "realtime" | "mock";
}

export interface TechnicalIndicator {
  name: string;
  value: string;
  status: "BULLISH" | "NEUTRAL" | "BEARISH";
  description: string;
}

export interface NewsItem {
  title: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  source: string;
}

export interface StockAnalysis {
  stockName: string;
  symbol: string;
  currentPrice: string; // formatted with commas, e.g. "72,500"
  priceChange: string;
  priceChangePercent: string;
  highestPrice: string;
  lowestPrice: string;
  volume: string;
  analysisResult: "STRONG_BUY" | "BUY" | "HOLD" | "SELL";
  analysisScore: number; // 0 - 100
  targetPrice: string;
  stopLossPrice: string;
  summary: string;
  strengths: string[];
  risks: string[];
  technicalIndicators: TechnicalIndicator[];
  recentNews: NewsItem[];
  dataSource: "realtime" | "mock";
}

export interface PopularStock {
  symbol: string;
  name: string;
  category: string;
  price: string;
  changePercent: string;
  dataSource: "realtime" | "mock";
}

export interface PortfolioItem {
  symbol: string;
  name: string;
  avgBuyPrice: number;
  quantity: number;
  totalCost: number;
  currentPrice: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  targetPriceAlert?: string;
  addedAt: string;
}

export interface ChartDataPoint {
  date: string;
  price: number;
}
