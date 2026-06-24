import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  RefreshCw, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Sparkles, 
  ChevronRight, 
  DollarSign, 
  Layers, 
  Briefcase, 
  Bookmark, 
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Lock
} from "lucide-react";
import { 
  StockAnalysis, 
  MarketIndicesResponse, 
  PopularStock, 
  PortfolioItem, 
  WatchlistItem 
} from "./types";

export default function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => sessionStorage.getItem("kospi_auth") === "true");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput.trim() })
      });
      
      if (res.ok) {
        sessionStorage.setItem("kospi_auth", "true");
        setIsAuthenticated(true);
      } else {
        const errData = await res.json();
        setAuthError(errData.error || "비밀번호가 올바르지 않습니다.");
      }
    } catch (err) {
      setAuthError("서버와 통신에 실패했습니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Input & search state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentStock, setCurrentStock] = useState<StockAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Market indices
  const [marketIndices, setMarketIndices] = useState<MarketIndicesResponse | null>(null);
  const [loadingIndices, setLoadingIndices] = useState(false);
  
  // Recommendations and metadata
  const [popularStocks, setPopularStocks] = useState<PopularStock[]>([]);
  
  // User customized local lists (Watchlist & Portfolio)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    const saved = localStorage.getItem("kospi_watchlist");
    return saved ? JSON.parse(saved) : [
      { symbol: "005930", name: "삼성전자", addedAt: new Date().toISOString() },
      { symbol: "000660", name: "SK하이닉스", addedAt: new Date().toISOString() },
      { symbol: "035420", name: "NAVER", addedAt: new Date().toISOString() }
    ];
  });
  
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    const saved = localStorage.getItem("kospi_portfolio");
    return saved ? JSON.parse(saved) : [
      { symbol: "005930", name: "삼성전자", avgBuyPrice: 71000, quantity: 10, totalCost: 710000, currentPrice: 72500 }
    ];
  });

  // Selected chart period and interactive details
  const [selectedPeriod, setSelectedPeriod] = useState<"1D" | "1W" | "1M" | "1Y">("1D");
  const [realChartData, setRealChartData] = useState<{ label: string; value: number }[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  
  // Trade simulation state
  const [tradeQuantity, setTradeQuantity] = useState<number>(10);
  const [tradeMessage, setTradeMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  // Fetch real chart data when stock or period changes
  useEffect(() => {
    if (!currentStock) { setRealChartData([]); return; }
    setRealChartData([]);
    fetch(`/api/stock-history?symbol=${currentStock.symbol}&period=${selectedPeriod}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.chartData?.length > 0) setRealChartData(d.chartData); })
      .catch(() => {});
  }, [currentStock?.symbol, selectedPeriod]);

  // Synchronize local storage
  useEffect(() => {
    localStorage.setItem("kospi_watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem("kospi_portfolio", JSON.stringify(portfolio));
  }, [portfolio]);

  // Fetch initial market data & popular stocks and set up real-time updates
  useEffect(() => {
    if (isAuthenticated) {
      handleRefreshAll();

      const interval = setInterval(() => {
        handleRefreshAll();
      }, 20000); // refresh every 20 seconds for authentic real-time simulation

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleRefreshAll = async () => {
    setLoadingIndices(true);
    try {
      const timestamp = Date.now();
      const [indicesRes, stocksRes] = await Promise.all([
        fetch(`/api/market-indices?_t=${timestamp}`),
        fetch(`/api/popular-stocks-prices?_t=${timestamp}`)
      ]);

      if (indicesRes.ok) {
        const contentType = indicesRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await indicesRes.json();
          setMarketIndices(data);
        }
      }

      if (stocksRes.ok) {
        const contentType = stocksRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await stocksRes.json();
          setPopularStocks(data);
        }
      }
    } catch (e) {
      console.error("Failed to refresh market data", e);
    } finally {
      setLoadingIndices(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setTradeMessage(null);
    try {
      const res = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() })
      });
      
      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        if (contentType && contentType.includes("application/json")) {
          const errData = await res.json();
          throw new Error(errData.error || "주식 정보를 불러오는데 실패했습니다.");
        } else {
          throw new Error("서버와의 통신에 실패했습니다. (API가 존재하지 않거나 작동하지 않음)");
        }
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("서버 응답이 올바르지 않은 형식(HTML 등)입니다. 배포 환경을 확인하세요.");
      }
      
      const data: StockAnalysis = await res.json();
      setCurrentStock(data);
      setSearchQuery("");

      // Automatically update the portfolio items' current prices if their symbol matches
      setPortfolio(prev => prev.map(item => {
        if (item.symbol === data.symbol || item.name === data.stockName) {
          const rawPrice = parseFloat(data.currentPrice.replace(/,/g, ""));
          if (!isNaN(rawPrice)) {
            return { ...item, currentPrice: rawPrice };
          }
        }
        return item;
      }));

      // Automatically update the popular stocks' price if their symbol or name matches
      setPopularStocks(prev => prev.map(item => {
        if (item.symbol === data.symbol || item.name === data.stockName) {
          return { ...item, price: data.currentPrice, changePercent: data.priceChangePercent };
        }
        return item;
      }));
    } catch (e: any) {
      setError(e.message || "서버 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Add stock to watchlist
  const toggleWatchlist = (stock: { symbol: string, name: string }) => {
    const exists = watchlist.some(item => item.symbol === stock.symbol);
    if (exists) {
      setWatchlist(prev => prev.filter(item => item.symbol !== stock.symbol));
    } else {
      setWatchlist(prev => [...prev, { symbol: stock.symbol, name: stock.name, addedAt: new Date().toISOString() }]);
    }
  };

  // Portfolio actions
  const handleBuySimulation = () => {
    if (!currentStock) return;
    const priceRaw = parseFloat(currentStock.currentPrice.replace(/,/g, ""));
    if (isNaN(priceRaw) || tradeQuantity <= 0) {
      setTradeMessage({ type: "error", text: "유효한 수량을 입력해주세요." });
      return;
    }

    const totalCost = priceRaw * tradeQuantity;
    const existingIndex = portfolio.findIndex(item => item.symbol === currentStock.symbol);

    if (existingIndex > -1) {
      // Average price calculations
      const existingItem = portfolio[existingIndex];
      const newQty = existingItem.quantity + tradeQuantity;
      const newCost = existingItem.totalCost + totalCost;
      const newAvg = Math.round(newCost / newQty);
      
      const updated = [...portfolio];
      updated[existingIndex] = {
        ...existingItem,
        quantity: newQty,
        totalCost: newCost,
        avgBuyPrice: newAvg,
        currentPrice: priceRaw
      };
      setPortfolio(updated);
    } else {
      setPortfolio(prev => [...prev, {
        symbol: currentStock.symbol,
        name: currentStock.stockName,
        avgBuyPrice: priceRaw,
        quantity: tradeQuantity,
        totalCost: totalCost,
        currentPrice: priceRaw
      }]);
    }

    setTradeMessage({
      type: "success",
      text: `${currentStock.stockName} ${tradeQuantity}주가 포트폴리오에 추가되었습니다! (매수가: ${priceRaw.toLocaleString()}원)`
    });
  };

  const removeFromPortfolio = (symbol: string) => {
    setPortfolio(prev => prev.filter(item => item.symbol !== symbol));
  };

  // Compute chart points — real data first, random walk as fallback
  const chartPoints = useMemo(() => {
    if (realChartData.length > 0) return realChartData;
    if (!currentStock) return [];
    const base = parseFloat(currentStock.currentPrice.replace(/,/g, "")) || 70000;
    
    let pointsCount = 12;
    let volatility = 0.015;
    let trend = 0.003; // default bullish tendency

    if (currentStock.analysisResult === "STRONG_BUY") {
      trend = 0.006;
      volatility = 0.02;
    } else if (currentStock.analysisResult === "SELL") {
      trend = -0.005;
      volatility = 0.025;
    }

    switch (selectedPeriod) {
      case "1W":
        pointsCount = 7;
        break;
      case "1M":
        pointsCount = 15;
        break;
      case "1Y":
        pointsCount = 24;
        break;
      default:
        pointsCount = 12;
    }

    // Seeded random-walk to generate a cohesive path
    const points = [];
    let current = base * (1 - trend * (pointsCount / 2));
    
    // Generate dates
    const today = new Date();
    for (let i = 0; i < pointsCount; i++) {
      const dateCopy = new Date(today);
      if (selectedPeriod === "1D") {
        dateCopy.setHours(9 + Math.floor(i * 0.5), (i % 2) * 30);
      } else {
        dateCopy.setDate(today.getDate() - (pointsCount - i));
      }
      
      const label = selectedPeriod === "1D" 
        ? dateCopy.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
        : dateCopy.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
      
      // Random walk step
      const step = current * (Math.random() - 0.47) * volatility + (current * trend);
      current = Math.round(current + step);
      
      points.push({ label, value: current });
    }

    // Guarantee the last point equals the real current price
    points[points.length - 1].value = base;
    return points;
  }, [currentStock, selectedPeriod, realChartData]);

  // SVG Chart path calculation helpers
  const svgDimensions = { width: 500, height: 160 };
  const chartPath = useMemo(() => {
    if (chartPoints.length < 2) return "";
    const prices = chartPoints.map(p => p.value);
    const min = Math.min(...prices) * 0.995;
    const max = Math.max(...prices) * 1.005;
    const range = max - min;
    
    return chartPoints.map((point, i) => {
      const x = (i / (chartPoints.length - 1)) * svgDimensions.width;
      const y = svgDimensions.height - ((point.value - min) / range) * svgDimensions.height;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }, [chartPoints]);

  const chartGradientPath = useMemo(() => {
    if (chartPoints.length < 2) return "";
    const prices = chartPoints.map(p => p.value);
    const min = Math.min(...prices) * 0.995;
    const max = Math.max(...prices) * 1.005;
    const range = max - min;
    
    const lines = chartPoints.map((point, i) => {
      const x = (i / (chartPoints.length - 1)) * svgDimensions.width;
      const y = svgDimensions.height - ((point.value - min) / range) * svgDimensions.height;
      return `L ${x} ${y}`;
    });

    const firstX = 0;
    const firstY = svgDimensions.height - ((chartPoints[0].value - min) / range) * svgDimensions.height;
    const lastX = svgDimensions.width;
    
    return `M ${firstX} ${firstY} ${lines.join(" ")} L ${lastX} ${svgDimensions.height} L ${firstX} ${svgDimensions.height} Z`;
  }, [chartPoints]);

  // Helper values for active hovered point in the chart
  const activePoint = hoverIndex !== null ? chartPoints[hoverIndex] : null;

  // Calculate overall portfolio metrics
  const portfolioSummary = useMemo(() => {
    let totalCost = 0;
    let totalValue = 0;
    portfolio.forEach(item => {
      totalCost += item.totalCost;
      totalValue += item.quantity * item.currentPrice;
    });
    const profit = totalValue - totalCost;
    const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    return {
      totalCost,
      totalValue,
      profit,
      profitPercent
    };
  }, [portfolio]);

  const signalBadgeColor = (result: string) => {
    switch (result) {
      case "STRONG_BUY":
        return "bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-400/30";
      case "BUY":
        return "bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-500/30";
      case "SELL":
        return "bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-500/30";
      default:
        return "bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-500/30";
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0B0E] text-[#E0E1E6] font-sans flex items-center justify-center p-4 relative overflow-hidden antialiased">
        {/* Glow Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#12131A]/80 border border-[#23252E] backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/30 mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              KOSPI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-extrabold">QUANT ENGINE</span>
            </h1>
            <p className="text-xs text-gray-400 mt-2">시스템 보안을 위해 접속 비밀번호를 입력해 주세요.</p>
          </div>

          <form onSubmit={handleVerifyPassword} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Access Password</label>
              <input
                type="password"
                placeholder="••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-[#16171D] border border-[#23252E] focus:border-blue-500 rounded-xl py-3 px-4 text-center text-white placeholder-gray-600 transition-all outline-none focus:ring-1 focus:ring-blue-500/40 text-lg tracking-widest font-mono"
                autoFocus
              />
            </div>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-3 text-xs text-center font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? "확인 중..." : "엔진 접속"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="kospi-app-container" className="min-h-screen bg-[#0A0B0E] text-[#E0E1E6] font-sans p-3 md:p-6 flex flex-col antialiased">
      
      {/* HEADER SECTION */}
      <header id="app-header" className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 border-b border-[#1A1C24] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-blue-900/30">
            KQ
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              KOSPI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-extrabold">QUANT ENGINE</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">v2.5</span>
            </h1>
            <p className="text-xs text-gray-400">실시간 코스피 데이터 수집 및 고성능 AI 매수 타이밍 진단기</p>
          </div>
        </div>

        {/* SEARCH BAR */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="relative w-full md:w-80">
          <input
            id="stock-search-input"
            type="text"
            placeholder="주식명 또는 종목코드 입력 (예: 삼성전자)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading}
            className="w-full bg-[#12131A] border border-[#23252E] focus:border-blue-500 rounded-xl py-2 px-4 pl-10 text-sm text-white placeholder-gray-500 transition-all outline-none focus:ring-1 focus:ring-blue-500/40"
          />
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-gray-500" />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-1.5 top-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1 px-3 rounded-lg transition-colors"
          >
            {loading ? "분석중..." : "분석"}
          </button>
        </form>

        {/* Market Status and Mini Index Widget */}
        <div className="flex items-center gap-4 bg-[#12131A] border border-[#23252E] px-4 py-2 rounded-2xl">
          <div
            onClick={handleRefreshAll}
            className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1.5 rounded-xl transition-colors"
            title="실시간 시세 새로고침"
          >
            <div className={`w-2 h-2 rounded-full ${marketIndices?.dataSource === "mock" ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`}></div>
            <span className={`text-xs font-bold ${marketIndices?.dataSource === "mock" ? "text-amber-500" : "text-emerald-500"}`}>
              {marketIndices?.dataSource === "mock" ? "MOCK" : "REALTIME"}
            </span>
          </div>
          <div className="h-6 w-px bg-gray-800"></div>
          <div className="flex gap-4">
            <div className="text-right">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">KOSPI</span>
              <span className="text-sm font-mono font-bold text-white flex items-center gap-1">
                {marketIndices?.kospi.value || "2,682.43"}
                <span className={`text-[10px] ${marketIndices?.kospi.trend === "BULLISH" ? "text-emerald-400" : "text-rose-400"}`}>
                  {marketIndices?.kospi.percent || "+0.54%"}
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">KOSDAQ</span>
              <span className="text-sm font-mono font-bold text-white flex items-center gap-1">
                {marketIndices?.kosdaq.value || "852.12"}
                <span className={`text-[10px] ${marketIndices?.kosdaq.trend === "BULLISH" ? "text-emerald-400" : "text-rose-400"}`}>
                  {marketIndices?.kosdaq.percent || "-0.25%"}
                </span>
              </span>
            </div>
          </div>
          <button 
            id="refresh-indices-btn"
            onClick={handleRefreshAll} 
            disabled={loadingIndices} 
            title="실시간 시세 새로고침" 
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingIndices ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* ERROR CORNER */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-400">알림</h4>
            <p className="text-xs text-gray-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* BENTO GRID LAYOUT */}
      <main className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-grow">
        
        {/* BENTO 1: Left Navigation & Watchlist (col-span-4) */}
        <section id="bento-watchlist" className="md:col-span-4 bg-[#12131A] border border-[#23252E] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-blue-400" />
                선호/추천 종목
              </h2>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-mono">KOSPI</span>
            </div>
            
            {/* Real-time search quick select table */}
            <div className="overflow-x-auto overflow-y-auto max-h-[380px] pr-1">
              <table className="w-full border-collapse">
                <thead className="text-[10px] text-gray-500 uppercase font-black border-b border-[#23252E]">
                  <tr>
                    <th className="pb-2 text-left">종목</th>
                    <th className="pb-2 text-right">현재가</th>
                    <th className="pb-2 text-right">등락률</th>
                    <th className="pb-2 text-center">분석</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C1E26]">
                  {popularStocks.map((stock) => {
                    const isWatched = watchlist.some(w => w.symbol === stock.symbol);
                    const isCurrent = currentStock?.symbol === stock.symbol;
                    const isPositive = stock.changePercent.startsWith("+");
                    const isMock = stock.dataSource === "mock";
                    return (
                      <tr 
                        key={stock.symbol}
                        className={`hover:bg-[#1A1B24] transition-colors ${isCurrent ? "bg-[#1E212E]" : ""}`}
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWatchlist(stock);
                              }}
                              className={`text-xs focus:outline-none ${isWatched ? "text-amber-400" : "text-gray-500 hover:text-gray-300"}`}
                              title={isWatched ? "관심종목 해제" : "관심종목 추가"}
                            >
                              ★
                            </button>
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-xs md:text-sm">{stock.name}</span>
                              <span className="text-[9px] text-gray-500 font-mono">{stock.symbol}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs font-bold text-white pr-2">
                          {stock.price} 원
                        </td>
                        <td className={`py-2.5 text-right font-mono text-xs font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {stock.changePercent}
                          {isMock && <span className="ml-1 text-[9px] text-amber-500 font-normal">~</span>}
                        </td>
                        <td className="py-2.5 text-center pl-2">
                          <button
                            onClick={() => handleSearch(stock.name)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-tight border transition-all cursor-pointer ${
                              isCurrent
                                ? "bg-blue-600 border-blue-500 text-white shadow-md"
                                : "bg-[#16171D] border-[#23252E] text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30"
                            }`}
                          >
                            AI 분석
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="mt-5 pt-4 border-t border-[#1C1E26] text-xs">
            <h3 className="text-gray-400 font-semibold mb-2 flex items-center gap-1">
              💡 퀀트 팁
            </h3>
            <p className="text-gray-400 leading-relaxed text-[11px]">
              AI 분석 버튼을 클릭하시면 실시간 뉴스, 지표, AI의 종합 의견과 점수가 조회됩니다. <span className="text-emerald-400 font-bold">75점 이상</span>일 때 매수 고려를 추천합니다.
            </p>
          </div>
        </section>

        {/* BENTO 2: Center - Hero Stock details & Interactive Chart (col-span-5) */}
        <section id="bento-chart" className="md:col-span-5 bg-[#12131A] border border-[#23252E] rounded-3xl p-6 flex flex-col justify-between relative shadow-xl min-h-[420px]">
          {currentStock ? (
            <>
              {/* Stock Title and Indicators */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-black text-white">{currentStock.stockName}</h2>
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono font-medium">{currentStock.symbol}</span>
                    {currentStock.dataSource === "mock" && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" />
                        모의 데이터
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="text-4xl font-mono font-black tracking-tight text-white">{currentStock.currentPrice}</span>
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold ${
                      currentStock.priceChangePercent.startsWith("+") 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}>
                      {currentStock.priceChangePercent.startsWith("+") ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{currentStock.priceChange} ({currentStock.priceChangePercent})</span>
                    </div>
                  </div>
                </div>

                {/* Period Selector */}
                <div className="flex gap-1.5 bg-[#16171D] border border-[#23252E] p-1 rounded-xl">
                  {(["1D", "1W", "1M", "1Y"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all ${
                        selectedPeriod === period 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" 
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {/* Glowing Circle Confidence Score Indicator */}
              <div className="absolute right-6 top-24 hidden lg:flex flex-col items-center justify-center p-3 bg-[#16171D] border border-[#23252E] rounded-2xl">
                <span className="text-[9px] text-gray-500 font-black tracking-widest uppercase mb-1">AI CONFIDENCE</span>
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="transparent" stroke="#1F2029" strokeWidth="4" />
                    <circle 
                      cx="32" 
                      cy="32" 
                      r="28" 
                      fill="transparent" 
                      stroke="#3B82F6" 
                      strokeWidth="4" 
                      strokeDasharray={175.9}
                      strokeDashoffset={175.9 - (175.9 * currentStock.analysisScore) / 100}
                    />
                  </svg>
                  <span className="text-lg font-black text-white">{currentStock.analysisScore}</span>
                </div>
              </div>

              {/* Chart Stage */}
              <div className="my-6 flex-grow flex flex-col justify-end">
                <div className="flex justify-between items-center text-xs text-gray-500 mb-2 px-1">
                  <span>추세 차트 ({selectedPeriod})</span>
                  {activePoint ? (
                    <span className="text-blue-400 font-mono font-bold">
                      {activePoint.label}: <span className="text-white">{activePoint.value.toLocaleString()} 원</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">마우스를 올려 가격 확인</span>
                  )}
                </div>

                <div className="relative h-44 w-full bg-[#16171D]/40 border border-[#23252E]/60 rounded-2xl overflow-hidden p-2 flex items-end">
                  <svg 
                    viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`} 
                    className="w-full h-full overflow-visible"
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    <defs>
                      <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grid lines */}
                    <line x1="0" y1={svgDimensions.height * 0.25} x2={svgDimensions.width} y2={svgDimensions.height * 0.25} stroke="#1C1D26" strokeDasharray="4 4" />
                    <line x1="0" y1={svgDimensions.height * 0.5} x2={svgDimensions.width} y2={svgDimensions.height * 0.5} stroke="#1C1D26" strokeDasharray="4 4" />
                    <line x1="0" y1={svgDimensions.height * 0.75} x2={svgDimensions.width} y2={svgDimensions.height * 0.75} stroke="#1C1D26" strokeDasharray="4 4" />

                    {/* Gradient fill path */}
                    <path d={chartGradientPath} fill="url(#chartGlow)" />
                    
                    {/* Line path */}
                    <path d={chartPath} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />

                    {/* Interactive hover lines and dots */}
                    {chartPoints.map((point, idx) => {
                      const x = (idx / (chartPoints.length - 1)) * svgDimensions.width;
                      return (
                        <g key={idx}>
                          {/* Invisible interactive hover zone */}
                          <rect
                            x={x - 15}
                            y={0}
                            width={30}
                            height={svgDimensions.height}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoverIndex(idx)}
                          />
                          {hoverIndex === idx && (
                            <>
                              <line x1={x} y1={0} x2={x} y2={svgDimensions.height} stroke="#3B82F6" strokeWidth="1" strokeDasharray="2 2" />
                              <circle 
                                cx={x} 
                                cy={svgDimensions.height - ((point.value - Math.min(...chartPoints.map(p=>p.value))*0.995) / (Math.max(...chartPoints.map(p=>p.value))*1.005 - Math.min(...chartPoints.map(p=>p.value))*0.995)) * svgDimensions.height} 
                                r="5" 
                                fill="#3B82F6" 
                                stroke="#FFFFFF" 
                                strokeWidth="1.5" 
                              />
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Bottom Metadata Info */}
              <div className="grid grid-cols-3 gap-4 bg-[#16171D] border border-[#23252E] p-3 rounded-2xl text-center">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-black">오늘 고가</span>
                  <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{currentStock.highestPrice} 원</p>
                </div>
                <div className="border-x border-gray-800">
                  <span className="text-[10px] text-gray-500 uppercase font-black">오늘 저가</span>
                  <p className="text-sm font-mono font-bold text-rose-400 mt-0.5">{currentStock.lowestPrice} 원</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-black">거래량</span>
                  <p className="text-sm font-mono font-bold text-white mt-0.5">{currentStock.volume}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
              <Sparkles className="w-12 h-12 text-blue-500/40 animate-pulse mb-3" />
              <p className="text-sm">주식을 검색하거나 좌측 추천 종목을 선택하시면</p>
              <p className="text-xs text-gray-600 mt-1">즉시 정밀한 AI 퀀트 가이드와 차트 분석이 표시됩니다.</p>
            </div>
          )}
        </section>

        {/* BENTO 3: Right - Buy Signal Engine & Simulator (col-span-3) */}
        <section id="bento-signal" className="md:col-span-3 bg-[#12131A] border border-[#23252E] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          {currentStock ? (
            <>
              {/* Dynamic Recommendation Card */}
              <div className={`p-5 rounded-2xl border ${signalBadgeColor(currentStock.analysisResult)} flex flex-col justify-between shadow-lg`}>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">RECOMMENDED TIMING</span>
                    <Sparkles className="w-4 h-4 opacity-80" />
                  </div>
                  <h3 className="text-3xl font-black tracking-tight">{currentStock.analysisResult}</h3>
                  <p className="text-xs mt-1.5 opacity-90 font-medium">AI 연산 가중치 점수: <span className="font-bold">{currentStock.analysisScore}점</span></p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9px] opacity-75 uppercase block">목표가</span>
                    <span className="font-mono font-bold text-xs">{currentStock.targetPrice}</span>
                  </div>
                  <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9px] opacity-75 uppercase block">손절가</span>
                    <span className="font-mono font-bold text-xs">{currentStock.stopLossPrice}</span>
                  </div>
                </div>
              </div>

              {/* Simulated Purchase Engine */}
              <div className="mt-4 pt-4 border-t border-[#1C1E26]">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                  모의 매수 시뮬레이터
                </h4>
                <p className="text-[11px] text-gray-400 mb-3">현재가에 모의 매수하여 실적 추이를 관측합니다.</p>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-[#16171D] border border-[#23252E] px-3 py-1.5 rounded-xl">
                    <span className="text-xs text-gray-500">수량:</span>
                    <input 
                      type="number" 
                      value={tradeQuantity} 
                      onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full bg-transparent border-none text-white text-sm font-mono font-bold focus:outline-none focus:ring-0"
                    />
                    <span className="text-xs text-gray-400 font-bold">주</span>
                  </div>

                  <button 
                    onClick={handleBuySimulation}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    포트폴리오에 매수 등록
                  </button>
                </div>

                {/* Simulated Purchase Feedback Message */}
                {tradeMessage && (
                  <div className={`mt-3 p-2.5 rounded-xl border text-[11px] font-medium ${
                    tradeMessage.type === "success" 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  }`}>
                    {tradeMessage.text}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
              <Sparkles className="w-8 h-8 text-indigo-500/40 animate-pulse mb-2" />
              <p className="text-xs">주식을 검색하시면 신호가 활성화됩니다.</p>
            </div>
          )}
        </section>

        {/* BENTO 4: Center-Bottom - Technical Analysis & Indicators (col-span-4) */}
        <section id="bento-technical" className="md:col-span-4 bg-[#12131A] border border-[#23252E] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              보조 지표 기술 분석
            </h3>

            {currentStock ? (
              <div className="space-y-3">
                {currentStock.technicalIndicators.map((indicator, index) => {
                  let statusColor = "bg-gray-800 text-gray-400";
                  if (indicator.status === "BULLISH") statusColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                  else if (indicator.status === "BEARISH") statusColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

                  return (
                    <div key={index} className="p-3 bg-[#16171D] border border-[#23252E] rounded-xl flex items-start justify-between">
                      <div className="flex-grow">
                        <p className="text-xs font-bold text-white">{indicator.name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{indicator.description}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                        <span className="text-xs font-mono font-bold text-white">{indicator.value}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${statusColor}`}>{indicator.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-500 italic">
                보조지표 정보 없음
              </div>
            )}
          </div>
          <div className="text-[10px] text-gray-500 mt-4 leading-relaxed">
            * 퀀트 모델이 20일 이동평균, 상대강도지수(RSI), MACD 추세를 종합 분석한 결과입니다.
          </div>
        </section>

        {/* BENTO 5: Center-Bottom-Right - Strength / Risk Breakdown (col-span-4) */}
        <section id="bento-breakdown" className="md:col-span-4 bg-[#12131A] border border-[#23252E] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
              AI 진단 주요 핵심 요약
            </h3>

            {currentStock ? (
              <div className="space-y-4">
                {/* Strengths */}
                <div>
                  <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block mb-2">🎯 성장 모멘텀 및 강점</span>
                  <ul className="space-y-1.5">
                    {currentStock.strengths.slice(0, 3).map((s, idx) => (
                      <li key={idx} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
                        <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risks */}
                <div>
                  <span className="text-[10px] text-rose-400 font-extrabold uppercase tracking-wider block mb-2">⚠️ 리스크 및 지지항선</span>
                  <ul className="space-y-1.5">
                    {currentStock.risks.slice(0, 3).map((r, idx) => (
                      <li key={idx} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
                        <span className="text-rose-500 font-bold mt-0.5">!</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-500 italic">
                핵심 요약 없음
              </div>
            )}
          </div>

          <p className="text-[10px] text-gray-600 italic mt-4">
            * AI 기반 분석으로 실제 투자를 권유하는 것이 아니며 투자 책임은 본인에게 있습니다.
          </p>
        </section>

        {/* BENTO 6: Right-Bottom - Recent News & Sentiment Alerts (col-span-4) */}
        <section id="bento-news" className="md:col-span-4 bg-[#12131A] border border-[#23252E] rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              실시간 언론 동향 및 심리
            </h3>

            {currentStock ? (
              <div className="space-y-3">
                {currentStock.recentNews.slice(0, 3).map((news, index) => {
                  let badge = "bg-gray-800 text-gray-400 border-gray-800";
                  if (news.sentiment === "POSITIVE") badge = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                  else if (news.sentiment === "NEGATIVE") badge = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

                  return (
                    <div key={index} className="p-3 bg-[#16171D] border border-[#23252E] rounded-xl flex flex-col justify-between hover:border-gray-700 transition-all">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[9px] text-gray-500 font-bold font-mono">{news.source}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${badge}`}>{news.sentiment}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-200 leading-normal hover:text-white transition-colors">{news.title}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-500 italic">
                최신 뉴스 정보 없음
              </div>
            )}
          </div>

          {currentStock && (
            <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
              <span className="text-[10px] text-blue-400 font-bold block mb-1">🤖 AI 종합 의견 요약</span>
              <p className="text-[11px] text-gray-300 leading-normal line-clamp-2 italic">
                "{currentStock.summary}"
              </p>
            </div>
          )}
        </section>

      </main>

      {/* LOWER BENTO: My Portfolio Tracker Block (Generous bottom-rail) */}
      <section id="bento-portfolio" className="mt-6 bg-[#12131A] border border-[#23252E] rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#1C1E26]">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              나의 실시간 모의 투자 포트폴리오
            </h3>
            <p className="text-xs text-gray-400 mt-1">포트폴리오에 등록한 주식의 실시간 가치와 총 이익/손실율을 계산합니다.</p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-6 text-sm bg-[#16171D] border border-[#23252E] px-4 py-2.5 rounded-2xl font-mono">
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">총 매입금액</span>
              <span className="text-white font-bold">{portfolioSummary.totalCost.toLocaleString()} 원</span>
            </div>
            <div className="h-8 w-px bg-gray-800"></div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">총 평가금액</span>
              <span className="text-white font-bold">{portfolioSummary.totalValue.toLocaleString()} 원</span>
            </div>
            <div className="h-8 w-px bg-gray-800"></div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">총 평가손익</span>
              <span className={`font-bold flex items-center gap-1 ${portfolioSummary.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {portfolioSummary.profit >= 0 ? "+" : ""}
                {portfolioSummary.profit.toLocaleString()} 원
                <span className="text-xs">({portfolioSummary.profitPercent.toFixed(2)}%)</span>
              </span>
            </div>
          </div>
        </div>

        {portfolio.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolio.map((item) => {
              const currentVal = item.quantity * item.currentPrice;
              const profit = currentVal - item.totalCost;
              const profitPct = (profit / item.totalCost) * 100;
              
              return (
                <div key={item.symbol} className="p-4 bg-[#16171D] border border-[#23252E] rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-sm">{item.name}</h4>
                        <span className="text-[10px] text-gray-500 font-mono">{item.symbol}</span>
                      </div>
                      <button 
                        onClick={() => removeFromPortfolio(item.symbol)}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-rose-400 transition-colors"
                        title="포트폴리오에서 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-3 text-xs border-t border-[#1C1E26] pt-2">
                      <div>
                        <span className="text-gray-500 block">수량</span>
                        <span className="text-white font-bold font-mono">{item.quantity} 주</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">평균 단가</span>
                        <span className="text-white font-bold font-mono">{item.avgBuyPrice.toLocaleString()} 원</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">현재 단가</span>
                        <span className="text-white font-bold font-mono">{item.currentPrice.toLocaleString()} 원</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">평가손익</span>
                        <span className={`font-bold font-mono ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {profit >= 0 ? "+" : ""}
                          {profitPct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSearch(item.name)}
                    className="mt-3 w-full py-1.5 bg-[#1F212E] hover:bg-blue-600/10 text-blue-400 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    실시간 시세/퀀트 다시 보기 <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-gray-500 italic">
            포트폴리오가 비어 있습니다. 위 '모의 매수 시뮬레이터'를 사용해 가상 주식을 추가해 보세요!
          </div>
        )}
      </section>

      {/* FOOTER STATS BAR */}
      <footer id="app-footer" className="mt-6 flex flex-col md:flex-row items-center justify-between px-5 py-3 bg-[#12131A] border border-[#23252E] rounded-2xl gap-3 text-xs text-gray-500">
        <div className="flex flex-wrap gap-6 justify-center md:justify-start">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">엔진 상태</span>
            <span className="font-mono font-bold text-emerald-400">NORMAL OPERATING</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">종합 거래세율</span>
            <span className="font-mono font-bold text-white">0.15% (KOSPI)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">데이터 소스</span>
            <span className={`font-mono font-bold ${marketIndices?.dataSource === "mock" ? "text-amber-400" : "text-white"}`}>
              {marketIndices?.dataSource === "mock" ? "모의 데이터 (Gemini API 미연결)" : "Gemini 2.5 Flash Search Grounding"}
            </span>
          </div>
        </div>
        <div className="text-right text-[10px] text-gray-600">
          실시간 주식 정보 분석기 • Last updated: {marketIndices?.updatedAt || new Date().toLocaleTimeString("ko-KR")}
        </div>
      </footer>

    </div>
  );
}
