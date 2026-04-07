print("1. sys import")
import sys
print("2. os import")
import os
print("3. pandas import")
import pandas as pd
print("4. fdr import")
import FinanceDataReader as fdr
print("5. supabase import")
from supabase import create_client
print("6. dotenv import")
from dotenv import load_dotenv

print("--- All imports successful ---")
load_dotenv()
url = os.getenv("SUPABASE_URL")
print(f"URL: {url[:10] if url else 'None'}...")
print("Script complete.")
