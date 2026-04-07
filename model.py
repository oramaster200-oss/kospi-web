import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL or SUPABASE_KEY not found in .env file.")
    exit(1)

supabase: Client = create_client(url, key)

def prepare_features(df):
    """
    Adds relative technical indicators and target return to the dataframe.
    """
    # Note: Indicators are already calculated in data_loader.py and stored in Supabase.
    # We just need to ensure the columns are mapped correctly and target is created.
    
    # Target: Tomorrow's Return (Next day's Close / Today's Close - 1)
    df['Target_Return'] = df['close'].pct_change().shift(-1)
    
    # Map database column names to model feature names if they differ
    # Features in DB: rsi, ma5_rel, ma20_rel, ma60_rel, macd_rel, vol_change, us_return
    # Plus 'Return' which we can calculate here if needed
    df['Return'] = df['close'].pct_change()
    
    df.dropna(inplace=True)
    return df

def train_model(symbol='KS11'):
    """
    Trains a RandomForest model to predict returns using data from Supabase.
    """
    print(f"Fetching historical data for {symbol} from Supabase...")
    try:
        # Fetch all history from Supabase
        response = supabase.table('kospi_history').select("*").order("date", desc=False).execute()
        if not response.data:
            print("No data found in Supabase. Run data_loader.py first.")
            return
        
        df = pd.DataFrame(response.data)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
    except Exception as e:
        print(f"Error fetching from Supabase: {e}")
        return

    df = prepare_features(df)
    
    # Define features (Must match columns in Supabase or those calculated in prepare_features)
    features = ['Return', 'ma5_rel', 'ma20_rel', 'ma60_rel', 'rsi', 'macd_rel', 'vol_change', 'us_return']
    X = df[features]
    y = df['Target_Return']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
    
    print(f"Training advanced model for {symbol} (Predicting Returns)...")
    model = RandomForestRegressor(n_estimators=200, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    print(f"Model trained. Mean Abs Error (Return): {mae:.4f}")
    
    os.makedirs('models', exist_ok=True)
    joblib.dump(model, f'models/{symbol}_model.joblib')
    return model

if __name__ == "__main__":
    train_model()
