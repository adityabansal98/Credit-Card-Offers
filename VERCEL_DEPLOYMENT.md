# Deploy Web UI to Vercel

## Prerequisites

1. Vercel account (sign up at https://vercel.com if needed)
2. Vercel CLI installed (optional, but recommended):
   ```bash
   npm install -g vercel
   ```

## Deployment Steps

### Option 1: Deploy via Vercel Website (Recommended)

1. **Push your code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push
   ```

2. **Go to Vercel Dashboard**:
   - Visit https://vercel.com
   - Click "Add New..." → "Project"
   - Import your GitHub repository

3. **Configure the project**:
   - **Framework Preset**: Other
   - **Root Directory**: `shopping` (or the directory containing frontend folder)
   - **Output Directory**: `frontend`
   - **Build Command**: (leave empty)
   - **Install Command**: (leave empty)

4. **Add Environment Variables** (if needed):
   - Go to Project Settings → Environment Variables
   - Add any needed variables (currently none required for frontend-only deployment)

5. **Deploy**: Click "Deploy"

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm install -g vercel
   ```

2. **Navigate to project root**:
   ```bash
   cd /Users/adityabansal/credit-card-offers/shopping
   ```

3. **Login to Vercel**:
   ```bash
   vercel login
   ```

4. **Deploy**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? (select your account)
   - Link to existing project? **No** (or Yes if you've deployed before)
   - Project name: (enter a name or press Enter for default)
   - Directory: **shopping/frontend** (or just use the vercel.json config)

5. **For production deployment**:
   ```bash
   vercel --prod
   ```

## Important: Update API URL for Production

After deployment, you'll need to update the API URL in `frontend/app.js` to point to your backend:

**Current code** (line 2):
```javascript
const API_BASE_URL = window.location.origin;
```

This works if your backend is on the same domain, but if your backend is on a different URL (like Railway, Render, etc.), you'll need to:

**Option A: Use environment variable** (recommended):
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
```

**Option B: Hardcode production URL**:
```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-url.com' 
  : window.location.origin;
```

For Vercel environment variables:
1. Go to Project Settings → Environment Variables
2. Add: `VITE_API_URL` = `https://your-backend-url.com`
3. Redeploy

## Update Google OAuth Redirect URI

After deployment, add your Vercel URL to Google Cloud Console:

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Open your Web application OAuth client
3. Add to **Authorized redirect URIs**:
   - `https://your-vercel-app.vercel.app/`
   - (or your custom domain if you set one up)

## Testing

1. Visit your Vercel deployment URL
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify offers load correctly

## Notes

- The `vercel.json` file configures Vercel to serve the frontend folder as a static site
- The backend API should be deployed separately (Railway, Render, etc.)
- Make sure your backend CORS settings allow requests from your Vercel domain
- Environment variables can be set in Vercel dashboard for different environments (production, preview, development)

