# Coursera Search Intelligence: How It Works

    ## 🔄 Quick Overview (30-Second Read)

**What it does**: Chrome extension that shows course performance metrics and AI explanations directly on Coursera search pages when you hover over course cards.

**How it works**:
1. **Intercepts Coursera searches** - Automatically captures why courses appear in results
2. **Shows performance data** - Displays CTR, enrollments, and completion rates from Redis cache  
3. **AI explains search results** - OpenAI formats technical data into readable insights
4. **Instant display** - All data appears in <100ms overlay without disrupting browsing
5. **Smart caching** - Stores explanations to minimize API costs and maximize speed

**Bottom line**: Hover on any course → see performance metrics + AI explanation of why it ranked there.

---

## 💡 Why Each Component Matters

**Interceptor Script**: Without this, we'd only see Coursera's basic course data - no insight into why courses rank where they do.

**Redis Cache**: 15,736+ historical performance records provide context that Coursera doesn't show users - which courses actually convert vs. just appear in search.

**AI Integration**: Raw `searchExplanation` data is technical and cryptic - OpenAI makes it actionable for product teams and marketers.

**Background Script**: Handles all external API calls to bypass browser security restrictions that would otherwise block the extension.

**Smart Caching**: Ensures the system scales efficiently without excessive API costs or slow response times.
