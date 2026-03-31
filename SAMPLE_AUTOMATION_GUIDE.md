# How to Create a Sample AI Automation Flow in NextFlow

This guide walks you through building a complete AI automation workflow
from scratch using the NextFlow visual editor.

---

## Prerequisites

Before starting, make sure:
1. You're signed in at `http://localhost:3000`
2. The dev server is running (`npm run dev`)
3. The Trigger.dev worker is running (`npm run trigger`)
4. You've set your environment variables:
   - `GEMINI_API_KEY` — in both `.env` and **Trigger.dev dashboard**
   - `TRANSLOADIT_*` keys — in both `.env` and **Trigger.dev dashboard**
   - `DATABASE_URL` — in both `.env` and **Trigger.dev dashboard**

---

## Example 1: "Describe an Image" Flow

**Goal**: Upload an image → AI writes a description of it.

### Step 1: Add a Text node (System Prompt)
1. In the left sidebar, click **"Text"**
2. A Text node appears on the canvas
3. Type in: `You are an expert image analyst. Describe images in detail.`

### Step 2: Add a Text node (User Message)
1. Click **"Text"** again from the sidebar
2. Type in: `What do you see in this image? Describe it in 2-3 sentences.`

### Step 3: Add an Upload Image node
1. Click **"Upload image"** from the sidebar
2. Click **"Choose JPG, PNG, WebP, GIF…"** and select an image from your computer
3. Wait for the upload to complete — you'll see a preview appear

### Step 4: Add a Run LLM node
1. Click **"Run LLM"** from the sidebar
2. Select your model (e.g., **Gemini 2.0 Flash**)

### Step 5: Connect the nodes
1. **Drag** from the **Text node (System Prompt)** right handle → to the **LLM node** left handle (top one = "system_prompt")
2. **Drag** from the **Text node (User Message)** right handle → to the **LLM node** left handle (middle one = "user_message")
3. **Drag** from the **Upload Image** node right handle → to the **LLM node** left handle (bottom one = "images")

### Step 6: Save & Run
1. Click **"Save"** in the top toolbar
2. Click **"Run all"** to execute the entire flow
3. Check the **"Workflow history"** panel on the right for status
4. Once complete, the LLM node will show the AI-generated description!

---

## Example 2: "Extract Frame from Video + Analyze" Flow

**Goal**: Upload a video → extract a specific frame → AI analyzes it.

### Step 1: Add Upload Video node
1. Click **"Upload video"** from the sidebar
2. Upload an MP4/MOV file

### Step 2: Add Extract Frame node
1. Click **"Extract frame"** from the sidebar
2. Set the timestamp (e.g., `5` for 5 seconds, or `50%` for the midpoint)

### Step 3: Connect Video → Extract Frame
1. **Drag** from **Upload Video** right handle → **Extract Frame** left handle (top = "video_url")

### Step 4: Add LLM node
1. Click **"Run LLM"**
2. Type a user message directly in the node: `What is happening in this frame?`

### Step 5: Connect Extract Frame → LLM
1. **Drag** from **Extract Frame** right handle → **LLM** left handle (bottom = "images")

### Step 6: Save & Run
1. Click **Save**, then **Run all**
2. The flow will: upload video → extract frame at timestamp → AI analyzes frame

---

## Example 3: "AI Copywriter" Flow (Text-only)

**Goal**: Give AI a role + prompt → get creative text output.

### Step 1: Add Text node (System)
- Type: `You are a creative copywriter for a luxury brand.`

### Step 2: Add Text node (User)
- Type: `Write a 3-line tagline for a matte black water bottle called "HydroElite".`

### Step 3: Add Run LLM node
- Select **Gemini 2.0 Flash** model

### Step 4: Connect
- Text (System) → LLM (system_prompt)
- Text (User) → LLM (user_message)

### Step 5: Run
- Click **Save** → **Run all**
- Read the output in the LLM node!

---

## Example 4: "Crop + Analyze" Flow

**Goal**: Upload image → crop a specific region → AI analyzes the cropped region.

### Step 1: Add Upload Image + Crop Image nodes
1. Add **Upload Image** and upload your file
2. Add **Crop Image** node
3. Set crop parameters: `X: 10, Y: 10, W: 50, H: 50` (crops the top-left quarter-ish)

### Step 2: Connect Image → Crop
- **Upload Image** right handle → **Crop Image** left handle (top = "image_url")

### Step 3: Add LLM with message
- Add **Run LLM**
- User message: `What is in this cropped portion of the image?`

### Step 4: Connect Crop → LLM
- **Crop Image** right handle → **LLM** left handle (bottom = "images")

### Step 5: Save & Run

---

## Tips

| Tip | Details |
|-----|---------|
| **Drag to connect** | Drag from any purple (output) handle on the right side of a node to a gray (input) handle on the left side of another node |
| **Delete nodes** | Select a node by clicking it, then press `Delete` or `Backspace` |
| **Undo/Redo** | `Ctrl+Z` / `Ctrl+Y` |
| **Run selected only** | Select specific nodes (click + hold), then click "Run selected" |
| **Export/Import** | Use the download/upload icons in the header to export or import workflow JSON files |
| **Theme toggle** | Click the Sun/Moon icon in the header to switch between dark and light mode |

---

## Node Reference

| Node Type | Inputs | Output | Description |
|-----------|--------|--------|-------------|
| **Text** | — | text | Provides a static text value |
| **Upload Image** | — | image URL | Upload and host an image file |
| **Upload Video** | — | video URL | Upload and host a video file |
| **Run LLM** | system_prompt (text), user_message (text), images (image[]) | text | Calls Google Gemini AI |
| **Crop Image** | image_url (image), x/y/w/h (text) | image URL | Crops an image by percentage |
| **Extract Frame** | video_url (video), timestamp (text) | image URL | Extracts a frame from a video |
