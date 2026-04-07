'use client';

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Calendar, BarChart3, Info, Play, RefreshCcw, Brain, Rocket, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  // Mock data (실제로는 Python 모델 결과를 API로 받아오게 됩니다)
  const currentPrice = 5450.33;
  const predictedPrice = 5450.25;
  const priceChange = predictedPrice - currentPrice;
  const percentChange = (priceChange / currentPrice) * 100;
  const isUp = priceChange >= 0;

  // Execution states
  const [running, setRunning] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

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
    { id: 'model.py', label: 'Train Model', icon: Brain, description: 'Re-train LSTM model' },
    { id: 'predict.py', label: 'Predict KOSPI', icon: Rocket, description: 'Generate new forecast' },
  ];

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
          <span className="text-sm">2026-04-06</span>
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
          <h2 className="text-4xl font-black mb-2 tracking-tight">{currentPrice.toLocaleString()}</h2>
          <div className="flex items-center gap-1 text-emerald-400 text-sm">
            <TrendingUp size={16} /> +1.36% (Today)
          </div>
        </div>

        {/* AI Prediction Card */}
        <div className="bg-[#1E293B] p-6 rounded-2xl border border-sky-500/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-sky-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-sky-400 text-sm font-bold uppercase tracking-wider">AI Forecast (Next)</span>
            <Activity size={20} className="text-sky-400" />
          </div>
          <h2 className="text-4xl font-black mb-2 tracking-tight text-sky-400">{predictedPrice.toLocaleString()}</h2>
          <div className={`flex items-center gap-1 text-sm ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {percentChange.toFixed(2)}% Expected
          </div>
        </div>

        {/* Strategy Insight */}
        <div className="bg-[#1E293B] p-6 rounded-2xl border border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-sm font-medium">AI Analysis</span>
            <Info size={20} className="text-slate-500" />
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            The market is showing a <span className="text-slate-100 font-bold italic">"Neutral-sideways"</span> pattern. 
            Maintain current positions and monitor global interest rate shifts.
          </p>
          <div className="bg-slate-700/50 h-2 w-full rounded-full overflow-hidden">
            <div className="bg-sky-500 h-full w-[65%] shadow-[0_0_10px_#38bdf8]"></div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-500 uppercase font-bold">
            <span>Sentiment: Neutral</span>
            <span>65% Confidence</span>
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

      {/* Chart Placeholder */}
      <div className="bg-[#1E293B] p-8 rounded-2xl border border-slate-700 h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:20px_20px]"></div>
        <div className="text-slate-500 mb-2">
          <BarChart3 size={48} strokeWidth={1} />
        </div>
        <h3 className="text-lg font-medium text-slate-300">Predictive Chart Visualizing...</h3>
        <p className="text-slate-500 text-xs mt-1 italic">Fetching historical patterns for deep-learning analysis</p>
      </div>

      <footer className="mt-12 text-center text-slate-600 text-xs">
        <p>© 2026 KOSPI Predict AI. Data provided by FinanceDataReader.</p>
        <p className="mt-1 opacity-60">Fetching historical patterns for deep-learning analysis</p>
      </footer>
    </div>
  );
};

export default Dashboard;
