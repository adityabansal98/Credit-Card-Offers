# Deploy Frontend + Backend to Vercel

You can deploy both frontend and backend on Vercel! The backend will run as serverless functions.

## What Was Set Up

1. **`api/index.js`** - Serverless function entry point that wraps your Express app
2. **Updated `vercel.json`** - Routes API calls to serverless functions, serves frontend as static files
3. **Root `package.json`** - Contains all dependencies needed for Vercel deployment

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
   - **Root Directory**: `shopping` (or leave blank if shopping is the repo root)
   - **Output Directory**: `frontend`
   - **Build Command**: (leave empty)
   - **Install Command**: (leave empty)

4. **Add Environment Variables**:
   Go to Project Settings → Environment Variables and add:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_KEY` - Your Supabase anon/public key
   - `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID (Web application)
   - `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret
   - `NODE_ENV` - Set to `production`

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

4. **Set environment variables** (or set them in dashboard):
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_KEY
   vercel env add GOOGLE_CLIENT_ID
   vercel env add GOOGLE_CLIENT_SECRET
   vercel env add NODE_ENV
   ```

5. **Deploy**:
   ```bash
   vercel
   ```
   
   Follow the prompts and select your settings.

6. **For production deployment**:
   ```bash
   vercel --prod
   ```

## Update Google OAuth Redirect URI

After deployment, add your Vercel URL to Google Cloud Console:

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Open your Web application OAuth client
3. Add to **Authorized redirect URIs**:
   - `https://your-vercel-app.vercel.app/`
   - (or your custom domain if you set one up)

## How It Works

- **Frontend**: Served as static files from the `frontend` directory
- **Backend API**: Runs as serverless functions in the `api` directory
- **Routing**: 
  - `/api/*` routes → Serverless functions (`api/index.js`)
  - All other routes → Frontend SPA (`frontend/index.html`)

## Testing

1. Visit your Vercel deployment URL
2. Test the API: `https://your-app.vercel.app/api/health`
3. Click "Sign in with Google" on the web UI
4. Complete OAuth flow
5. Verify offers load correctly

## Notes

- The backend runs as serverless functions (cold starts may occur on first request)
- Environment variables are set in Vercel dashboard
- The frontend API URL uses `window.location.origin`, which will automatically use your Vercel domain
- Both frontend and backend are on the same domain, so CORS is handled automatically
- Serverless functions have execution time limits (30 seconds default, configurable)

## Troubleshooting

- **API calls fail**: Check environment variables are set correctly
- **Cold start delays**: First request to API may be slow (normal for serverless)
- **OAuth errors**: Make sure redirect URI is added to Google Cloud Console
- **Database errors**: Verify Supabase credentials in environment variables

