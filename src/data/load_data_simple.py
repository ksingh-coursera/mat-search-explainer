#!/usr/bin/env python3

import pandas as pd
import redis
import json
import time
import sys

def wait_for_redis():
    """Wait for Redis to be ready"""
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            print(f"Attempting to connect to Redis (attempt {retry_count + 1}/{max_retries})")
            r = redis.Redis(host='redis', port=6379, decode_responses=True)
            r.ping()
            print("✅ Connected to Redis!")
            return r
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            time.sleep(2)
            retry_count += 1
    
    print("❌ Failed to connect to Redis after maximum retries")
    sys.exit(1)

def load_csv_data(r):
    """Load CSV data into Redis"""
    print("📊 Loading CSV data...")
    
    # Read CSV file
    try:
        df = pd.read_csv('(Clone)_SearchQuery_productid_level_metric_2025_07_17.csv')
        print(f"📈 Loaded {len(df)} rows from CSV")
    except Exception as e:
        print(f"❌ Failed to read CSV: {e}")
        sys.exit(1)
    
    # Process and insert data
    inserted_count = 0
    
    for index, row in df.iterrows():
        try:
            # Create key in format: search_query:product_id
            key = f"{row['searched_query']}:{row['clicked_product']}"
            
            # Create value dictionary with metrics
            value = {
                "viewers": int(row['viewers']),
                "clickers": int(row['clickers']),
                "enrollers": int(row['enrollers']),
                "paid_enrollers": int(row['paid_enrollers']),
                "ctr": float(row['ctr']),
                "enrollment_rate": float(row['enrollment_rate']),
                "paid_conversion_rate": float(row['paid_conversion_rate'])
            }
            
            # Store in Redis as JSON
            r.set(key, json.dumps(value))
            inserted_count += 1
            
            if inserted_count % 1000 == 0:
                print(f"   Inserted {inserted_count:,} records...")
                
        except Exception as e:
            print(f"⚠️  Error processing row {index}: {e}")
            continue
    
    print(f"✅ Successfully loaded {inserted_count:,} records into Redis")
    
    # Show some sample data
    print("\n📋 Sample data:")
    sample_keys = r.keys('ai:*')[:3]  # Get 3 keys that start with 'ai:'
    for key in sample_keys:
        value = r.get(key)
        print(f"   {key}: {value}")

def main():
    print("🚀 Starting Simple Redis Data Loader")
    print("=" * 40)
    
    # Connect to Redis
    r = wait_for_redis()
    
    # Load data
    load_csv_data(r)
    
    print("\n🎉 Data loading complete!")
    print(f"📊 Total keys in Redis: {r.dbsize():,}")

if __name__ == "__main__":
    main() 