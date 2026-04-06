import FinanceDataReader as fdr
import pandas as pd
import os

def fetch_kospi_data(symbol='KS11', start='2010-01-01'):
    """
    Fetches historical KOSPI data and saves it to a CSV file.
    """
    print(f"Fetching data for {symbol} from {start}...")
    df = fdr.DataReader(symbol, start)
    
    # Ensure directory exists
    os.makedirs('data', exist_ok=True)
    
    file_path = f'data/{symbol}_history.csv'
    df.to_csv(file_path)
    print(f"Data saved to {file_path}")
    return df

if __name__ == "__main__":
    fetch_kospi_data()
