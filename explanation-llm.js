// explanation-llm.js - Simple LLM-based explanation formatter

function formatExplanationForLLM(searchHit) {
  if (!searchHit._explanation) {
    return null;
  }
  
  return {
    score: searchHit._score,
    explanation: searchHit._explanation,
    source: searchHit._source,
    index: searchHit._index,
    id: searchHit._id
  };
}

function createExplanationPrompt(searchHit) {
  const data = formatExplanationForLLM(searchHit);
  if (!data) return null;
  
  return `Please explain this OpenSearch result in simple terms:

**Search Result Score:** ${data.score}

**Raw Explanation:**
${JSON.stringify(data.explanation, null, 2)}

**Source Data:**
${JSON.stringify(data.source, null, 2)}

Please explain:
1. Why this result got this score
2. What factors contributed most to the ranking
3. How the different components (popularity, relevance, etc.) affected the final score
4. Any interesting insights about the search algorithm

Keep the explanation concise and focused on the most important factors.`;
}

// Usage example
function getExplanationFromLLM(searchHit) {
  const prompt = createExplanationPrompt(searchHit);
  if (!prompt) return "No explanation available";
  
  // In a real implementation, you would send this to your LLM service
  // For now, just return the formatted prompt
  return prompt;
}

// Export for use in browser extension
if (typeof window !== 'undefined') {
  window.formatExplanationForLLM = formatExplanationForLLM;
  window.createExplanationPrompt = createExplanationPrompt;
  window.getExplanationFromLLM = getExplanationFromLLM;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatExplanationForLLM, createExplanationPrompt, getExplanationFromLLM };
} 