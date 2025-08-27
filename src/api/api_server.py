#!/usr/bin/env python3

from flask import Flask, jsonify, request
from flask_cors import CORS
import json
from redis.cluster import RedisCluster
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

# Redis cluster connection
rc = None

def connect_to_redis():
    """Connect to Redis cluster"""
    global rc
    startup_nodes = [{"host": "localhost", "port": 7001}]
    try:
        rc = RedisCluster(startup_nodes=startup_nodes, decode_responses=True, socket_timeout=5)
        rc.ping()
        logger.info("✅ Connected to Redis cluster")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to connect to Redis: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        if rc:
            rc.ping()
            return jsonify({
                "status": "healthy",
                "redis_connected": True,
                "total_keys": rc.dbsize()
            })
        else:
            return jsonify({
                "status": "unhealthy", 
                "redis_connected": False
            }), 500
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

@app.route('/metrics/<path:search_query>/<path:product_id>', methods=['GET'])
def get_metrics(search_query, product_id):
    """Get metrics for a specific search query and product combination"""
    try:
        # Create Redis key
        key = f"{search_query}:{product_id}"
        logger.info(f"Querying Redis for key: {key}")
        
        # Get data from Redis
        data = rc.get(key)
        
        if data:
            metrics = json.loads(data)
            logger.info(f"Found metrics for {key}")
            return jsonify({
                "success": True,
                "key": key,
                "metrics": metrics,
                "found": True
            })
        else:
            logger.info(f"No metrics found for {key}")
            return jsonify({
                "success": True,
                "key": key,
                "metrics": None,
                "found": False,
                "message": "No metrics found for this search query and product combination"
            })
            
    except Exception as e:
        logger.error(f"Error querying metrics: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/search/<path:search_query>', methods=['GET'])
def get_search_metrics(search_query):
    """Get all metrics for a specific search query"""
    try:
        pattern = f"{search_query}:*"
        keys = list(rc.scan_iter(match=pattern, count=100))
        
        results = []
        for key in keys:
            data = rc.get(key)
            if data:
                product_id = key.split(':', 1)[1]  # Everything after first colon
                metrics = json.loads(data)
                results.append({
                    "product_id": product_id,
                    "key": key,
                    "metrics": metrics
                })
        
        logger.info(f"Found {len(results)} products for search query: {search_query}")
        return jsonify({
            "success": True,
            "search_query": search_query,
            "total_products": len(results),
            "products": results
        })
        
    except Exception as e:
        logger.error(f"Error querying search metrics: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get cluster statistics"""
    try:
        total_keys = rc.dbsize()
        
        # Sample some search queries
        sample_keys = list(rc.scan_iter(count=1000))
        search_queries = set()
        for key in sample_keys:
            query = key.split(':')[0]
            search_queries.add(query)
        
        return jsonify({
            "success": True,
            "total_keys": total_keys,
            "unique_search_queries": len(search_queries),
            "sample_queries": list(search_queries)[:10]
        })
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404

if __name__ == '__main__':
    print("🚀 Starting Redis API Bridge Server")
    print("===================================")
    
    # Connect to Redis
    if connect_to_redis():
        print("✅ Redis connection established")
        print("🌐 Starting Flask server on http://localhost:5000")
        print("📋 Available endpoints:")
        print("   GET /health                                    - Health check")
        print("   GET /metrics/<search_query>/<product_id>      - Get specific metrics")
        print("   GET /search/<search_query>                    - Get all products for query")
        print("   GET /stats                                    - Cluster statistics")
        print()
        print("🔗 Chrome extension can now connect to this API")
        
        app.run(host='localhost', port=5000, debug=False)
    else:
        print("❌ Failed to connect to Redis. Make sure Redis cluster is running:")
        print("   docker-compose up -d")
        exit(1) 