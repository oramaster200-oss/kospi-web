import FinanceDataReader as fdr
import pandas as pd
import os

def fetch_market_data(symbol='KS11', us_symbol='^GSPC', start='2010-01-01'):
    """
    Fetches historical KOSPI and US (S&P 500) data, merges them, and saves to CSV.
    """
    print(f"Fetching data for {symbol} and {us_symbol} from {start}...")
    
    # KOSPI Data
    kospi = fdr.DataReader(symbol, start)
    
    # S&P 500 Data (US Market)
    us_market = fdr.DataReader(us_symbol, start)
    
    # Calculate US Return and shift it by 1 day to represent 'Previous Day US Return'
    # This reflects the US market's impact on the NEXT KOSPI trading day.
    us_market['US_Return'] = us_market['Close'].pct_change()
    us_data = us_market[['US_Return']].shift(1)
    
    # Merge on date (KOSPI dates)
    combined = kospi.join(us_data, how='left')
    combined.fillna(method='ffill', inplace=True) # Fill gaps (e.g., US holidays)
    
    # Ensure directory exists
    os.makedirs('data', exist_ok=True)
    
    file_path = f'data/{symbol}_history.csv'
    combined.to_csv(file_path)
    print(f"Combined market data saved to {file_path}")
    return combined

if __name__ == "__main__":
    fetch_market_data()
