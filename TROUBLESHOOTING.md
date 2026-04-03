# NextFlow Troubleshooting Guide

## 🔴 API Key Issues

### Problem: "Quota exceeded" error even with new API key

**Symptoms:**
- Error: `[429 Too Many Requests] You exceeded your current quota`
- No requests showing in Google AI Studio
- New API key not being used

**Root Causes:**
1. **Old API key cached in Trigger.dev environment variables**
2. **Browser cache storing old workflow data**
3. **Database has old workflows with old API keys**

**Solutions:**

#### Step 1: Clear Trigger.dev Environment Variables
1. Go to [Trigger.dev Dashboard](https://cloud.trigger.dev)
2. Navigate to your project
3. Click **Environment Variables**
4. **DELETE** the old `GEMINI_API_KEY` variable (if it exists)
5. **DO NOT** add a new one - users provide their own keys now

#### Step 2: Clear Local Environment
1. Open `.env` file
2. Make sure `GEMINI_API_KEY` is commented out or removed:
   ```bash
   # GEMINI_API_KEY=  # <-- Should be commented or removed
   ```
3. Restart both terminals:
   ```bash
   # Terminal 1
   npm run dev
   
   # Terminal 2
   npm run trigger
   ```

#### Step 3: Clear Browser Cache & Workflow Data
1. In your browser, open DevTools (F12)
2. Go to **Application** → **Storage** → **Clear site data**
3. Refresh the page
4. Delete old workflows and create a new one
5. Add a fresh LLM node with your NEW API key

#### Step 4: Verify API Key in Google AI Studio
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Check your API key status
3. Verify quota limits
4. If needed, create a **brand new** API key

---

## 🟡 Limited Model Options

### Problem: Only seeing old Gemini models

**Solution:** The code has been updated to include:

**Latest Gemini Models:**
- ✅ Gemini 2.0 Flash Experimental
- ✅ Gemini 2.0 Flash Thinking
- ✅ Gemini Experimental 1206
- ✅ Gemini 2.0 Flash
- ✅ Gemini 1.5 Flash
- ✅ Gemini 1.5 Flash-8B
- ✅ Gemini 1.5 Pro

**After the fix, refresh your browser and create a new LLM node.**

---

## 🟢 Multi-Provider Support

### Now Supporting Multiple LLM Providers

The LLM node now supports:

1. **Google Gemini** (default)
   - Use your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

2. **OpenAI**
   - Use your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Models: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo

3. **Anthropic Claude**
   - Use your Claude API key from [Anthropic Console](https://console.anthropic.com/)
   - Models: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus

4. **Amazon Bedrock**
   - Requires AWS credentials setup (coming soon)
   - Models: Claude 3.5 on Bedrock, Amazon Nova

### How to Use Different Providers

1. Add an LLM node to your workflow
2. Select **Provider** dropdown (Gemini, OpenAI, Claude, Bedrock)
3. Enter your API key for that provider
4. Select the model from the updated model list
5. The model dropdown automatically updates based on provider

---

## 🔧 Common Fixes

### Fix 1: API Key Not Being Used

**Check these locations:**
- ✅ LLM node has API key filled in
- ✅ Trigger.dev environment variables are clear (no old keys)
- ✅ `.env` file has no `GEMINI_API_KEY` set
- ✅ Workflow is saved after adding API key

### Fix 2: Models Not Updating

**Steps:**
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Delete old LLM nodes
4. Add new LLM node
5. You should see new models

### Fix 3: Provider Selection Not Working

**Steps:**
1. Make sure you've pulled latest code changes
2. Restart both dev servers:
   ```bash
   npm run dev
   npm run trigger
   ```
3. Create a NEW workflow
4. Add a fresh LLM node
5. Provider dropdown should appear at the top

---

## 📊 Debugging Checklist

When LLM calls fail, check in this order:

- [ ] API key is entered in the LLM node (not in .env)
- [ ] API key is valid (test in provider's playground)
- [ ] Provider is selected correctly
- [ ] Model is available for your API key tier
- [ ] Trigger.dev environment variables are clean
- [ ] Both dev servers are running
- [ ] Workflow is saved before running
- [ ] Check Trigger.dev dashboard for task logs
- [ ] Check browser console for errors
- [ ] Check Network tab for API calls

---

## 🆘 Still Having Issues?

### Check Trigger.dev Logs
1. Go to [Trigger.dev Dashboard](https://cloud.trigger.dev)
2. Click on your project
3. Go to **Runs** tab
4. Find your workflow run
5. Click to see detailed logs
6. Look for the `run-llm` task
7. Check the error message

### Check Browser Console
1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for red errors
4. Check **Network** tab for failed API calls

### Verify API Key Works
Test your API key directly:

**For Gemini:**
```bash
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

**For OpenAI:**
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'
```

**For Claude:**
```bash
curl https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-3-5-haiku-20241022","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
```

---

## 📝 Summary of Changes

### What Was Fixed:

1. ✅ **Multi-provider support** - Can now use Gemini, OpenAI, Claude, Bedrock
2. ✅ **Latest models** - Added all latest Gemini models (2.0 Flash Exp, Thinking, etc.)
3. ✅ **Provider dropdown** - Select provider in LLM node
4. ✅ **Dynamic model list** - Models update based on selected provider
5. ✅ **API key per node** - Each LLM node has its own API key field
6. ✅ **No environment variables** - API keys come from node data, not .env

### What You Need to Do:

1. **Pull latest code** (already done with the fixes above)
2. **Restart dev servers** (`npm run dev` + `npm run trigger`)
3. **Clear Trigger.dev environment variables** (remove old GEMINI_API_KEY)
4. **Clear browser cache** (hard refresh)
5. **Create new workflow** with fresh LLM node
6. **Enter your API key** in the LLM node itself
7. **Select provider** (Gemini, OpenAI, Claude)
8. **Select model** from updated list
9. **Test the workflow**

---

## 🎯 Quick Test

To verify everything works:

1. Create a new workflow
2. Add a **Text** node with "Hello, test this"
3. Add an **LLM** node
4. Select **Provider**: OpenAI (or Gemini with fresh key)
5. Enter your API key
6. Select **Model**: gpt-4o-mini (or gemini-2.0-flash-exp)
7. Connect Text → LLM (user_message handle)
8. Click **Run all**
9. Check the output in the LLM node

If this works, your setup is correct! 🎉
