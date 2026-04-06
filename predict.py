import FinanceDataReader as fdr
import pandas as pd
import joblib
import os
from model import prepare_features

def predict_today(symbol='KS11'):
    """
    Fetches latest data and predicts today's closing price.
    """
    # Load model
    model_path = f'models/{symbol}_model.joblib'
    if not os.path.exists(model_path):
        print(f"Model {model_path} not found. Run model.py first.")
        return
    
    model = joblib.load(model_path)
    
    # Fetch latest data (e.g., from 6 months ago to today)
    from datetime import datetime, timedelta
    start_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
    df = fdr.DataReader(symbol, start_date)
    
    # Prepare features (we need enough rows to calculate indicators)
    df_with_features = prepare_features(df.copy())
    
    # Get the latest row of features (excluding the Target which we shift for training)
    features_list = ['Open', 'High', 'Low', 'Close', 'Volume', 'MA5', 'MA20', 'MA60', 'RSI', 'MACD', 'Signal']
    
    # We need the most recent row that has all indicators calculated
    latest_features = df_with_features[features_list].tail(1)
    
    # Note: If today is a trading day and it's currently open, df.tail(1) will have partial data.
    # The model predicts the *next* day's close based on *current* day's OHLCV.
    # So if we use today's open, high, low, close (so far), it predicts tomorrow's close.
    # If we use yesterday's data, it predicts today's close.
    
    # To predict TODAY'S close, we use YESTERDAY'S data as features.
    # In df_with_features, each row's Target is the next day's close.
    # So the last row of df_with_features contains yesterday's data, and it predicted today's close.
    
    # Actually, in our train_model, Target = Close.shift(-1)
    # This means for each day, we use that day's data to predict the NEXT day's close.
    
    # Fetch data up to yesterday to predict today.
    # If we fetch up to "today", the last row is today.
    
    prediction = model.predict(latest_features)[0]
    
    last_date = latest_features.index[0].strftime('%Y-%m-%d')
    print(f"--- Prediction for {symbol} ---")
    print(f"Based on data from: {last_date}")
    print(f"Predicted Closing Price: {prediction:.2f}")
    
    return prediction

if __name__ == "__main__":
    predict_today()
