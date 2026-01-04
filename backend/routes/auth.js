const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST /api/auth/callback - OAuth callback endpoint
// This endpoint exchanges the Google OAuth code for access token and user info
router.post('/callback', async (req, res) => {
    try {
        const { code, redirect_uri } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, error: 'Missing authorization code' });
        }

        // Get Google OAuth credentials from environment
        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            return res.status(500).json({
                success: false,
                error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
            });
        }

        // Exchange authorization code for tokens
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code: code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        });

        const { access_token, id_token } = tokenResponse.data;

        if (!access_token || !id_token) {
            return res.status(500).json({
                success: false,
                error: 'Failed to get tokens from Google'
            });
        }

        // Get user info from Google using access token
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const userInfo = userInfoResponse.data;

        // Return tokens and user info
        res.json({
            success: true,
            access_token: id_token, // Use ID token for authentication (contains user info and is verifiable)
            user: {
                id: userInfo.id,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                given_name: userInfo.given_name,
                family_name: userInfo.family_name
            }
        });
    } catch (error) {
        console.error('Auth callback error:', error);
        const errorMessage = error.response?.data?.error_description || error.message;
        res.status(500).json({ success: false, error: errorMessage });
    }
});

module.exports = router;
