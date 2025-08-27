#!/usr/bin/env python3

from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import redis
import logging
import ssl
import tempfile
import os

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
        
        return jsonify({
            'status': 'healthy' if redis_connected else 'unhealthy',
            'redis_connected': redis_connected,
            'total_keys': total_keys
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/search/<query>')
def get_search_data(query):
    """Get all data for a specific search query"""
    try:
        if r is None:
            connect_to_redis()
        
        # Find all keys that start with the query
        pattern = f"{query}:*"
        keys = r.keys(pattern)
        
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
    try:
        if r is None:
            connect_to_redis()
        
        key = f"{query}:{product_id}"
        value = r.get(key)
        
        if value:
            metrics = json.loads(value)
            return jsonify({
                'query': query,
                'product_id': product_id,
                'metrics': metrics
            })
        else:
            return jsonify({
                'query': query,
                'product_id': product_id,
                'metrics': None,
                'message': 'No data found for this combination'
            }), 404
            
    except Exception as e:
        logger.error(f"Metrics lookup failed for {query}:{product_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/stats')
def get_stats():
    """Get overall statistics"""
    try:
        if r is None:
            connect_to_redis()
        
        total_keys = r.dbsize()
        
        # Get some sample queries
        sample_keys = r.keys('*')[:10]
        queries = set()
        products = set()
        
        for key in sample_keys:
            parts = key.split(':', 1)
            if len(parts) == 2:
                queries.add(parts[0])
                products.add(parts[1])
        
        return jsonify({
            'total_records': total_keys,
            'sample_queries': list(queries)[:5],
            'unique_products_sample': len(products)
        })
        
    except Exception as e:
        logger.error(f"Stats failed: {e}")
        return jsonify({'error': str(e)}), 500

def create_self_signed_cert():
    """Create a self-signed certificate for HTTPS"""
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    import datetime
    
    # Generate a key
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    
    # Various details about who we are. For a self-signed certificate the
    # subject and issuer are always the same.
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
    ])
    
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        # Our certificate will be valid for 10 days
        datetime.datetime.utcnow() + datetime.timedelta(days=10)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName(u"localhost"),
            x509.IPAddress(ipaddress.IPv4Address(u"127.0.0.1")),
        ]),
        critical=False,
    ).sign(key, hashes.SHA256())
    
    # Write our certificate out to disk.
    cert_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pem')
    key_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pem')
    
    with open(cert_file.name, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    
    with open(key_file.name, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
    
    return cert_file.name, key_file.name

def main():
    logger.info("🚀 Starting HTTPS Redis API Bridge Server")
    logger.info("=" * 40)
    
    if not connect_to_redis():
        logger.error("❌ Failed to connect to Redis. Make sure Redis is running:")
        logger.error("   docker compose -f docker-compose-simple.yml up -d")
        return
    
    try:
        # Try to create self-signed cert
        import ipaddress
        cert_file, key_file = create_self_signed_cert()
        
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert_file, key_file)
        
        logger.info("🔒 HTTPS API Server starting on https://localhost:5443")
        logger.info("📋 Available endpoints:")
        logger.info("   GET /health - Health check")
        logger.info("   GET /search/<query> - Get all data for a search query")
        logger.info("   GET /metrics/<query>/<product_id> - Get specific metrics")
        logger.info("   GET /stats - Overall statistics")
        logger.info("")
        logger.info("⚠️  You'll need to accept the self-signed certificate in your browser")
        
        app.run(host='0.0.0.0', port=5443, debug=False, ssl_context=context)
        
    except ImportError:
        logger.error("❌ Missing cryptography package. Install with: pip install cryptography")
        logger.info("🔄 Falling back to HTTP server on port 5001...")
        
        logger.info("🌐 API Server starting on http://localhost:5001")
        logger.info("📋 Available endpoints:")
        logger.info("   GET /health - Health check")
        logger.info("   GET /search/<query> - Get all data for a search query")
        logger.info("   GET /metrics/<query>/<product_id> - Get specific metrics")
        logger.info("   GET /stats - Overall statistics")
        
        app.run(host='0.0.0.0', port=5001, debug=False)

if __name__ == '__main__':
    main() 