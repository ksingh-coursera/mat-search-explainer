# Coursera Search Intelligence

A Chrome extension that provides real-time course performance metrics and AI-powered search explanations directly on Coursera search pages. See why courses appear in search results and how they're actually performing.

## ✨ What It Does

**Hover on any course card** → **See instant insights:**
- **Performance Metrics**: CTR, enrollment rates, completion percentages
- **AI Search Explanations**: Why this course appears in your search results
- **Historical Data**: Real performance data from 15,736+ course-query combinations

## 🎯 Key Features

- **Real-time Overlay**: Performance data appears instantly without disrupting browsing
- **AI-Powered Insights**: OpenAI formats technical search explanations into readable analysis
- **Zero Setup for Users**: Works immediately on any Coursera search page
- **Smart Caching**: Optimized for speed and minimal API costs

## 🚀 Quick Start

### 1. Setup the Backend
```bash
# Start Redis and load data
docker compose -f docker-compose-simple.yml up -d

# Install Python dependencies
pip install -r requirements.txt

# Start the API server
python3 api_server_8080.py
```

### 2. Install Chrome Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this project folder
4. Extension will appear in your toolbar

### 3. Use It
1. Go to [Coursera Search](https://www.coursera.org/search?query=ai)
2. **Hover over any course card**
3. See instant performance metrics and AI explanations!

## 📖 Documentation

- **[How It Works](HOW_IT_WORKS.md)** - 30-second overview of the system
- **[System Overview](SYSTEM_OVERVIEW.md)** - Detailed architecture and components
- **[OpenAI Setup](OPENAI_SETUP.md)** - Configure AI explanations (optional)
- **[Current Architecture](CURRENT_ARCHITECTURE.md)** - Complete technical breakdown

## 🎯 Use Cases

**For Product Teams:**
- Validate search algorithm changes in real-time
- Understand why courses rank where they do
- Spot performance patterns and opportunities

**For Marketing Teams:**
- Identify high-performing courses for campaigns
- Analyze search result effectiveness
- Monitor course performance trends

**For Engineering Teams:**
- Debug search ranking issues
- Analyze algorithm behavior
- Test search improvements quickly

## ⚡ What You'll See

When hovering over a course card:

```
📈 Metrics - Historical Performance
🎯 CTR: 12.5% (85th percentile)
📚 Enrollments: 1,247
⭐ Completion Rate: 67%

🧠 AI Search Explanation
✨ High Relevance Match
This course strongly aligns with "machine learning" 
because it covers core ML algorithms and practical 
Python implementation...
```

## 🔧 Requirements

- Docker & Docker Compose
- Python 3.8+
- Chrome browser
- 2GB+ available memory

## 🚧 Current Limitations

- Local development setup only
- Limited to historical CSV data (15,736 records)
- Chrome extension only (no Firefox/Safari)
- Requires OpenAI API key for AI explanations

## 🎪 Demo & Pitch Materials

- **[Pitch Slides](PITCH_SLIDES.md)** - Executive presentation
- **[Production Pitch](PRODUCTION_PITCH.md)** - Full business proposal for scaling
- **[Technical Design](TECHNICAL_DESIGN.md)** - Production architecture plan

---

*Transform Coursera search into an intelligence platform - see not just what courses appear, but why they appear and how they perform.* 