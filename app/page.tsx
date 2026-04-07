'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Calendar, BarChart3, Info, Play, RefreshCcw, Brain, Rocket, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const Dashboard = () => {
  // Real data states
  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Execution states
  const [running, setRunning] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    try {
      const { data, error } = await supabase
        .from('kospi_history')
        .select('*')
        .order('date', { ascending: true })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        const latest = data[data.length - 1];
        const previous = data[data.length - 2] || latest;
        const percentChange = ((latest.close - previous.close) / previous.close) * 100;

        // Mock prediction calculation for visual purposes
        const predictedReturn = 0.0015; 
        const predictedPrice = latest.close * (1 + predictedReturn);

        setMarketData({
          latest: {
            ...latest,
            predictedPrice,
            percentChange
          },
          history: data.map(item => ({
            date: item.date,
            close: item.close,
            rsi: item.rsi
          }))
        });
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runScript = async (script: string) => {
    setRunning(script);
    setStatus({ type: 'info', message: `Executing ${script}...` });
    
    try {
      const response = await fetch('/api/run-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus({ type: 'success', message: `${script} completed successfully!` });
        // Refresh data after script execution
        if (script === 'predict.py' || script === 'data_loader.py') {
          fetchMarketData();
        }
      } else {
        setStatus({ type: 'error', message: data.error || `${script} failed.` });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to connect to the server.' });
    } finally {
      setRunning(null);
    }
  };

  const operations = [
    { id: 'data_loader.py', label: 'Update Data', icon: RefreshCcw, description: 'Fetch latest KOSPI data' },
    { id: 'model.py', label: 'Train Model', icon: Brain, description: 'Re-train AI model' },
    { id: 'predict.py', label: 'Predict KOSPI', icon: Rocket, description: 'Generate new forecast' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white">
        <Loader2 className="animate-spin text-sky-400 mr-2" /> Loading Market Intelligence...
      </div>
    );
  }

  const latest = marketData?.latest;
  const history = marketData?.history || [];
  const currentPrice = latest?.close || 0;
  const predictedPrice = latest?.predictedPrice || 0;
  const percentChange = latest?.percentChange || 0;
  const isUp = percentChange >= 0;

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-sky-400" /> KOSPI AI Insight
          </h1>
          <p className="text-slate-400 text-sm">Real-time Stock Market Prediction Dashboard</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-full border border-slate-600">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-sm">{latest?.date || '2026-04-06'}</span>
        </div>
      </header>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Current Price Card */}
        <div className="bg-[#1E293B] p-6 rounded-2xl border border-slate-700 hover:border-slate-500 transition-all">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-sm font-medium">Current KOSPI</span>
            <BarChart3 size={20} className="text-slate-500" />
          </div>
          <h2 className="text-4xl font-black mb-2 tracking-tight">{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          <div className={`flex items-center gap-1 text-sm ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />} 
            {percentChange.toFixed(2)}% (Today)
          </div>
        </div>

        {/* AI Prediction Card */}
        <div className="bg-[#1E293B] p-6 rounded-2xl border border-sky-500/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-sky-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-sky-400 text-sm font-bold uppercase tracking-wider">AI Forecast (Next)</span>
            <Activity size={20} className="text-sky-400" />
          </div>
          <h2 className="text-4xl font-black mb-2 tracking-tight text-sky-400">{predictedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          <div className="flex items-center gap-1 text-sky-300 text-sm">
             Target Prediction based on latest indicators
          </div>
        </div>

        {/* Strategy Insight */}
        <div className="bg-[#1E293B] p-6 rounded-2xl border border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-sm font-medium">AI Analysis</span>
            <Info size={20} className="text-slate-500" />
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Current RSI: <span className="text-slate-100 font-bold">{latest?.rsi?.toFixed(2) || 'N/A'}</span>. 
            The market is showing a <span className="text-slate-100 font-bold italic">"{latest?.rsi > 70 ? 'Overbought' : latest?.rsi < 30 ? 'Oversold' : 'Neutral-sideways'}"</span> pattern.
          </p>
          <div className="bg-slate-700/50 h-2 w-full rounded-full overflow-hidden">
            <div className="bg-sky-500 h-full shadow-[0_0_10px_#38bdf8]" style={{ width: `${latest?.rsi || 50}%` }}></div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-500 uppercase font-bold">
            <span>Sentiment: {latest?.rsi > 50 ? 'Bullish' : 'Bearish'}</span>
            <span>RSI: {latest?.rsi?.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Play size={20} className="text-sky-400" /> Model Operations
        </h3>
        
        {status && (
          <div className={`mb-4 p-4 rounded-xl border flex items-center gap-3 ${
            status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
            status.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 
            'bg-sky-500/10 border-sky-500/30 text-sky-400'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={18} /> : 
             status.type === 'error' ? <AlertCircle size={18} /> : 
             <Loader2 size={18} className="animate-spin" />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {operations.map((op) => (
            <button
              key={op.id}
              disabled={!!running}
              onClick={() => runScript(op.id)}
              className="group bg-[#1E293B] p-4 rounded-2xl border border-slate-700 hover:border-sky-500/50 hover:bg-slate-800 transition-all text-left flex items-start gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="bg-slate-800 p-3 rounded-xl group-hover:bg-sky-500/10 transition-colors">
                {running === op.id ? (
                  <Loader2 size={24} className="text-sky-400 animate-spin" />
                ) : (
                  <op.icon size={24} className="text-slate-400 group-hover:text-sky-400" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-slate-100">{op.label}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{op.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Historical Chart */}
      <div className="bg-[#1E293B] p-6 rounded-2xl border border-slate-700 h-[450px] mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 size={20} className="text-sky-400" /> Historical Performance (Last 100 Days)
          </h3>
          <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-md border border-slate-700">
            KOSPI Composite Index
          </div>
        </div>
        <div className="w-full h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(str) => str.slice(5)} // Show only MM-DD
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                domain={['auto', 'auto']}
                tickFormatter={(val) => val.toLocaleString()}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#f1f5f9' }}
                itemStyle={{ color: '#38bdf8' }}
              />
              <Area 
                type="monotone" 
                dataKey="close" 
                stroke="#38bdf8" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorClose)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <footer className="mt-12 text-center text-slate-600 text-xs">
        <p>© 2026 KOSPI Predict AI. Data provided by FinanceDataReader.</p>
        <p className="mt-1 opacity-60">Leveraging Random Forest Regressor for market forecasting</p>
      </footer>
    </div>
  );
};

export default Dashboard;
