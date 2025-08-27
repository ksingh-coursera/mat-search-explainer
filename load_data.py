#!/usr/bin/env python3

import pandas as pd
import redis
import json
import time
import sys
from redis.cluster import RedisCluster

def wait_for_cluster():
    """Wait for Redis cluster to be ready"""
    startup_nodes = [
        {"host": "redis-node-1", "port": 6379},
        {"host": "redis-node-2", "port": 6379},
        {"host": "redis-node-3", "port": 6379}
    ]
    
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            print(f"Attempting to connect to Redis cluster (attempt {retry_count + 1}/{max_retries})")
            rc = RedisCluster(startup_nodes=startup_nodes, decode_responses=True, skip_full_coverage_check=True)
            rc.ping()
            print("✅ Successfully connected to Redis cluster!")
            return rc
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            retry_count += 1
            time.sleep(5)
    
    print("❌ Failed to connect to Redis cluster after maximum retries")
    sys.exit(1)

def load_csv_to_redis():
    """Load CSV data into Redis with the specified JSON format"""
    
    # Connect to Redis cluster
    rc = wait_for_cluster()
    
    # Read CSV file
    print("📊 Reading CSV file...")
    try:
        df = pd.read_csv('(Clone)_SearchQuery_productid_level_metric_2025_07_17.csv')
        print(f"✅ Successfully loaded {len(df)} rows from CSV")
    except Exception as e:
        print(f"❌ Error reading CSV file: {e}")
        sys.exit(1)
    
    # Process data and load into Redis
    print("🔄 Processing and loading data into Redis...")
    success_count = 0
    error_count = 0
    
    for index, row in df.iterrows():
        try:
            # Create the key: searched_query:clicked_product
            key = f"{row['searched_query']}:{row['clicked_product']}"
            
            # Create the value dictionary with all metrics
            value = {
                "viewers": int(row['viewers']) if pd.notna(row['viewers']) else 0,
                "clickers": int(row['clickers']) if pd.notna(row['clickers']) else 0,
                "enrollers": int(row['enrollers']) if pd.notna(row['enrollers']) else 0,
                "paid_enrollers": int(row['paid_enrollers']) if pd.notna(row['paid_enrollers']) else 0,
                "ctr": float(row['ctr']) if pd.notna(row['ctr']) else 0.0,
                "enrollment_rate": float(row['enrollment_rate']) if pd.notna(row['enrollment_rate']) else 0.0,
                "paid_conversion_rate": float(row['paid_conversion_rate']) if pd.notna(row['paid_conversion_rate']) else 0.0
            }
            
            # Store as JSON string in Redis
            rc.set(key, json.dumps(value))
            success_count += 1
            
            # Progress indicator
            if (index + 1) % 1000 == 0:
                print(f"⏳ Processed {index + 1}/{len(df)} rows...")
                
        except Exception as e:
            print(f"❌ Error processing row {index}: {e}")
            error_count += 1
            continue
    
    print(f"✅ Data loading complete!")
    print(f"📈 Successfully loaded: {success_count} records")
    print(f"❌ Errors: {error_count} records")
    
    # Display some sample data
    print("\n📋 Sample data verification:")
    sample_keys = list(rc.scan_iter(count=5))
    for key in sample_keys[:3]:
        value = rc.get(key)
        print(f"Key: {key}")
        print(f"Value: {value}")
        print("---")
    
    # Display cluster info
    print(f"\n🔍 Redis cluster info:")
    print(f"Total keys in cluster: {rc.dbsize()}")
    
    return success_count, error_count

if __name__ == "__main__":
    print("🚀 Starting data load process...")
    success_count, error_count = load_csv_to_redis()
    
    if error_count == 0:
        print("🎉 All data loaded successfully!")
    else:
        print(f"⚠️  Data loaded with {error_count} errors out of {success_count + error_count} total records")
    
    print("✅ Data loading process completed!") 