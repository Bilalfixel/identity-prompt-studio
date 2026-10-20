# Deploy Identity Prompt Studio as a website (beginner guide)

You do NOT need to build a new website. The files in this folder are already the working website (HTML/CSS/JS + Python API).

## Step 1 — Put the files in GitHub
1. Make accounts at https://github.com and https://render.com.
2. Visit https://github.com/new and create a **private** repository named `identity-prompt-studio`.
3. Click **uploading an existing file** (or **Add file → Upload files**).
4. **Unzip this package first.** Upload **the contents** of this folder: `server.py`, `index.html`, `style.css`, `app.js`, `render.yaml`, etc. All files must be at the repository **root**, not inside another folder.
5. Choose **Commit changes**. Do not upload an `.env` file or API key.

## Step 2 — Deploy automatically on Render
1. Visit https://dashboard.render.com and sign in.
2. Choose **New → Blueprint**, connect GitHub, and select your `identity-prompt-studio` repository.
3. Leave the Blueprint path as `render.yaml`. Review the service details, then start the deployment.
4. When prompted for `SITE_PASSWORD`, make up a long password and save it somewhere safe. This is the password that protects the website and your private photos. Login **username** is `studio`.
5. Wait for Render to report the service as **Live**, then open your HTTPS address: `https://identity-prompt-studio-xxxx.onrender.com` (Render assigns the exact link).
6. Your browser will request login. Enter username `studio` and the password you set.

The free Render web service may sleep after 15 minutes of no traffic and may take about a minute to wake back up on the next visit.

## Step 3 — Enable actual AI photo analysis (optional, but recommended)
Option A (convenient for private websites):
1. In Render, select your web service, then **Environment**.
2. Add an environment variable named `OPENAI_API_KEY` with your OpenAI API key from https://platform.openai.com/api-keys .
3. Save/deploy the environment changes. **Never put the key into GitHub or `render.yaml`.**
4. Refresh your website; the OpenAI key field will say that a server key is configured.

Option B: Leave `OPENAI_API_KEY` unset in Render and paste your API key into the website on each visit. The key is used only for that request and is not saved by this app. Photos and entered keys are transferred to YOUR Render backend, then to OpenAI using HTTPS.

Without either kind of API key, the tool still creates a strict **generic JSON template**, but it cannot inspect what is shown in the photos.

## Step 4 — Use the website
1. Upload up to four photos of **you** (face front, 3/4 angle, profile, full body if useful).
2. Upload/paste the target image that you want to recreate.
3. Click **Generate identity-locked JSON**.
4. Copy or download the prompt. To create an image in another generator, include **both sets of reference photos** along with your JSON prompt. This app generates JSON, not image files.

## Alternative: Deploy via Web Service manually
Instead of Blueprint, choose **New → Web Service**, connect the repository, choose **Python 3**, **Free**, build command `python -m py_compile server.py`, start command `python server.py --no-browser`, and environment variable `SITE_PASSWORD` = your own secret. Set the health check to `/health` if requested.

## Domain name
Your Render website automatically receives an HTTPS `onrender.com` address. To use a custom domain like `studio.yourdomain.com`, add it in Render > Settings > Custom Domains, then set the DNS records at your registrar according to Render's instructions.

## Costs and privacy
- Render offers a free trial/hobby web service tier subject to resource and spin-down limits. Production use may require a paid instance.
- Actual AI vision requests are **charged separately by OpenAI API**. ChatGPT subscriptions don't include API credits.
- The app does not store user photos or keys on disk, but your hosting provider and OpenAI process image data for AI-enabled requests. Don't use a shared server key for a publicly accessible app without enforcing access control and usage limits. This package protects your private site using a password.
- A detailed prompt cannot mathematically guarantee zero facial drift; the downstream image-generation model must support the attached reference photos.
