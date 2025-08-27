// background.js
console.log('Coursera Search Intelligence: Background script loaded');

// Store for captured requests and responses
let capturedRequests = new Map();

// Listen for GraphQL requests
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.method === 'POST' && details.requestBody) {
      try {
        let requestData = null;
        
        if (details.requestBody.raw) {
          const decoder = new TextDecoder();
          const rawData = decoder.decode(details.requestBody.raw[0].bytes);
          requestData = JSON.parse(rawData);
        } else if (details.requestBody.formData) {
          // Handle form data if needed
          requestData = details.requestBody.formData;
        }
        
        if (requestData) {
          // Check if this is a search operation
          const isSearchRequest = Array.isArray(requestData) 
            ? requestData.some(op => op.operationName === 'Search')
            : requestData.operationName === 'Search';
          
          if (isSearchRequest) {
            console.log('🎯 Captured GraphQL search request:', {
              url: details.url,
              requestData: requestData
            });
            
            // Store request for matching with response
            capturedRequests.set(details.requestId, {
              url: details.url,
              requestData: requestData,
              timestamp: Date.now()
            });
            
            // Send request to content script
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'searchCaptured',
                  data: {
                    url: details.url,
                    operations: Array.isArray(requestData) ? requestData : [requestData],
                    requestBody: JSON.stringify(requestData),
                    timestamp: Date.now()
                  }
                });
              }
            });
          }
        }
      } catch (error) {
        console.log('❌ Error processing request:', error);
      }
    }
  },
  {
    urls: ["https://www.coursera.org/graphql*", "https://www.coursera.org/api/*"],
    types: ["xmlhttprequest"]
  },
  ["requestBody"]
);

// Listen for GraphQL responses
chrome.webRequest.onCompleted.addListener(
  function(details) {
    const capturedRequest = capturedRequests.get(details.requestId);
    
    if (capturedRequest && details.statusCode === 200) {
      console.log('✅ GraphQL search request completed successfully:', details.url);
      
      // Clean up stored request (don't make duplicate requests)
      capturedRequests.delete(details.requestId);
    }
  },
  {
    urls: ["https://www.coursera.org/graphql*", "https://www.coursera.org/api/*"],
    types: ["xmlhttprequest"]
  }
);

// Handle context menu or extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, {action: 'toggle'});
});

// Redis API configuration
const REDIS_API_BASE = 'http://localhost:8080';

// OpenAI API configuration
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE'; // Replace with your actual API key
const OPENAI_API_BASE = 'https://api.openai.com/v1';

// Cache for OpenAI explanations to avoid repeated API calls
const explanationCache = new Map();

// Handle messages from content script (for Redis API calls)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🔗 [BACKGROUND] Received message:', request);
  
  if (request.action === 'checkRedisAPI') {
    console.log('🔗 [BACKGROUND] Checking Redis API health...');
    checkRedisAPIHealth()
      .then(result => {
        console.log('🔗 [BACKGROUND] Health check result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.log('🔗 [BACKGROUND] Health check error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'fetchRedisMetrics') {
    console.log('🔗 [BACKGROUND] Fetching Redis metrics for:', request.query, request.productId);
    fetchRedisMetrics(request.query, request.productId)
      .then(result => {
        console.log('🔗 [BACKGROUND] Metrics result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.log('🔗 [BACKGROUND] Metrics error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'formatExplanation') {
    console.log('🎯 [BACKGROUND] Received formatExplanation request');
    console.log('🔍 [CONTEXT] Raw explanation:', request.explanation?.substring(0, 100) + '...');
    console.log('🔍 [CONTEXT] Product details:', request.productDetails);
    console.log('🔍 [CONTEXT] Search query:', request.searchQuery);
    
    formatExplanationWithOpenAI(
      request.explanation,
      request.productDetails,
      request.searchQuery
    ).then(result => {
      console.log('🎯 [BACKGROUND] Formatted result:', result.cached ? 'CACHED' : 'FRESH');
      sendResponse(result);
    }).catch(error => {
      console.error('❌ [BACKGROUND] Error formatting explanation:', error);
      sendResponse({
        sections: {
          '❌ Error': 'Failed to generate AI explanation. Please try again later.'
        },
        cached: false,
        error: true
      });
    });
    
    return true; // Will respond asynchronously
  }
});

// Redis API health check
async function checkRedisAPIHealth() {
  try {
    console.log('🔗 [BACKGROUND] Making health request to:', `${REDIS_API_BASE}/health`);
    const response = await fetch(`${REDIS_API_BASE}/health`);
    console.log('🔗 [BACKGROUND] Health response:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔗 [BACKGROUND] Health data:', data);
      return { 
        success: true, 
        healthy: data.status === 'healthy',
        data: data 
      };
    } else {
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error) {
    console.log('🔗 [BACKGROUND] Health check fetch error:', error);
        return { 
      success: false, 
      error: error.message 
    };
  }
}

// Enhanced function to format explanation with OpenAI using rich context and Redis caching
async function formatExplanationWithOpenAI(rawExplanation, productDetails, searchQuery) {
  try {
    const cacheKey = `${searchQuery.toLowerCase()}:${productDetails.productId}`;
    
    // Check if we have this in our session cache first
    if (explanationCache.has(cacheKey)) {
      console.log('🎯 [OPENAI] Using session cache for:', cacheKey);
      return {
        ...explanationCache.get(cacheKey),
        cached: true,
        cacheType: 'session'
      };
    }
    
    // Check Redis cache
    console.log('🔍 [REDIS] Checking cache for AI explanation:', cacheKey);
    try {
      const cacheResponse = await fetch(`http://localhost:8080/ai-explanation/${encodeURIComponent(cacheKey)}`);
      if (cacheResponse.ok) {
        const cachedData = await cacheResponse.json();
        console.log('✅ [REDIS] Found cached AI explanation');
        
        // Store in session cache too
        explanationCache.set(cacheKey, cachedData);
        
        return {
          ...cachedData,
          cached: true,
          cacheType: 'redis'
        };
      }
    } catch (redisError) {
      console.log('⚠️ [REDIS] Cache check failed, proceeding with OpenAI:', redisError.message);
    }

    console.log('🤖 [OPENAI] Generating new explanation with rich context');
    console.log('🔍 [CONTEXT] Query:', searchQuery);
    console.log('🔍 [CONTEXT] Product:', productDetails.title);
    console.log('🔍 [CONTEXT] Raw explanation:', rawExplanation?.substring(0, 100) + '...');
    console.log('🔍 [CONTEXT] Fallback mode:', rawExplanation === 'FALLBACK_MODE');

    // Determine if we're in fallback mode (no searchExplanation from Coursera)
    const isFallbackMode = rawExplanation === 'FALLBACK_MODE';
    const hasRawExplanation = rawExplanation && rawExplanation !== 'FALLBACK_MODE';

    let promptContent;
    
    if (isFallbackMode) {
      // Generate explanation based purely on course metadata when searchExplanation is null
      promptContent = `You are a Coursera course recommendation expert. The course's search explanation service is unavailable, so analyze this course based on available metadata and explain why it matches the search query.

IMPORTANT: Write in objective, third-person style. Do NOT use personal pronouns like "I", "you", "I recommend", or "you should". Write as factual statements and recommendations.

SEARCH QUERY: "${searchQuery}"

COURSE DETAILS:
- Title: ${productDetails.title}
- Partner: ${productDetails.partner}
- Description: ${productDetails.description || 'Not available'}
- Skills: ${productDetails.skills ? JSON.stringify(productDetails.skills) : 'Not available'}
- Rating: ${productDetails.averageRating}
- URL: ${productDetails.url}
- Entity Type: ${productDetails.entityType}
- Free/Paid: ${productDetails.isCourseFree ? 'Free' : 'Paid'}

FULL COURSE DATA:
${JSON.stringify(productDetails, null, 2)}

Since Coursera's search explanation service is not available, analyze this course based on the available metadata and provide insights on why it matches "${searchQuery}". Focus on inferring the course content, learning outcomes, and relevance from the title, description, skills, and other available data.

Please provide a structured analysis in this EXACT format:

📋 Summary: [2-3 sentences explaining why this course matches "${searchQuery}" based on available data]

🎯 Relevance: [How this course relates to "${searchQuery}" based on title, description, and skills - infer from available metadata]

💡 Key Skills: [List 3-4 specific skills this course likely teaches related to the search, based on course data]

🔍 Topics: [List 3-4 main topics/subjects this course likely covers, inferred from available data]

📚 Content Format: [Infer the learning format based on partner, course type, and available metadata]

📈 Level: [Infer beginner/intermediate/advanced based on course title, description, and context]

💫 Recommendation: [Specific objective recommendation explaining what learners will gain from this course and how it relates to "${searchQuery}". Use phrases like "This course is recommended for..." or "This course provides..." instead of "I recommend" or "You will...". Base this on the actual course data available.]

Note: Analysis based on course metadata (Coursera's explanation service unavailable)`;
    } else {
      // Use the original prompt when we have searchExplanation data
      promptContent = `You are a Coursera course recommendation expert. Analyze this course data and provide a structured explanation of why it matches the search query.

IMPORTANT: Write in objective, third-person style. Do NOT use personal pronouns like "I", "you", "I recommend", or "you should". Write as factual statements and recommendations.

CRITICAL: Include specific numbers, percentages, scores, and metrics from the RAW SEARCH EXPLANATION when available. These provide valuable quantitative insights about the course's relevance.

SEARCH QUERY: "${searchQuery}"

COURSE DETAILS:
- Title: ${productDetails.title}
- Partner: ${productDetails.partner}
- Description: ${productDetails.description || 'Not available'}
- Skills: ${productDetails.skills ? JSON.stringify(productDetails.skills) : 'Not available'}
- Rating: ${productDetails.averageRating}
- URL: ${productDetails.url}

RAW SEARCH EXPLANATION: ${rawExplanation || 'Not available'}

ADDITIONAL COURSE DATA:
${JSON.stringify(productDetails, null, 2)}

Please provide a structured analysis in this EXACT format:

📋 Summary: [2-3 sentences explaining why this course matches "${searchQuery}". Include any numerical relevance scores or percentages from the raw explanation.]

🎯 Relevance: [How specifically this course relates to "${searchQuery}" - mention exact technologies, concepts, or skills. Include specific numbers, scores, or percentages from the search explanation that demonstrate relevance.]

💡 Key Skills: [List 3-4 specific skills/technologies this course teaches that relate to the search. Include any skill-level scores or competency metrics if available.]

🔍 Topics: [List 3-4 main topics/subjects covered. Include topic relevance scores or coverage percentages if provided in the explanation.]

📚 Content Format: [What type of learning format - hands-on projects, theory, case studies, etc.]

📈 Level: [Beginner/Intermediate/Advanced and why]

💫 Recommendation: [Specific objective recommendation based on the search query - mention what learners will gain, what prerequisites are needed, or what can be accomplished after completing this course. Use phrases like "This course is recommended for..." or "This course provides..." instead of "I recommend" or "You will...". Include any confidence scores or match percentages from the explanation data.]

Focus on being specific rather than generic. Use the actual course data AND numerical metrics from the search explanation to make data-driven, personalized recommendations.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: promptContent
        }],
        max_tokens: 800,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices[0].message.content;

    // Parse the structured response
    const sections = {};
    const lines = explanation.split('\n');
    let currentSection = '';
    let currentContent = '';

    for (const line of lines) {
      if (line.match(/^(📋|🎯|💡|🔍|📚|📈|💫)/)) {
        if (currentSection && currentContent) {
          sections[currentSection] = currentContent.trim();
        }
        const parts = line.split(': ');
        currentSection = parts[0].trim();
        currentContent = parts.slice(1).join(': ');
      } else if (line.trim() && currentSection) {
        currentContent += ' ' + line.trim();
      }
    }
    
    // Add the last section
    if (currentSection && currentContent) {
      sections[currentSection] = currentContent.trim();
    }

    const result = {
      sections: sections,
      rawResponse: explanation,
      cached: false,
      cacheType: 'fresh',
      query: searchQuery,
      productId: productDetails.productId,
      fallbackMode: isFallbackMode
    };

    // Store in session cache
    explanationCache.set(cacheKey, result);

    // Store in Redis cache
    try {
      console.log('💾 [REDIS] Caching AI explanation:', cacheKey);
      await fetch('http://localhost:8080/ai-explanation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: cacheKey,
          data: result,
          query: searchQuery,
          productId: productDetails.productId,
          title: productDetails.title
        })
      });
      console.log('✅ [REDIS] AI explanation cached successfully');
    } catch (cacheError) {
      console.log('⚠️ [REDIS] Failed to cache explanation:', cacheError.message);
    }

    return result;

  } catch (error) {
    console.error('❌ [OPENAI] Error formatting explanation:', error);
    return {
      sections: {
        '❌ Error': 'Failed to generate AI explanation. Please try again later.'
      },
      cached: false,
      error: true
    };
  }
}

// Fetch Redis metrics
async function fetchRedisMetrics(query, productId) {
  try {
    // Normalize query to lowercase for case-insensitive Redis lookup
    const normalizedQuery = query.toLowerCase();
    const cleanProductId = productId.includes('~') ? productId.split('~')[1] : productId;
    const url = `${REDIS_API_BASE}/metrics/${encodeURIComponent(normalizedQuery)}/${encodeURIComponent(cleanProductId)}`;
    
    console.log('🔗 [BACKGROUND] Making metrics request to:', url);
    console.log('🔗 [BACKGROUND] Original query:', query, '→ Normalized:', normalizedQuery);
    
    const response = await fetch(url);
    console.log('🔗 [BACKGROUND] Metrics response:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔗 [BACKGROUND] Metrics data:', data);
      return { 
        success: true, 
        metrics: data.metrics,
        originalQuery: query,
        normalizedQuery: normalizedQuery
      };
    } else if (response.status === 404) {
      console.log('🔗 [BACKGROUND] No metrics found for normalized query:', normalizedQuery);
      return { 
        success: true, 
        metrics: null,
        originalQuery: query,
        normalizedQuery: normalizedQuery
      };
    } else {
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error) {
    console.log('🔗 [BACKGROUND] Metrics fetch error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
} 