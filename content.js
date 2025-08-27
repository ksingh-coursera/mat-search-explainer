// content.js
console.log('Coursera Search Intelligence: Content script loaded');

let searchData = null;
let productCards = [];
let overlays = [];
let isActive = true;
let responseData = null;
let allResponses = []; // Store all accumulated responses

// Redis API integration (via background script)
let redisApiAvailable = false;
let currentSearchQuery = null;
let aiExplanationsEnabled = true; // Toggle for AI explanations

// Check Redis API availability (via background script)
async function checkRedisAPI() {
  console.log('🔗 [DEBUG] Checking Redis API availability via background script...');
  
  try {
    console.log('🔗 [DEBUG] Sending message to background script...');
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'checkRedisAPI' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('🔗 [DEBUG] Background script response:', result);
    
    if (result.success && result.healthy) {
      redisApiAvailable = true;
      console.log('🔗 Redis API status: Available ✅');
      return true;
    } else {
      redisApiAvailable = false;
      console.log('🔗 Redis API status: Unavailable ❌');
      console.log('🔗 [DEBUG] Error:', result.error);
      return false;
    }
  } catch (error) {
    console.log('🔗 [ERROR] Redis API check failed:');
    console.log('🔗 [ERROR] Error type:', error.constructor.name);
    console.log('🔗 [ERROR] Error message:', error.message);
    console.log('🔗 [ERROR] Error stack:', error.stack);
    redisApiAvailable = false;
    return false;
  }
}

// Extract current search query from page
function extractSearchQuery() {
  // Try URL parameters first
  const urlParams = new URLSearchParams(window.location.search);
  let query = urlParams.get('query') || urlParams.get('q');
  
  if (query) {
    currentSearchQuery = decodeURIComponent(query);
    console.log('🔍 Search query from URL:', currentSearchQuery);
    return currentSearchQuery;
  }
  
  // Try to extract from search input field
  const searchInput = document.querySelector('input[type="search"]') || 
                     document.querySelector('input[placeholder*="search"]') ||
                     document.querySelector('[data-testid="search-input"]');
  
  if (searchInput && searchInput.value) {
    currentSearchQuery = searchInput.value.trim();
    console.log('🔍 Search query from input:', currentSearchQuery);
    return currentSearchQuery;
  }
  
  // Try to extract from page title or breadcrumb
  const title = document.title;
  const searchMatch = title.match(/search.*?["\'""]([^"\'""]+)["\'""]|search for (.+?) \||search results for (.+?)$/i);
  if (searchMatch) {
    currentSearchQuery = searchMatch[1] || searchMatch[2] || searchMatch[3];
    console.log('🔍 Search query from title:', currentSearchQuery);
    return currentSearchQuery;
  }
  
  console.log('❌ Could not extract search query');
  return null;
}

// Fetch metrics from Redis API
async function fetchRedisMetrics(searchQuery, productId) {
  if (!redisApiAvailable || !searchQuery || !productId) {
    return null;
  }
  
  try {
    // Strip prefix from productId (e.g., "course~ABC123" -> "ABC123", "s12n~XYZ789" -> "XYZ789")
    const cleanProductId = productId.includes('~') ? productId.split('~')[1] : productId;
    
    console.log(`🔍 [DEBUG] Fetching Redis metrics via background script for: ${searchQuery} + ${productId} (clean: ${cleanProductId})`);
    console.log(`🔍 [DEBUG] API Available flag: ${redisApiAvailable}`);
    
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ 
        action: 'fetchRedisMetrics',
        query: searchQuery,
        productId: cleanProductId
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log(`🔍 [DEBUG] Background script metrics response:`, result);
    
    if (result.originalQuery && result.normalizedQuery) {
      console.log(`🔍 [DEBUG] Query normalization: "${result.originalQuery}" → "${result.normalizedQuery}"`);
    }
    
    if (result.success && result.metrics) {
      console.log('✅ Found Redis metrics:', result.metrics);
      return result.metrics;
    } else if (result.success && result.metrics === null) {
      console.log('❌ No Redis metrics found for this combination');
      return null;
    } else {
      console.log('❌ Error fetching metrics:', result.error);
      return null;
    }
  } catch (error) {
    console.log('❌ [ERROR] Error fetching Redis metrics:');
    console.log('❌ [ERROR] Error type:', error.constructor.name);
    console.log('❌ [ERROR] Error message:', error.message);
    console.log('❌ [ERROR] Error stack:', error.stack);
    return null;
  }
}

// Debouncing for processSearchResults
let processTimeout = null;

// Enhanced debugging for timing issues
let responseCount = 0;
let cardDetectionHistory = [];



function debouncedProcessSearchResults() {
  if (processTimeout) {
    clearTimeout(processTimeout);
  }
  
  processTimeout = setTimeout(() => {
    processSearchResults();
    processTimeout = null;
  }, 1000); // Wait 1 second before processing
}

// Function to inject response interceptor script (CSP-safe approach)
function injectResponseInterceptor() {
  // Create and inject a script element that loads from the extension
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('interceptor.js');
  script.onload = function() {
    console.log('✅ Response interceptor script loaded');
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Listen for intercepted responses - accumulate instead of replace
window.addEventListener('message', (event) => {
  if (event.data.type === 'GRAPHQL_RESPONSE_INTERCEPTED') {
    console.log('🔍 [DEBUG] Intercepted GraphQL response:', event.data.url);
    
    // Only process Search responses, skip other GraphQL requests
    if (!event.data.url.includes('opname=Search')) {
      console.log('🔍 [DEBUG] Skipping non-Search GraphQL response');
      return;
    }
    
    console.log('🔍 [DEBUG] Processing Search GraphQL response');
    responseCount++;
    
    // Add this response to our accumulated responses
    const newResponseData = {
      type: 'GRAPHQL_RESPONSE_CAPTURED',
      url: event.data.url,
      data: event.data.response,
      timestamp: Date.now(),
      responseNumber: responseCount
    };
    
    allResponses.push(newResponseData);
    console.log('🔍 [DEBUG] Total accumulated responses:', allResponses.length);
    
    // Create a combined response with all accumulated results
    responseData = {
      type: 'ACCUMULATED_RESPONSE',
      url: 'multiple_responses',
      data: combineAllResponses(),
      timestamp: Date.now(),
      totalResponses: allResponses.length
    };
    
    // Use debounced processing
    debouncedProcessSearchResults();
  }
});

// Check the actual response structure
window.addEventListener('message', (event) => {
  if (event.data.type === 'GRAPHQL_RESPONSE_INTERCEPTED' && event.data.url.includes('opname=Search')) {
    console.log('🔍 RESPONSE STRUCTURE received');
    
    if (Array.isArray(event.data.response)) {
      event.data.response.forEach((item, index) => {
        console.log(`🔍 Response item ${index}:`, {
          hasData: !!item.data,
          dataKeys: item.data ? Object.keys(item.data) : 'none',
          searchResults: item.data?.SearchResult?.search?.length || 0
        });
        
        if (item.data?.SearchResult?.search) {
          item.data.SearchResult.search.forEach((search, searchIndex) => {
            console.log(`  Search ${searchIndex}:`, {
              source: search.source?.indexName,
              elements: search.elements?.length || 0
            });
            
            // Check for searchExplanation in individual elements
            if (search.elements && search.elements.length > 0) {
              console.log(`🧠 [DEBUG] Checking ${search.elements.length} elements for searchExplanation...`);
              search.elements.forEach((element, elementIndex) => {
                console.log(`🧠 [DEBUG] Element ${elementIndex} keys:`, Object.keys(element));
                if (element.searchExplanation) {
                  console.log(`🧠 [DEBUG] ✅ Found searchExplanation in element ${elementIndex}:`, element.searchExplanation);
                } else {
                  console.log(`🧠 [DEBUG] ❌ No searchExplanation in element ${elementIndex}`);
                }
              });
            }
          });
        }
      });
    }
  }
});

// Function to combine all accumulated responses into one
function combineAllResponses() {
  if (allResponses.length === 0) return null;
  
  // Extract all product hits from all responses
  const allElements = [];
  
  allResponses.forEach((response, responseIndex) => {
    if (response.data?.[0]?.data?.SearchResult?.search) {
      response.data[0].data.SearchResult.search.forEach((searchResult, searchIndex) => {
        if (searchResult.elements && Array.isArray(searchResult.elements)) {
          searchResult.elements.forEach(element => {
            if (element.__typename === 'Search_ProductHit' || element.id) {
              allElements.push({
                ...element,
                _responseIndex: responseIndex,
                _searchIndex: searchIndex
              });
            }
          });
        }
      });
    }
  });
  
  // Create a combined response structure
  return {
    data: [{
      data: {
        SearchResult: {
          search: [{
            elements: allElements,
            source: { indexName: 'combined_responses' }
          }]
        }
      }
    }]
  };
}

// Try to access responses through existing page data
function tryExtractResponseFromPage() {
  console.log('🔍 Starting page data extraction...');
  
  try {
    // Check for search results DOM element
    const searchResultsElement = document.querySelector('#searchResults');
    console.log('🔍 searchResults element:', searchResultsElement);
    
    if (searchResultsElement) {
      console.log('✅ Found searchResults element');
      
      // Look for course cards within search results
      const courseCards = searchResultsElement.querySelectorAll('a[href*="/learn/"], a[href*="/specializations/"], a[href*="/professional-certificates/"]');
      console.log('📊 Found', courseCards.length, 'course links in search results');
      
      if (courseCards.length === 0) {
        console.log('❌ No course links found in searchResults');
        return false;
      }
      
      const extractedCourses = [];
      
      courseCards.forEach((link, index) => {
        if (index < 3) { // Debug first 3 only
          console.log(`🔍 Processing link ${index}:`, link.href);
          
          const card = link.closest('[data-click-value]') || link.closest('div[class*="card"]') || link.closest('article');
          console.log(`🔍 Found card for link ${index}:`, !!card);
          
          if (card) {
            const clickData = card.querySelector('[data-click-value]');
            console.log(`🔍 Found click data for link ${index}:`, !!clickData);
            
            let courseData = null;
            if (clickData) {
              try {
                const clickValue = clickData.getAttribute('data-click-value');
                courseData = JSON.parse(clickValue);
                console.log(`🔍 Parsed course data for link ${index}:`, courseData?.objectID);
              } catch (e) {
                console.log(`❌ Error parsing click data for link ${index}:`, e.message);
              }
            }
            
            const title = card.querySelector('h1, h2, h3, h4')?.textContent?.trim() || 'No title';
            console.log(`🔍 Title for link ${index}:`, title);
            
            extractedCourses.push({
              type: 'page_extracted_course',
              title: title,
              id: courseData?.objectID || 'No ID',
              objectID: courseData?.objectID || 'No objectID',
              url: link.href,
              clickData: courseData
            });
          }
        }
      });
      
      console.log('🎯 Extracted courses count:', extractedCourses.length);
      console.log('🎯 Sample extracted courses:', extractedCourses);
      
      if (extractedCourses.length > 0) {
        responseData = {
          type: 'PAGE_EXTRACTED_RESPONSE',
          url: window.location.href,
          data: {
            extractedCourses: extractedCourses
          },
          timestamp: Date.now()
        };
        
        console.log('✅ Set responseData:', !!responseData);
        return true;
      } else {
        console.log('❌ No courses extracted');
      }
    } else {
      console.log('❌ No searchResults element found');
    }
    
  } catch (error) {
    console.log('❌ Error in page extraction:', error.message);
  }
  
  console.log('❌ Page extraction failed');
  return false;
}

// Function to extract search results from GraphQL response data
function extractSearchResultsFromResponse(responseData) {
  console.log('🚨 EXTRACT DEBUG: Starting extractSearchResultsFromResponse');
  console.log('🚨 EXTRACT DEBUG: responseData exists:', !!responseData);
  console.log('🚨 EXTRACT DEBUG: responseData type:', responseData?.type);
  console.log('🚨 EXTRACT DEBUG: responseData.data exists:', !!responseData?.data);
  
  if (!responseData || !responseData.data) {
    console.log('🚨 EXTRACT DEBUG: EARLY EXIT - no responseData or data');
    return [];
  }
  
  const results = [];
  let data = responseData.data;
  
  // Handle accumulated responses from infinite scroll
  if (responseData.type === 'ACCUMULATED_RESPONSE') {
    console.log('🚨 EXTRACT DEBUG: Processing ACCUMULATED_RESPONSE');
    console.log('🚨 EXTRACT DEBUG: data structure:', {
      hasData: !!data,
      hasDataArray: !!data?.data,
      dataArrayLength: data?.data?.length,
      hasSearchResult: !!data?.data?.[0]?.data?.SearchResult,
      hasSearch: !!data?.data?.[0]?.data?.SearchResult?.search,
      searchLength: data?.data?.[0]?.data?.SearchResult?.search?.length,
      hasElements: !!data?.data?.[0]?.data?.SearchResult?.search?.[0]?.elements,
      elementsLength: data?.data?.[0]?.data?.SearchResult?.search?.[0]?.elements?.length
    });
    
    if (data?.data?.[0]?.data?.SearchResult?.search?.[0]?.elements) {
      const elements = data.data[0].data.SearchResult.search[0].elements;
      console.log(`🚨 EXTRACT DEBUG: Found ${elements.length} elements to process`);
      
      elements.forEach((element, index) => {
        results.push({
          type: 'accumulated_product_hit',
          title: element.name || element.title || 'No title',
          slug: element.url ? element.url.replace(/^\/learn\//, '').replace(/^\//, '') : 'No slug',
          entityType: element.__typename || 'Unknown',
          id: element.id || 'No ID',
          objectID: element.id || 'No objectID',
          partners: element.partners || [],
          averageRating: element.avgProductRating || 'No rating',
          numRatings: element.numProductRatings || 0,
          isCourseFree: element.isCourseFree || false,
          url: element.url || 'No URL',
          description: element.tagline || 'No description',
          skills: element.skills || [],
          rawHit: element,
          foundAt: `accumulated[${index}] from response ${element._responseIndex || 'unknown'}`
        });
      });
      
      console.log(`🚨 EXTRACT DEBUG: Created ${results.length} results from accumulated elements`);
      return results;
    } else {
      console.log('🚨 EXTRACT DEBUG: ACCUMULATED_RESPONSE path failed - no elements found');
    }
  }
  
  // Handle page-extracted data (from DOM parsing)
  if (responseData.type === 'PAGE_EXTRACTED_RESPONSE' && data.extractedCourses) {
    console.log('🔍 Processing page-extracted courses:', data.extractedCourses.length);
    
    data.extractedCourses.forEach((course, index) => {
      results.push({
        type: 'page_extracted_hit',
        title: course.title,
        slug: course.slug,
        entityType: 'PAGE_EXTRACTED',
        id: course.id,
        objectID: course.objectID,
        partners: course.partner ? [course.partner] : [],
        averageRating: 'Unknown',
        numRatings: 0,
        isCourseFree: false,
        url: course.url,
        description: 'Extracted from page',
        skills: [],
        rawHit: course,
        foundAt: `page.extractedCourses[${index}]`
      });
    });
    
    console.log('✅ Processed', results.length, 'page-extracted courses');
    return results;
  }
  
  // Handle Coursera's array wrapper (GraphQL response)
  if (Array.isArray(data) && data.length > 0 && data[0].data) {
    data = data[0].data;
  }
  
  // Handle Coursera's actual response structure
  if (data.SearchResult && data.SearchResult.search && Array.isArray(data.SearchResult.search)) {
    console.log('🔍 Found', data.SearchResult.search.length, 'search results (products + suggestions)');
    
    data.SearchResult.search.forEach((searchResult, searchIndex) => {
      // Filter for PRODUCTS only, skip SUGGESTIONS
      const isProductsResult = searchResult.source?.indexName?.includes('products') || 
                              searchResult.source?.indexName?.includes('consumer_products') ||
                              searchIndex === 0; // Products is typically first
      
      const isSuggestionsResult = searchResult.source?.indexName?.includes('suggestions') ||
                                 searchResult.elements?.[0]?.__typename === 'Search_SuggestionHit';
      
      console.log(`🔍 Search result ${searchIndex}:`, {
        indexName: searchResult.source?.indexName,
        isProducts: isProductsResult,
        isSuggestions: isSuggestionsResult,
        elementCount: searchResult.elements?.length || 0,
        firstElementType: searchResult.elements?.[0]?.__typename
      });
      
      // Only process PRODUCTS results, skip suggestions
      if (isProductsResult && !isSuggestionsResult && searchResult.elements && Array.isArray(searchResult.elements)) {
        console.log(`✅ Processing PRODUCTS result ${searchIndex} with ${searchResult.elements.length} elements`);
        
        searchResult.elements.forEach((element, elementIndex) => {
          if (element.__typename === 'Search_ProductHit' || element.id) {
            results.push({
              type: 'coursera_product_hit',
              title: element.name || element.title || 'No title',
              slug: element.url ? element.url.replace(/^\/learn\//, '').replace(/^\//, '') : 'No slug',
              entityType: element.__typename || 'Unknown',
              id: element.id || 'No ID',
              objectID: element.id || 'No objectID',
              partners: element.partners || [],
              averageRating: element.avgProductRating || 'No rating',
              numRatings: element.numProductRatings || 0,
              isCourseFree: element.isCourseFree || false,
              url: element.url || 'No URL',
              description: element.tagline || 'No description',
              skills: element.skills || [],
              rawHit: element,
              foundAt: `SearchResult.search[${searchIndex}].elements[${elementIndex}]`
            });
          }
        });
      } else {
        console.log(`⏭️ Skipping result ${searchIndex} (${isSuggestionsResult ? 'suggestions' : 'not products'})`);
      }
    });
  }
  
  console.log('🎯 Extracted', results.length, 'product results (suggestions filtered out)');
  return results;
}

// Function to extract search results from the captured GraphQL response
function extractSearchResultsFromAPI(apiData) {
  if (!apiData) {
    return [];
  }
  
  const searchResults = [];
  
  // First, try to extract from operations
  if (apiData.operations && Array.isArray(apiData.operations)) {
    
    apiData.operations.forEach((operation, opIndex) => {
      
      if (operation.operationName === 'Search' && operation.variables) {
        const variables = operation.variables;
        
        // Try multiple possible query field names
        const query = variables.query || 
                     variables.q || 
                     variables.searchTerm || 
                     variables.term || 
                     variables.keyword ||
                     variables.searchQuery ||
                     JSON.stringify(variables);
        
        searchResults.push({
          type: 'search_query',
          query: query,
          variables: variables,
          operationName: operation.operationName,
          source: 'operations'
        });
        
      }
    });
  }
  
  // Also try to extract from the raw request body if available
  if (apiData.requestBody) {
    
    try {
      const parsedBody = JSON.parse(apiData.requestBody);
      
      if (Array.isArray(parsedBody)) {
        parsedBody.forEach((item, index) => {
          
          if (item.operationName === 'Search' && item.variables) {
            
            // Try multiple possible query field names
            const query = item.variables.query || 
                         item.variables.q || 
                         item.variables.searchTerm || 
                         item.variables.term || 
                         item.variables.keyword ||
                         item.variables.searchQuery ||
                         'Query found in variables: ' + JSON.stringify(item.variables).substring(0, 100);
            
            searchResults.push({
              type: 'search_operation',
              query: query,
              variables: item.variables,
              operationName: item.operationName,
              rawOperation: item,
              source: 'requestBody'
            });
            
          }
        });
      } else if (parsedBody.operationName === 'Search') {
        // Handle single operation
        
        const query = parsedBody.variables?.query || 
                     parsedBody.variables?.q || 
                     'Single operation: ' + JSON.stringify(parsedBody.variables || {}).substring(0, 100);
        
        searchResults.push({
          type: 'single_search_operation',
          query: query,
          variables: parsedBody.variables || {},
          operationName: parsedBody.operationName,
          source: 'singleRequestBody'
        });
        
      }
    } catch (e) {
      console.log('❌ Error parsing request body:', e);
      
      // If JSON parsing fails, try to extract query from raw string
      if (typeof apiData.requestBody === 'string') {
        const queryMatch = apiData.requestBody.match(/"query"\s*:\s*"([^"]+)"/);
        const qMatch = apiData.requestBody.match(/"q"\s*:\s*"([^"]+)"/);
        
        if (queryMatch || qMatch) {
          const extractedQuery = queryMatch ? queryMatch[1] : qMatch[1];
          searchResults.push({
            type: 'extracted_from_string',
            query: extractedQuery,
            variables: { extracted: true },
            operationName: 'Search',
            source: 'stringExtraction'
          });
          
        }
      }
    }
  }
  
  // If we still have no results, try to extract from rawRequest
  if (searchResults.length === 0 && apiData.rawRequest) {
    
    if (Array.isArray(apiData.rawRequest)) {
      apiData.rawRequest.forEach((item, index) => {
        if (item && item.variables) {
          
          const query = item.variables.query || 
                       item.variables.q || 
                       'Raw request variables: ' + JSON.stringify(item.variables).substring(0, 100);
          
          searchResults.push({
            type: 'raw_request',
            query: query,
            variables: item.variables,
            operationName: item.operationName || 'Unknown',
            source: 'rawRequest'
          });
          
        }
      });
    }
  }
  
  // Fallback: if no specific query found, at least show we captured something
  if (searchResults.length === 0 && apiData.url) {
    const urlQuery = new URL(apiData.url).searchParams.get('query') || 
                    new URL(apiData.url).searchParams.get('q') ||
                    'Search request captured from: ' + apiData.url;
    
    searchResults.push({
      type: 'url_fallback',
      query: urlQuery,
      variables: { url: apiData.url },
      operationName: 'Search',
      source: 'url'
    });
    
  }
  
  return searchResults;
}

// Function to extract search results from Apollo state (fallback)
function extractSearchResultsFromApollo() {
  try {
    if (window.__APOLLO_STATE__) {
      const apolloState = window.__APOLLO_STATE__;
      
      // Find search results in Apollo state
      const searchResults = [];
      
      // Look for search result objects
      Object.keys(apolloState).forEach(key => {
        if (key.startsWith('Search_ProductHit:')) {
          const product = apolloState[key];
          if (product && product.__typename === 'Search_ProductHit') {
            searchResults.push({
              type: 'apollo_product',
              id: key,
              title: product.name || 'No title',
              slug: product.slug || 'No slug',
              productId: product.id || 'No ID',
              entityType: product.entityType || 'Unknown',
              partnerName: product.partnerName || 'No partner',
              productComplexId: product.productComplexId || 'No complex ID',
              averageRating: product.averageRating || 'No rating',
              url: product.url || 'No URL',
              rawData: product
            });
          }
        }
      });
      
      return searchResults;
    }
  } catch (error) {
    console.error('❌ Error extracting Apollo search results:', error);
  }
  return [];
}

// Function to find the actual card containers more precisely
function findProductCards() {
  const courseLinks = document.querySelectorAll('a[href*="/learn/"], a[href*="/browse/"], a[href*="/professional-certificates/"], a[href*="/degrees/"], a[href*="/projects/"], a[href*="/specializations/"]');
  
  const cards = [];
  const processedElements = new Set();
  
  courseLinks.forEach((link, index) => {
    
    // Walk up the DOM to find the card container
    let currentElement = link;
    let cardContainer = null;
    let attempts = 0;
    
    while (currentElement && attempts < 10) {
      attempts++;
      currentElement = currentElement.parentElement;
      
      if (!currentElement) break;
      
      // Check if this element looks like a card container
      const rect = currentElement.getBoundingClientRect();
      const hasGoodSize = rect.width > 200 && rect.height > 200;
      const hasContent = currentElement.querySelector('img') || currentElement.querySelector('h1, h2, h3, h4');
      
      // Look for common card patterns
      const classList = currentElement.className.toLowerCase();
      const isCardLike = classList.includes('card') || 
                        classList.includes('product') || 
                        classList.includes('course') || 
                        classList.includes('result') ||
                        currentElement.tagName.toLowerCase() === 'article' ||
                        currentElement.hasAttribute('data-testid');
      
      if (hasGoodSize && hasContent && isCardLike) {
        cardContainer = currentElement;
        break;
      }
    }
    
    // If we found a container and haven't processed it already
    if (cardContainer && !processedElements.has(cardContainer)) {
      processedElements.add(cardContainer);
      cards.push(cardContainer);
    }
  });
  
  return cards;
}

// Function to extract product ID from card
function extractProductIdFromCard(card) {
  try {
    // First, try to extract objectID from data-click-value
    const clickData = card.querySelector('[data-click-value]');
    if (clickData) {
      try {
        const clickValue = clickData.getAttribute('data-click-value');
        const parsedData = JSON.parse(clickValue);
        if (parsedData.objectID) {
          return {
            objectID: parsedData.objectID,
            href: parsedData.href,
            query: parsedData.query,
            hitPosition: parsedData.hitPosition,
            type: 'objectID'
          };
        }
      } catch (e) {
        // Silent
      }
    }
    
    // Fallback: Look for links that contain course/product information
    const links = card.querySelectorAll('a[href*="/learn/"], a[href*="/browse/"], a[href*="/professional-certificates/"], a[href*="/degrees/"], a[href*="/projects/"], a[href*="/specializations/"]');
    
    for (let link of links) {
      const href = link.getAttribute('href');
      if (href) {
        // Extract slug from URL patterns
        const patterns = [
          /\/learn\/([^\/\?]+)/,
          /\/browse\/([^\/\?]+)/,
          /\/professional-certificates\/([^\/\?]+)/,
          /\/degrees\/([^\/\?]+)/,
          /\/projects\/([^\/\?]+)/,
          /\/specializations\/([^\/\?]+)/
        ];
        
        for (let pattern of patterns) {
          const match = href.match(pattern);
          if (match) {
            return {
              slug: match[1],
              href: href,
              type: 'slug'
            };
          }
        }
      }
    }
  } catch (error) {
    // Silent
  }
  return null;
}

// Function to match cards with API data
function matchCardsWithData(cards, apiResults, apolloResults, responseResults) {
  const matches = [];
  
  cards.forEach((card, index) => {
    const productData = extractProductIdFromCard(card);
    
    let matchedApolloResult = null;
    let matchedResponseResult = null;
    
    if (productData) {
      if (productData.type === 'objectID' && productData.objectID) {
        // Try to find matching response
        matchedResponseResult = responseResults.find(result => 
          result.objectID === productData.objectID ||
          result.id === productData.objectID ||
          result.rawHit?.objectID === productData.objectID ||
          result.rawHit?.id === productData.objectID
        );
      }
      
      if (!matchedResponseResult && productData.slug) {
        matchedResponseResult = responseResults.find(result => 
          result.slug === productData.slug || 
          result.id === productData.slug ||
          (result.url && result.url.includes(productData.slug)) ||
          (result.rawHit?.slug === productData.slug) ||
          (result.rawHit?.url && result.rawHit.url.includes(productData.slug))
        );
      }
    }
    
    const cardInfo = {
      title: card.querySelector('h3')?.textContent?.trim() || 
             card.querySelector('h2')?.textContent?.trim() || 
             card.querySelector('h1')?.textContent?.trim() || 
             card.querySelector('[data-testid="card-title"]')?.textContent?.trim() || 
             'No title found',
      partner: card.querySelector('[data-testid="partner-name"]')?.textContent?.trim() || 
              card.querySelector('.partner-name')?.textContent?.trim() || 
              'No partner found',
      rating: card.querySelector('[data-testid="rating"]')?.textContent?.trim() || 
             card.querySelector('.rating')?.textContent?.trim() || 
             'No rating found',
      productId: productData ? (productData.objectID || productData.slug || 'No product ID found') : 'No product ID found',
      productData: productData
    };
    
    const match = {
      cardElement: card,
      cardInfo: cardInfo,
      apolloData: matchedApolloResult,
      responseData: matchedResponseResult,
      apiData: apiResults.length > 0 ? apiResults[0] : null,
      index: index
    };
    
    matches.push(match);
  });
  
  return matches;
}

// Function to create overlay for a card
async function createOverlay(match) {
  const overlay = document.createElement('div');
  overlay.className = 'coursera-search-overlay';
  overlay.style.cssText = `
    position: fixed;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: #1e293b;
    padding: 20px;
    border-radius: 20px;
    font-size: 12px;
    line-height: 1.6;
    max-width: 420px;
    z-index: 10000;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 10px 20px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    display: none;
    pointer-events: auto;
    border: 1px solid rgba(71, 85, 105, 0.1);
    animation: slideIn 0.2s ease-out;
  `;
  
  // Add CSS animation keyframes
  if (!document.getElementById('overlay-styles')) {
    const style = document.createElement('style');
    style.id = 'overlay-styles';
    style.textContent = `
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Build overlay content
  let content = ``;
  
  // Extract search query if not already done
  if (!currentSearchQuery) {
    extractSearchQuery();
  }
  
  // Get product ID from card info
  const productId = match.cardInfo?.productId || match.cardInfo?.productData?.objectID || match.cardInfo?.productData?.slug;
  const cleanProductId = productId && productId.includes('~') ? productId.split('~')[1] : productId;
  
  // Fetch Redis metrics if available
  let redisMetrics = null;
  if (redisApiAvailable && currentSearchQuery && productId) {
    try {
      redisMetrics = await fetchRedisMetrics(currentSearchQuery, productId);
    } catch (error) {
      console.log('❌ Error fetching Redis metrics in overlay:', error);
    }
  }
  
  // Add Redis metrics section
  if (redisMetrics) {
    content += `
      <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(196, 181, 253, 0.12) 100%); border-radius: 10px; border-left: 3px solid #7c3aed;">
        <div style="font-weight: 600; color: #7c3aed; margin-bottom: 8px; font-size: 11px;">📈 Metrics - Historical Performance</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
          <div style="padding: 6px; background: rgba(139, 92, 246, 0.1); border-radius: 6px;">
            <div style="font-size: 9px; color: #64748b;">👀 Viewers</div>
            <div style="font-weight: 600; color: #7c3aed; font-size: 11px;">${redisMetrics.viewers?.toLocaleString() || 'N/A'}</div>
          </div>
          <div style="padding: 6px; background: rgba(139, 92, 246, 0.1); border-radius: 6px;">
            <div style="font-size: 9px; color: #64748b;">🖱️ Clickers</div>
            <div style="font-weight: 600; color: #7c3aed; font-size: 11px;">${redisMetrics.clickers?.toLocaleString() || 'N/A'}</div>
          </div>
          <div style="padding: 6px; background: rgba(139, 92, 246, 0.1); border-radius: 6px;">
            <div style="font-size: 9px; color: #64748b;">📚 Enrollers</div>
            <div style="font-weight: 600; color: #7c3aed; font-size: 11px;">${redisMetrics.enrollers?.toLocaleString() || 'N/A'}</div>
          </div>
          <div style="padding: 6px; background: rgba(139, 92, 246, 0.1); border-radius: 6px;">
            <div style="font-size: 9px; color: #64748b;">💰 Paid Enrollers</div>
            <div style="font-weight: 600; color: #7c3aed; font-size: 11px;">${redisMetrics.paid_enrollers?.toLocaleString() || 'N/A'}</div>
          </div>
          <div style="padding: 6px; background: rgba(139, 92, 246, 0.1); border-radius: 6px;">
            <div style="font-size: 9px; color: #64748b;">🎯 CTR</div>
            <div style="font-weight: 600; color: #7c3aed; font-size: 11px;">${redisMetrics.ctr?.toFixed(2) || 'N/A'}%</div>
          </div>
          <div style="padding: 6px; background: rgba(139, 92, 246, 0.1); border-radius: 6px;">
            <div style="font-size: 9px; color: #64748b;">📈 Enrollment Rate</div>
            <div style="font-weight: 600; color: #7c3aed; font-size: 11px;">${redisMetrics.enrollment_rate?.toFixed(2) || 'N/A'}%</div>
          </div>
        </div>
        <div style="margin-top: 8px; padding: 6px; background: rgba(139, 92, 246, 0.1); border-radius: 6px;">
          <div style="font-size: 9px; color: #64748b;">💵 Paid Conversion Rate</div>
          <div style="font-weight: 600; color: #7c3aed; font-size: 11px;">${redisMetrics.paid_conversion_rate?.toFixed(2) || 'N/A'}%</div>
        </div>
      </div>
    `;
  } else if (redisApiAvailable && currentSearchQuery) {
    content += `
      <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(107, 114, 128, 0.08) 0%, rgba(156, 163, 175, 0.12) 100%); border-radius: 10px; border-left: 3px solid #6b7280;">
        <div style="font-weight: 600; color: #6b7280; margin-bottom: 8px; font-size: 11px;">📈 Metrics - No Historical Data</div>
        <div style="font-size: 10px; color: #374151;">No historical performance data found for this course</div>
      </div>
    `;
  } else if (!redisApiAvailable) {
    content += `
      <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.12) 100%); border-radius: 10px; border-left: 3px solid #d97706;">
        <div style="font-weight: 600; color: #d97706; margin-bottom: 8px; font-size: 11px;">📈 Metrics - API Unavailable</div>
        <div style="font-size: 10px; color: #374151;">API server not running. Start it with:</div>
        <div style="font-size: 10px; font-family: monospace; background: rgba(245, 158, 11, 0.1); padding: 4px; border-radius: 4px; margin-top: 4px;">python3 api_server.py</div>
      </div>
    `;
  }
  
  // Show AI Search Explanation prominently if available (MOVED TO TOP)
  console.log('🧠 [DEBUG] Checking for searchExplanation...');
  
  if (match.responseData) {
    console.log('🧠 [DEBUG] responseData keys:', Object.keys(match.responseData));
    console.log('🧠 [DEBUG] responseData type:', match.responseData.type);
    console.log('🧠 [DEBUG] searchExplanation value:', match.responseData.searchExplanation);
    console.log('🧠 [DEBUG] searchExplanation type:', typeof match.responseData.searchExplanation);
    
    // Also check if searchExplanation exists in rawHit
    if (match.responseData.rawHit) {
      console.log('🧠 [DEBUG] rawHit keys:', Object.keys(match.responseData.rawHit));
      console.log('🧠 [DEBUG] rawHit.searchExplanation:', match.responseData.rawHit.searchExplanation);
      console.log('🧠 [DEBUG] rawHit.__typename:', match.responseData.rawHit.__typename);
    }
    
    // Check multiple possible locations for searchExplanation
    const searchExplanation = match.responseData.searchExplanation || 
                             match.responseData.rawHit?.searchExplanation ||
                             match.responseData.rawData?.searchExplanation;
    
    console.log('🧠 [DEBUG] Final searchExplanation found:', searchExplanation);
    
    if (searchExplanation) {
      const explanation = searchExplanation;
      console.log('🧠 [DEBUG] Found searchExplanation:', explanation);
      
      // Create a placeholder for the AI explanation that will be updated
      const explanationId = `ai-explanation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      content += `
        <div id="${explanationId}" style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(253, 186, 116, 0.12) 100%); border-radius: 10px; border-left: 3px solid #ea580c;">
          <div style="font-weight: 600; color: #ea580c; margin-bottom: 8px; font-size: 11px; display: flex; align-items: center;">
            <span>🧠 AI Search Explanation</span>
            <div style="margin-left: 8px; width: 12px; height: 12px; border: 2px solid #ea580c; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          </div>
          <div style="padding: 12px; background: rgba(249, 115, 22, 0.1); border-radius: 6px;">
            <div style="font-size: 10px; color: #ea580c;">🤖 Analyzing with AI...</div>
          </div>
        </div>
      `;
      
      // Store the explanation data and complete match object for later use
      overlay.setAttribute('data-explanation', explanation);
      overlay.setAttribute('data-explanation-id', explanationId);
      overlay.setAttribute('data-course-title', match.cardInfo?.title || 'Unknown Course');
      overlay.setAttribute('data-product-id', match.cardInfo?.productId || 'Unknown');
      
      // Store complete match data as JSON for rich OpenAI context
      const matchData = {
        cardInfo: match.cardInfo,
        responseData: match.responseData ? {
          title: match.responseData.title,
          description: match.responseData.description,
          skills: match.responseData.skills,
          partners: match.responseData.partners,
          averageRating: match.responseData.averageRating,
          numRatings: match.responseData.numRatings,
          isCourseFree: match.responseData.isCourseFree,
          url: match.responseData.url,
          entityType: match.responseData.entityType,
          rawHit: match.responseData.rawHit
        } : null
      };
      overlay.setAttribute('data-match-details', JSON.stringify(matchData));
      
    } else {
      console.log('🧠 [DEBUG] No searchExplanation found in responseData');
      
      // Check if searchExplanation exists but is null
      const hasNullExplanation = match.responseData.rawHit && 
                                 'searchExplanation' in match.responseData.rawHit && 
                                 match.responseData.rawHit.searchExplanation === null;
      
      // Determine the result type for better messaging
      const resultType = match.responseData.type;
      const hitType = match.responseData.rawHit?.__typename;
      
      if (hasNullExplanation) {
        console.log('🧠 [DEBUG] searchExplanation field exists but is NULL - generating AI explanation from available data');
        
        // Create AI explanation using available course data instead of null searchExplanation
        const explanationId = `ai-explanation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const aiToggleId = `toggle-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        content += `
          <div id="${explanationId}" style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(253, 186, 116, 0.12) 100%); border-radius: 10px; border-left: 3px solid #ea580c;">
            <div id="${aiToggleId}-header" data-toggle-id="${aiToggleId}" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 8px;">
              <div style="font-weight: 600; color: #ea580c; font-size: 11px; display: flex; align-items: center;">
                <span>🧠 AI Course Analysis</span>
                <div style="margin-left: 8px; width: 12px; height: 12px; border: 2px solid #ea580c; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              </div>
              <div id="${aiToggleId}-arrow" style="color: #ea580c; font-size: 12px; transform: rotate(0deg); transition: transform 0.2s;">▶</div>
            </div>
            <div id="${aiToggleId}" style="display: none; transition: all 0.3s ease;">
              <div style="padding: 12px; background: rgba(249, 115, 22, 0.1); border-radius: 6px;">
                <div style="font-size: 10px; color: #ea580c;">🤖 Analyzing course data with AI...</div>
                <div style="font-size: 9px; color: #b45309; margin-top: 4px;">Using course metadata (searchExplanation service unavailable)</div>
              </div>
            </div>
          </div>
        `;
        
        // Store fallback mode toggle ID for event listener setup after overlay creation
        overlay.setAttribute('data-fallback-toggle-id', aiToggleId);
        
        // Store available data for AI analysis
        overlay.setAttribute('data-explanation', 'FALLBACK_MODE'); // Special flag
        overlay.setAttribute('data-explanation-id', explanationId);
        overlay.setAttribute('data-course-title', match.cardInfo?.title || 'Unknown Course');
        overlay.setAttribute('data-product-id', match.cardInfo?.productId || 'Unknown');
        
        // Store complete match data as JSON for rich OpenAI context
        const matchData = {
          cardInfo: match.cardInfo,
          responseData: match.responseData ? {
            title: match.responseData.title,
            description: match.responseData.description,
            skills: match.responseData.skills,
            partners: match.responseData.partners,
            averageRating: match.responseData.averageRating,
            numRatings: match.responseData.numRatings,
            isCourseFree: match.responseData.isCourseFree,
            url: match.responseData.url,
            entityType: match.responseData.entityType,
            rawHit: match.responseData.rawHit
          } : null
        };
        overlay.setAttribute('data-match-details', JSON.stringify(matchData));
        
      } else {
        // Show different messages based on result type
        let debugMessage = '';
        let reasonMessage = '';
        
        if (resultType === 'page_extracted_hit') {
          debugMessage = '🔍 Debug: Data from Page Extraction';
          reasonMessage = 'This course data was extracted from the page DOM, not from GraphQL responses. searchExplanation is only available in GraphQL Search_ProductHit data.';
        } else if (resultType === 'accumulated_product_hit') {
          debugMessage = '🔍 Debug: Data from Infinite Scroll';
          reasonMessage = 'This course data comes from infinite scroll/pagination. searchExplanation may not be available in accumulated responses.';
        } else if (hitType && hitType !== 'Search_ProductHit') {
          debugMessage = '🔍 Debug: Non-ProductHit Type';
          reasonMessage = `This is a ${hitType} type result. searchExplanation is only added to Search_ProductHit types by our interceptor.`;
        } else {
          debugMessage = '🔍 Debug: No searchExplanation Found';
          reasonMessage = 'searchExplanation field is missing from this result data.';
        }
        
        // Show debug info about what fields are available
        content += `
          <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(252, 165, 165, 0.12) 100%); border-radius: 10px; border-left: 3px solid #dc2626;">
            <div style="font-weight: 600; color: #dc2626; margin-bottom: 8px; font-size: 11px;">${debugMessage}</div>
            <div style="font-size: 10px; color: #374151; margin-bottom: 6px;">${reasonMessage}</div>
            <div style="font-size: 9px; color: #6b7280; margin-bottom: 4px;"><strong>Result Type:</strong> ${resultType || 'Unknown'}</div>
            <div style="font-size: 9px; color: #6b7280; margin-bottom: 4px;"><strong>Hit Type:</strong> ${hitType || 'Unknown'}</div>
            <div style="font-size: 9px; color: #6b7280;"><strong>Available fields:</strong> ${Object.keys(match.responseData).join(', ')}</div>
          </div>
        `;
      }
    }
  } else {
    console.log('🧠 [DEBUG] No responseData found');
    
    content += `
      <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(252, 165, 165, 0.12) 100%); border-radius: 10px; border-left: 3px solid #dc2626;">
        <div style="font-weight: 600; color: #dc2626; margin-bottom: 8px; font-size: 11px;">🔍 Debug: No ResponseData Found</div>
        <div style="font-size: 10px; color: #374151;">No GraphQL response data available for this card</div>
      </div>
    `;
  }

  // Show GraphQL Response data (the real API results) - COLLAPSIBLE
  if (match.responseData) {
    const rawData = match.responseData.rawHit || match.responseData;
    const toggleId = `toggle-details-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🔽 [DEBUG] Creating collapsible section with toggleId:', toggleId);
    
    content += `
      <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(134, 239, 172, 0.12) 100%); border-radius: 10px; border-left: 3px solid #16a34a;">
        <div id="${toggleId}-header" data-toggle-id="${toggleId}" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
          <div style="font-weight: 600; color: #15803d; font-size: 11px;">✅ Product Object Details</div>
          <div id="${toggleId}-arrow" style="color: #15803d; font-size: 12px; transform: rotate(0deg); transition: transform 0.2s;">▶</div>
        </div>
        <div id="${toggleId}" style="display: none; margin-top: 8px; max-height: 200px; overflow-y: auto; border-top: 1px solid rgba(34, 197, 94, 0.2); padding-top: 8px;">
    `;
    
    // Display all fields from the raw response data
    Object.keys(rawData).forEach(key => {
      if (key === '__typename' || key === 'searchExplanation') return; // Skip typename and searchExplanation (shown above)
      
      let value = rawData[key];
      let displayValue = '';
      
      // Format different data types appropriately
      if (value === null || value === undefined) {
        displayValue = 'null';
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          displayValue = '[]';
        } else if (typeof value[0] === 'string') {
          displayValue = `[${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}]`;
        } else {
          displayValue = `[${value.length} items]`;
        }
      } else if (typeof value === 'object') {
        displayValue = `{${Object.keys(value).length} fields}`;
      } else if (typeof value === 'string' && value.length > 50) {
        displayValue = value.substring(0, 50) + '...';
      } else {
        displayValue = String(value);
      }
      
      // Create clean key name for display
      const cleanKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      
      content += `<div style="margin-bottom: 3px; font-size: 10px; color: #374151;"><strong style="color: #15803d;">${cleanKey}:</strong> ${displayValue}</div>`;
    });
    
    content += `
          ${match.responseData.foundAt ? `<div style="margin-top: 8px; font-size: 9px; color: #64748b;"><strong>Found at:</strong> ${match.responseData.foundAt}</div>` : ''}
        </div>
      </div>
    `;
  } else {
    // Show debugging info for response data
    const hasAnyResponseData = responseData && responseData.data;
    if (hasAnyResponseData) {
      content += `
        <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(252, 165, 165, 0.12) 100%); border-radius: 10px; border-left: 3px solid #dc2626;">
          <div style="font-weight: 600; color: #dc2626; margin-bottom: 8px; font-size: 11px;">❌ Response Data Issues</div>
          <div style="margin-bottom: 4px; font-size: 10px; color: #374151;"><strong style="color: #dc2626;">Status:</strong> Response captured but not matched</div>
          <div style="margin-bottom: 4px; font-size: 10px; color: #374151;"><strong style="color: #dc2626;">Product ID:</strong> ${match.cardInfo.productId}</div>
          <div style="margin-bottom: 4px; font-size: 10px; color: #374151;"><strong style="color: #dc2626;">Debug:</strong> Check console for response structure</div>
        </div>
      `;
    }
  }
  
  // Show API data (GraphQL request info) - simplified to show just search query
  if (match.apiData) {
    // Extract just the search query from the complex request structure
    let searchQuery = 'No query found';
    
    if (match.apiData.query) {
      try {
        // Try to parse the query if it's JSON
        const parsedQuery = JSON.parse(match.apiData.query);
        if (parsedQuery.requests && Array.isArray(parsedQuery.requests)) {
          // Find the PRODUCTS request
          const productsRequest = parsedQuery.requests.find(req => req.entityType === 'PRODUCTS');
          if (productsRequest && productsRequest.query) {
            searchQuery = productsRequest.query;
          }
        }
      } catch (e) {
        // If not JSON, use as is
        searchQuery = match.apiData.query;
      }
    }
    
    content += `
      <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(196, 181, 253, 0.12) 100%); border-radius: 10px; border-left: 3px solid #7c3aed;">
        <div style="font-weight: 600; color: #7c3aed; margin-bottom: 8px; font-size: 11px;">🔍 Search Query</div>
        <div style="margin-bottom: 4px; font-size: 10px; color: #374151;"><strong style="color: #7c3aed;">Query:</strong> ${searchQuery}</div>
      </div>
    `;
  }
  
  // Show Apollo data (cached response)
  if (match.apolloData) {
    content += `
      <div style="margin-bottom: 12px; padding: 12px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(165, 180, 252, 0.12) 100%); border-radius: 10px; border-left: 3px solid #5b21b6;">
        <div style="font-weight: 600; color: #5b21b6; margin-bottom: 8px; font-size: 11px;">💾 Apollo Cache</div>
        <div style="margin-bottom: 4px; font-size: 10px; color: #374151;"><strong style="color: #5b21b6;">Entity:</strong> ${match.apolloData.entityType}</div>
        <div style="margin-bottom: 4px; font-size: 10px; color: #374151;"><strong style="color: #5b21b6;">Rating:</strong> ${match.apolloData.averageRating}</div>
        <div style="margin-bottom: 4px; font-size: 10px; color: #374151;"><strong style="color: #5b21b6;">Partner:</strong> ${match.apolloData.partnerName}</div>
      </div>
    `;
  }
  
  // Show matching status
  if (!match.apiData && !match.apolloData && !match.responseData) {
    content += `
      <div style="margin-top: 8px; padding: 12px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.12) 100%); border-radius: 10px; border-left: 3px solid #d97706;">
        <div style="font-weight: 600; font-size: 11px; color: #d97706;">⚠️ No API Data Found</div>
        <div style="font-size: 10px; margin-top: 4px; color: #374151;">This card couldn't be matched with any API data</div>
      </div>
    `;
  }
  
  overlay.innerHTML = content;
  
  // Add event listeners for toggle functionality after DOM is created
  const toggleHeaders = overlay.querySelectorAll('[data-toggle-id]');
  toggleHeaders.forEach(header => {
    const toggleId = header.getAttribute('data-toggle-id');
    console.log('🔽 [DEBUG] Setting up event listener for toggleId:', toggleId);
    
    header.addEventListener('click', function() {
      console.log('🔽 [DEBUG] Toggle clicked for:', toggleId);
      const content = document.getElementById(toggleId);
      const arrow = document.getElementById(toggleId + '-arrow');
      
      console.log('🔽 [DEBUG] Found elements:', { content: !!content, arrow: !!arrow });
      
      if (content && arrow) {
        if (content.style.display === 'none') {
          content.style.display = 'block';
          arrow.style.transform = 'rotate(90deg)';
          arrow.textContent = '▼';
          console.log('🔽 [DEBUG] Expanded product details');
        } else {
          content.style.display = 'none';
          arrow.style.transform = 'rotate(0deg)';
          arrow.textContent = '▶';
          console.log('🔽 [DEBUG] Collapsed product details');
        }
      } else {
        console.log('🔽 [ERROR] Could not find elements for toggle:', toggleId);
      }
    });
  });
  
  // Setup event listener for fallback mode AI toggle (if present)
  const fallbackToggleId = overlay.getAttribute('data-fallback-toggle-id');
  if (fallbackToggleId) {
    console.log('🔽 [DEBUG] Setting up fallback AI toggle for:', fallbackToggleId);
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const aiHeader = document.getElementById(`${fallbackToggleId}-header`);
      if (aiHeader) {
        aiHeader.addEventListener('click', function() {
          console.log('🔽 [DEBUG] Fallback AI Toggle clicked for:', fallbackToggleId);
          const content = document.getElementById(fallbackToggleId);
          const arrow = document.getElementById(`${fallbackToggleId}-arrow`);
          
          console.log('🔽 [DEBUG] Found fallback AI elements:', { content: !!content, arrow: !!arrow });
          
          if (content && arrow) {
            if (content.style.display === 'none') {
              content.style.display = 'block';
              arrow.style.transform = 'rotate(90deg)';
              arrow.textContent = '▼';
              console.log('🔽 [DEBUG] Expanded fallback AI analysis');
            } else {
              content.style.display = 'none';
              arrow.style.transform = 'rotate(0deg)';
              arrow.textContent = '▶';
              console.log('🔽 [DEBUG] Collapsed fallback AI analysis');
            }
          } else {
            console.log('🔽 [ERROR] Could not find fallback AI elements for toggle:', fallbackToggleId);
          }
        });
      }
    }, 100);
  }
  
  document.body.appendChild(overlay);
  return overlay;
}

// Function to format explanation with OpenAI and update the overlay
async function formatAndUpdateExplanation(overlay) {
  const explanation = overlay.getAttribute('data-explanation');
  const explanationId = overlay.getAttribute('data-explanation-id');
  const courseTitle = overlay.getAttribute('data-course-title');
  const productId = overlay.getAttribute('data-product-id');
  const matchDetailsJson = overlay.getAttribute('data-match-details');
  
  if (!explanationId || !currentSearchQuery || !productId || !matchDetailsJson || 
      (!explanation && explanation !== 'FALLBACK_MODE')) {
    console.log('🤖 [DEBUG] Missing data for OpenAI formatting:', {
      explanation: explanation, 
      explanationId: !!explanationId, 
      currentSearchQuery: !!currentSearchQuery, 
      productId: !!productId,
      matchDetails: !!matchDetailsJson
    });
    return;
  }
  
  try {
    // Parse match details for rich context
    const matchDetails = JSON.parse(matchDetailsJson);
    
    // Create comprehensive product details object
    const productDetails = {
      // Basic info
      productId: productId,
      title: courseTitle,
      partner: matchDetails.cardInfo?.partner || 'Unknown',
      
      // From response data if available
      description: matchDetails.responseData?.description || matchDetails.cardInfo?.description || 'No description available',
      skills: matchDetails.responseData?.skills || [],
      averageRating: matchDetails.responseData?.averageRating || matchDetails.cardInfo?.rating || 'No rating',
      numRatings: matchDetails.responseData?.numRatings || 0,
      isCourseFree: matchDetails.responseData?.isCourseFree || false,
      url: matchDetails.responseData?.url || 'No URL',
      entityType: matchDetails.responseData?.entityType || 'Unknown',
      partners: matchDetails.responseData?.partners || [],
      
      // Raw data for additional context
      rawCardInfo: matchDetails.cardInfo,
      rawResponseData: matchDetails.responseData
    };
    
    // Check if we're in fallback mode or have actual explanation
    const isFallbackMode = explanation === 'FALLBACK_MODE';
    console.log(`🤖 [DEBUG] ${isFallbackMode ? 'Using fallback mode with course metadata' : 'Using searchExplanation data'}`);
    console.log('🔍 [DEBUG] Product details:', productDetails);
    
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'formatExplanation',
        explanation: explanation, // Pass the raw explanation (including 'FALLBACK_MODE')
        productDetails: productDetails,
        searchQuery: currentSearchQuery
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('🤖 [DEBUG] OpenAI formatting result:', result);
    
    const explanationElement = document.getElementById(explanationId);
    if (!explanationElement) {
      console.log('🤖 [DEBUG] Explanation element not found');
      return;
    }
    
    if (result.sections && !result.error) {
      // Create beautiful formatted UI with new sections format
      const sectionColors = {
        '📋': { bg: 'rgba(59, 130, 246, 0.08)', border: '#2563eb', text: '#1d4ed8' },
        '🎯': { bg: 'rgba(34, 197, 94, 0.08)', border: '#16a34a', text: '#15803d' },
        '💡': { bg: 'rgba(59, 130, 246, 0.08)', border: '#2563eb', text: '#1d4ed8' },
        '🔍': { bg: 'rgba(20, 184, 166, 0.08)', border: '#0d9488', text: '#0f766e' },
        '📚': { bg: 'rgba(239, 68, 68, 0.08)', border: '#dc2626', text: '#b91c1c' },
        '📈': { bg: 'rgba(245, 158, 11, 0.08)', border: '#d97706', text: '#b45309' },
        '💫': { bg: 'rgba(139, 92, 246, 0.08)', border: '#7c3aed', text: '#6b21b6' }
      };
      
      // Create cache status indicator with fallback mode support
      let cacheStatus;
      if (result.fallbackMode) {
        if (result.cached) {
          cacheStatus = `<span style="margin-left: 8px; font-size: 9px; background: rgba(139, 92, 246, 0.1); color: #6b21b6; padding: 2px 6px; border-radius: 4px;">💾 ${result.cacheType === 'redis' ? 'Redis' : 'Session'} (Metadata)</span>`;
        } else {
          cacheStatus = `<span style="margin-left: 8px; font-size: 9px; background: rgba(245, 158, 11, 0.1); color: #b45309; padding: 2px 6px; border-radius: 4px;">✨ Fresh (Metadata)</span>`;
        }
      } else {
        if (result.cached) {
          cacheStatus = `<span style="margin-left: 8px; font-size: 9px; background: rgba(59, 130, 246, 0.1); color: #1d4ed8; padding: 2px 6px; border-radius: 4px;">💾 ${result.cacheType === 'redis' ? 'Redis' : 'Session'}</span>`;
        } else {
          cacheStatus = `<span style="margin-left: 8px; font-size: 9px; background: rgba(34, 197, 94, 0.1); color: #15803d; padding: 2px 6px; border-radius: 4px;">✨ Fresh</span>`;
        }
      }
      
      let sectionsHtml = '';
      for (const [sectionKey, content] of Object.entries(result.sections)) {
        if (content && content.trim()) {
          const emoji = sectionKey.split(' ')[0]; // Get emoji from section key
          const colors = sectionColors[emoji] || sectionColors['📋'];
          const sectionName = sectionKey.substring(emoji.length).trim(); // Remove emoji to get clean name
          
          sectionsHtml += `
            <div style="margin-bottom: 10px; padding: 10px; background: linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg}dd 100%); border-radius: 8px; border-left: 3px solid ${colors.border};">
              <div style="font-weight: 600; color: ${colors.text}; margin-bottom: 6px; font-size: 10px;">${sectionKey}</div>
              <div style="font-size: 10px; color: #374151; line-height: 1.5;">${content}</div>
            </div>
          `;
        }
      }
      
      // Add disclaimer for fallback mode
      const fallbackDisclaimer = result.fallbackMode ? `
        <div style="margin-top: 8px; padding: 8px; background: rgba(245, 158, 11, 0.08); border-radius: 6px; border-left: 2px solid #d97706;">
          <div style="font-size: 9px; color: #b45309; display: flex; align-items: center;">
            <span>ℹ️ Analysis based on course metadata</span>
          </div>
          <div style="font-size: 8px; color: #92400e; margin-top: 2px;">Coursera's search explanation service unavailable</div>
        </div>
      ` : '';
      
      // Create collapsible AI explanation section
      const aiToggleId = `toggle-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      explanationElement.innerHTML = `
        <div id="${aiToggleId}-header" data-toggle-id="${aiToggleId}" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 12px;">
          <div style="font-weight: 600; color: #ea580c; font-size: 11px; display: flex; align-items: center;">
            <span>${result.fallbackMode ? '🧠 AI Course Analysis' : '🧠 AI Search Explanation'}</span>
            ${cacheStatus}
          </div>
          <div id="${aiToggleId}-arrow" style="color: #ea580c; font-size: 12px; transform: rotate(0deg); transition: transform 0.2s;">▶</div>
        </div>
        <div id="${aiToggleId}" style="display: none; transition: all 0.3s ease;">
          ${sectionsHtml}
          ${fallbackDisclaimer}
        </div>
      `;
      
      // Add event listener for the AI section toggle functionality
      const aiHeader = document.getElementById(`${aiToggleId}-header`);
      if (aiHeader) {
        aiHeader.addEventListener('click', function() {
          console.log('🔽 [DEBUG] AI Toggle clicked for:', aiToggleId);
          const content = document.getElementById(aiToggleId);
          const arrow = document.getElementById(`${aiToggleId}-arrow`);
          
          console.log('🔽 [DEBUG] Found AI elements:', { content: !!content, arrow: !!arrow });
          
          if (content && arrow) {
            if (content.style.display === 'none') {
              content.style.display = 'block';
              arrow.style.transform = 'rotate(90deg)';
              arrow.textContent = '▼';
              console.log('🔽 [DEBUG] Expanded AI analysis');
            } else {
              content.style.display = 'none';
              arrow.style.transform = 'rotate(0deg)';
              arrow.textContent = '▶';
              console.log('🔽 [DEBUG] Collapsed AI analysis');
            }
          } else {
            console.log('🔽 [ERROR] Could not find AI elements for toggle:', aiToggleId);
          }
        });
      }
      
    } else {
      // Show error state but keep the original explanation as fallback
      const errorMessage = result.sections?.['❌ Error'] || result.error || 'Unknown error occurred';
      
      explanationElement.innerHTML = `
        <div style="font-weight: 600; color: #ea580c; margin-bottom: 8px; font-size: 11px;">🧠 AI Search Explanation</div>
        <div style="margin-bottom: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border-left: 3px solid #dc2626;">
          <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px; font-size: 9px;">⚠️ AI Enhancement Failed</div>
          <div style="font-size: 9px; color: #7f1d1d; margin-bottom: 6px;">${errorMessage}</div>
        </div>
        <div style="padding: 10px; background: rgba(249, 115, 22, 0.1); border-radius: 6px;">
          <div style="font-weight: 600; color: #ea580c; margin-bottom: 6px; font-size: 10px;">📄 Original Explanation:</div>
          <div style="font-size: 10px; color: #374151; line-height: 1.5; white-space: pre-wrap; max-height: 100px; overflow-y: auto;">${explanation}</div>
        </div>
      `;
    }
    
  } catch (error) {
    console.log('🤖 [ERROR] Error formatting explanation:', error);
    
    // Show error state with original explanation
    const explanationElement = document.getElementById(explanationId);
    if (explanationElement) {
      explanationElement.innerHTML = `
        <div style="font-weight: 600; color: #ea580c; margin-bottom: 8px; font-size: 11px;">🧠 AI Search Explanation</div>
        <div style="margin-bottom: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border-left: 3px solid #dc2626;">
          <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px; font-size: 9px;">⚠️ AI Enhancement Error</div>
          <div style="font-size: 9px; color: #7f1d1d; margin-bottom: 6px;">${error.message}</div>
        </div>
        <div style="padding: 10px; background: rgba(249, 115, 22, 0.1); border-radius: 6px;">
          <div style="font-weight: 600; color: #ea580c; margin-bottom: 6px; font-size: 10px;">📄 Original Explanation:</div>
          <div style="font-size: 10px; color: #374151; line-height: 1.5; white-space: pre-wrap; max-height: 100px; overflow-y: auto;">${explanation}</div>
        </div>
      `;
    }
  }
}

// Function to position overlay near the card
function positionOverlay(overlay, card) {
  const cardRect = card.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  
  // Calculate initial position (top-right of card)
  let left = cardRect.right + 10;
  let top = cardRect.top;
  
  // Adjust if overlay would go off-screen
  if (left + overlayRect.width > window.innerWidth) {
    left = cardRect.left - overlayRect.width - 10; // Position to the left
  }
  
  if (top + overlayRect.height > window.innerHeight) {
    top = Math.max(10, cardRect.bottom - overlayRect.height); // Position higher
  }
  
  // Ensure overlay stays within screen bounds
  left = Math.max(10, Math.min(left, window.innerWidth - overlayRect.width - 10));
  top = Math.max(10, Math.min(top, window.innerHeight - overlayRect.height - 10));
  
  overlay.style.left = left + 'px';
  overlay.style.top = top + 'px';
}

// Function to add hover effects to cards
function addHoverEffects(matches) {
  matches.forEach(async (match) => {
    const card = match.cardElement;
    const overlay = await createOverlay(match);
    let hideTimeout = null; // Store timeout reference
    
    // Add visual indicator to card for debugging
    card.style.outline = '1px dashed rgba(76, 175, 80, 0.3)';
    card.style.outlineOffset = '2px';
    
    // Add hover event listeners
    card.addEventListener('mouseenter', (e) => {
      if (isActive) {
        
        // Clear any existing hide timeout
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        
        overlay.style.display = 'block';
        
        // Position overlay after it's visible so we can get its dimensions
        setTimeout(() => {
          positionOverlay(overlay, card);
        }, 10);
        
        // Format explanation with OpenAI if available and enabled
        const hasExplanation = overlay.getAttribute('data-explanation');
        if (hasExplanation && aiExplanationsEnabled) {
          // Add a small delay to let the overlay show first
          setTimeout(() => {
            formatAndUpdateExplanation(overlay);
          }, 200);
        }
        
        // Always update AI display state after overlay is shown
        setTimeout(() => {
          updateOverlayAIDisplay(overlay);
        }, 50);
      }
    });
    
    card.addEventListener('mouseleave', (e) => {
      
      // Set a timeout to hide the overlay after 1 second
      hideTimeout = setTimeout(() => {
        overlay.style.display = 'none';
        hideTimeout = null;
      }, 1000); // 1 second delay
    });
    
    // Optional: Keep overlay visible if user hovers over the overlay itself
    overlay.addEventListener('mouseenter', (e) => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    });
    
    overlay.addEventListener('mouseleave', (e) => {
      
      // Set timeout again when leaving overlay
      hideTimeout = setTimeout(() => {
        overlay.style.display = 'none';
        hideTimeout = null;
      }, 1000); // 1 second delay
    });
    
    // Update position on scroll
    window.addEventListener('scroll', () => {
      if (overlay.style.display === 'block') {
        positionOverlay(overlay, card);
      }
    });
    
    overlays.push(overlay);
  });
}

// Function to process search results
function processSearchResults() {
  if (!isActive) return;
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`🔍 [${timestamp}] processSearchResults called`);
  
  // Check for any existing searchExplanation elements on the page
  const possibleExplanationElements = document.querySelectorAll('[data-testid*="explanation"], [class*="explanation"], [class*="search-explanation"], [data-testid*="search-explanation"]');
  if (possibleExplanationElements.length > 0) {
    console.log('🧠 [DEBUG] Found potential explanation elements on page:', possibleExplanationElements.length);
  }
  
  // Clean up existing overlays first
  cleanupOverlays();
  
  const apiResults = searchData ? extractSearchResultsFromAPI(searchData) : [];
  const responseResults = responseData ? extractSearchResultsFromResponse(responseData) : [];
  const apolloResults = extractSearchResultsFromApollo();
  
  console.log(`🔍 [${timestamp}] Response extraction returned:`, responseResults.length, 'results');
  
  const cards = findProductCards();
  productCards = cards;
  
  // Track card detection over time
  cardDetectionHistory.push({
    timestamp: timestamp,
    cardCount: cards.length,
    responseCount: responseResults.length
  });
  
  
  if (cards.length === 0) {
    console.log(`❌ [${timestamp}] No cards found, skipping processing`);
    return;
  }
  console.log('🔍 Response responseResults:', responseResults);
  // Debug: Show available response IDs vs card IDs
  const responseIds = responseResults.map(r => r.id).filter(Boolean);
  const cardIds = [];

  console.log('🔍 Response IDs:', responseIds);

  cards.forEach((card, index) => {
    const productData = extractProductIdFromCard(card);
    if (productData) {
      cardIds.push(productData.objectID || productData.slug || `card-${index}`);
    }
  });
  
  console.log(`🔍 Available response IDs (${responseIds.length}):`, responseIds);
  console.log(`🔍 Looking for card IDs (${cardIds.length}):`, cardIds);
  
  // Debug: Show first few response results structure
  if (responseResults.length > 0) {
    console.log(`📊 Sample response results:`, responseResults.slice(0, 3).map(r => ({
      type: r.type,
      id: r.id,
      objectID: r.objectID,
      title: r.title,
      foundAt: r.foundAt
    })));
  }
  
  // Debug: Show first few card IDs and their product data
  if (cardIds.length > 0) {
    console.log(`📊 Sample card data:`, cards.slice(0, 3).map((card, index) => ({
      index: index,
      productData: extractProductIdFromCard(card),
      title: card.querySelector('h3, h2, h1')?.textContent?.trim()?.substring(0, 50) || 'No title'
    })));
  }
  
  // Find missing IDs
  const missingIds = cardIds.filter(cardId => !responseIds.includes(cardId));
  if (missingIds.length > 0) {
    console.log(`❌ Missing IDs (${missingIds.length}):`, missingIds);
  } else {
    console.log(`✅ All card IDs found in response data!`);
  }
  
  // Match cards with data
  const matches = matchCardsWithData(cards, apiResults, apolloResults, responseResults);
  console.log(`🔗 Created ${matches.length} matches`);
  
  // Debug: Show how many matches have response data
  const matchesWithResponse = matches.filter(m => m.responseData);
  const matchesWithoutResponse = matches.filter(m => !m.responseData);
  
  // Emergency debug: Show what's actually being compared
  if (matchesWithoutResponse.length > 0 && responseResults.length > 0) {
    
    // Show first few card IDs and their extraction
    console.log(`📋 First 3 card IDs extracted:`);
    matchesWithoutResponse.slice(0, 3).forEach((match, idx) => {
      const productData = extractProductIdFromCard(match.cardElement);
      console.log(`   Card ${idx + 1}:`, {
        productData: productData,
        title: match.cardInfo?.title?.substring(0, 30) || 'No title'
      });
    });
    
    // Show first few response IDs
    console.log(`📋 First 3 response IDs available:`);
    responseResults.slice(0, 3).forEach((result, idx) => {
      console.log(`   Response ${idx + 1}:`, {
        id: result.id,
        objectID: result.objectID,
        title: result.title?.substring(0, 30) || 'No title',
        type: result.type
      });
    });
    
    // Try to manually match first card with first response
    const firstCard = matchesWithoutResponse[0];
    const firstResponse = responseResults[0];
    const cardProductData = extractProductIdFromCard(firstCard.cardElement);
    
    console.log(`🔍 Manual matching test:`, {
      cardObjectID: cardProductData?.objectID,
      responseObjectID: firstResponse?.objectID,
      responseId: firstResponse?.id,
      cardType: cardProductData?.type,
      responseType: firstResponse?.type,
      exactMatch: cardProductData?.objectID === firstResponse?.objectID,
      idMatch: cardProductData?.objectID === firstResponse?.id
    });
  }
  
  // Debug: Show sample matches
  if (matchesWithResponse.length > 0) {
    console.log(`📊 Sample matches WITH response:`, matchesWithResponse.slice(0, 2).map(m => ({
      index: m.index,
      cardProductId: m.cardInfo?.productId,
      responseId: m.responseData?.id || m.responseData?.objectID,
      responseType: m.responseData?.type
    })));
  }
  
  if (matchesWithoutResponse.length > 0) {
    console.log(`📊 Sample matches WITHOUT response:`, matchesWithoutResponse.slice(0, 2).map(m => ({
      index: m.index,
      cardProductId: m.cardInfo?.productId,
      hasProductData: !!m.cardInfo?.productData
    })));
  }
  
  addHoverEffects(matches);
  
  console.log(`✅ [${timestamp}] Extension ready! Found ${cards.length} cards, ${matches.filter(m => m.responseData).length} matched`);
}

// Function to clean up overlays
function cleanupOverlays() {
  // Remove all existing overlays
  overlays.forEach(overlay => {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  });
  
  // Clear the overlays array
  overlays = [];
  
  // Remove debug outlines from cards
  productCards.forEach(card => {
    if (card) {
      card.style.outline = '';
      card.style.outlineOffset = '';
    }
  });
  
  // Remove all existing coursera overlays (in case any were missed)
  const existingOverlays = document.querySelectorAll('.coursera-search-overlay');
  existingOverlays.forEach(overlay => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  });
  
  console.log('🧹 Cleaned up overlays and outlines');
}

// Function to toggle extension
function toggleExtension() {
  isActive = !isActive;
  if (!isActive) {
    cleanupOverlays();
  } else {
    setTimeout(processSearchResults, 1000);
  }
}

// Function to toggle AI explanations
function toggleAIExplanations() {
  aiExplanationsEnabled = !aiExplanationsEnabled;
  console.log('🧠 AI explanations toggled:', aiExplanationsEnabled ? 'ON' : 'OFF');
  
  // Update all existing overlays
  overlays.forEach(overlay => {
    updateOverlayAIDisplay(overlay);
  });
  
  // If AI is enabled and there are overlays, process them
  if (aiExplanationsEnabled) {
    overlays.forEach(overlay => {
      const hasExplanation = overlay.getAttribute('data-explanation');
      if (hasExplanation && overlay.style.display === 'block') {
        setTimeout(() => {
          formatAndUpdateExplanation(overlay);
        }, 100);
      }
    });
  }
}

// Function to update AI display in overlay based on toggle state
function updateOverlayAIDisplay(overlay) {
  // Find AI explanation elements in the overlay
  const aiElements = overlay.querySelectorAll('[id*="ai-explanation"]');
  const aiSections = Array.from(overlay.querySelectorAll('div')).filter(div => 
    div.textContent.includes('🧠 AI') || div.textContent.includes('AI Course Analysis') || div.textContent.includes('AI Search Explanation')
  );
  
  // Show/hide AI elements based on toggle state
  [...aiElements, ...aiSections].forEach(element => {
    if (element) {
      element.style.display = aiExplanationsEnabled ? 'block' : 'none';
    }
  });
  
  // If AI is disabled, also hide loading states
  if (!aiExplanationsEnabled) {
    const loadingElements = overlay.querySelectorAll('div');
    Array.from(loadingElements).forEach(element => {
      if (element.textContent.includes('Analyzing with AI') || element.textContent.includes('🤖')) {
        element.style.display = 'none';
      }
    });
  }
  
  // Add or update AI toggle indicator in overlay
  let toggleIndicator = overlay.querySelector('.ai-toggle-indicator');
  if (!toggleIndicator) {
    toggleIndicator = document.createElement('div');
    toggleIndicator.className = 'ai-toggle-indicator';
    toggleIndicator.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: ${aiExplanationsEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)'};
      color: ${aiExplanationsEnabled ? '#15803d' : '#6b7280'};
      border: 1px solid ${aiExplanationsEnabled ? '#16a34a' : '#9ca3af'};
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 9px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    toggleIndicator.title = 'Click to toggle AI explanations (Alt+A)';
    
    // Add click handler
    toggleIndicator.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAIExplanations();
    });
    
    overlay.appendChild(toggleIndicator);
  }
  
  // Update indicator content and style
  toggleIndicator.textContent = aiExplanationsEnabled ? '🧠 AI ON' : '🧠 AI OFF';
  toggleIndicator.style.background = aiExplanationsEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)';
  toggleIndicator.style.color = aiExplanationsEnabled ? '#15803d' : '#6b7280';
  toggleIndicator.style.borderColor = aiExplanationsEnabled ? '#16a34a' : '#9ca3af';
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchCaptured') {
    console.log('🎯 Search request captured:', request.data);
    searchData = request.data;
    
    // Use debounced processing instead of immediate processing
    debouncedProcessSearchResults();
  } else if (request.action === 'toggle') {
    toggleExtension();
  }
});

// Listen for keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && e.key === 'c') {
    toggleExtension();
  }
  
  // Alt + A to toggle AI explanations
  if (e.altKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    toggleAIExplanations();
    
    // Show toast notification
    showToast(`AI explanations ${aiExplanationsEnabled ? 'enabled' : 'disabled'}`);
  }
  
  // Alt + E to toggle extension
  if (e.altKey && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    toggleExtension();
    
    // Show toast notification
    showToast(`Extension ${isActive ? 'enabled' : 'disabled'}`);
  }
});

// Function to show toast notifications
function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.95) 0%, rgba(234, 88, 12, 0.95) 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);
  
  // Remove after 2 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2000);
}

// Initialize when page loads
console.log('⌨️ [DEBUG] Keyboard shortcuts available:');
console.log('   Alt+E: Toggle extension on/off');
console.log('   Alt+A: Toggle AI explanations on/off');
console.log('   Ctrl+Alt+C: Legacy extension toggle');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectResponseInterceptor();
    setTimeout(processSearchResults, 2000);
  });
} else {
  injectResponseInterceptor();
  setTimeout(processSearchResults, 2000);
}

// Re-process when page content changes (for dynamic loading)
const observer = new MutationObserver((mutations) => {
  let shouldReprocess = false;
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType === 1 && (
          node.querySelector && (
            node.querySelector('a[href*="/learn/"]') ||
            node.querySelector('a[href*="/browse/"]') ||
            node.querySelector('a[href*="/professional-certificates/"]')
          )
        )) {
          shouldReprocess = true;
          break;
        }
      }
    }
  });
  
  if (shouldReprocess) {
    cleanupOverlays();
    setTimeout(processSearchResults, 1000);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('🎯 [DEBUG] ============================================');
console.log('🎯 [DEBUG] Coursera Search Intelligence Starting...');
console.log('🎯 [DEBUG] ============================================');
console.log('🎯 [DEBUG] Extension Version: 2.0 (Toggle Fixed with Event Listeners - No More Onclick)');
console.log('🎯 [DEBUG] Current URL:', window.location.href);
console.log('🎯 [DEBUG] Redis API Mode: Background Script (localhost:8080)');
console.log('🎯 [DEBUG] User Agent:', navigator.userAgent);
console.log('🎯 [DEBUG] Page loaded, starting API check...');

console.log('🔽 [DEBUG] Toggle functionality will be set up via event listeners');

// Start Redis API check immediately
checkRedisAPI().then(available => {
  console.log('🎯 [DEBUG] Initial API check complete:', available ? 'SUCCESS ✅' : 'FAILED ❌');
});

console.log('🎯 Coursera Search Intelligence loaded! Hover over course cards to see API vs Card data comparison.');

// Check what's in the individual responses before combining
console.log('=== RAW RESPONSES DEBUG ===');
console.log('allResponses count:', window.allResponses?.length);

if (window.allResponses && window.allResponses.length > 0) {
  window.allResponses.forEach((resp, index) => {
    console.log(`Response ${index + 1}:`, {
      url: resp.url,
      hasData: !!resp.data,
      dataStructure: resp.data ? Object.keys(resp.data) : 'none'
    });
    
    // Check the path to elements in this individual response
    const elements = resp.data?.data?.[0]?.data?.SearchResult?.search?.[0]?.elements;
    console.log(`Response ${index + 1} elements:`, elements?.length || 0);
    
    if (elements && elements.length > 0) {
      console.log(`Response ${index + 1} first element:`, elements[0]);
    }
  });
}

// Initialize Redis API and search query detection
setTimeout(() => {
  console.log('🚀 Initializing Redis integration...');
  checkRedisAPI();
  extractSearchQuery();
}, 1000);

console.log('✅ Coursera Search Intelligence with Redis integration loaded!');