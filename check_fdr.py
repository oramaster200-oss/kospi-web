import FinanceDataReader as fdr
import datetime

symbol = 'KS11'
start = '2010-01-01'
df = fdr.DataReader(symbol, start)
print(f"Total rows fetched from FinanceDataReader: {len(df)}")
if not df.empty:
    print(f"First date: {df.index[0]}")
    print(f"Last date: {df.index[-1]}")
