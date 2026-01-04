// Authentication middleware for verifying Google ID tokens
const axios = require('axios');

async function verifyGoogleToken(req, res, next) {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: 'No authentication token provided' 
    });
  }

  const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify the ID token with Google
    // For production, you should use the google-auth-library package for proper verification
    // This is a simplified version that fetches user info to verify the token is valid
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/tokeninfo', {
      params: {
        id_token: idToken
      }
    });

    const tokenInfo = userInfoResponse.data;

    // Check if token is valid and not expired
    if (tokenInfo.error) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token: ' + tokenInfo.error 
      });
    }

    // Attach user info to request
    req.user = {
      id: tokenInfo.sub || tokenInfo.user_id,
      email: tokenInfo.email,
      name: tokenInfo.name,
      picture: tokenInfo.picture
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
}

module.exports = verifyGoogleToken;
