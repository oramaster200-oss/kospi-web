import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib
import os

def prepare_features(df):
    """
    Adds technical indicators and target variable to the dataframe.
    """
    # Moving Averages
    df['MA5'] = df['Close'].rolling(window=5).mean()
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA60'] = df['Close'].rolling(window=60).mean()
    
    # RSI (Relative Strength Index)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # MACD (Moving Average Convergence Divergence)
    exp1 = df['Close'].ewm(span=12, adjust=False).mean()
    exp2 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = exp1 - exp2
    df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    
    # Target: Tomorrow's Close
    df['Target'] = df['Close'].shift(-1)
    
    # Drop rows with NaN values (due to rolling/shifting)
    df.dropna(inplace=True)
    return df

def train_model(symbol='KS11'):
    """
    Trains a RandomForest model using historical data.
    """
    file_path = f'data/{symbol}_history.csv'
    if not os.path.exists(file_path):
        print(f"File {file_path} not found. Run data_loader.py first.")
        return
    
    df = pd.read_csv(file_path, index_col=0, parse_dates=True)
    df = prepare_features(df)
    
    # Define features (X) and target (y)
    features = ['Open', 'High', 'Low', 'Close', 'Volume', 'MA5', 'MA20', 'MA60', 'RSI', 'MACD', 'Signal']
    X = df[features]
    y = df['Target']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
    
    # Train model
    print(f"Training model for {symbol}...")
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    
    print(f"Model trained. MAE: {mae:.2f}, RMSE: {rmse:.2f}")
    
    # Save model
    os.makedirs('models', exist_ok=True)
    model_path = f'models/{symbol}_model.joblib'
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")
    
    return model

if __name__ == "__main__":
    train_model()
