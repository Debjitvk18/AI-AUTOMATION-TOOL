# How to Create Automation Flows in NextFlow

This guide walks you through building workflows from scratch using the NextFlow visual editor.
It includes both **no-LLM flows** (work even without Gemini API quota) and **AI flows** (require Gemini API key).

---

## Prerequisites

1. You're signed in at `http://localhost:3000`
2. Dev server running: `npm run dev`
3. Trigger.dev worker running: `npm run trigger`
4. Environment variables set in both `.env` **and** Trigger.dev dashboard:
   - `GEMINI_API_KEY` (only needed for AI/LLM flows)
   - `TRANSLOADIT_*` keys (only needed for file uploads)
   - `DATABASE_URL`

---

## 🟢 Example 1: "API Fetch + Data Transform" (No LLM Required)

**Goal**: Fetch data from a public API → transform the JSON → display result.

### Steps:

1. **Add HTTP Request node** (from Integrations sidebar)
   - Method: `GET`
   - URL: `https://jsonplaceholder.typicode.com/posts/1`
   - Leave headers & body empty

2. **Add Data Transform node** (from Logic & Data sidebar)
   - Operation: `Extract JSON Field`
   - Template: `title`

3. **Connect**: HTTP Request → Data Transform (drag from orange output → cyan input)

4. Click **Save** → **Run all**

5. **Expected result**: The Data Transform node outputs just the post title from the API response.

---

## 🟢 Example 2: "Manual Trigger + If/Else Condition" (No LLM Required)

**Goal**: Provide input data → check a condition → route true/false.

### Steps:

1. **Add Manual Trigger node** (from Triggers sidebar)
   - Input Data: `{"status": "active", "count": 15}`

2. **Add If/Else node** (from Logic & Data sidebar)
   - Field: `count`
   - Operator: `Greater Than`
   - Value: `10`

3. **Add two Text nodes**:
   - Text node 1: `Count is above threshold!`
   - Text node 2: `Count is below threshold.`

4. **Connect**:
   - Manual Trigger → If/Else (input)

5. Click **Save** → **Run all**

6. **Expected result**: If/Else evaluates `count > 10` → result is `true`.

---

## 🟢 Example 3: "API Chain" (No LLM Required)

**Goal**: Fetch a user → extract their name → send as notification.

### Steps:

1. **Add HTTP Request node**
   - Method: `GET`
   - URL: `https://jsonplaceholder.typicode.com/users/1`

2. **Add Data Transform node**
   - Operation: `Extract JSON Field`
   - Template: `name`

3. **Add another Data Transform node**
   - Operation: `Template (use {{input}})`
   - Template: `Hello, {{input}}! Your workflow ran successfully.`

4. **Add Send Notification node**
   - Type: `Console Log`
   - Message template: `{{input}}`

5. **Connect in chain**: HTTP Request → Transform 1 → Transform 2 → Notification

6. Click **Save** → **Run all**

7. **Expected result**: Console logs `"Hello, Leanne Graham! Your workflow ran successfully."`

---

## 🟢 Example 4: "Webhook + Data Processing" (No LLM Required)

**Goal**: Set up a webhook → receive external data → process it.

### Steps:

1. **Add Webhook Trigger node** (auto-generates a unique URL)
   - Copy the webhook URL shown in the node

2. **Open a terminal** and send test data:
   ```powershell
       curl -X POST "http://localhost:3000/api/webhooks/trigger/<ID>" -H "Content-Type: application/json" -d "{\"event\": \"order_placed\", \"amount\": 99.99}"
   ```

3. **Add Data Transform node**
   - Operation: `JSON Parse`

4. **Connect**: Webhook Trigger → Data Transform

5. Click **Save** → **Run all**

6. **Expected result**: The transform node outputs the formatted JSON that was sent to the webhook.

---

## 🟢 Example 5: "Text Transform Pipeline" (No LLM Required)

**Goal**: Chain multiple data transformations.

### Steps:

1. **Add Text node**: `hello world this is nextflow`

2. **Add Data Transform #1** (Uppercase)
   - Operation: `Uppercase`

3. **Add Data Transform #2** (Template)
   - Operation: `Template (use {{input}})`
   - Template: `[PROCESSED] {{input}} [END]`

4. **Add Data Transform #3** (Base64 Encode)
   - Operation: `Base64 Encode`

5. **Connect in chain**: Text → Transform 1 → Transform 2 → Transform 3

6. Click **Save** → **Run all**

7. **Expected result**: Original text → UPPERCASE → wrapped in template → Base64 encoded.

---

## 🔵 Example 6: "Describe an Image" (Requires LLM)

**Goal**: Upload an image → AI writes a description of it.

### Steps:

1. **Add Text node** (System): `You are an expert image analyst.`
2. **Add Text node** (User): `What do you see in this image? Describe it in 2-3 sentences.`
3. **Add Upload Image node** → upload a file
4. **Add Run LLM node** → select Gemini 2.0 Flash
5. **Connect**:
   - Text (System) → LLM (`system_prompt`)
   - Text (User) → LLM (`user_message`)
   - Upload Image → LLM (`images`)
6. Click **Save** → **Run all**

---

## Tips

| Tip | Details |
|-----|---------|
| **Drag to connect** | Drag from any colored handle on the right → gray handle on the left |
| **Delete nodes** | Select node → press `Delete` or `Backspace` |
| **Undo/Redo** | `Ctrl+Z` / `Ctrl+Y` |
| **Run selected only** | Select nodes → click "Run selected" |
| **Delete run history** | Click the trash icon next to any run in the right panel |
| **Export/Import** | Use the download/upload icons in the header |
| **Theme toggle** | Sun/Moon icon in the header |

---

## Node Reference

| Node Type | Category | Inputs | Output | Needs External Service? |
|-----------|----------|--------|--------|------------------------|
| **Text** | Logic & Data | — | text | No |
| **Manual Trigger** | Triggers | — | text (JSON) | No |
| **Webhook Trigger** | Triggers | — | text (payload) | No |
| **Schedule Trigger** | Triggers | — | text (timestamp) | No |
| **If / Else** | Logic & Data | condition (text) | true/false text | No |
| **Data Transform** | Logic & Data | input (text) | text | No |
| **HTTP Request** | Integrations | url, body (text) | text (response) | External API |
| **Send Notification** | Integrations | input (text) | text (status) | Webhook URL |
| **Upload Image** | AI & Media | — | image URL | Transloadit |
| **Upload Video** | AI & Media | — | video URL | Transloadit |
| **Run LLM** | AI & Media | system, user, images | text | Gemini API |
| **Crop Image** | AI & Media | image, x/y/w/h | image URL | Transloadit |
| **Extract Frame** | AI & Media | video, timestamp | image URL | Transloadit + FFmpeg |

---

## 🟠 Example 7: "Webhook → WhatsApp Alert" (Practical Integration)

**Goal**: Receive order events by webhook and send a WhatsApp-style alert via Twilio API.

### Steps:

1. **Add Webhook Trigger node**
   - Copy generated webhook URL

2. **Add Data Transform node**
   - Operation: `Template (use {{input}})`
   - Template:
     `{"Body":"New order event: {{input}}","From":"whatsapp:+14155238886","To":"whatsapp:+91XXXXXXXXXX"}`

3. **Add HTTP Request node**
   - Method: `POST`
   - URL: `https://api.twilio.com/2010-04-01/Accounts/<ACCOUNT_SID>/Messages.json`
   - Headers: `{"Content-Type":"application/json","Authorization":"Basic <BASE64_ACCOUNT_SID_AUTH_TOKEN>"}`
   - Body: `{{input}}`

4. **Connect**: Webhook Trigger → Data Transform → HTTP Request

5. Trigger with terminal test:
   ```powershell
   curl -X POST "http://localhost:3000/api/webhooks/trigger/<HOOK_ID>" -H "Content-Type: application/json" -d "{\"orderId\":\"A-1001\",\"amount\":1200}"
   ```

6. Click **Save** → **Run all**

7. **Expected result**: Twilio endpoint receives the JSON body and sends WhatsApp message.

---

## 🟠 Example 8: "Missed Call Automation" (Call Flow)

**Goal**: Inbound call event webhook triggers callback ticket creation.

### Steps:

1. **Add Webhook Trigger node**

2. **Add Data Transform node**
   - Operation: `Extract JSON Field`
   - Template: `callerNumber`

3. **Add Data Transform node**
   - Operation: `Template (use {{input}})`
   - Template: `{"customer":"{{input}}","priority":"high","source":"missed_call"}`

4. **Add Send Notification node**
   - Type: `Webhook`
   - Webhook URL: your CRM/ticket endpoint
   - Message template: `{{input}}`

5. **Connect**: Webhook Trigger → Transform 1 → Transform 2 → Notification

6. **Expected result**: CRM receives structured callback ticket payload.

---

## 🟠 Example 9: "Inbound Email Parsing + Routing"

**Goal**: Parse inbound support email payload and route urgent issues.

### Steps:

1. **Add Webhook Trigger node** (email provider posts payload)

2. **Add Data Transform node**
   - Operation: `Extract JSON Field`
   - Template: `subject`

3. **Add If/Else node**
   - Field: *(leave empty, use full input text)*
   - Operator: `contains`
   - Value: `urgent`

4. **Add two Send Notification nodes**
   - Notification A (true branch): Slack/Teams webhook for urgent channel
   - Notification B (false branch): Standard support webhook

5. **Connect**:
   - Webhook Trigger → Data Transform → If/Else
   - If/Else `true` output → Notification A
   - If/Else `false` output → Notification B

6. **Expected result**: Urgent subjects go to escalation path, others go to standard queue.

---

## 🟠 Example 10: "Daily Email Digest Summary" (LLM)

**Goal**: Collect text input and generate concise summary for daily report email.

### Steps:

1. **Add Text node** (system):
   `You summarize operational updates into 5 concise bullet points.`

2. **Add Text node** (user):
   Paste raw updates/log text.

3. **Add Run LLM node**
   - Provider/model as configured

4. **Add Send Notification node**
   - Type: `Webhook`
   - Message template: `{{input}}`

5. **Connect**:
   - Text (system) → LLM `system_prompt`
   - Text (user) → LLM `user_message`
   - LLM → Send Notification

6. **Expected result**: Notification receives a compact summary suitable for email digest body.

---

## 🟠 Example 11: "Support Chat Auto-Reply" (LLM Decision)

**Goal**: Draft first response to customer message and classify intent.

### Steps:

1. **Add Manual Trigger node**
   - Input Data: `{"message":"I was charged twice and need help"}`

2. **Add Text node** (system):
   `Classify intent (billing/technical/general) and draft a polite first reply in JSON with keys: intent, reply.`

3. **Add Data Transform node**
   - Operation: `Extract JSON Field`
   - Template: `message`

4. **Add Run LLM node**

5. **Add Send Notification node**
   - Type: `Console Log`
   - Message template: `{{input}}`

6. **Connect**:
   - Text(system) → LLM `system_prompt`
   - Manual Trigger → Transform → LLM `user_message`
   - LLM → Notification

7. **Expected result**: Output contains JSON with intent and suggested reply.

---

## 🟠 Example 12: "Lead Scoring with LLM + If/Else"

**Goal**: Score incoming lead text and route hot leads.

### Steps:

1. **Add Webhook Trigger node**

2. **Add Text node** (system):
   `Return only a number from 0 to 100 indicating purchase intent score.`

3. **Add Run LLM node**

4. **Add If/Else node**
   - Field: *(empty)*
   - Operator: `gt`
   - Value: `70`

5. **Add two Send Notification nodes**
   - True path: sales team webhook
   - False path: nurture queue webhook

6. **Connect**:
   - Text(system) → LLM `system_prompt`
   - Webhook Trigger → LLM `user_message`
   - LLM → If/Else
   - If/Else true/false outputs → respective notifications

7. **Expected result**: High-score leads are escalated immediately.

---

## 🟠 Example 13: "Webhook Payload Normalizer"

**Goal**: Standardize payload shape from multiple external systems.

### Steps:

1. **Add Webhook Trigger node**

2. **Add Data Transform node**
   - Operation: `JSON Parse`

3. **Add Data Transform node**
   - Operation: `Template (use {{input}})`
   - Template: `{"source":"external","receivedAt":"{{input}}"}`

4. **Add Send Notification node**
   - Type: `Webhook`
   - Message template: `{{input}}`

5. **Connect**: Webhook Trigger → Transform 1 → Transform 2 → Notification

6. **Expected result**: Downstream service always receives predictable normalized JSON wrapper.

---

## 🟠 Example 14: "Document Summarization API"

**Goal**: Expose your own summarization endpoint using webhook + LLM.

### Steps:

1. **Add Webhook Trigger node**

2. **Add Data Transform node**
   - Operation: `Extract JSON Field`
   - Template: `text`

3. **Add Text node** (system):
   `Summarize the input in 6 bullet points and end with one action recommendation.`

4. **Add Run LLM node**

5. **Add Send Notification node**
   - Type: `Webhook`
   - Webhook URL: your internal callback URL
   - Message template: `{{input}}`

6. **Connect**:
   - Webhook Trigger → Transform → LLM `user_message`
   - Text(system) → LLM `system_prompt`
   - LLM → Notification

7. **Expected result**: Callback receives compact summary text for each incoming document payload.

---

## 🟠 Example 15: "Image Moderation Decision"

**Goal**: Upload image and decide allow/block with LLM vision.

### Steps:

1. **Add Upload Image node**

2. **Add Text node** (system):
   `Classify image safety as only one word: SAFE or UNSAFE.`

3. **Add Text node** (user):
   `Analyze this image for moderation.`

4. **Add Run LLM node**

5. **Add If/Else node**
   - Operator: `equals`
   - Value: `SAFE`

6. **Add two Send Notification nodes**
   - SAFE → approval webhook
   - UNSAFE → moderation webhook

7. **Connect**:
   - Text(system) → LLM system
   - Text(user) → LLM user
   - Upload Image → LLM images
   - LLM → If/Else → Notifications

8. **Expected result**: Image is automatically routed to approved or review queue.

---

## 🟠 Example 16: "Scheduled KPI Report Push"

**Goal**: Generate periodic report message and push to chat/email webhook.

### Steps:

1. **Add Schedule Trigger node**
   - Cron: `0 9 * * *` (daily 9 AM)

2. **Add HTTP Request node**
   - Method: `GET`
   - URL: your KPI endpoint (for example `/api/metrics/today`)

3. **Add Data Transform node**
   - Operation: `Template (use {{input}})`
   - Template: `Daily KPI report:\n{{input}}`

4. **Add Send Notification node**
   - Type: `Webhook`
   - Message template: `{{input}}`

5. **Connect**: Schedule Trigger → HTTP Request → Data Transform → Notification

6. **Expected result**: Each schedule run pushes KPI digest automatically.
