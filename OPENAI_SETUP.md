# OpenAI Integration Setup

## 🚀 Setup Instructions

To enable AI-enhanced searchExplanation formatting, you need to configure your OpenAI API key.

### 1. Get OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key and copy it

### 2. Configure the Extension
1. Open `background.js` in your extension folder
2. Find this line:
   ```javascript
   const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';
   ```
3. Replace `'YOUR_OPENAI_API_KEY_HERE'` with your actual API key:
   ```javascript
   const OPENAI_API_KEY = 'sk-your-actual-api-key-here';
   ```

### 3. Reload Extension
1. Go to `chrome://extensions/` (or `opera://extensions/`)
2. Find "Coursera Search Explainer"
3. Click the reload button

## 🎨 What You'll See

Once configured, when you hover over course cards with searchExplanation data:

1. **Loading State**: Shows "🤖 Analyzing with AI..." with a spinning loader
2. **Enhanced Display**: 
   - **Summary**: One-sentence overview of the match
   - **Key Points**: Categorized reasons (Relevance, Skills, Content, Level, Format) with confidence indicators
   - **Recommendation**: Personalized advice about the course
   - **Color-coded categories**: Each category has its own color scheme

## 🔧 Features

- **Intelligent Analysis**: OpenAI analyzes the raw searchExplanation and structures it
- **Visual Categories**: Color-coded categories for easy scanning
- **Confidence Indicators**: 🎯 High, ✅ Medium, 💡 Low confidence
- **Fallback Support**: Shows original explanation if AI enhancement fails
- **Cost-Efficient**: Uses GPT-3.5-turbo with optimized prompts

## 💰 Costs

- Uses OpenAI GPT-3.5-turbo model
- Approximate cost: $0.001-0.002 per explanation (very low)
- Only calls API when hovering over cards with searchExplanation data

## 🚫 Without API Key

If no API key is configured, the extension will:
- Show the original searchExplanation (still functional!)
- Display a brief error message about missing API key
- All other features continue to work normally

## 🛠️ Troubleshooting

**Error: "OpenAI API key not configured"**
- Make sure you've replaced the placeholder with your actual API key
- Reload the extension after making changes

**Error: "OpenAI API error: 401"**
- Your API key might be invalid or expired
- Check your OpenAI account and regenerate the key if needed

**Error: "OpenAI API error: 429"**
- You've hit rate limits
- Wait a moment and try again, or upgrade your OpenAI plan 