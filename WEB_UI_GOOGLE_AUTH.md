# Web UI Google Authentication Setup

Google Sign-In has been added to the web UI. Users can now sign in and see only their own offers.

## What Was Added

1. **Sign-In Button** - Google Sign-In button in the header
2. **User Info Display** - Shows user name, email, and profile picture when signed in
3. **Sign-Out Button** - Allows users to sign out
4. **Authentication Flow** - OAuth flow with token exchange via backend
5. **Protected API Calls** - All API calls now include authentication token

## Configuration Needed

### 1. Google Cloud Console Setup

Make sure your **Web application** OAuth client has the correct redirect URI:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Open your **Web application** OAuth client
3. Add to **Authorized redirect URIs**:
   - For local development: `http://localhost:3001/` (or whatever port your backend runs on)
   - For production: `https://your-domain.com/`
4. Save the changes

### 2. Update Client ID (if needed)

The frontend uses the same Google Client ID. Make sure it's correct in `frontend/app.js`:
- Line 7: `const GOOGLE_CLIENT_ID = 'your-client-id.apps.googleusercontent.com';`

If you want to use a different OAuth client for the web UI:
- Create a new Web application OAuth client in Google Cloud Console
- Update the Client ID in `frontend/app.js`

## How It Works

1. User clicks "Sign in with Google"
2. Redirects to Google OAuth consent screen
3. User authorizes
4. Google redirects back to your site with authorization code
5. Frontend sends code to backend `/api/auth/callback`
6. Backend exchanges code for tokens (using Client Secret)
7. Backend returns ID token and user info
8. Frontend stores token in localStorage
9. All API calls include the token in Authorization header
10. Backend verifies token and filters offers by user_id

## Testing

1. Start your backend server
2. Open the web UI (http://localhost:3001)
3. Click "Sign in with Google"
4. Complete the OAuth flow
5. You should see your user info in the header
6. Offers should load (filtered by your user_id)

## Features

- ✅ Sign in with Google
- ✅ User info display (name, email, picture)
- ✅ Sign out functionality
- ✅ Token stored in localStorage (persists across page reloads)
- ✅ All API calls authenticated
- ✅ Only user's own offers are displayed
- ✅ Responsive design (works on mobile)

## Notes

- Tokens are stored in localStorage (consider using httpOnly cookies for production)
- The same backend `/api/auth/callback` endpoint is used for both extension and web UI
- Make sure your Web application OAuth client has the correct redirect URI

