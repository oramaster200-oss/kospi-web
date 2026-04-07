import FinanceDataReader as fdr
import pandas as pd
import os
import time
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

def calculate_technical_indicators(df, us_df):
    """
    Calculates technical indicators for the KOSPI dataset.
    """
    print("Calculating technical indicators...")
    # KOSPI Indicators
    df['Return'] = df['Close'].pct_change()
    df['MA5_Rel'] = df['Close'] / df['Close'].rolling(window=5).mean()
    df['MA20_Rel'] = df['Close'] / df['Close'].rolling(window=20).mean()
    df['MA60_Rel'] = df['Close'] / df['Close'].rolling(window=60).mean()
    
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / (loss + 1e-9) # Avoid division by zero
    df['RSI'] = 100 - (100 / (1 + rs))
    
    exp1 = df['Close'].ewm(span=12, adjust=False).mean()
    exp2 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD_Rel'] = (exp1 - exp2) / df['Close']
    df['Vol_Change'] = df['Volume'].pct_change()
    
    # Incorporate US Market Return
    us_df['US_Return'] = us_df['Close'].pct_change()
    us_data = us_df[['US_Return']].shift(1)
    
    combined = df.join(us_data, how='left')
    combined.ffill(inplace=True)
    combined.dropna(inplace=True)
    
    return combined

def fetch_and_save_to_supabase(symbol='KS11', us_symbol='^GSPC', start='2010-01-01'):
    """
    Fetches data, calculates indicators, and upserts to Supabase in chunks.
    """
    try:
        print(f"Fetching data for {symbol} and {us_symbol} starting from {start}...")
        df = fdr.DataReader(symbol, start)
        us_df = fdr.DataReader(us_symbol, start)
        
        if df.empty or us_df.empty:
            print("Error: Could not fetch data from FinanceDataReader.")
            return

        combined = calculate_technical_indicators(df, us_df)
        
        # Prepare for Supabase
        combined.reset_index(inplace=True)
        combined.rename(columns={'Date': 'date', 'Close': 'close', 'Volume': 'volume', 
                                 'RSI': 'rsi', 'MA5_Rel': 'ma5_rel', 'MA20_Rel': 'ma20_rel', 
                                 'MA60_Rel': 'ma60_rel', 'MACD_Rel': 'macd_rel', 
                                 'Vol_Change': 'vol_change', 'US_Return': 'us_return'}, inplace=True)
        
        save_cols = ['date', 'close', 'volume', 'rsi', 'ma5_rel', 'ma20_rel', 'ma60_rel', 'macd_rel', 'vol_change', 'us_return']
        data_to_upsert = combined[save_cols].to_dict(orient='records')
        
        # Format dates and clean NaNs
        for row in data_to_upsert:
            row['date'] = row['date'].strftime('%Y-%m-%d')
            for k in row:
                if pd.isna(row[k]):
                    row[k] = None

        total_rows = len(data_to_upsert)
        chunk_size = 100
        print(f"Uploading {total_rows} rows in chunks of {chunk_size}...")

        for i in range(0, total_rows, chunk_size):
            chunk = data_to_upsert[i:i + chunk_size]
            try:
                supabase.table('kospi_history').upsert(chunk).execute()
                print(f"Uploaded rows {i} to {min(i + chunk_size, total_rows)}...")
                time.sleep(0.1) # Small delay to avoid rate limiting
            except Exception as chunk_error:
                print(f"Error uploading chunk starting at index {i}: {chunk_error}")

        print("\nSuccessfully finished updating Supabase!")

    except Exception as e:
        print(f"A fatal error occurred: {e}")

if __name__ == "__main__":
    fetch_and_save_to_supabase()
