import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(url, key)

try:
    # 전체 건수 확인
    res = supabase.table('kospi_history').select("date", count='exact').order("date", descending=False).execute()
    data = res.data
    count = res.count
    
    if data:
        print(f"Total rows: {count}")
        print(f"First date: {data[0]['date']}")
        print(f"Last date: {data[-1]['date']}")
        
        # 년도별 분포 확인
        years = {}
        for row in data:
            year = row['date'][:4]
            years[year] = years.get(year, 0) + 1
        
        print("\nRows per year:")
        for year, cnt in sorted(years.items()):
            print(f"{year}: {cnt}")
    else:
        print("No data found in kospi_history table.")

except Exception as e:
    print(f"Error: {e}")
