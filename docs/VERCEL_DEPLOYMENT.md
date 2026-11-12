# Vercel Deployment Guide

This guide explains how to deploy the **MySMS Dashboard** React website to Vercel.

---

## 1. Project Configuration

The website is a React + Vite + TypeScript single-page application located in `web-dashboard/`.

### Deployment Settings:
- **Framework Preset**: Vite
- **Root Directory**: `web-dashboard`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

---

## 2. Environment Variables Configuration

Set these environment variables in your Vercel Project Settings (**Settings -> Environment Variables**):

| Variable Name | Environment | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Production, Preview, Development | Your Supabase project URL (`https://<project-ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview, Development | Your Supabase public anon key |

> [!IMPORTANT]
> Never expose the Supabase `service_role` key in frontend environment variables. Only the public `anon` key should be used in the client bundle.

---

## 3. Deploying via Vercel CLI

1. Open terminal in the `web-dashboard` directory:
   ```bash
   cd web-dashboard
   ```
2. Link project:
   ```bash
   vercel link
   ```
3. Deploy to production:
   ```bash
   vercel --prod
   ```

---

## 4. Deploying via GitHub Git Integration

1. Commit and push the repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete MySMS system"
   git push origin main
   ```
2. In the Vercel Dashboard:
   - Click **Add New... -> Project**.
   - Select your GitHub repository.
   - Set **Root Directory** to `web-dashboard`.
   - Add the two environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
   - Click **Deploy**.
3. Vercel automatically builds and provides a production HTTPS URL (e.g. `https://mysms-dashboard.vercel.app`).

---

## 5. Client-Side Routing Configuration (`vercel.json`)

To prevent 404 errors on browser page reloads in single page applications (SPAs), `web-dashboard/vercel.json` contains:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
