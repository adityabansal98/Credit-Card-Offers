// API Configuration
const API_BASE_URL = window.location.origin; // Use same origin as frontend
const API_URL = `${API_BASE_URL}/api/offers`;

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = '1049006920180-evpusgghi0f207usbm48o2sg4vu009gt.apps.googleusercontent.com';

// State
let allOffers = [];
let filteredOffers = [];
let currentSourceFilter = 'all';
let currentSearchQuery = '';
let googleAccessToken = null;
let googleUser = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const offersContainer = document.getElementById('offersContainer');
const emptyState = document.getElementById('emptyState');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const filterButtons = document.querySelectorAll('.filter-btn');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const authNotSignedIn = document.getElementById('authNotSignedIn');
const authSignedIn = document.getElementById('authSignedIn');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');
const statsElements = {
    total: document.getElementById('totalOffers'),
    amex: document.getElementById('amexCount'),
    chase: document.getElementById('chaseCount'),
    email: document.getElementById('emailCount')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for OAuth callback
    handleOAuthCallback();

    // Initialize auth
    initAuth();

    setupEventListeners();

    // Only load offers if signed in
    if (googleAccessToken) {
        loadOffers();
        loadStats();
    } else {
        showError('Please sign in to view your offers');
    }
});

// ========== AUTHENTICATION FUNCTIONS ==========

function initAuth() {
    // Load stored session
    const storedToken = localStorage.getItem('googleAccessToken');
    const storedUser = localStorage.getItem('googleUser');

    if (storedToken && storedUser) {
        googleAccessToken = storedToken;
        googleUser = JSON.parse(storedUser);
        updateAuthUI(true);
    } else {
        updateAuthUI(false);
    }
}

function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
        console.error('OAuth error:', error);
        showError('Sign in failed: ' + error);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    if (code) {
        // Exchange code for tokens
        exchangeCodeForTokens(code);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function signInWithGoogle() {
    if (!GOOGLE_CLIENT_ID) {
        showError('Google OAuth not configured');
        return;
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=openid profile email&` +
        `access_type=offline&` +
        `prompt=consent`;

    // Redirect to Google OAuth
    window.location.href = googleOAuthUrl;
}

async function exchangeCodeForTokens(code) {
    try {
        showLoading();
        hideError();

        const redirectUri = `${window.location.origin}${window.location.pathname}`;

        const tokenResponse = await fetch(`${API_BASE_URL}/api/auth/callback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, redirect_uri: redirectUri })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Token exchange failed');
        }

        const tokenData = await tokenResponse.json();

        if (!tokenData.success) {
            throw new Error(tokenData.error || 'Token exchange failed');
        }

        // Store tokens and user info
        googleAccessToken = tokenData.access_token;
        googleUser = tokenData.user;

        localStorage.setItem('googleAccessToken', googleAccessToken);
        localStorage.setItem('googleUser', JSON.stringify(googleUser));

        updateAuthUI(true);
        hideLoading();

        // Load offers after sign in
        loadOffers();
        loadStats();
    } catch (error) {
        console.error('Token exchange error:', error);
        showError('Authentication failed: ' + error.message);
        hideLoading();
    }
}

function signOut() {
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleUser');
    googleAccessToken = null;
    googleUser = null;
    updateAuthUI(false);
    allOffers = [];
    filteredOffers = [];
    renderOffers();
    showError('Please sign in to view your offers');
}

function updateAuthUI(isSignedIn) {
    if (isSignedIn && googleUser) {
        authNotSignedIn.classList.add('hidden');
        authSignedIn.classList.remove('hidden');
        userName.textContent = googleUser.name || googleUser.email || 'User';
        userEmail.textContent = googleUser.email || '';
        if (googleUser.picture) {
            userAvatar.src = googleUser.picture;
            userAvatar.style.display = 'block';
        } else {
            userAvatar.style.display = 'none';
        }
    } else {
        authNotSignedIn.classList.remove('hidden');
        authSignedIn.classList.add('hidden');
    }
}

function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (googleAccessToken) {
        headers['Authorization'] = `Bearer ${googleAccessToken}`;
    }

    return headers;
}

// ========== END AUTHENTICATION FUNCTIONS ==========

// Event Listeners
function setupEventListeners() {
    // Auth buttons
    if (signInBtn) {
        signInBtn.addEventListener('click', signInWithGoogle);
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
    }

    // Search input
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        filterOffers();
    });

    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update filter
            currentSourceFilter = btn.dataset.source;
            filterOffers();
        });
    });
}

// Load offers from API
async function loadOffers() {
    if (!googleAccessToken) {
        return;
    }

    showLoading();
    hideError();

    try {
        const response = await fetch(API_URL, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success) {
            allOffers = result.data || [];
            filterOffers();
            updateStats();
        } else {
            if (response.status === 401) {
                // Token expired or invalid
                signOut();
                showError('Session expired. Please sign in again.');
            } else {
                showError(result.error || 'Failed to load offers');
            }
        }
    } catch (error) {
        console.error('Error loading offers:', error);
        showError('Failed to connect to server. Make sure the backend is running.');
    } finally {
        hideLoading();
    }
}

// Load statistics
async function loadStats() {
    if (!googleAccessToken) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/stats`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success) {
            updateStatsDisplay(result.data);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Filter offers based on search and source
function filterOffers() {
    filteredOffers = allOffers.filter(offer => {
        // Source filter
        if (currentSourceFilter !== 'all' && offer.source !== currentSourceFilter) {
            return false;
        }

        // Search filter
        if (currentSearchQuery) {
            const merchant = (offer.merchant || '').toLowerCase();
            const description = (offer.description || '').toLowerCase();
            const searchLower = currentSearchQuery.toLowerCase();

            if (!merchant.includes(searchLower) && !description.includes(searchLower)) {
                return false;
            }
        }

        return true;
    });

    renderOffers();
}

// Render offers to DOM
function renderOffers() {
    offersContainer.innerHTML = '';

    if (filteredOffers.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    filteredOffers.forEach(offer => {
        const card = createOfferCard(offer);
        offersContainer.appendChild(card);
    });
}

// Create offer card element
function createOfferCard(offer) {
    const card = document.createElement('div');
    card.className = 'offer-card';

    const sourceClass = offer.source.toLowerCase();
    const statusClass = (offer.status || 'Available').toLowerCase().replace(/\s+/g, '-');

    card.innerHTML = `
        <div class="offer-header">
            <div class="offer-merchant">${escapeHtml(offer.merchant || 'Unknown Merchant')}</div>
            <span class="source-badge ${sourceClass}">${escapeHtml(offer.source)}</span>
        </div>
        <div class="offer-description">${escapeHtml(offer.description || 'No description available')}</div>
        <div class="offer-details">
            ${offer.discount ? `<div class="offer-discount">💰 ${escapeHtml(offer.discount)}</div>` : ''}
            ${offer.expiry_date ? `<div class="offer-expiry">⏰ Expires: ${escapeHtml(offer.expiry_date)}</div>` : ''}
            ${offer.status ? `<span class="offer-status ${statusClass}">${escapeHtml(offer.status)}</span>` : ''}
        </div>
    `;

    return card;
}

// Update statistics display
function updateStats() {
    const stats = {
        total: allOffers.length,
        amex: allOffers.filter(o => o.source === 'Amex').length,
        chase: allOffers.filter(o => o.source === 'Chase').length,
        email: allOffers.filter(o => o.source === 'Email').length
    };

    updateStatsDisplay(stats);
}

function updateStatsDisplay(stats) {
    statsElements.total.textContent = stats.total;
    statsElements.amex.textContent = stats.amex;
    statsElements.chase.textContent = stats.chase;
    statsElements.email.textContent = stats.email;
}

// Utility functions
function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    errorDiv.classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
