# 🚀 Coursera Search Explainer with Redis Metrics

This Chrome extension displays AI-generated search explanations AND historical metrics from your CSV data when hovering over course cards on Coursera.

## ✅ What's Working

- **Redis Setup**: Single Redis instance (simple and reliable)
- **API Bridge**: Flask server on port 5001 (avoids Apple AirTunes conflicts)
- **Data Loading**: Successfully loads 15,736 records from your CSV
- **Chrome Extension**: Shows Redis metrics in overlays when hovering over courses

## 📊 Data Format

Your CSV data is stored in Redis with this structure:

**Key Format:** `{search_query}:{product_id}`

**Value Format:**
```json
{
  "viewers": 17899,
  "clickers": 17899, 
  "enrollers": 2622,
  "paid_enrollers": 1070,
  "ctr": 100.00,
  "enrollment_rate": 14.65,
  "paid_conversion_rate": 0.01
}
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.7+ with pip
- Chrome/Brave browser
- Your CSV file: `(Clone)_SearchQuery_productid_level_metric_2025_07_17.csv`

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start Everything
```bash
./start_simple.sh
```

This will:
- Start Redis container
- Load your CSV data (15,736+ records)
- Start API server on port 5001
- Show status and test connections

### 3. Load Chrome Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this project folder
4. The extension should now be active

### 4. Test It!
1. Go to [Coursera](https://coursera.org)
2. Search for "ai" or "machine learning"
3. Hover over any course card
4. You should see an overlay with:
   - AI explanations (from GraphQL)
   - Historical metrics (from Redis)

## 🔍 API Endpoints

Test these URLs while the system is running:

```bash
# Health check
curl http://localhost:5001/health

# Get all data for a search query
curl http://localhost:5001/search/ai

# Get specific metrics for query + course
curl "http://localhost:5001/metrics/ai/mR7MlUaTEemuHQ4HpHozrA"

# Overall statistics
curl http://localhost:5001/stats
```

## 🎯 How It Works

1. **When you hover** over a course card on Coursera:
   - Extension extracts search query from URL or page context
   - Extension gets course/product ID from card data
   - Extension calls Redis API: `/metrics/{query}/{product_id}`

2. **Redis API** looks up historical metrics using key format: `{query}:{product_id}`

3. **Overlay displays**:
   - Course title and basic info
   - Search query analysis
   - **NEW**: Historical performance metrics from your data
   - AI-generated explanations (if available)

## 📈 Example Overlay Display

```
📊 Card 1 Analysis
🔍 Search Query: "ai"  
📚 Course: Machine Learning Course

📈 Redis Metrics - Historical Performance
👀 Viewers: 17,899       🖱️ Clickers: 17,899
📚 Enrollers: 2,622      💰 Paid: 1,070
📊 CTR: 100.00%          🎯 Conversion: 14.65%

🤖 AI Explanation:
[GraphQL explanation data if available]
```

## 🛠️ Management Commands

```bash
# Stop everything
Ctrl+C (from the start_simple.sh terminal)

# Or manually stop services
docker compose -f docker-compose-simple.yml down
pkill -f api_server_simple.py

# View logs
docker compose -f docker-compose-simple.yml logs
tail -f api_server.log

# Restart just the API
python3 api_server_simple.py &
```

## 🐛 Troubleshooting

### Port 5000 Conflicts
- **Issue**: API won't start (port already in use)
- **Solution**: We use port 5001 to avoid Apple AirTunes conflicts

### Extension Not Working
1. Check if API is running: `curl http://localhost:5001/health`
2. Check browser console for errors (F12)
3. Verify extension is loaded in `chrome://extensions/`
4. Make sure you're on Coursera (extension only works there)

### No Data in Overlays
1. Verify Redis has data: `curl http://localhost:5001/stats`
2. Check that search query matches data in CSV
3. Make sure course IDs are being extracted correctly

### Brave Browser Issues
- Disable Brave Shields for coursera.org
- Check permissions at `brave://extensions/`
- Ensure privacy settings allow localhost requests

## 📁 File Structure

```
coursera-search-explainer/
├── content.js              # Chrome extension (updated for Redis)
├── api_server_simple.py    # Flask API server
├── docker-compose-simple.yml # Simple Redis setup
├── load_data_simple.py     # Loads CSV into Redis
├── start_simple.sh         # One-click startup
├── requirements.txt        # Python dependencies
└── (Clone)_SearchQuery_productid_level_metric_2025_07_17.csv
```

## 🎉 Success!

If everything is working, you should see:
- ✅ Redis running with 15,736+ records
- ✅ API responding on port 5001
- ✅ Chrome extension showing overlays with both AI explanations AND historical metrics
- ✅ Data from your CSV displayed when hovering over matching courses

The extension now bridges your historical CSV data with live Coursera browsing! 🚀 