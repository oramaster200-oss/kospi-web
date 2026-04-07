import pandas as pd
import joblib
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def predict_today(symbol='KS11'):
    """
    Predicts using data fetched directly from Supabase (much faster).
    """
    model_path = f'models/{symbol}_model.joblib'
    if not os.path.exists(model_path):
        print(f"Model {model_path} not found. Run model.py first.")
        return
    
    model = joblib.load(model_path)
    
    # Fetch the LATEST row from Supabase
    print("Fetching latest market data from Supabase...")
    try:
        response = supabase.table('kospi_history').select("*").order("date", desc=True).limit(1).execute()
        if not response.data:
            print("No data found in Supabase. Run data_loader.py first.")
            return
        
        latest_data = response.data[0]
    except Exception as e:
        print(f"Error fetching from Supabase: {e}")
        return

    # Prepare features for prediction
    # These must match the features used during training
    features = ['rsi', 'ma5_rel', 'ma20_rel', 'ma60_rel', 'macd_rel', 'vol_change', 'us_return']
    
    # We need to calculate 'Return' if it's used as a feature, 
    # but based on previous code, let's stick to what we have in DB
    # Note: If your model requires 'Return' of the current day as a feature, 
    # you might need to fetch 2 rows to calculate it.
    
    # Create DataFrame for prediction
    input_df = pd.DataFrame([latest_data])
    
    # Map database column names to model feature names if they differ
    # (Assuming model was trained with specific feature names)
    # If the model was trained with 'RSI' (capitalized), we must match that.
    feature_mapping = {
        'rsi': 'RSI',
        'ma5_rel': 'MA5_Rel',
        'ma20_rel': 'MA20_Rel',
        'ma60_rel': 'MA60_Rel',
        'macd_rel': 'MACD_Rel',
        'vol_change': 'Vol_Change',
        'us_return': 'US_Return'
    }
    
    # If your model needs 'Return' (pct_change of close), 
    # we should have calculated it in data_loader and stored it.
    # Let's check what features model.py expects.
    
    input_row = pd.DataFrame([{
        'Return': (latest_data['close'] / latest_data['close']) - 1, # Placeholder if needed
        'MA5_Rel': latest_data['ma5_rel'],
        'MA20_Rel': latest_data['ma20_rel'],
        'MA60_Rel': latest_data['ma60_rel'],
        'RSI': latest_data['rsi'],
        'MACD_Rel': latest_data['macd_rel'],
        'Vol_Change': latest_data['vol_change'],
        'US_Return': latest_data['us_return']
    }])
    
    required_features = ['Return', 'MA5_Rel', 'MA20_Rel', 'MA60_Rel', 'RSI', 'MACD_Rel', 'Vol_Change', 'US_Return']
    predicted_return = model.predict(input_row[required_features])[0]
    
    current_close = latest_data['close']
    predicted_close = current_close * (1 + predicted_return)
    
    print(f"\n--- [Supabase 기반 고속 예측 결과] ---")
    print(f"분석 기준 날짜: {latest_data['date']}")
    print(f"현재 종가: {current_close:.2f}")
    print(f"예상 수익률: {predicted_return*100:+.2f}%")
    print(f"다음 거래일 예상 종가: {predicted_close:.2f}")
    
    return predicted_close

if __name__ == "__main__":
    predict_today()
