// interceptor.js - GraphQL Request/Response Interceptor
(function() {
  console.log('🔍 GraphQL request/response interceptor loaded');

  // Store original functions
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  // Flag to disable query modification if we detect schema errors
  let queryModificationEnabled = true;
  
  // Reset query modification to enabled with the working cookie
  console.log('🔄 Resetting query modification to enabled with working ASG_PREFERENCE cookie');

  // Function to modify GraphQL query to include searchExplanation
  function addSearchExplanationToQuery(queryString) {
    try {
      console.log('🔍 Analyzing GraphQL query:', queryString.substring(0, 200) + '...');
      
      // Check if query modification is disabled due to schema errors
      if (!queryModificationEnabled) {
        console.log('⚠️ Query modification disabled due to previous schema errors');
        return queryString;
      }
      
      // Check if query contains Search_ProductHit
      if (queryString.includes('Search_ProductHit')) {
        console.log('✅ Found Search_ProductHit in query');
        
        // Check if searchExplanation is already present
        if (queryString.includes('searchExplanation')) {
          console.log('⚠️ searchExplanation already present in query');
          return queryString;
        }
        
        console.log('🔧 Adding searchExplanation field to GraphQL query');
        
                         // Find ONLY the SearchProductHit fragment and add searchExplanation specifically to Search_ProductHit type
        const searchProductHitStart = queryString.indexOf('fragment SearchProductHit on Search_ProductHit {');
        const nextFragmentStart = queryString.indexOf('fragment SearchSuggestionHit', searchProductHitStart);
        
        if (searchProductHitStart !== -1 && nextFragmentStart !== -1) {
          console.log('🎯 Found SearchProductHit fragment boundaries');
          
          const searchProductHitFragment = queryString.substring(searchProductHitStart, nextFragmentStart);
          
          // Validate this is specifically the Search_ProductHit type fragment
          if (!searchProductHitFragment.includes('on Search_ProductHit')) {
            console.log('❌ Fragment is not for Search_ProductHit type, skipping');
            return queryString;
          }
          
          console.log('✅ Confirmed this is Search_ProductHit type fragment');
          console.log('🔍 SearchProductHit fragment:', searchProductHitFragment.substring(0, 300) + '...');
          
          // Ensure we don't already have searchExplanation in this fragment
          if (searchProductHitFragment.includes('searchExplanation')) {
            console.log('⚠️ searchExplanation already exists in SearchProductHit fragment');
            return queryString;
          }
          
          // Look for tagline field followed by __typename in this specific fragment
          const taglinePattern = /(tagline[\s\n]*?)(__typename[\s\n]*\})/;
          const taglineMatch = searchProductHitFragment.match(taglinePattern);
          
          if (taglineMatch) {
            console.log('🎯 Found tagline field in SearchProductHit fragment - adding searchExplanation');
            
            const searchExplanationFields = `
  searchExplanation`;
            
            // Insert searchExplanation after tagline and before __typename
            const modifiedFragment = searchProductHitFragment.replace(
              taglinePattern,
              taglineMatch[1] + searchExplanationFields + '\n  ' + taglineMatch[2]
            );
            
            // Replace the original fragment with the modified one
            const modifiedQuery = queryString.replace(searchProductHitFragment, modifiedFragment);
            
            console.log('✅ Successfully added searchExplanation ONLY to Search_ProductHit type');
            
            // Verify no other fragments were modified (more precise check)
            const otherFragments = ['SearchArticleHit', 'SearchSuggestionHit'];
            otherFragments.forEach(fragName => {
              const fragmentStart = modifiedQuery.indexOf(`fragment ${fragName}`);
              if (fragmentStart !== -1) {
                const nextFragmentStart = modifiedQuery.indexOf('fragment ', fragmentStart + 1);
                const fragmentEnd = nextFragmentStart !== -1 ? nextFragmentStart : modifiedQuery.length;
                const fragmentContent = modifiedQuery.substring(fragmentStart, fragmentEnd);
                if (fragmentContent.includes('searchExplanation')) {
                  console.warn(`⚠️ WARNING: searchExplanation was incorrectly added to ${fragName} fragment!`);
                }
              }
            });
            
            console.log('🔍 Verification: searchExplanation added only to SearchProductHit');
            
            return modifiedQuery;
          } else {
            console.log('❌ Could not find tagline field in SearchProductHit fragment');
          }
                   } else {
            console.log('❌ SearchProductHit fragment not found with expected pattern');
            // Log the query structure for debugging
            console.log('🔍 Full query for analysis:', queryString);
          }
      } else {
        console.log('⚠️ No Search_ProductHit found in query');
      }
    } catch (error) {
      console.log('❌ Error modifying query:', error);
    }
    
    return queryString;
  }

  // Function to get ASG_PREFERENCE cookie value
  function getASGPreferenceCookie() {
    // Use the working ASG_PREFERENCE cookie value provided by user
    const workingCookieValue = 'OUa4MygnNGqcoslY7e5THZuX2P39LaLS_LA5i-qmYhcTqHpkJdrxBD-O4UoAlXoiE0GCU4tmeU0oxhoKR43sXw.6s8g23CnGITnznQjpLc8Fw.bBVcjDmAhu1S5kwdKWogAFRu9Nkj-1JUpWb-pf7yGTUsuZiDqZxLoItaesdwTYUAbdwkpr8zcDa4eIyBfpKOIzXCsg4jyBIBNsvKD7whK771xxtX7B17TlcKm-Zl1xzV5lQYYxQxaq55NfRPH-TESy-GofoVgjVFdnY1mP24Y44';
    
    console.log('🍪 Using hardcoded ASG_PREFERENCE cookie:', workingCookieValue.substring(0, 20) + '...');
    return workingCookieValue;
    
    // Fallback to reading from document.cookie (commented out for debugging)
    /*
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'ASG_PREFERENCE') {
        return value;
      }
    }
    return null;
    */
  }

  // Function to check for COURSERIAN cookie (required for devGatewayGql)
  function checkCourserianCookie() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'COURSERIAN') {
        console.log('✅ COURSERIAN cookie found - devGatewayGql access granted');
        return true;
      }
    }
    console.log('⚠️ COURSERIAN cookie not found - you may need to log in to tools.coursera.org');
    return false;
  }

  // Override fetch
  window.fetch = function(...args) {
    const [url, options] = args;
    
    // Intercept outgoing GraphQL requests
    if (url && url.includes('graphql') && options && options.body) {
      
      // Add ASG_PREFERENCE cookie to ensure we hit the right deployment
      const asgPreference = getASGPreferenceCookie();
      console.log('🍪 ASG_PREFERENCE cookie value:', asgPreference);
      
      if (asgPreference && options.headers) {
        // Make sure the cookie is included in the request
        const currentCookies = options.headers.cookie || options.headers.Cookie || '';
        if (!currentCookies.includes('ASG_PREFERENCE')) {
          options.headers.cookie = currentCookies ? `${currentCookies}; ASG_PREFERENCE=${asgPreference}` : `ASG_PREFERENCE=${asgPreference}`;
          console.log('🍪 Added ASG_PREFERENCE to request headers');
        }
      }
      try {
        const bodyData = JSON.parse(options.body);
        console.log('🔍 Request body structure:', bodyData);
        console.log('📦 ORIGINAL REQUEST BODY:', JSON.stringify(bodyData, null, 2));
        
        // Handle array of GraphQL operations (Coursera's format)
        if (Array.isArray(bodyData)) {
          let modified = false;
          const modifiedBodyData = bodyData.map(operation => {
            if (operation.query) {
              const modifiedQuery = addSearchExplanationToQuery(operation.query);
              if (modifiedQuery !== operation.query) {
                console.log('🚀 Modified GraphQL operation:', operation.operationName);
                console.log('🔧 Adding devGatewayGql context for schema access');
                checkCourserianCookie();
                modified = true;
                return {
                  ...operation,
                  query: modifiedQuery,
                  context: {
                    ...operation.context,
                    clientName: 'devGatewayGql',
                    schemaVersion: 'cluster:search-application-vpcprodpreview-1685'
                  }
                };
              }
            }
            return operation;
          });
          
          if (modified) {
            console.log('🚀 Sending modified GraphQL request with searchExplanation');
            console.log('📦 EXACT MODIFIED REQUEST BODY:', JSON.stringify(modifiedBodyData, null, 2));
            console.log('📦 EXACT MODIFIED REQUEST (stringified):', JSON.stringify(modifiedBodyData));
            console.log('🍪 FINAL REQUEST COOKIES:', options.headers?.cookie || options.headers?.Cookie || 'No cookies');
            options.body = JSON.stringify(modifiedBodyData);
          }
        }
        // Handle single GraphQL operation (standard format)
        else if (bodyData.query) {
          const modifiedQuery = addSearchExplanationToQuery(bodyData.query);
          if (modifiedQuery !== bodyData.query) {
            console.log('🚀 Sending modified GraphQL query with searchExplanation');
            console.log('🔧 Adding devGatewayGql context for schema access');
            options.body = JSON.stringify({
              ...bodyData,
              query: modifiedQuery,
              context: {
                ...bodyData.context,
                clientName: 'devGatewayGql',
                schemaVersion: 'cluster:search-application-vpcprodpreview-1685'
              }
            });
          }
        }
      } catch (e) {
        console.log('⚠️ Could not parse request body:', e);
      }
    }
    
    return originalFetch.apply(this, args).then(response => {
      // Check if this is a GraphQL request
      if (url && url.includes('graphql')) {
        console.log('🎯 Intercepted GraphQL fetch response:', url);
        
        // Clone response to read it
        const clonedResponse = response.clone();
        
        clonedResponse.json().then(data => {
          console.log('📦 GraphQL fetch response data:', data);
          
          // Check for GraphQL errors, especially related to searchExplanation
          if (data.errors) {
            console.log('🚨 GraphQL Errors detected:');
            data.errors.forEach((error, index) => {
              console.log(`  Error ${index + 1}:`, error.message);
              if (error.message.includes('searchExplanation')) {
                console.log('  🎯 This error is related to searchExplanation field!');
                console.log('  💡 The field might not be available in production schema yet.');
                console.log('  🔧 Disabling query modification to prevent further errors.');
                queryModificationEnabled = false;
              }
            });
          }
          
          // Send to content script
          window.postMessage({
            type: 'GRAPHQL_RESPONSE_INTERCEPTED',
            url: url,
            response: data,
            method: 'fetch',
            timestamp: Date.now()
          }, '*');
        }).catch(err => {
          console.log('❌ Error reading fetch response:', err);
        });
      }
      
      return response;
    });
  };

  // Override XMLHttpRequest
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._interceptor_url = url;
    this._interceptor_method = method;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const url = this._interceptor_url;
    
    // Intercept outgoing GraphQL requests
    if (url && url.includes('graphql') && body) {
      
      // Add ASG_PREFERENCE cookie to ensure we hit the right deployment
      const asgPreference = getASGPreferenceCookie();
      console.log('🍪 XHR ASG_PREFERENCE cookie value:', asgPreference);
      
      if (asgPreference) {
        // Get existing cookie header or create new one
        const existingCookies = this.getRequestHeader('Cookie') || '';
        if (!existingCookies.includes('ASG_PREFERENCE')) {
          const newCookieHeader = existingCookies ? `${existingCookies}; ASG_PREFERENCE=${asgPreference}` : `ASG_PREFERENCE=${asgPreference}`;
          this.setRequestHeader('Cookie', newCookieHeader);
          console.log('🍪 Added ASG_PREFERENCE to XHR request headers');
        }
      }
      try {
        const bodyData = JSON.parse(body);
        console.log('🔍 XHR Request body structure:', bodyData);
        console.log('📦 ORIGINAL XHR REQUEST BODY:', JSON.stringify(bodyData, null, 2));
        
        // Handle array of GraphQL operations (Coursera's format)
        if (Array.isArray(bodyData)) {
          let modified = false;
          const modifiedBodyData = bodyData.map(operation => {
            if (operation.query) {
              const modifiedQuery = addSearchExplanationToQuery(operation.query);
              if (modifiedQuery !== operation.query) {
                console.log('🚀 Modified GraphQL XHR operation:', operation.operationName);
                console.log('🔧 Adding devGatewayGql context for schema access');
                modified = true;
                return {
                  ...operation,
                  query: modifiedQuery,
                  context: {
                    ...operation.context,
                    clientName: 'devGatewayGql',
                    schemaVersion: 'cluster:search-application-vpcprodpreview-1685'
                  }
                };
              }
            }
            return operation;
          });
          
          if (modified) {
            console.log('🚀 Sending modified GraphQL XHR request with searchExplanation');
            console.log('📦 EXACT MODIFIED XHR REQUEST BODY:', JSON.stringify(modifiedBodyData, null, 2));
            console.log('📦 EXACT MODIFIED XHR REQUEST (stringified):', JSON.stringify(modifiedBodyData));
            console.log('🍪 FINAL XHR REQUEST COOKIES:', this.getRequestHeader('Cookie') || 'No cookies');
            arguments[0] = JSON.stringify(modifiedBodyData);
          }
        }
        // Handle single GraphQL operation (standard format)
        else if (bodyData.query) {
          const modifiedQuery = addSearchExplanationToQuery(bodyData.query);
          if (modifiedQuery !== bodyData.query) {
            console.log('🚀 Sending modified GraphQL XHR query with searchExplanation');
            console.log('🔧 Adding devGatewayGql context for schema access');
            // Modify the body for this request
            arguments[0] = JSON.stringify({
              ...bodyData,
              query: modifiedQuery,
              context: {
                ...bodyData.context,
                clientName: 'devGatewayGql',
                schemaVersion: 'cluster:search-application-vpcprodpreview-1685'
              }
            });
          }
        }
      } catch (e) {
        console.log('⚠️ Could not parse XHR request body:', e);
      }
    }
    
    if (url && url.includes('graphql')) {
      console.log('🎯 Intercepted GraphQL XHR request:', url);
      
      // Hook into response
      this.addEventListener('load', () => {
        try {
          if (this.responseText) {
            const data = JSON.parse(this.responseText);
            console.log('📦 GraphQL XHR response data:', data);
            
            // Send to content script
            window.postMessage({
              type: 'GRAPHQL_RESPONSE_INTERCEPTED',
              url: url,
              response: data,
              method: 'xhr',
              timestamp: Date.now()
            }, '*');
          }
        } catch (e) {
          console.log('❌ Error parsing XHR response:', e);
        }
      });
    }
    
    return originalXHRSend.apply(this, arguments);
  };

  console.log('✅ GraphQL request/response interceptor ready');
})(); 