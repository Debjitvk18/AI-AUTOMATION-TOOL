# 🚀 NextFlow — New Features Testing Guide

> **Who is this for?** Anyone — even non-technical users — who wants to test the two new features. Just follow the steps below, one by one.

This guide covers **two new features**:

| # | Feature | What It Does |
|---|---------|-------------|
| 1 | 🔧 **Auto-Repair** | Diagnoses failed workflow nodes and suggests fixes |
| 2 | 👁️ **Execution Preview (Dry Run)** | Shows predicted outputs for every node BEFORE actually running the workflow |

---

# FEATURE 1: 🔧 Auto-Repair

## 📋 What Does Auto-Repair Do?

When a workflow node **fails** (for example: a bad URL, a missing input, a timeout), the Auto-Repair feature can:

1. **Diagnose the problem** — tells you *why* it failed
2. **Suggest a fix** — tells you *what to change* so it succeeds
3. **Automatically retry** — applies the fix and re-runs the workflow for you

Think of it like a **spell checker, but for workflow errors**.

---

## ✅ Before You Start — Make Sure the App Is Running

You need **two terminal windows** open:

### Terminal 1 — Start the website
```
cd "d:\MY ALL PROJECTS\AI AUTOMATION FLOW"
npm run dev
```
Wait until you see `✓ Ready on http://localhost:3000`

### Terminal 2 — Start the workflow engine
```
cd "d:\MY ALL PROJECTS\AI AUTOMATION FLOW"
npm run trigger
```
Wait until you see `Ready` or similar confirmation.

### Open your browser
Go to **http://localhost:3000** and sign in.

---

## 🧪 Test Scenario 1: HTTP Request with a Bad URL

> **Goal:** Create a workflow that will fail, then ask Auto-Repair to fix it.

### Step 1 — Create a New Workflow

1. Click **"+ New Workflow"** (or open an existing one)
2. You'll see the visual canvas with a dot-grid background

### Step 2 — Add an HTTP Request Node

1. In the **left sidebar**, find **"HTTP Request"** (under Integrations)
2. **Drag it** onto the canvas
3. Click on the node to configure it
4. Set these values:
   - **Method:** `GET`
   - **URL:** `example.com/api/data`  ← ⚠️ *Intentionally wrong! Missing `https://`*

### Step 3 — Run the Workflow

1. Click the **"▶ Run All"** button in the top toolbar
2. Wait a few seconds — the node should turn **red** (failed)
3. Open the **right sidebar** (Run History) to see the failed run

### Step 4 — Get the IDs You Need

You need three pieces of information. Here's how to get them:

1. **Workflow ID** — Look at your browser's address bar:
   ```
   http://localhost:3000/workflow?id=clxxxxxxxxxxxxxxxxx
   ```
   The part after `id=` is your **Workflow ID**

2. **Run ID and Node ID** — Open a new browser tab and go to:
   ```
   http://localhost:3000/api/workflows/YOUR_WORKFLOW_ID/runs
   ```
   Replace `YOUR_WORKFLOW_ID` with the ID from step 1.

   You'll see a JSON response. Look for:
   - `"id"` at the top level → this is your **Run ID**
   - Inside `"nodeRuns"`, find the entry with `"status": "FAILED"` → its `"nodeId"` is your **Node ID**

   > 💡 **Tip:** The JSON might look messy. You can install the **"JSON Formatter"** browser extension to make it readable, or copy-paste the JSON into https://jsonformatter.org

### Step 5 — Ask Auto-Repair to Diagnose

Open a new browser tab and type this URL (replace the three IDs):

```
http://localhost:3000/api/workflows/WORKFLOW_ID/runs/RUN_ID/repair?nodeId=NODE_ID
```

**Press Enter.** You should see a response like:

```json
{
  "status": "FIX_APPLIED",
  "error_type": "VALIDATION_ERROR",
  "reasoning": "Fixed malformed URL: \"example.com/api/data\" → \"https://example.com/api/data\"",
  "fix": {
    "updated_inputs": {
      "url": "https://example.com/api/data"
    },
    "changed_fields": ["url"],
    "notes": "Fixed malformed URL"
  },
  "retry_strategy": {
    "should_retry": true,
    "retry_delay_ms": 500,
    "max_retries": 2
  },
  "confidence": 0.8
}
```

🎉 **What this means:**
- ✅ **"status": "FIX_APPLIED"** → Auto-Repair found a fix!
- 🔍 **"reasoning"** → It noticed the URL was missing `https://`
- 🔧 **"fix"** → It shows the corrected URL
- 📊 **"confidence": 0.8** → It's 80% sure this fix is correct

### Step 6 — Apply the Fix (Optional)

To actually apply the fix and re-run the workflow, you need to send a POST request. The easiest way:

**Option A — Using the browser console:**
1. Press **F12** to open Developer Tools
2. Click the **Console** tab
3. Paste this (replace the three IDs):

```javascript
fetch('/api/workflows/WORKFLOW_ID/runs/RUN_ID/repair', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nodeId: 'NODE_ID', applyFix: true })
}).then(r => r.json()).then(console.log)
```

4. Press **Enter**
5. You should see the repair result plus a `newRunId` — the workflow is re-running with the fix!

**Option B — Using a tool like Postman:**
- **URL:** `http://localhost:3000/api/workflows/WORKFLOW_ID/runs/RUN_ID/repair`
- **Method:** `POST`
- **Body (JSON):**
  ```json
  {
    "nodeId": "NODE_ID",
    "applyFix": true
  }
  ```

---

## 🧪 Test Scenario 2: LLM Node with Missing Message

> **Goal:** Test repair on an AI/LLM node that has no user message.

### Step 1 — Build the Workflow

1. Add a **Text Node** → type `"Describe this photo in detail"`
2. Add a **Run LLM Node**
3. **Connect** the Text Node's output → to the LLM Node's **system_prompt** handle
4. Leave the LLM Node's **user_message** field **empty** (don't type anything and don't connect anything to it)

### Step 2 — Run It

1. Click **"▶ Run All"**
2. The LLM node should fail with error: *"User message is required"*

### Step 3 — Diagnose with Auto-Repair

Use the same steps from Scenario 1 (Step 4-5) to get IDs and call the repair endpoint.

**Expected result:**
```json
{
  "status": "FIX_APPLIED",
  "error_type": "VALIDATION_ERROR",
  "reasoning": "Mapped userMessage from upstream text output",
  "fix": {
    "updated_inputs": {
      "userMessage": "Describe this photo in detail"
    },
    "changed_fields": ["userMessage"],
    "notes": "Mapped userMessage from upstream text output"
  },
  "confidence": 0.85
}
```

🎉 **Auto-Repair figured out** that the Text Node had usable text and suggests mapping it to the LLM's user message!

---

## 🧪 Test Scenario 3: Authentication Error (Unfixable)

> **Goal:** Verify that Auto-Repair correctly says "I can't fix this" for auth issues.

### Step 1 — Build the Workflow

1. Add a **Run LLM Node**
2. In the node config, type a fake API key like `sk-fake-key-12345`
3. Type any user message

### Step 2 — Run and Diagnose

1. Run the workflow → it will fail with a 401/auth error
2. Call the repair endpoint

**Expected result:**
```json
{
  "status": "NO_SAFE_FIX",
  "error_type": "AUTH_ERROR",
  "reasoning": "Authentication error detected... User must provide valid credentials.",
  "fix": null,
  "retry_strategy": {
    "should_retry": false,
    "retry_delay_ms": 0,
    "max_retries": 0
  },
  "confidence": 0.0
}
```

✅ **Correct behavior!** Auto-Repair knows it cannot fix password/key problems.

---

## 🧪 Test Scenario 4: Network Timeout (Retry Suggestion)

### Step 1 — Build the Workflow

1. Add an **HTTP Request Node**
2. Set the URL to something that will timeout: `https://httpstat.us/504?sleep=60000`
3. Method: `GET`

### Step 2 — Run and Diagnose

1. Run the workflow → it should fail with a timeout/network error
2. Call the repair endpoint

**Expected result:**
```json
{
  "status": "FIX_APPLIED",
  "error_type": "NETWORK_ERROR",
  "reasoning": "Network error... Transient issue likely resolved by retry.",
  "fix": {
    "updated_inputs": { ... },
    "changed_fields": [],
    "notes": "No input changes — retry to resolve transient network issue"
  },
  "retry_strategy": {
    "should_retry": true,
    "retry_delay_ms": 3000,
    "max_retries": 3
  },
  "confidence": 0.7
}
```

✅ **Auto-Repair suggests waiting and retrying** — no input changes needed, just a network hiccup.

---

## 📖 Auto-Repair Quick Reference: All Response Fields

| Field | What It Means |
|-------|---------------|
| **status** | `"FIX_APPLIED"` = found a fix, `"NO_SAFE_FIX"` = can't fix safely |
| **error_type** | Category: `VALIDATION_ERROR`, `AUTH_ERROR`, `NETWORK_ERROR`, `LOGIC_ERROR`, `RATE_LIMIT`, `UNKNOWN` |
| **reasoning** | Plain English explanation of what went wrong and what was fixed |
| **fix.updated_inputs** | The corrected node configuration |
| **fix.changed_fields** | List of exactly which fields were changed |
| **fix.notes** | Short description of the change |
| **retry_strategy.should_retry** | Should you try again? `true` or `false` |
| **retry_strategy.retry_delay_ms** | How long to wait before retrying (in milliseconds) |
| **retry_strategy.max_retries** | Maximum number of retry attempts |
| **confidence** | How sure the system is (0.0 = not sure at all, 1.0 = completely sure) |

---

## 📖 Auto-Repair API Endpoints

### 🔍 Diagnose Only (GET)

Just look at what's wrong — don't change anything:

```
GET http://localhost:3000/api/workflows/{workflowId}/runs/{runId}/repair?nodeId={nodeId}
```

### 🔧 Diagnose + Fix (POST)

Analyze the problem AND apply the fix + re-run:

```
POST http://localhost:3000/api/workflows/{workflowId}/runs/{runId}/repair

Body:
{
  "nodeId": "the-failed-node-id",
  "applyFix": true
}
```

Set `"applyFix": false` to just see the diagnosis without applying it.

---
---

# FEATURE 2: 👁️ Execution Preview (Dry Run)

## 📋 What Does Execution Preview Do?

Before running your workflow for real, you can **preview** what each node will produce. It's like a "rehearsal" — the system simulates every node and shows you the expected output without:

- ❌ Calling any real APIs
- ❌ Using any AI credits
- ❌ Sending any real notifications
- ❌ Saving anything to the database

This helps you **catch mistakes early** before spending time and resources on a real run.

---

## 🧪 Preview Test 1: Simple Text Workflow

> **Goal:** See the Preview button work and show simulated output for a basic workflow.

### Step 1 — Open or Create a Workflow

1. Go to **http://localhost:3000** and sign in
2. Open an existing workflow or click **"+ New Workflow"**

### Step 2 — Add a Text Node

1. From the **left sidebar**, drag a **"Text"** node onto the canvas
2. Click the node and type: `Hello, this is a test message`
3. Click **Save** (top right)

### Step 3 — Click Preview

1. Look at the top toolbar — you'll see a new button called **"Preview"** (with an eye icon 👁️)
2. **Click it**

### Step 4 — See the Results

A **floating panel** will appear at the bottom of the canvas. It shows:

- 🟡 **SIMULATED** badge (yellow) — this output was predicted, not from a real run
- The **node type** (e.g., "text")
- The **predicted output**: `{"text":"Hello, this is a test message"}`

✅ **Success!** You just did a dry run!

### Step 5 — Clear the Preview

1. Click the **"Clear preview"** button (the Preview button changes to this after preview runs)
2. The floating panel disappears

---

## 🧪 Preview Test 2: Multi-Node Workflow (Text → LLM)

> **Goal:** See how preview simulates a chain of connected nodes.

### Step 1 — Build the Workflow

1. Add a **Text Node** → type: `Explain quantum computing to a 5 year old`
2. Add a **Run LLM Node**
3. **Connect** the Text Node's output handle → to the LLM Node's **user_message** input handle
4. Click **Save**

### Step 2 — Click Preview

1. Click the **"Preview"** button in the toolbar

### Step 3 — Check the Results

The floating panel should show **2 entries**:

| Node | Badge | Output |
|------|-------|--------|
| **text** | 🟡 SIMULATED | `{"text":"Explain quantum computing to a 5 year old"}` |
| **llm** | 🟡 SIMULATED | `{"text":"[Preview] Predicted LLM response for: \"Explain quantum computing to a 5 year old\""}` |

🎉 **What happened:** The preview engine:
1. Processed the Text node first (it has no dependencies)
2. Passed its output to the LLM node as input
3. Generated a mock LLM response (without calling any AI API!)

---

## 🧪 Preview Test 3: HTTP Request Node

> **Goal:** See that the preview returns a mock HTTP response.

### Step 1 — Build the Workflow

1. Add an **HTTP Request Node**
2. Set **Method**: `GET`
3. Set **URL**: `https://api.example.com/data`
4. Click **Save**

### Step 2 — Click Preview

The floating panel should show:

```
httpRequest (abc12345…)
SIMULATED
{"statusCode":200,"responseText":"{\"mock\":true,\"method\":\"GET\",\"url\":\"https://api.example.com/data\",\"data\":{}}","text":"..."}
```

✅ **Notice:** The preview returned a **fake 200 response** without actually calling the URL. This is safe — no real HTTP request was made.

---

## 🧪 Preview Test 4: Previous Run Reuse

> **Goal:** If you've already run a workflow successfully, the preview will use real historical outputs instead of simulating.

### Step 1 — Run a Workflow First

1. Create a simple Text node workflow
2. Click **"▶ Run All"** and wait for it to succeed (green status in history)

### Step 2 — Click Preview

1. Click the **"Preview"** button

### Step 3 — Check the Badge

The floating panel should show:

- 🟢 **FROM_HISTORY** badge (green) — this output came from a real previous run

This means the preview is using **actual data** from your last successful run, which is even more accurate than simulation!

---

## 📖 Preview Quick Reference

### What the Badges Mean

| Badge | Color | Meaning |
|-------|-------|---------|
| **SIMULATED** | 🟡 Yellow/Amber | Output was predicted using mock logic |
| **FROM_HISTORY** | 🟢 Green | Output was taken from a previous successful run |

### What Each Node Type Shows in Preview

| Node Type | Preview Output |
|-----------|---------------|
| **Text** | Returns whatever text you typed |
| **Run LLM** | `[Preview] Predicted LLM response for: "your prompt..."` |
| **HTTP Request** | `{"mock": true, "method": "GET", "url": "...", "data": {}}` |
| **If/Else** | Actually evaluates the condition and shows true/false |
| **Data Transform** | Actually applies the transform (uppercase, trim, etc.) |
| **Crop Image** | Returns a mock image URL |
| **Extract Frame** | Returns a mock frame URL |
| **Notification** | `[Preview] Notification: your message` |
| **Manual Trigger** | Returns the input data you configured |
| **Upload Image/Video** | Returns the URL you provided or a placeholder |

---

## 💡 Preview Tips

- ✅ **Preview works with unsaved changes** — you don't need to save first. The preview uses whatever is currently on your canvas.
- ✅ **Preview is instant** — it should complete in under 500ms for small workflows.
- ✅ **Preview is 100% safe** — it never calls real APIs, never costs money, never sends data anywhere.
- ✅ **Preview → Run** — use Preview first to check your workflow makes sense, then click "Run All" for the real execution.

---
---

# ❓ Troubleshooting (Both Features)

| Problem | Solution |
|---------|----------|
| **"Unauthorized" error** | Make sure you're signed in at `localhost:3000` in the same browser |
| **"Workflow not found"** | Double-check the Workflow ID from your browser URL bar |
| **"Run not found"** | Double-check the Run ID from the `/runs` API response |
| **"No failed NodeRun found"** | The node might not have failed, or you have the wrong Node ID |
| **Preview button is grayed out** | You need to save the workflow first (click Save) |
| **Preview panel doesn't appear** | Check the browser console (F12) for errors |
| **The dev server isn't running** | Run `npm run dev` in Terminal 1 |
| **Trigger.dev isn't running** | Run `npm run trigger` in Terminal 2 |

---

> 💡 **Tip:** You can always go to `http://localhost:3000/api/workflows/YOUR_WORKFLOW_ID/runs` in your browser to see all past runs and their node results. Look for entries with `"status": "FAILED"` to find nodes you can test the repair on.

