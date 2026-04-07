import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Fetch historical data (last 100 days)
    const { data: history, error: historyError } = await supabase
      .from('kospi_history')
      .select('*')
      .order('date', { ascending: true })
      .limit(100);

    if (historyError) throw historyError;

    // Get the latest data point
    const latest = history && history.length > 0 ? history[history.length - 1] : null;

    // Calculate a simple mock prediction if not already in DB
    // In a real scenario, this would come from a separate table or a model execution result
    const predictedReturn = 0.0015; // Example: 0.15% gain
    const predictedPrice = latest ? latest.close * (1 + predictedReturn) : 0;

    return NextResponse.json({
      latest: {
        ...latest,
        predictedPrice,
        percentChange: latest ? ((latest.close - (history[history.length - 2]?.close || latest.close)) / (history[history.length - 2]?.close || latest.close)) * 100 : 0
      },
      history: history.map(item => ({
        date: item.date,
        close: item.close,
        rsi: item.rsi
      }))
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
