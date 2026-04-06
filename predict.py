import FinanceDataReader as fdr
import pandas as pd
import joblib
import os
from model import prepare_features

def predict_today(symbol='KS11'):
    """
    Predicts the next closing price using return-based forecasting.
    """
    model_path = f'models/{symbol}_model.joblib'
    if not os.path.exists(model_path):
        print(f"Model {model_path} not found. Run model.py first.")
        return
    
    model = joblib.load(model_path)
    
    from datetime import datetime, timedelta
    start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    df = fdr.DataReader(symbol, start_date)
    
    # Calculate Relative Features
    df['Return'] = df['Close'].pct_change()
    df['MA5_Rel'] = df['Close'] / df['Close'].rolling(window=5).mean()
    df['MA20_Rel'] = df['Close'] / df['Close'].rolling(window=20).mean()
    df['MA60_Rel'] = df['Close'] / df['Close'].rolling(window=60).mean()
    
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    exp1 = df['Close'].ewm(span=12, adjust=False).mean()
    exp2 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD_Rel'] = (exp1 - exp2) / df['Close']
    df['Vol_Change'] = df['Volume'].pct_change()
    
    features = ['Return', 'MA5_Rel', 'MA20_Rel', 'MA60_Rel', 'RSI', 'MACD_Rel', 'Vol_Change']
    
    # Predict the return for the NEXT trading day
    latest_row = df[features].tail(1)
    predicted_return = model.predict(latest_row)[0]
    
    current_close = df['Close'].iloc[-1]
    predicted_close = current_close * (1 + predicted_return)
    
    last_date = latest_row.index[0].strftime('%Y-%m-%d')
    print(f"\n--- [고도화된 수익률 기반 예측] ---")
    print(f"분석 기준 날짜: {last_date}")
    print(f"현재 종가: {current_close:.2f}")
    print(f"예상 수익률: {predicted_return*100:+.2f}%")
    print(f"다음 거래일 예상 종가: {predicted_close:.2f}")
    
    return predicted_close

if __name__ == "__main__":
    predict_today()
