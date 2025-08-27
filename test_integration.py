#!/usr/bin/env python3

import requests
import json
import time

def test_api_integration():
    """Test the Redis API integration"""
    
    API_BASE = 'http://localhost:5000'
    
    print("🧪 Testing Redis API Integration")
    print("=" * 40)
    
    # Test 1: Health check
    print("\n1. Testing API health...")
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ API is healthy!")
            print(f"   Redis connected: {data.get('redis_connected')}")
            print(f"   Total keys: {data.get('total_keys', 'Unknown')}")
        else:
            print(f"❌ API health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to API: {e}")
        print("   Make sure you run: python3 api_server.py")
        return False
    
    # Test 2: Get stats
    print("\n2. Testing cluster statistics...")
    try:
        response = requests.get(f"{API_BASE}/stats", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Stats retrieved!")
            print(f"   Total keys: {data.get('total_keys', 'Unknown'):,}")
            print(f"   Unique queries: {data.get('unique_search_queries', 'Unknown')}")
            print(f"   Sample queries: {', '.join(data.get('sample_queries', [])[:3])}")
        else:
            print(f"❌ Stats failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Stats error: {e}")
    
    # Test 3: Test specific metric (AI search)
    print("\n3. Testing specific metrics...")
    test_queries = [
        ("ai", "mR7MlUaTEemuHQ4HpHozrA"),
        ("ai for everyone", "daG-a-O1EeijKBISCWxf6g"),
        ("machine learning", "fake_product_id")  # This should fail
    ]
    
    for query, product_id in test_queries:
        try:
            print(f"\n   Testing: '{query}' + '{product_id}'")
            response = requests.get(f"{API_BASE}/metrics/{query}/{product_id}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get('found'):
                    metrics = data.get('metrics', {})
                    print(f"   ✅ Found metrics!")
                    print(f"      Viewers: {metrics.get('viewers', 'N/A'):,}")
                    print(f"      Enrollers: {metrics.get('enrollers', 'N/A'):,}")
                    print(f"      CTR: {metrics.get('ctr', 'N/A')}%")
                    print(f"      Enrollment Rate: {metrics.get('enrollment_rate', 'N/A')}%")
                else:
                    print(f"   ⚠️  No data found (this is expected for some combinations)")
            else:
                print(f"   ❌ Request failed: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # Test 4: Search by query
    print("\n4. Testing search by query...")
    try:
        response = requests.get(f"{API_BASE}/search/ai", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Search results retrieved!")
            print(f"   Products found: {data.get('total_products', 0)}")
            if data.get('products'):
                print(f"   Sample product: {data['products'][0]['product_id'][:20]}...")
        else:
            print(f"❌ Search failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Search error: {e}")
    
    print("\n🎉 Integration test complete!")
    print("\n📋 Next steps:")
    print("1. Start your Chrome browser")
    print("2. Load the Coursera Search Explainer extension")
    print("3. Go to https://www.coursera.org/search?query=ai")
    print("4. Hover over course cards to see the Redis metrics!")
    
    return True

if __name__ == "__main__":
    # Wait a moment for API to be ready if just started
    print("⏳ Waiting for API to be ready...")
    time.sleep(2)
    
    test_api_integration() 