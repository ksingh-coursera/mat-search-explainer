#!/usr/bin/env python3

from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import redis
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

# Redis connection
r = None

def connect_to_redis():
    """Connect to Redis"""
    global r
    try:
        r = redis.Redis(host='localhost', port=6379, decode_responses=True, socket_timeout=5)
        r.ping()
        logger.info("✅ Connected to Redis")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to connect to Redis: {e}")
        return False

@app.route('/health')
def health():
    """Health check endpoint"""
    logger.info(f"🏥 [HEALTH] Health check requested from {request.remote_addr}")
    logger.info(f"🏥 [HEALTH] Request headers: {dict(request.headers)}")
    try:
        if r is None:
            connect_to_redis()
        
        redis_connected = False
        total_keys = 0
        
        if r:
            try:
                r.ping()
                redis_connected = True
                total_keys = r.dbsize()
            except:
                redis_connected = False
        
        response_data = {
            'status': 'healthy' if redis_connected else 'unhealthy',
            'redis_connected': redis_connected,
            'total_keys': total_keys
        }
        logger.info(f"🏥 [HEALTH] Responding with: {response_data}")
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"🏥 [HEALTH] Health check failed: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/search/<query>')
def get_search_data(query):
    """Get all data for a specific search query (case-insensitive)"""
    try:
        if r is None:
            connect_to_redis()
        
        # Try both original and lowercase query patterns for case-insensitive search
        original_pattern = f"{query}:*"
        lowercase_pattern = f"{query.lower()}:*"
        
        logger.info(f"🔍 [SEARCH] Searching with patterns: {original_pattern}")
        keys = r.keys(original_pattern)
        
        # If no results and query isn't already lowercase, try lowercase pattern
        if not keys and query != query.lower():
            logger.info(f"🔍 [SEARCH] Trying lowercase pattern: {lowercase_pattern}")
            keys = r.keys(lowercase_pattern)
        
        logger.info(f"🔍 [SEARCH] Found {len(keys)} keys")
        results = {}
        for key in keys:
            try:
                value = r.get(key)
                if value:
                    # Parse the key to get product_id
                    parts = key.split(':', 1)
                    if len(parts) == 2:
                        product_id = parts[1]
                        results[product_id] = json.loads(value)
            except Exception as e:
                logger.error(f"Error processing key {key}: {e}")
                continue
        
        return jsonify({
            'query': query,
            'results': results,
            'count': len(results)
        })
    
    except Exception as e:
        logger.error(f"Search failed for query '{query}': {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/metrics/<query>/<product_id>')
def get_metrics(query, product_id):
    """Get metrics for specific query + product combination"""
    logger.info(f"📊 [METRICS] Request from {request.remote_addr} for {query}:{product_id}")
    logger.info(f"📊 [METRICS] Request headers: {dict(request.headers)}")
    try:
        if r is None:
            connect_to_redis()
        
        # Try both original and lowercase query for case-insensitive lookup
        original_key = f"{query}:{product_id}"
        lowercase_key = f"{query.lower()}:{product_id}"
        
        logger.info(f"📊 [METRICS] Looking up Redis key: {original_key}")
        value = r.get(original_key)
        
        # If not found and original query wasn't lowercase, try lowercase
        if not value and query != query.lower():
            logger.info(f"📊 [METRICS] Trying lowercase key: {lowercase_key}")
            value = r.get(lowercase_key)
        
        if value:
            metrics = json.loads(value)
            # Determine which key was used
            used_key = original_key if r.get(original_key) else lowercase_key
            response_data = {
                'query': query,
                'product_id': product_id,
                'metrics': metrics,
                'redis_key_used': used_key
            }
            logger.info(f"📊 [METRICS] Found data using key: {used_key}")
            return jsonify(response_data)
        else:
            logger.info(f"📊 [METRICS] No data found for keys: {original_key} or {lowercase_key}")
            return jsonify({
                'query': query,
                'product_id': product_id,
                'metrics': None,
                'message': 'No data found for this combination',
                'tried_keys': [original_key, lowercase_key]
            }), 404
            
    except Exception as e:
        logger.error(f"📊 [METRICS] Lookup failed for {query}:{product_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/ai-explanation/<key>')
def get_ai_explanation(key):
    """Get cached AI explanation"""
    logger.info(f"🧠 [AI-CACHE] Request from {request.remote_addr} for AI explanation: {key}")
    try:
        if r is None:
            connect_to_redis()
        
        # Use a different prefix for AI explanations to separate from metrics
        redis_key = f"ai_explanation:{key}"
        logger.info(f"🧠 [AI-CACHE] Looking up Redis key: {redis_key}")
        
        value = r.get(redis_key)
        if value:
            explanation_data = json.loads(value)
            logger.info(f"🧠 [AI-CACHE] Found cached AI explanation for: {key}")
            return jsonify(explanation_data)
        else:
            logger.info(f"🧠 [AI-CACHE] No cached explanation found for: {key}")
            return jsonify({'error': 'No cached explanation found'}), 404
            
    except Exception as e:
        logger.error(f"🧠 [AI-CACHE] Lookup failed for {key}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/ai-explanation', methods=['POST'])
def save_ai_explanation():
    """Save AI explanation to cache"""
    try:
        if r is None:
            connect_to_redis()
        
        data = request.get_json()
        if not data or 'key' not in data or 'data' not in data:
            return jsonify({'error': 'Missing key or data in request body'}), 400
        
        cache_key = data['key']
        explanation_data = data['data']
        
        # Add metadata
        cache_entry = {
            **explanation_data,
            'cached_at': int(time.time()),
            'query': data.get('query', ''),
            'productId': data.get('productId', ''),
            'title': data.get('title', '')
        }
        
        redis_key = f"ai_explanation:{cache_key}"
        logger.info(f"🧠 [AI-CACHE] Saving explanation to Redis key: {redis_key}")
        
        # Store with expiration (30 days)
        r.setex(redis_key, 30 * 24 * 60 * 60, json.dumps(cache_entry))
        
        logger.info(f"🧠 [AI-CACHE] Successfully cached AI explanation for: {cache_key}")
        return jsonify({
            'success': True,
            'key': cache_key,
            'redis_key': redis_key,
            'message': 'AI explanation cached successfully'
        })
        
    except Exception as e:
        logger.error(f"🧠 [AI-CACHE] Failed to save explanation: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/stats')
def get_stats():
    """Get overall statistics"""
    try:
        if r is None:
            connect_to_redis()
        
        total_keys = r.dbsize()
        
        # Get some sample queries
        sample_keys = r.keys('*')[:20]  # Get more samples
        queries = set()
        products = set()
        ai_explanations = 0
        
        for key in sample_keys:
            if key.startswith('ai_explanation:'):
                ai_explanations += 1
            else:
                parts = key.split(':', 1)
                if len(parts) == 2:
                    queries.add(parts[0])
                    products.add(parts[1])
        
        return jsonify({
            'total_records': total_keys,
            'sample_queries': list(queries)[:5],
            'unique_products_sample': len(products),
            'cached_ai_explanations': ai_explanations
        })
        
    except Exception as e:
        logger.error(f"Stats failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/ai-explanation/flush')
def flush_ai_cache():
    """Clear all AI explanation cache entries"""
    try:
        if r is None:
            connect_to_redis()
        
        # Get all AI explanation keys
        ai_keys = r.keys('ai_explanation:*')
        deleted_count = 0
        
        if ai_keys:
            # Delete all AI explanation keys
            deleted_count = r.delete(*ai_keys)
            logger.info(f"🧠 [AI-CACHE] Flushed {deleted_count} AI explanation cache entries")
        
        return jsonify({
            'success': True,
            'deleted_count': deleted_count,
            'message': f'Successfully cleared {deleted_count} AI explanation cache entries'
        })
        
    except Exception as e:
        logger.error(f"🧠 [AI-CACHE] Failed to flush cache: {e}")
        return jsonify({'error': str(e)}), 500

def main():
    logger.info("🚀 Starting Redis API Bridge Server")
    logger.info("=" * 35)
    
    if not connect_to_redis():
        logger.error("❌ Failed to connect to Redis. Make sure Redis is running:")
        logger.error("   docker compose -f docker-compose-simple.yml up -d")
        return
    
    logger.info("🌐 API Server starting on http://localhost:5001")
    logger.info("📋 Available endpoints:")
    logger.info("   GET /health - Health check")
    logger.info("   GET /search/<query> - Get all data for a search query")
    logger.info("   GET /metrics/<query>/<product_id> - Get specific metrics")
    logger.info("   GET /ai-explanation/<key> - Get cached AI explanation")
    logger.info("   POST /ai-explanation - Save AI explanation to cache")
    logger.info("   GET /ai-explanation/flush - Clear all AI explanation cache")
    logger.info("   GET /stats - Overall statistics")
    
    app.run(host='0.0.0.0', port=8080, debug=False)

if __name__ == '__main__':
    main() 