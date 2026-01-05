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
    capitalOne: document.getElementById('capitalOneCount'),
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
        loadOffers(); // This will calculate and display stats from the loaded offers
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

        // Load offers after sign in (stats will be calculated automatically)
        loadOffers();
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

// Load statistics - DEPRECATED: Stats are now calculated from allOffers in updateStats()
// Keeping this function for backward compatibility but it's no longer called
async function loadStats() {
    console.warn('loadStats() is deprecated - stats are calculated from loaded offers');
    return;
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

// Merchant name to domain mapping
const MERCHANT_DOMAIN_MAP = {
    'banter by piercing pagoda': 'banter.com',
    'replit': 'replit.com',
    'hellofresh': 'hellofresh.com',
    'nativepath': 'nativepath.com',
    'aka hotels & residences': 'stayaka.com',
    'intimissimi': 'intimissimi.com',
    'saxx underwear': 'saxxunderwear.com',
    'litter-robot': 'litter-robot.com',
    'farmgirl flowers': 'farmgirlflowers.com',
    'event tickets center': 'eventticketscenter.com',
    'ritual': 'ritual.com',
    'the bouqs co': 'bouqs.com',
    'canon': 'canon.com',
    'lotte hotel seattle': 'lottehotel.com',
    'maurices': 'maurices.com',
    'kiwico': 'kiwico.com',
    'morgenthal frederics': 'morgenthalfrederics.com',
    'ariat': 'ariat.com',
    'express': 'express.com',
    'shiseido': 'shiseido.com',
    'grüns': 'gruns.co',
    'cozy earth': 'cozyearth.com',
    'aarp': 'aarp.org',
    'ruggable': 'ruggable.com',
    'armra': 'tryarmra.com',
    'lensdirect': 'lensdirect.com',
    'redken': 'redken.com',
    'harper wilde': 'harperwilde.com',
    'fanatics': 'fanatics.com',
    'daily harvest': 'daily-harvest.com',
    'consumer reports': 'consumerreports.org',
    'popstroke': 'popstroke.com',
    'the friendly toast': 'thefriendlytoast.com',
    'tommy john': 'tommyjohn.com',
    'straight talk': 'straighttalk.com',
    'wilson': 'wilson.com',
    'pureology': 'pureology.com',
    'green chef': 'greenchef.com',
    'fubotv': 'fubo.tv',
    'liquid iv': 'liquid-iv.com',
    'eva air': 'evaair.com',
    'air india': 'airindia.com',
    'whisker': 'whisker.com',
    'tracfone': 'tracfone.com',
    'zenni optical': 'zennioptical.com',
    'johnson fitness & wellness': 'johnsonfitness.com',
    'meta store': 'meta.com',
    'menotomy grill & tavern': 'menotomygrill.com',
    'hatch': 'hatch.co',
    'visible by verizon': 'visible.com',
    'solgaard': 'solgaard.co',
    'hp': 'hp.com',
    'thuma': 'thuma.co',
    'optimum': 'optimum.com',
    'ticketsmarter': 'ticketsmarter.com',
    'jamba juice': 'jamba.com',
    'sling tv': 'sling.com',
    'att wireless': 'att.com',
    'paramount plus': 'paramountplus.com',
    'total wireless': 'totalwireless.com',
    'the farmers dog': 'thefarmersdog.com',
    'once upon a farm': 'onceuponafarmorganics.com',
    'seatgeek': 'seatgeek.com',
    'the economist': 'economist.com',
    'lululemon': 'lululemon.com',
    'tonal': 'tonal.com',
    'elizabeth arden': 'elizabetharden.com',
    'bissell': 'bissell.com',
    'sony electronics': 'sony.com',
    'misfits market': 'misfitsmarket.com',
    'aldo': 'aldoshoes.com',
    'viator': 'viator.com',
    'blue apron': 'blueapron.com',
    'fragrance.com': 'fragrance.com',
    'iherb': 'iherb.com',
    'dropbox': 'dropbox.com',
    'cookunity': 'cookunity.com',
    'nordictrack': 'nordictrack.com',
    'ancestry': 'ancestry.com',
    'kohler': 'kohler.com',
    'wild alaskan company': 'wildalaskancompany.com',
    'turbotax': 'turbotax.intuit.com',
    'prenuvo': 'prenuvo.com',
    'ag1': 'drinkag1.com',
    'calm': 'calm.com',
    'true religion': 'truereligion.com',
    'trust & will': 'trustandwill.com',
    'prettylitter': 'prettylitter.com',
    'grown brilliance': 'grownbrilliance.com',
    'onnit': 'onnit.com',
    'glassesusa': 'glassesusa.com',
    'therabody': 'therabody.com',
    'tory burch': 'toryburch.com',
    'youtube tv': 'tv.youtube.com',
    'home chef': 'homechef.com',
    'smashburger': 'smashburger.com',
    'airalo': 'airalo.com',
    'brilliant earth': 'brilliantearth.com',
    'the vitamin shoppe': 'vitaminshoppe.com',
    'oxo': 'oxo.com',
    'bloomsybox': 'bloomsybox.com',
    'turo': 'turo.com',
    'rugs usa': 'rugsusa.com',
    'olaplex': 'olaplex.com',
    'h&r block': 'hrblock.com',
    'lg': 'lg.com',
    'expedia amex': 'expedia.com',
    'briggs & riley': 'briggs-riley.com',
    'sweetwater': 'sweetwater.com',
    'pura': 'pura.com',
    'nobull': 'nobullproject.com',
    'natori': 'natori.com',
    'gorjana': 'gorjana.com',
    'burberry': 'burberry.com',
    'staud': 'staud.clothing',
    'cnn': 'cnn.com',
    'zagg': 'zagg.com',
    'branch basics': 'branchbasics.com',
    'bed bath & beyond': 'bedbathandbeyond.com',
    'newegg': 'newegg.com',
    'bonobos': 'bonobos.com',
    'southern tide': 'southerntide.com',
    'gametime': 'gametime.co',
    'cotopaxi': 'cotopaxi.com',
    'gainful': 'gainful.com',
    'factor': 'factor75.com',
    'mizzen+main': 'mizzenandmain.com',
    'teleflora': 'teleflora.com',
    'guardian bikes': 'guardianbikes.com',
    'fair harbor': 'fairharborclothing.com',
    'jared': 'jared.com',
    'peak design': 'peakdesign.com',
    'purple': 'purple.com',
    'maui jim': 'mauijim.com',
    'qdoba': 'qdoba.com',
    'the motley fool': 'fool.com',
    'away': 'awaytravel.com',
    'contacts direct': 'contactsdirect.com',
    'eyebuydirect': 'eyebuydirect.com',
    'steve madden': 'stevemadden.com',
    'rag & bone': 'rag-bone.com',
    'simplehuman': 'simplehuman.com',
    '1-800-flowers': '1800flowers.com',
    'betterhelp': 'betterhelp.com',
    'stretchlab': 'stretchlab.com',
    'biossance': 'biossance.com',
    'quickbooks': 'quickbooks.intuit.com',
    'simple tire': 'simpletire.com',
    'mackage': 'mackage.com',
    'office supply': 'officesupply.com',
    'the atlantic': 'theatlantic.com',
    'versace': 'versace.com',
    'faherty': 'fahertybrand.com',
    'negative underwear': 'negativeunderwear.com',
    'levis': 'levi.com',
    'tommy hilfiger': 'tommy.com',
    'hbo max': 'max.com',
    'zwilling': 'zwilling.com',
    'walmart plus': 'walmart.com',
    'discovery plus': 'discoveryplus.com',
    'ariat': 'ariat.com',
    'tulum mexican cuisine': 'tulummexicancuisine.com',
    'wilson': 'wilson.com',
    'aldo': 'aldoshoes.com',
    'smashburger': 'smashburger.com',
    'teleflora': 'teleflora.com',
    'jamba juice': 'jamba.com',
    'fragrance.com': 'fragrance.com',
    'the vitamin shoppe': 'vitaminshoppe.com',
    'paramount+': 'paramountplus.com',
    'bloomsybox': 'bloomsybox.com',
    'blue apron': 'blueapron.com',
    'harper wilde': 'harperwilde.com',
    'glassesusa.com': 'glassesusa.com',
    'solea restaurant and tapas bar': 'solearestaurant.com',
    'once upon a farm': 'onceuponafarmorganics.com',
    'pizzeria enzina': 'enzinadc.com',
    'cozy earth': 'cozyearth.com',
    'cafe saint germain': 'cafesaintgermain.com',
    'redken': 'redken.com',
    'grüns': 'gruns.co',
    'popstroke': 'popstroke.com',
    'tremonte restaurant and bar': 'tremonterestaurant.com',
    'straight talk': 'straighttalk.com',
    'the fat greek': 'thefatgreekdc.com',
    'airalo': 'airalo.com',
    'the friendly toast': 'thefriendlytoast.com',
    'sony electronics': 'sony.com',
    'love at first bite thai kitchen': 'loveatfirstbitethai.com',
    'mamaleh\'s delicatessen': 'mamalehs.com',
    'grown brilliance': 'grownbrilliance.com',
    'what a soup': 'whatasoup.com',
    'eva air': 'evaair.com',
    'circle k in-store': 'circlek.com',
    'onnit labs': 'onnit.com',
    'express': 'express.com',
    'turo': 'turo.com',
    'tommy john': 'tommyjohn.com',
    'green chef': 'greenchef.com',
    'turbotax': 'turbotax.intuit.com',
    'liquid i.v.': 'liquid-iv.com',
    'tonal': 'tonal.com',
    'johnson fitness & wellness': 'johnsonfitness.com',
    'lensdirect': 'lensdirect.com',
    'shiseido': 'shiseido.com',
    'ticketsmarter': 'ticketsmarter.com',
    'visible by verizon': 'visible.com',
    'elizabeth arden': 'elizabetharden.com',
    'therabody': 'therabody.com',
    'meta store': 'meta.com',
    'bissell': 'bissell.com',
    'dropbox': 'dropbox.com',
    'air india': 'airindia.com',
    'seatgeek': 'seatgeek.com',
    'zenni optical': 'zennioptical.com',
    'youtube tv': 'tv.youtube.com',
    'true religion': 'truereligion.com',
    'ag1': 'drinkag1.com',
    'kipling': 'kipling-usa.com',
    'sling tv': 'sling.com',
    'ruggable': 'ruggable.com',
    'nordictrack': 'nordictrack.com',
    'consumer reports': 'consumerreports.org',
    'hellofresh': 'hellofresh.com',
    'nuts.com': 'nuts.com',
    'solgaard': 'solgaard.co',
    'prettylitter cat litter': 'prettylitter.com',
    'viator': 'viator.com',
    'whisker': 'whisker.com',
    'ancestry': 'ancestry.com',
    'wild alaskan company': 'wildalaskancompany.com',
    'hatch': 'hatch.co',
    'oxo': 'oxo.com',
    'iherb': 'iherb.com',
    'trust & will': 'trustandwill.com',
    'forme': 'forme.life',
    'fubotv': 'fubo.tv',
    'the economist': 'economist.com',
    'tory burch': 'toryburch.com',
    'event tickets center': 'eventticketscenter.com',
    'lands\' end': 'landsend.com',
    'the farmer\'s dog': 'thefarmersdog.com',
    'pureology': 'pureology.com',
    'just salad': 'justsalad.com',
    'hp': 'hp.com',
    'misfits market': 'misfitsmarket.com',
    'kohler': 'kohler.com',
    'fanatics': 'fanatics.com',
    'lululemon': 'lululemon.com'
};

// Helper function to get domain for a merchant name
function getMerchantDomain(merchant) {
    if (!merchant) return null;

    // First check if it's already a URL pattern
    const urlPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (urlPattern.test(merchant.trim())) {
        return merchant.toLowerCase().replace(/^www\./, '');
    }

    // Look up in merchant mapping (case-insensitive)
    const normalizedName = merchant.toLowerCase().trim();
    return MERCHANT_DOMAIN_MAP[normalizedName] || null;
}

// Helper function to create merchant display with optional favicon and link
function createMerchantDisplay(merchant) {
    const escapedMerchant = escapeHtml(merchant || 'Unknown Merchant');
    const domain = getMerchantDomain(merchant);

    if (domain) {
        // Has a domain - show with favicon and make clickable
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;

        return `<a href="https://${domain}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; color: inherit;">
            <img src="${faviconUrl}" alt="" width="16" height="16" loading="lazy" style="flex-shrink: 0;" onerror="this.style.display='none'">
            <span style="text-decoration: underline;">${escapedMerchant}</span>
        </a>`;
    }

    return escapedMerchant;
}

// Helper function to get source favicon URL
function getSourceFaviconUrl(source) {
    const faviconMap = {
        'Amex': 'https://www.google.com/s2/favicons?domain=americanexpress.com&sz=16',
        'Chase': 'https://www.google.com/s2/favicons?domain=chase.com&sz=16',
        'Capital One': 'https://www.capitalone.com/assets/shell/favicon.ico'
    };
    return faviconMap[source] || null;
}

// Helper function to create source badge with favicon
function createSourceBadge(source, sourceClass) {
    const escapedSource = escapeHtml(source);
    const faviconUrl = getSourceFaviconUrl(source);

    if (faviconUrl) {
        return `<span class="source-badge ${sourceClass}" style="display: inline-flex; align-items: center; gap: 6px;">
            <img src="${faviconUrl}" alt="" width="16" height="16" loading="lazy" style="flex-shrink: 0;" onerror="this.style.display='none'">
            ${escapedSource}
        </span>`;
    }

    return `<span class="source-badge ${sourceClass}">${escapedSource}</span>`;
}

// Create offer card element
function createOfferCard(offer) {
    const card = document.createElement('div');
    card.className = 'offer-card';

    const sourceClass = offer.source.toLowerCase().replace(/\s+/g, '-');
    const statusClass = (offer.status || 'Available').toLowerCase().replace(/\s+/g, '-');

    card.innerHTML = `
        <div class="offer-header">
            <div class="offer-merchant">${createMerchantDisplay(offer.merchant)}</div>
            ${createSourceBadge(offer.source, sourceClass)}
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
        capitalOne: allOffers.filter(o => o.source === 'Capital One').length,
        email: allOffers.filter(o => o.source === 'Email').length
    };

    updateStatsDisplay(stats);
}

function updateStatsDisplay(stats) {
    // Add fallback for all stats to prevent "undefined" display
    statsElements.total.textContent = stats.total || 0;
    statsElements.amex.textContent = stats.amex || 0;
    statsElements.chase.textContent = stats.chase || 0;
    statsElements.capitalOne.textContent = stats.capitalOne || 0;
    statsElements.email.textContent = stats.email || 0;
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
