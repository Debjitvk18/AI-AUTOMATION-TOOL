# Feature Testing Guide: AI Workflow Generator

This guide explains how to test the new "Generate workflow from prompt" feature in a very simple way.

You do not need to understand coding to follow this.

## What This Feature Does

This feature lets you type a plain-English instruction like:

`When I upload a video, extract a frame, describe it with AI, then send a notification`

The app should automatically create a workflow graph for you.

## Before You Start

Please make sure the person who set up the project has already done these things:

- Installed the project dependencies
- Connected the database
- Added the required environment variables
- Started the app locally

If the app already opens in your browser and you can sign in, you can continue.

## What You Need

You only need:

- A browser
- Access to the running app
- A login for the app

## How To Open The App

1. Open your browser.
2. Go to:

```text
http://localhost:3000
```

3. Sign in.
4. Open the workflow page.

If the app is already open and you can see the workflow canvas, you are ready.

## Main Test: Check If Workflow Generation Works

### Step 1: Open a Workflow

1. Open an existing workflow, or create a new one.
2. Stay on the workflow builder screen.

You should see:

- A large canvas in the middle
- Buttons at the top
- A button called `Generate`

### Step 2: Open the Generator

1. Click the `Generate` button.

Expected result:

- A popup window opens
- It contains a large text box

### Step 3: Enter a Test Prompt

Copy and paste this exact text into the box:

```text
When I upload a video, extract a frame, describe it with AI, then send a notification
```

### Step 4: Generate the Workflow

1. Click `Generate graph`

Expected result:

- The popup closes
- A workflow appears on the canvas automatically

You should see a flow similar to this:

`Upload Video -> Extract Frame -> Run LLM -> Send Notification`

## Test 2: Check If The Workflow Was Saved

This test checks whether the generated workflow stays saved after refresh.

1. After the graph appears, refresh the browser page.
2. Wait for the workflow page to load again.

Expected result:

- The same generated workflow should still be visible

If it is still there, saving is working.

## Test 3: Check If Unsupported Requests Show an Error

This test makes sure the app does not create broken workflows for unsupported requests.

1. Click `Generate` again
2. Paste this prompt:

```text
Create a workflow that sends an email, updates Google Sheets, and posts to Salesforce
```

3. Click `Generate graph`

Expected result:

- The app should show an error message
- It should not create a broken graph

This is correct behavior because those tools are not available in the current node catalog.

## Test 4: Simple Real Run Test

This is the easiest full test because it does not require image or video upload.

### Step 1: Generate a Simple Workflow

1. Click `Generate`
2. Paste this prompt:

```text
Start with a manual trigger, send the message to an AI model, then send a console notification
```

3. Click `Generate graph`

Expected result:

- A small workflow appears on the canvas

It should look roughly like:

`Manual Trigger -> Run LLM -> Send Notification`

### Step 2: Check the Notification Node

1. Click the `Send Notification` node
2. In the notification settings, choose:

`Console Log`

This avoids needing an external webhook URL.

### Step 3: Run the Workflow

1. Click `Run all`

Expected result:

- The workflow starts running
- The run history panel updates
- The nodes should show progress
- The run should finish successfully

## Easy Prompts You Can Use For Testing

You can test the feature with these prompts one by one.

### Prompt A

```text
When I upload an image, describe it with AI
```

Expected graph:

`Upload Image -> Run LLM`

### Prompt B

```text
When I upload a video, extract a frame and describe it
```

Expected graph:

`Upload Video -> Extract Frame -> Run LLM`

### Prompt C

```text
Start with a manual trigger, transform the text to uppercase, then send a notification
```

Expected graph:

`Manual Trigger -> Data Transform -> Send Notification`

### Prompt D

```text
Call an HTTP endpoint, extract a field from the response, then send a notification
```

Expected graph:

`Manual Trigger or Text -> HTTP Request -> Data Transform -> Send Notification`

## How To Decide If The Feature Is Working

The feature is working correctly if:

- The `Generate` button opens the popup
- A valid graph appears after entering a supported prompt
- The graph is still there after refresh
- Unsupported requests show an error instead of a broken graph
- At least one generated workflow can run successfully

## Common Problems and What They Mean

### Problem: Nothing happens after clicking Generate

Possible reason:

- The app is not connected properly
- The AI key may be missing

### Problem: You see an error about Gemini or API key

Possible reason:

- `GEMINI_API_KEY` was not added to the project setup

### Problem: The graph appears but running fails

Possible reason:

- A node needs extra setup
- Example: Notification node may need to be switched to `Console Log`

### Problem: The page refreshes and the graph disappears

Possible reason:

- The workflow was generated but not saved correctly

## Best Quick Test For a Demo

If you want the fastest demo for someone, use this:

1. Open the workflow page
2. Click `Generate`
3. Paste:

```text
Start with a manual trigger, send the message to an AI model, then send a console notification
```

4. Click `Generate graph`
5. Set notification type to `Console Log`
6. Click `Run all`

If this works, the feature is basically working end to end.

## File Location

This guide is saved in:

[FEATURE_TESTING_GUIDE.md](/d:/AI-AUTOMATION-TOOL/FEATURE_TESTING_GUIDE.md)
