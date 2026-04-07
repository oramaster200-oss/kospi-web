import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib
import os

def prepare_features(df):
    """
    Adds relative technical indicators and target return to the dataframe.
    """
    # Relative price features
    df['Return'] = df['Close'].pct_change()
    df['MA5_Rel'] = df['Close'] / df['Close'].rolling(window=5).mean()
    df['MA20_Rel'] = df['Close'] / df['Close'].rolling(window=20).mean()
    df['MA60_Rel'] = df['Close'] / df['Close'].rolling(window=60).mean()
    
    # RSI (Relative Strength Index) - already relative (0-100)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # MACD Relative to price
    exp1 = df['Close'].ewm(span=12, adjust=False).mean()
    exp2 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD_Rel'] = (exp1 - exp2) / df['Close']
    
    # Volume Change
    df['Vol_Change'] = df['Volume'].pct_change()
    
    # Target: Tomorrow's Return (Next day's Close / Today's Close - 1)
    df['Target_Return'] = df['Close'].pct_change().shift(-1)
    
    df.dropna(inplace=True)
    return df

def train_model(symbol='KS11'):
    """
    Trains a RandomForest model to predict returns.
    """
    file_path = f'data/{symbol}_history.csv'
    if not os.path.exists(file_path):
        print(f"File {file_path} not found. Run data_loader.py first.")
        return
    
    df = pd.read_csv(file_path, index_col=0, parse_dates=True)
    df = prepare_features(df)
    
    # Define features (Relative values only, including US market return)
    features = ['Return', 'MA5_Rel', 'MA20_Rel', 'MA60_Rel', 'RSI', 'MACD_Rel', 'Vol_Change', 'US_Return']
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
