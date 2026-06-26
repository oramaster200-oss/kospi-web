import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase client (optional — cache is skipped if credentials are absent)
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
if (supabase) {
  console.log("[Supabase] Client initialized — DB caching enabled");
} else {
  console.warn("[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — all DB saves will be skipped!");
}

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

interface GenerateContentParams {
  contents: string;
  config?: any;
}

// Wrapper function to sequentially try all requested models on failure/rate-limit
async function generateContentWithRetry(params: GenerateContentParams) {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[Gemini Request] Attempting generateContent with model: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
        contents: params.contents,
        config: params.config,
      });
      console.log(`[Gemini Success] Request completed successfully using model: ${model}`);
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Fallback Warning] Model ${model} failed. Error: ${err.message || err.toString()}`);
    }
  }

  console.error(`[Gemini Fallback Error] All models in the fallback chain failed.`);
  throw lastError || new Error("All Gemini models in fallback chain failed");
}

// ─── Supabase Cache Helpers ───────────────────────────────────────────────────

const TTL = {
  MARKET_INDICES: 60,    // seconds
  POPULAR_STOCKS: 20,    // seconds
  STOCK_ANALYSIS: 300,   // seconds (5 min)
};

function expiresAt(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

// market_indices
async function getCachedMarketIndices() {
  if (!supabase) return null;
  const { data } = await supabase
    .from("market_indices")
    .select("*")
    .eq("id", "current")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  return {
    kospi:  { value: data.kospi_value,  change: data.kospi_change,  percent: data.kospi_percent,  trend: data.kospi_trend  },
    kosdaq: { value: data.kosdaq_value, change: data.kosdaq_change, percent: data.kosdaq_percent, trend: data.kosdaq_trend },
    statusSummary: data.status_summary,
    updatedAt: new Date(data.updated_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    dataSource: data.data_source as "realtime" | "mock",
  };
}

async function setCachedMarketIndices(payload: any) {
  if (!supabase) return;
  await supabase.from("market_indices").upsert({
    id: "current",
    kospi_value:   payload.kospi.value,
    kospi_change:  payload.kospi.change,
    kospi_percent: payload.kospi.percent,
    kospi_trend:   payload.kospi.trend,
    kosdaq_value:   payload.kosdaq.value,
    kosdaq_change:  payload.kosdaq.change,
    kosdaq_percent: payload.kosdaq.percent,
    kosdaq_trend:   payload.kosdaq.trend,
    status_summary: payload.statusSummary,
    data_source:    payload.dataSource,
    updated_at:     new Date().toISOString(),
    expires_at:     expiresAt(TTL.MARKET_INDICES),
  });
}

// popular_stocks
async function getCachedPopularStocks() {
  if (!supabase) return null;
  const { data } = await supabase
    .from("popular_stocks")
    .select("*")
    .gt("expires_at", new Date().toISOString());
  if (!data || data.length < 10) return null;
  return data.map((r: any) => ({
    symbol:        r.symbol,
    name:          r.name,
    category:      r.category,
    price:         r.price,
    changePercent: r.change_percent,
    dataSource:    r.data_source as "realtime" | "mock",
  }));
}

async function setCachedPopularStocks(stocks: any[]) {
  if (!supabase) return;
  const rows = stocks.map((s: any) => ({
    symbol:        s.symbol,
    name:          s.name,
    category:      s.category,
    price:         s.price,
    change_percent: s.changePercent,
    data_source:   s.dataSource,
    updated_at:    new Date().toISOString(),
    expires_at:    expiresAt(TTL.POPULAR_STOCKS),
  }));
  await supabase.from("popular_stocks").upsert(rows);
}

// stock_analyses (query_key = query.trim().toLowerCase())
async function getCachedStockAnalysis(queryKey: string) {
  if (!supabase) return null;
  const { data } = await supabase
    .from("stock_analyses")
    .select("*")
    .eq("query_key", queryKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  return {
    stockName:           data.stock_name,
    symbol:              data.symbol,
    currentPrice:        data.current_price,
    priceChange:         data.price_change,
    priceChangePercent:  data.price_change_percent,
    highestPrice:        data.highest_price,
    lowestPrice:         data.lowest_price,
    volume:              data.volume,
    analysisResult:      data.analysis_result,
    analysisScore:       data.analysis_score,
    targetPrice:         data.target_price,
    stopLossPrice:       data.stop_loss_price,
    summary:             data.summary,
    strengths:           data.strengths,
    risks:               data.risks,
    technicalIndicators: data.technical_indicators,
    recentNews:          data.recent_news,
    dataSource:          data.data_source as "realtime" | "mock",
  };
}

async function setCachedStockAnalysis(queryKey: string, analysis: any) {
  if (!supabase) {
    console.warn("[Supabase] setCachedStockAnalysis skipped — supabase client not initialized");
    return;
  }
  const row = {
    query_key:            queryKey,
    symbol:               analysis.symbol,
    stock_name:           analysis.stockName,
    current_price:        analysis.currentPrice,
    price_change:         analysis.priceChange,
    price_change_percent: analysis.priceChangePercent,
    highest_price:        analysis.highestPrice,
    lowest_price:         analysis.lowestPrice,
    volume:               analysis.volume,
    analysis_result:      analysis.analysisResult,
    analysis_score:       analysis.analysisScore,
    target_price:         analysis.targetPrice,
    stop_loss_price:      analysis.stopLossPrice,
    summary:              analysis.summary,
    strengths:            analysis.strengths,
    risks:                analysis.risks,
    technical_indicators: analysis.technicalIndicators,
    recent_news:          analysis.recentNews,
    data_source:          analysis.dataSource,
    updated_at:           new Date().toISOString(),
    expires_at:           expiresAt(TTL.STOCK_ANALYSIS),
  };
  const { error } = await supabase
    .from("stock_analyses")
    .upsert(row, { onConflict: "query_key" });
  if (error) {
    console.error("[Supabase] stock_analyses upsert failed:", error.message, error.details, error.hint);
  } else {
    console.log(`[Supabase] stock_analyses saved — query_key="${queryKey}"`);
  }
}

// stock_chart_cache
const CHART_TTL: Record<string, number> = {
  "1D": 5 * 60,
  "1W": 30 * 60,
  "1M": 2 * 60 * 60,
  "1Y": 12 * 60 * 60,
};

const YAHOO_CHART_PARAMS: Record<string, { range: string; interval: string }> = {
  "1D": { range: "1d",  interval: "5m"  },
  "1W": { range: "5d",  interval: "1h"  },
  "1M": { range: "1mo", interval: "1d"  },
  "1Y": { range: "1y",  interval: "1wk" },
};

async function getCachedChartData(symbol: string, period: string) {
  if (!supabase) return null;
  const { data } = await supabase
    .from("stock_chart_cache")
    .select("*")
    .eq("symbol", symbol)
    .eq("period", period)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  return { chartData: data.chart_data, dataSource: data.data_source as "realtime" | "mock" };
}

async function setCachedChartData(symbol: string, period: string, chartData: any[], dataSource: string) {
  if (!supabase) return;
  await supabase.from("stock_chart_cache").upsert({
    symbol,
    period,
    chart_data: chartData,
    data_source: dataSource,
    updated_at: new Date().toISOString(),
    expires_at: expiresAt(CHART_TTL[period] ?? 300),
  });
}

async function fetchYahooChartData(symbol: string, period: string) {
  const { range, interval } = YAHOO_CHART_PARAMS[period] ?? YAHOO_CHART_PARAMS["1M"];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.KS?range=${range}&interval=${interval}`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`Yahoo Finance chart: ${response.status}`);

  const json: any = await response.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("No chart result from Yahoo Finance");

  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
  if (!timestamps.length || !closes.length) throw new Error("Empty chart data");

  const chartData = timestamps
    .map((ts, i) => {
      const date = new Date(ts * 1000);
      const label = period === "1D"
        ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
        : date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
      return { label, value: closes[i] ?? null };
    })
    .filter(p => p.value !== null);

  return chartData;
}

// ─────────────────────────────────────────────────────────────────────────────

// Helper function to generate premium mock analysis when Gemini API is rate-limited or unavailable
function getMockAnalysis(stockQuery: string) {
  const query = stockQuery.trim();
  const popular = [
    { symbol: "005930", name: "삼성전자", category: "반도체", basePrice: 334500, analysisResult: "BUY", score: 82, target: 380000, stopLoss: 310000 },
    { symbol: "000660", name: "SK하이닉스", category: "반도체", basePrice: 2621000, analysisResult: "STRONG_BUY", score: 92, target: 3000000, stopLoss: 2450000 },
    { symbol: "373220", name: "LG에너지솔루션", category: "2차전지", basePrice: 342000, analysisResult: "HOLD", score: 65, target: 380000, stopLoss: 315000 },
    { symbol: "207940", name: "삼성바이오로직스", category: "제약/바이오", basePrice: 981000, analysisResult: "BUY", score: 79, target: 1100000, stopLoss: 910000 },
    { symbol: "005380", name: "현대차", category: "자동차", basePrice: 248500, analysisResult: "BUY", score: 81, target: 290000, stopLoss: 228000 },
    { symbol: "005490", name: "POSCO홀딩스", category: "철강/소재", basePrice: 364000, analysisResult: "HOLD", score: 58, target: 410000, stopLoss: 335000 },
    { symbol: "035420", name: "NAVER", category: "IT/플랫폼", basePrice: 168000, analysisResult: "HOLD", score: 62, target: 195000, stopLoss: 152000 },
    { symbol: "035720", name: "카카오", category: "IT/플랫폼", basePrice: 34150, analysisResult: "SELL", score: 35, target: 39000, stopLoss: 31000 },
    { symbol: "000270", name: "기아", category: "자동차", basePrice: 139200, analysisResult: "STRONG_BUY", score: 90, target: 160000, stopLoss: 125000 },
    { symbol: "068270", name: "셀트리온", category: "제약/바이오", basePrice: 173200, analysisResult: "BUY", score: 76, target: 200000, stopLoss: 155000 }
  ];

  const match = popular.find(s => s.name.includes(query) || query.includes(s.name) || s.symbol === query);
  
  const name = match ? match.name : (query.length === 6 && /^\d+$/.test(query) ? `KOSPI 종목 ${query}` : query);
  const symbol = match ? match.symbol : (query.length === 6 && /^\d+$/.test(query) ? query : "005930");
  const category = match ? match.category : "일반제조";
  const basePrice = match ? match.basePrice : 75000;
  const analysisResult = (match ? match.analysisResult : "BUY") as "STRONG_BUY" | "BUY" | "HOLD" | "SELL";
  const score = match ? match.score : 75;
  const target = match ? match.target : Math.round(basePrice * 1.15 / 100) * 100;
  const stopLoss = match ? match.stopLoss : Math.round(basePrice * 0.92 / 100) * 100;

  // Dynamically fluctuate base prices in real-time based on the clock so that the graph & numbers look authentic and lively
  const now = new Date();
  const seed = now.getMinutes() + now.getSeconds() / 60;
  const percentChange = (Math.sin(seed) * 1.8).toFixed(2);
  const isPositive = parseFloat(percentChange) >= 0;
  const sign = isPositive ? "+" : "";
  const diffVal = Math.round(basePrice * (parseFloat(percentChange) / 100));
  const finalPrice = basePrice + diffVal;

  return {
    dataSource: "mock" as const,
    stockName: name,
    symbol: symbol,
    currentPrice: finalPrice.toLocaleString("ko-KR"),
    priceChange: (isPositive ? "+" : "") + diffVal.toLocaleString("ko-KR"),
    priceChangePercent: `${sign}${percentChange}%`,
    highestPrice: Math.round(finalPrice * 1.018).toLocaleString("ko-KR"),
    lowestPrice: Math.round(finalPrice * 0.985).toLocaleString("ko-KR"),
    volume: Math.round(2400000 + (seed * 115000)).toLocaleString("ko-KR"),
    analysisResult: analysisResult,
    analysisScore: score,
    targetPrice: target.toLocaleString("ko-KR") + " KRW",
    stopLossPrice: stopLoss.toLocaleString("ko-KR") + " KRW",
    summary: `${name}(${symbol})은(는) 퀀트 분석 가중치와 지지선 구조를 결합해 정밀 분석한 결과, 주봉 및 일봉 상의 20일 이동평균선 지지 흐름이 대단히 견고하며 단기 상승 모멘텀 유입으로 '${analysisResult}' 의견이 산출됩니다.`,
    strengths: [
      "기관과 외국인 투자자의 연속 순매수 주체성 확보로 하방 경직성 확보",
      "차세대 핵심 주력군 공급 다변화에 따른 매출 다각화 및 실적 성장 모멘텀",
      "PBR 및 PER 밸류에이션 하단 위치에 따른 높은 가치 메리트 소유"
    ],
    risks: [
      "대외 지정학적 불확실성 및 고금리 장기화 기조에 따른 매크로 불안요소",
      "단기 강한 매물 저항 벽 부딪침에 의한 박스권 변동성 장세 우려",
      "소재 조달 원가율 일시적 인상에 따른 영업이익 마진율 압박 요소"
    ],
    technicalIndicators: [
      { name: "20일 이동평균 (20 SMA)", value: "정배열 유지", status: "BULLISH", description: "주봉 및 일봉 추세선 우상향 정배열" },
      { name: "RSI (14)", value: "56.4 (안정권)", status: "NEUTRAL", description: "과매도 탈출 후 견고한 매수세 수렴 국면" },
      { name: "MACD", value: "골든크로스 포착", status: "BULLISH", description: "시그널 라인 상향 돌파에 따른 모멘텀 활성화" }
    ],
    recentNews: [
      { title: `${name}, 글로벌 공급 다변화 수주 성공에 힘입어 하반기 실적 가이드라인 대폭 상향`, sentiment: "POSITIVE", source: "매일경제" },
      { title: `외국인 투심 대거 회복 속 ${name} 순매수 비중 상위 랭크인`, sentiment: "POSITIVE", source: "한국경제" },
      { title: `글로벌 거시경제 변동성에 따른 단기 마진 방어선 및 리스크 요인 종합 분석`, sentiment: "NEUTRAL", source: "연합인포맥스" }
    ]
  };
}

// Helper function to clean and parse JSON response from Gemini
function parseGeminiResponse(text: string) {
  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();
  return JSON.parse(cleanText);
}

// Helper function to query Gemini with search grounding
async function getStockAnalysisFromGemini(stockQuery: string) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined");
  }

  const prompt = `Analyze KOSPI stock: "${stockQuery}".
Use Google Search for real-time data:
1. Price, daily change, high, low, volume.
2. Market sentiment, financial overview, news.
3. Indicators (RSI, SMA, MACD).

Output MUST be a raw JSON object only (no markdown code blocks, no text outside JSON):
{
  "stockName": "Name",
  "symbol": "6-digit",
  "currentPrice": "75,200",
  "priceChange": "+1,500",
  "priceChangePercent": "+2.03%",
  "highestPrice": "76,000",
  "lowestPrice": "74,100",
  "volume": "15.4M shares",
  "analysisResult": "STRONG_BUY"|"BUY"|"HOLD"|"SELL",
  "analysisScore": 85,
  "targetPrice": "85,000 KRW",
  "stopLossPrice": "71,000 KRW",
  "summary": "2-sentence Korean summary",
  "strengths": ["s1", "s2", "s3"],
  "risks": ["r1", "r2", "r3"],
  "technicalIndicators": [
    { "name": "RSI(14)", "value": "55.4", "status": "NEUTRAL"|"BULLISH"|"BEARISH", "description": "detail" }
  ],
  "recentNews": [
    { "title": "news title", "sentiment": "POSITIVE"|"NEUTRAL"|"NEGATIVE", "source": "agency" }
  ]
}`;

  const response = await generateContentWithRetry({
    contents: prompt,
    config: {
      systemInstruction: "You are an elite stock analyst specializing in the Korean KOSPI stock market. Provide extremely accurate and highly professional analysis of stocks based on real-time web search results.",
      tools: [{ googleSearch: {} }]
    }
  });

  return parseGeminiResponse(response.text || "{}");
}

// 0. Debug API: Diagnostics check for API Key and Gemini connection status
app.get("/api/debug-status", async (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  const keySnippet = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 8) + "..." : "none";
  let testSimple = "not tested";
  let testSearch = "not tested";
  let errorSimple = null;
  let errorSearch = null;

  if (hasKey) {
    // 1. Test simple call
    try {
      const testAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const resp = await testAi.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Hello, answer 'OK' and nothing else.",
      });
      testSimple = resp.text ? resp.text.trim() : "empty response";
    } catch (err: any) {
      errorSimple = err.message || err.toString();
    }

    // 2. Test search grounding call
    try {
      const testAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const resp = await testAi.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "What is the current stock price of Samsung Electronics?",
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      testSearch = resp.text ? "Success (got content)" : "empty response";
    } catch (err: any) {
      errorSearch = err.message || err.toString();
    }
  }

  res.json({
    hasKey,
    keySnippet,
    env: process.env.NODE_ENV || "unknown",
    testSimple,
    errorSimple,
    testSearch,
  });
});

// 0.5. API: Supabase connectivity test
app.get("/api/test-supabase", async (req, res) => {
  if (!supabase) {
    return res.json({ ok: false, error: "Supabase client is null — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var is missing" });
  }
  const testKey = "__test__";
  const { error: upsertError } = await supabase.from("stock_analyses").upsert({
    query_key: testKey,
    symbol: "000000",
    stock_name: "테스트",
    current_price: "0",
    price_change: "0",
    price_change_percent: "0%",
    highest_price: "0",
    lowest_price: "0",
    volume: "0",
    analysis_result: "HOLD",
    analysis_score: 0,
    target_price: "0",
    stop_loss_price: "0",
    summary: "test",
    strengths: [],
    risks: [],
    technical_indicators: [],
    recent_news: [],
    data_source: "mock",
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60000).toISOString(),
  }, { onConflict: "query_key" });

  if (upsertError) {
    return res.json({ ok: false, error: upsertError.message, details: upsertError.details, hint: upsertError.hint, code: upsertError.code });
  }

  // clean up test row
  await supabase.from("stock_analyses").delete().eq("query_key", testKey);
  return res.json({ ok: true, message: "Supabase upsert to stock_analyses succeeded!" });
});

// 0.6. API: Verify application entry password
app.post("/api/verify-password", (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD || "1234";
  if (password === correctPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "비밀번호가 올바르지 않습니다." });
  }
});

// 1. API: Get Korean Market Indices (KOSPI & KOSDAQ) via Yahoo Finance
app.get("/api/market-indices", async (req, res) => {
  try {
    // 1) 캐시 확인
    const cached = await getCachedMarketIndices();
    if (cached) {
      console.log("[Cache HIT] market_indices");
      return res.json(cached);
    }
    console.log("[Cache MISS] market_indices — fetching from Yahoo Finance");

    // 2) Yahoo Finance v8 chart API로 KOSPI(^KS11), KOSDAQ(^KQ11) 조회
    const fetchIndex = async (ticker: string) => {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (!r.ok) throw new Error(`Yahoo chart ${ticker}: ${r.status}`);
      const j: any = await r.json();
      const res = j.chart?.result?.[0];
      if (!res) throw new Error(`No data for ${ticker}`);
      const meta = res.meta;
      return {
        price:         meta.regularMarketPrice as number,
        prevClose:     meta.chartPreviousClose as number,
        change:        (meta.regularMarketPrice - meta.chartPreviousClose) as number,
        changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100) as number,
      };
    };

    const [kospiD, kosdaqD] = await Promise.all([fetchIndex("^KS11"), fetchIndex("^KQ11")]);

    const fmt  = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = (n: number) => n >= 0 ? "+" : "";

    const result = {
      kospi: {
        value:   fmt(kospiD.price),
        change:  `${sign(kospiD.change)}${fmt(kospiD.change)}`,
        percent: `${sign(kospiD.changePercent)}${kospiD.changePercent.toFixed(2)}%`,
        trend:   (kospiD.changePercent >= 0 ? "BULLISH" : "BEARISH") as "BULLISH" | "BEARISH",
      },
      kosdaq: {
        value:   fmt(kosdaqD.price),
        change:  `${sign(kosdaqD.change)}${fmt(kosdaqD.change)}`,
        percent: `${sign(kosdaqD.changePercent)}${kosdaqD.changePercent.toFixed(2)}%`,
        trend:   (kosdaqD.changePercent >= 0 ? "BULLISH" : "BEARISH") as "BULLISH" | "BEARISH",
      },
      statusSummary: `KOSPI ${fmt(kospiD.price)} (${sign(kospiD.changePercent)}${kospiD.changePercent.toFixed(2)}%), KOSDAQ ${fmt(kosdaqD.price)} (${sign(kosdaqD.changePercent)}${kosdaqD.changePercent.toFixed(2)}%)`,
      dataSource: "realtime" as const,
    };

    await setCachedMarketIndices(result).catch(console.warn);
    return res.json({ ...result, updatedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) });

  } catch (error: any) {
    console.error("Error fetching market indices:", error.message);
    const fallback = {
      kospi:  { value: "2,682.43", change: "+14.50", percent: "+0.54%", trend: "BULLISH" as const },
      kosdaq: { value: "852.12",   change: "-2.11",  percent: "-0.25%", trend: "BEARISH" as const },
      statusSummary: "시장 지수를 가져오는 중 일시적인 오류가 발생했습니다.",
      dataSource: "mock" as const,
    };
    await setCachedMarketIndices(fallback).catch(console.warn);
    return res.json({ ...fallback, updatedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) });
  }
});

// 2. API: Search and analyze a KOSPI stock
app.post("/api/analyze-stock", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Stock name or symbol is required." });
  }

  const queryKey = query.trim().toLowerCase();

  // 1) 캐시 확인
  const cached = await getCachedStockAnalysis(queryKey).catch(() => null);
  if (cached) {
    console.log(`[Cache HIT] stock_analyses — "${queryKey}"`);
    return res.json(cached);
  }
  console.log(`[Cache MISS] stock_analyses — "${queryKey}" — fetching from Gemini`);

  try {
    const analysis = await getStockAnalysisFromGemini(query);
    const result = { ...analysis, dataSource: "realtime" as const };
    await setCachedStockAnalysis(queryKey, result);
    return res.json(result);
  } catch (error: any) {
    console.warn("[Server API Warning] Gemini call failed or quota exceeded. Falling back to high-fidelity mock data generator:", error.message);
    const analysis = getMockAnalysis(query);
    const result = { ...analysis, dataSource: "mock" as const };
    await setCachedStockAnalysis(queryKey, result);
    return res.json(result);
  }
});

// 3. API: Batch fetch popular stock prices and change percents from Naver Finance (real-time)
app.get("/api/popular-stocks-prices", async (req, res) => {
  // 1) 캐시 확인
  const cached = await getCachedPopularStocks().catch(() => null);
  if (cached) {
    console.log("[Cache HIT] popular_stocks");
    return res.json(cached);
  }
  console.log("[Cache MISS] popular_stocks — fetching from Naver Finance");

  const defaultPopular = [
    { symbol: "005930", name: "삼성전자", category: "반도체", basePrice: 334500 },
    { symbol: "000660", name: "SK하이닉스", category: "반도체", basePrice: 2621000 },
    { symbol: "373220", name: "LG에너지솔루션", category: "2차전지", basePrice: 342000 },
    { symbol: "207940", name: "삼성바이오로직스", category: "제약/바이오", basePrice: 981000 },
    { symbol: "005380", name: "현대차", category: "자동차", basePrice: 248500 },
    { symbol: "005490", name: "POSCO홀딩스", category: "철강/소재", basePrice: 364000 },
    { symbol: "035420", name: "NAVER", category: "IT/플랫폼", basePrice: 168000 },
    { symbol: "035720", name: "카카오", category: "IT/플랫폼", basePrice: 34150 },
    { symbol: "000270", name: "기아", category: "자동차", basePrice: 139200 },
    { symbol: "068270", name: "셀트리온", category: "제약/바이오", basePrice: 173200 }
  ];

  // Accept custom symbol list from client
  const symbolsParam = req.query.symbols as string | undefined;
  let popular: typeof defaultPopular;

  if (symbolsParam !== undefined) {
    const requestedSymbols = symbolsParam
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d{6}$/.test(s))
      .slice(0, 30);

    if (requestedSymbols.length === 0) {
      return res.json([]);
    }

    popular = requestedSymbols.map(sym => {
      const known = defaultPopular.find(p => p.symbol === sym);
      return known || { symbol: sym, name: sym, category: "기타", basePrice: 50000 };
    });
  } else {
    popular = defaultPopular;
  }

  try {
    const symbolList = popular.map(s => s.symbol).join(',');
    const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${symbolList}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!response.ok) {
      throw new Error(`Naver Finance API responded with status ${response.status}`);
    }

    const data: any = await response.json();
    const datas = data.result?.areas?.[0]?.datas;

    if (Array.isArray(datas) && datas.length > 0) {
      const merged = datas.map((item: any) => {
        const found = popular.find(p => p.symbol === item.cd);
        const knownName = found && found.name !== found.symbol ? found.name : undefined;
        const sign = (item.rf === "1" || item.rf === "2") ? "+" : (item.rf === "4" || item.rf === "5") ? "-" : "";
        return {
          symbol: item.cd,
          name: knownName || item.nm || item.cd,
          category: found?.category || "기타",
          price: item.nv.toLocaleString("ko-KR"),
          changePercent: `${sign}${item.cr}%`,
          dataSource: "realtime" as const
        };
      });
      await setCachedPopularStocks(merged).catch(console.warn);
      return res.json(merged);
    }
    throw new Error("Invalid datas structure from Naver Finance");
  } catch (naverError: any) {
    console.warn("[Naver Finance FAILED] Trying Yahoo Finance fallback:", naverError.message);

    try {
      const yahooSymbols = popular.map(s => `${s.symbol}.KS`).join(",");
      const yahooRes = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbols}`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (!yahooRes.ok) throw new Error(`Yahoo quote: ${yahooRes.status}`);

      const yahooData: any = await yahooRes.json();
      const quotes: any[] = yahooData.quoteResponse?.result ?? [];

      const merged = popular.map(stock => {
        const q = quotes.find((r: any) => r.symbol === `${stock.symbol}.KS`);
        const price = q?.regularMarketPrice ?? stock.basePrice;
        const pct   = q?.regularMarketChangePercent ?? 0;
        const sign  = pct >= 0 ? "+" : "";
        return {
          symbol: stock.symbol,
          name: stock.name,
          category: stock.category,
          price: Math.round(price).toLocaleString("ko-KR"),
          changePercent: `${sign}${pct.toFixed(2)}%`,
          dataSource: "realtime" as const
        };
      });

      await setCachedPopularStocks(merged).catch(console.warn);
      return res.json(merged);

    } catch (yahooError: any) {
      console.warn("[Yahoo Finance FAILED] Using mock data:", yahooError.message);
      const now = new Date();
      const seed = now.getMinutes() + now.getSeconds() / 60;

      const fallbackData = popular.map(stock => {
        const stockSeed = stock.name.charCodeAt(0) + seed;
        const stockPercent = (Math.sin(stockSeed) * 2.3).toFixed(2);
        const stockSign = parseFloat(stockPercent) >= 0 ? "+" : "";
        const diffVal = Math.round(stock.basePrice * (parseFloat(stockPercent) / 100));
        const finalPrice = stock.basePrice + diffVal;
        return {
          symbol: stock.symbol,
          name: stock.name,
          category: stock.category,
          price: finalPrice.toLocaleString("ko-KR"),
          changePercent: `${stockSign}${stockPercent}%`,
          dataSource: "mock" as const
        };
      });
      await setCachedPopularStocks(fallbackData).catch(console.warn);
      return res.json(fallbackData);
    }
  }
});


// 3.5. API: Fetch overseas ETF prices (EWY, JEPQ, KORU, SOXX)
const OVERSEAS_SYMBOLS = ["EWY", "JEPQ", "KORU", "SOXX"];
const OVERSEAS_BASE: Record<string, number> = { EWY: 62, JEPQ: 55, KORU: 28, SOXX: 210 };

app.get("/api/overseas-stocks", async (req, res) => {
  try {
    const symbols = OVERSEAS_SYMBOLS.join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`Yahoo Finance: ${response.status}`);

    const data: any = await response.json();
    const quotes: any[] = data.quoteResponse?.result ?? [];

    const result = OVERSEAS_SYMBOLS.map(sym => {
      const q = quotes.find((r: any) => r.symbol === sym);
      const price = q?.regularMarketPrice ?? OVERSEAS_BASE[sym];
      const pct   = q?.regularMarketChangePercent ?? 0;
      const sign  = pct >= 0 ? "+" : "";
      return {
        symbol: sym,
        price: price.toFixed(2),
        changePercent: `${sign}${pct.toFixed(2)}%`,
        dataSource: q ? "realtime" : "mock",
      };
    });

    return res.json(result);
  } catch (err: any) {
    console.warn("[overseas-stocks] Yahoo Finance failed:", err.message);
    const now = new Date();
    const seed = now.getMinutes() + now.getSeconds() / 60;
    const fallback = OVERSEAS_SYMBOLS.map(sym => {
      const base = OVERSEAS_BASE[sym];
      const pct = (Math.sin(base + seed) * 1.5).toFixed(2);
      const sign = parseFloat(pct) >= 0 ? "+" : "";
      return {
        symbol: sym,
        price: (base * (1 + parseFloat(pct) / 100)).toFixed(2),
        changePercent: `${sign}${pct}%`,
        dataSource: "mock",
      };
    });
    return res.json(fallback);
  }
});

// 4. API: Fetch real price history chart data from Yahoo Finance
app.get("/api/stock-history", async (req, res) => {
  const symbol = String(req.query.symbol || "").trim();
  const period = String(req.query.period || "1M").trim();

  if (!symbol) return res.status(400).json({ error: "symbol is required" });

  try {
    // 1) 캐시 확인
    const cached = await getCachedChartData(symbol, period);
    if (cached) {
      console.log(`[Cache HIT] stock_chart_cache — ${symbol} ${period}`);
      return res.json(cached);
    }
    console.log(`[Cache MISS] stock_chart_cache — ${symbol} ${period} — fetching from Yahoo Finance`);

    // 2) Yahoo Finance 조회
    const chartData = await fetchYahooChartData(symbol, period);
    await setCachedChartData(symbol, period, chartData, "realtime").catch(console.warn);
    return res.json({ chartData, dataSource: "realtime" });

  } catch (error: any) {
    console.warn(`[Yahoo Finance Chart FAILED] ${symbol} ${period}:`, error.message);
    return res.json({ chartData: [], dataSource: "mock" });
  }
});

// ─── Cached Analysis Quick View (no TTL) ────────────────────────────────────

app.get("/api/stock-cache", async (req, res) => {
  const query = (req.query.query as string)?.trim().toLowerCase();
  if (!query) return res.status(400).json({ error: "query required" });
  if (!supabase) return res.status(404).json({ error: "no cache" });
  try {
    const { data } = await supabase
      .from("stock_analyses")
      .select("*")
      .eq("query_key", query)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return res.status(404).json({ error: "no cache" });
    return res.json({
      stockName:           data.stock_name,
      symbol:              data.symbol,
      currentPrice:        data.current_price,
      priceChange:         data.price_change,
      priceChangePercent:  data.price_change_percent,
      highestPrice:        data.highest_price,
      lowestPrice:         data.lowest_price,
      volume:              data.volume,
      analysisResult:      data.analysis_result,
      analysisScore:       data.analysis_score,
      targetPrice:         data.target_price,
      stopLossPrice:       data.stop_loss_price,
      summary:             data.summary,
      strengths:           data.strengths,
      risks:               data.risks,
      technicalIndicators: data.technical_indicators,
      recentNews:          data.recent_news,
      dataSource:          data.data_source,
      cachedAt:            data.updated_at,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── User Data Sync ──────────────────────────────────────────────────────────

app.get("/api/user-sync", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
  try {
    const { data } = await supabase
      .from("user_data")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return res.json({ watchlist: [], userStocks: [], portfolio: [] });
    return res.json({
      watchlist: data.watchlist || [],
      userStocks: data.user_stocks || [],
      portfolio: data.portfolio || []
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/user-sync", async (req, res) => {
  const { userId, watchlist, userStocks, portfolio } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
  try {
    await supabase.from("user_data").upsert({
      user_id: userId,
      watchlist,
      user_stocks: userStocks,
      portfolio,
      updated_at: new Date().toISOString()
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Serve frontend build static files or connect to Vite middleware
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] Express server running on http://localhost:${PORT}`);
    });
  }
}

setupServer();

export default app;
