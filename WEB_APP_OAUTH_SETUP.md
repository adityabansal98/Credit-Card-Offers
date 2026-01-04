# Web Application OAuth Client Setup

Since you're using a **Web application** OAuth client (instead of Chrome extension OAuth client), you need to configure the backend with your Client ID and Client Secret.

## Backend Configuration

1. **Add to backend `.env` file:**
   ```
   GOOGLE_CLIENT_ID=your-web-app-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   ```

2. **Get your credentials from Google Cloud Console:**
   - Go to https://console.cloud.google.com/apis/credentials
   - Find your Web application OAuth client
   - Copy the **Client ID** and **Client Secret**
   - Add them to your backend `.env` file

3. **Important: Redirect URI in Google Cloud Console**
   - Make sure your Web application OAuth client has this redirect URI added:
   - `https://<your-extension-id>.chromiumapp.org/`
   - For example: `https://nhalpmjkaoljbbcddmjhdchikcghdlim.chromiumapp.org/`
   - This should be in "Authorized redirect URIs" section

4. **Restart your backend server** after updating `.env`

## How It Works Now

1. Extension initiates OAuth flow with your Web app Client ID
2. User authorizes on Google
3. Extension receives authorization code
4. Extension sends code to backend `/api/auth/callback`
5. Backend exchanges code for tokens (using Client Secret)
6. Backend returns tokens and user info to extension
7. Extension stores tokens and displays user info

## Testing

1. Make sure backend is running with updated `.env` file
2. Try signing in from the extension
3. Token exchange should now work!

