#!/usr/bin/env python3

import json
from redis.cluster import RedisCluster

def connect_to_cluster():
    """Connect to Redis cluster"""
    startup_nodes = [{"host": "localhost", "port": 7001}]
    try:
        rc = RedisCluster(startup_nodes=startup_nodes, decode_responses=True)
        rc.ping()
        print("✅ Connected to Redis cluster!")
        return rc
    except Exception as e:
        print(f"❌ Failed to connect to Redis cluster: {e}")
        print("Make sure the cluster is running: docker-compose up -d")
        return None

def query_examples(rc):
    """Run some example queries"""
    
    print("\n📊 Redis Cluster Data Analysis")
    print("=" * 50)
    
    # Total keys
    total_keys = rc.dbsize()
    print(f"🔢 Total records in cluster: {total_keys:,}")
    
    # Sample some AI-related searches
    print(f"\n🔍 Sample AI searches:")
    ai_keys = list(rc.scan_iter(match="ai:*", count=5))
    for key in ai_keys[:3]:
        data = json.loads(rc.get(key))
        print(f"  📝 {key}")
        print(f"     👀 Viewers: {data['viewers']:,}")
        print(f"     🎯 CTR: {data['ctr']:.2f}%")
        print(f"     📚 Enrollment rate: {data['enrollment_rate']:.2f}%")
        print()
    
    # Find top enrollment rates for AI courses
    print(f"🏆 Top AI courses by enrollment rate:")
    ai_courses = []
    for key in list(rc.scan_iter(match="ai:*", count=100)):
        data = json.loads(rc.get(key))
        ai_courses.append((key, data['enrollment_rate'], data['viewers']))
    
    # Sort by enrollment rate
    top_courses = sorted(ai_courses, key=lambda x: x[1], reverse=True)[:5]
    for i, (key, rate, viewers) in enumerate(top_courses, 1):
        print(f"  {i}. {key}")
        print(f"     📈 Enrollment rate: {rate:.2f}%")
        print(f"     👥 Viewers: {viewers:,}")
        print()
    
    # Search query analysis
    search_queries = set()
    for key in list(rc.scan_iter(count=1000)):
        query = key.split(':')[0]
        search_queries.add(query)
    
    print(f"🔍 Unique search queries found: {len(search_queries)}")
    print(f"📝 Sample queries: {', '.join(list(search_queries)[:5])}")

def interactive_query(rc):
    """Interactive query mode"""
    print("\n🎮 Interactive Query Mode")
    print("Commands:")
    print("  get <key>           - Get data for specific key")
    print("  search <query>      - Find all products for search query")
    print("  stats               - Show cluster statistics")
    print("  quit                - Exit")
    print()
    
    while True:
        try:
            command = input("redis> ").strip()
            
            if command.lower() in ['quit', 'exit', 'q']:
                break
                
            elif command.startswith('get '):
                key = command[4:]
                try:
                    data = rc.get(key)
                    if data:
                        parsed = json.loads(data)
                        print(json.dumps(parsed, indent=2))
                    else:
                        print(f"Key '{key}' not found")
                except Exception as e:
                    print(f"Error: {e}")
                    
            elif command.startswith('search '):
                query = command[7:]
                pattern = f"{query}:*"
                keys = list(rc.scan_iter(match=pattern, count=10))
                if keys:
                    print(f"Found {len(keys)} products for '{query}':")
                    for key in keys[:5]:
                        print(f"  {key}")
                    if len(keys) > 5:
                        print(f"  ... and {len(keys)-5} more")
                else:
                    print(f"No products found for '{query}'")
                    
            elif command == 'stats':
                print(f"Total keys: {rc.dbsize():,}")
                print(f"Cluster info: {rc.cluster_info()}")
                
            else:
                print("Unknown command. Type 'quit' to exit.")
                
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")

def main():
    print("🚀 Redis Cluster Data Query Tool")
    
    # Connect to cluster
    rc = connect_to_cluster()
    if not rc:
        return
    
    # Run example queries
    query_examples(rc)
    
    # Interactive mode
    try:
        interactive_query(rc)
    except KeyboardInterrupt:
        pass
    
    print("\n👋 Goodbye!")

if __name__ == "__main__":
    main() 