// Popup script for Credit Card Offers Extractor
// Note: MERCHANT_DOMAIN_MAP and getMerchantDomain are loaded from merchantDomains.js

// Global error handler to ensure popup always renders
window.addEventListener('error', (event) => {
    console.error('[Popup] Global error caught:', event.error);
    // Ensure UI is visible even if there's an error
    const container = document.querySelector('.container');
    if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Popup] DOMContentLoaded - initializing popup');

    // Ensure container is visible
    const container = document.querySelector('.container');
    if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
    }
    const extractBtn = document.getElementById('extractBtn');
    const syncBtn = document.getElementById('syncBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const offersList = document.getElementById('offersList');
    const offerCount = document.getElementById('offerCount');
    const instructions = document.getElementById('instructions');

    // Auth UI elements
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const authNotSignedIn = document.getElementById('authNotSignedIn');
    const authSignedIn = document.getElementById('authSignedIn');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');

    let currentOffers = [];
    let currentSite = 'unknown';
    let googleAccessToken = null;
    let googleUser = null;

    // Google OAuth Configuration
    const GOOGLE_CLIENT_ID = '1049006920180-evpusgghi0f207usbm48o2sg4vu009gt.apps.googleusercontent.com';
    // Backend API URL - change this to your backend URL
    // For local development: http://localhost:3000
    // For production: your deployed backend URL
    const API_BASE_URL = 'https://cc-offers.vercel.app';
    const API_URL = `${API_BASE_URL}/api/offers`;

    // Initialize authentication
    try {
        initAuth();
    } catch (error) {
        console.error('[Popup] Error initializing auth:', error);
        // Ensure at least the sign-in UI is visible if auth init fails
        if (authNotSignedIn) {
            authNotSignedIn.classList.remove('hidden');
        }
    }
    // Extract unique domains from offers for background matching
    function extractDomainsFromOffers(offers) {
        const domains = new Set();
        offers.forEach(offer => {
            if (offer.merchant) {
                // Merchant is already a domain (e.g., "expedia.com" or "Amazon")
                const merchantLower = offer.merchant.toLowerCase();
                // Remove www. if present
                const cleanDomain = merchantLower.replace(/^www\./, '');
                domains.add(cleanDomain);
            }
        });
        return Array.from(domains);
    }

    // Extract domain from URL
    function getDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            let domain = urlObj.hostname;
            // Remove www. prefix if present
            domain = domain.replace(/^www\./, '');
            return domain;
        } catch (error) {
            return null;
        }
    }

    // Load and display offers for a specific merchant domain
    function loadMerchantOffers(domain) {
        chrome.storage.local.get(['lastExtractedOffers', 'offerDomains'], (data) => {
            console.log('[Popup] Loaded stored offers for merchant domain:', domain);
            const allOffers = data.lastExtractedOffers || [];
            const offerDomains = data.offerDomains || [];

            // Build comprehensive domain set using merchant domain mapping
            const offerDomainsSet = new Set(offerDomains);
            allOffers.forEach(offer => {
                if (!offer.merchant) return;
                // Add direct merchant domain
                const merchantLower = offer.merchant.toLowerCase().replace(/^www\./, '');
                offerDomainsSet.add(merchantLower);
                // Add mapped domain from MERCHANT_DOMAIN_MAP
                const mappedDomain = getMerchantDomain(offer.merchant);
                if (mappedDomain) {
                    offerDomainsSet.add(mappedDomain);
                }
            });

            console.log('[Popup] Checking domain', domain, 'against', offerDomainsSet.size, 'offer domains');

            // Check if this domain has offers
            if (!offerDomainsSet.has(domain)) {
                // No offers for this domain
                showStatus('⚠️ Please navigate to Amex, Chase or Capital One offers page first', 'warning');
                extractBtn.disabled = true;
                instructions.style.display = 'block';
                return;
            }

            // Filter offers for this specific domain (check both direct and mapped domains)
            const merchantOffers = allOffers.filter(offer => {
                if (!offer.merchant) return false;
                // Check direct merchant match
                const offerDomain = offer.merchant.toLowerCase().replace(/^www\./, '');
                if (offerDomain === domain) return true;
                // Check mapped domain match
                const mappedDomain = getMerchantDomain(offer.merchant);
                return mappedDomain === domain;
            });

            if (merchantOffers.length > 0) {
                currentOffers = merchantOffers;
                displayOffers(merchantOffers);
                instructions.style.display = 'none';
                extractBtn.disabled = true; // Can't extract on merchant sites
                syncBtn.disabled = false; // Can still sync

                // Show merchant-specific status
                showStatus(`💳 ${merchantOffers.length} offer${merchantOffers.length > 1 ? 's' : ''} available for ${domain}`, 'success');
            } else {
                showStatus('⚠️ Please navigate to Amex, Chase or Capital One offers page first', 'warning');
                extractBtn.disabled = true;
                instructions.style.display = 'block';
            }
        });
    }

    // Check if we're on a supported offers page
    try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
                console.error('[Popup] Error querying tabs:', chrome.runtime.lastError);
                return;
            }

            if (!tabs || tabs.length === 0) {
                console.error('[Popup] No active tabs found');
                return;
            }

            const currentTab = tabs[0];
            const url = currentTab.url || '';

            const isAmexPage = url.includes('americanexpress.com') &&
                (url.includes('/offers/eligible') || url.includes('/offers'));
            const isChasePage = url.includes('chase.com') && url.includes('merchantOffers');
            const isCapitalOnePage = url.includes('capitaloneoffers.com');

            if (isAmexPage) {
                currentSite = 'amex';
                if (instructions) instructions.style.display = 'none';
                loadStoredOffers();
            } else if (isChasePage) {
                currentSite = 'chase';
                if (instructions) instructions.style.display = 'none';
                loadStoredOffers();
            } else if (isCapitalOnePage) {
                currentSite = 'capitalone';
                if (instructions) instructions.style.display = 'none';
                loadStoredOffers();
            } else {
                // Check if this is a merchant page with offers
                const currentDomain = getDomainFromUrl(url);
                if (currentDomain) {
                    loadMerchantOffers(currentDomain);
                } else {
                    showStatus('⚠️ Please navigate to Amex, Chase or Capital One offers page first', 'warning');
                    if (extractBtn) extractBtn.disabled = true;
                    if (instructions) instructions.style.display = 'block';
                }
            }
        });
    } catch (error) {
        console.error('[Popup] Error in tab query:', error);
        // Ensure UI is visible even if there's an error
        if (instructions) instructions.style.display = 'block';
    }

    // Extract offers button
    extractBtn.addEventListener('click', () => {
        extractOffers();
    });

    // Sync to server button
    syncBtn.addEventListener('click', () => {
        syncToServer();
    });

    // Export button
    exportBtn.addEventListener('click', () => {
        exportToCSV();
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        clearResults();
    });

    // Auth button listeners
    if (signInBtn) {
        signInBtn.addEventListener('click', () => {
            console.log('[Auth] Sign in button clicked');
            signInWithGoogle();
        });
    } else {
        console.error('[Auth] Sign in button not found!');
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            signOut();
        });
    }

    async function checkContentScriptLoaded(tabId) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve(false);
                } else {
                    resolve(response && response.success === true);
                }
            });
        });
    }

    async function extractOffers() {
        showStatus('🔄 Extracting offers...', 'info');
        extractBtn.disabled = true;

        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs || tabs.length === 0) {
                showStatus('❌ Error: Could not get current tab. Please try again.', 'error');
                extractBtn.disabled = false;
                return;
            }

            const tabId = tabs[0].id;
            const tabUrl = tabs[0].url || '';
            console.log('[Popup] Checking content script for tab', tabId, 'URL:', tabUrl);

            // Check if content script is loaded
            const isLoaded = await checkContentScriptLoaded(tabId);
            if (!isLoaded) {
                console.warn('[Popup] Content script not loaded. Attempting to inject or refresh...');
                showStatus('⚠️ Content script not ready. Please refresh the page and try again.', 'warning');
                extractBtn.disabled = false;
                return;
            }

            console.log('[Popup] Content script confirmed loaded. Sending extract message...');

            // Set a timeout to handle cases where response never comes
            let responseReceived = false;
            const timeout = setTimeout(() => {
                if (!responseReceived) {
                    console.error('[Popup] Message timeout - content script may not be responding');
                    showStatus('❌ Timeout: Content script not responding. Try refreshing the page and clicking again.', 'error');
                    extractBtn.disabled = false;
                }
            }, 10000); // 10 second timeout

            chrome.tabs.sendMessage(tabId, { action: 'extractOffers' }, (response) => {
                responseReceived = true;
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message;
                    console.error('[Popup] Error:', errorMsg);

                    // Check if content script might not be loaded
                    if (errorMsg.includes('Could not establish connection') ||
                        errorMsg.includes('Receiving end does not exist')) {
                        showStatus('❌ Content script not loaded. Please refresh the page and try again.', 'error');
                    } else {
                        showStatus('❌ Error: ' + errorMsg + '. Try refreshing the page.', 'error');
                    }
                    extractBtn.disabled = false;
                    return;
                }

                console.log('[Popup] Received response:', response);

                // Handle case where response is undefined or null
                if (!response) {
                    console.error('[Popup] No response received from content script');
                    showStatus('❌ No response from content script. The page may still be loading. Try again in a few seconds.', 'error');
                    extractBtn.disabled = false;
                    return;
                }

                if (response && response.success) {
                    const newOffers = response.offers || [];
                    console.log('[Popup] Received', newOffers.length, 'newly extracted offers');

                    // Merge with existing offers instead of replacing
                    chrome.storage.local.get(['lastExtractedOffers'], (data) => {
                        const existingOffers = data.lastExtractedOffers || [];

                        // Merge: add new offers that don't already exist
                        const mergedOffers = [...existingOffers];
                        let addedCount = 0;

                        newOffers.forEach(newOffer => {
                            // Check if this offer already exists (simple comparison by merchant + description)
                            const isDuplicate = existingOffers.some(existing => {
                                const normalize = (str) => (str || '').toLowerCase().trim();
                                return normalize(existing.merchant) === normalize(newOffer.merchant) &&
                                    normalize(existing.description) === normalize(newOffer.description);
                            });

                            if (!isDuplicate) {
                                mergedOffers.push(newOffer);
                                addedCount++;
                            }
                        });

                        currentOffers = mergedOffers;
                        console.log('[Popup] Merged offers:', existingOffers.length, 'existing +', addedCount, 'new =', mergedOffers.length, 'total');
                        displayOffers(currentOffers);

                        if (newOffers.length > 0) {
                            const statusMsg = addedCount > 0
                                ? `✅ Added ${addedCount} new offer(s)! Total: ${mergedOffers.length}`
                                : `ℹ️ All ${newOffers.length} offer(s) already extracted. Total: ${mergedOffers.length}`;
                            showStatus(statusMsg, addedCount > 0 ? 'success' : 'info');

                            // Store merged offers and domains
                            const domains = extractDomainsFromOffers(currentOffers);
                            chrome.storage.local.set({
                                lastExtractedOffers: currentOffers,
                                lastExtractionTime: Date.now(),
                                offerDomains: domains
                            });
                            console.log('[Popup] Stored', domains.length, 'unique merchant domains:', domains);
                            // Enable sync button
                            syncBtn.disabled = false;
                        } else {
                            showStatus('⚠️ No offers found. The page may still be loading. Try waiting a few seconds and clicking again, or check the browser console (F12) for details.', 'warning');
                        }
                    });
                } else {
                    const errorMsg = response?.error || 'Unknown error';
                    console.error('[Popup] Extraction failed:', errorMsg);
                    showStatus('⚠️ No offers found. Error: ' + errorMsg + '. Check browser console (F12) for details.', 'warning');
                }

                extractBtn.disabled = false;
            });
        });
    }

    function loadStoredOffers() {
        chrome.storage.local.get(['lastExtractedOffers', 'lastExtractionTime'], (data) => {
            if (data.lastExtractedOffers && data.lastExtractedOffers.length > 0) {
                currentOffers = data.lastExtractedOffers;
                displayOffers(currentOffers);
                const timeAgo = getTimeAgo(data.lastExtractionTime);
                showStatus(`📋 Loaded ${currentOffers.length} offers (extracted ${timeAgo})`, 'info');
                syncBtn.disabled = false;
            }
        });
    }

    // ========== AUTHENTICATION FUNCTIONS ==========

    async function initAuth() {
        // Load stored session
        chrome.storage.local.get(['googleAccessToken', 'googleUser'], (data) => {
            if (data.googleAccessToken && data.googleUser) {
                googleAccessToken = data.googleAccessToken;
                googleUser = data.googleUser;
                updateAuthUI(true);
            } else {
                updateAuthUI(false);
            }
        });
    }

    async function signInWithGoogle() {
        console.log('[Auth] signInWithGoogle() called');
        console.log('[Auth] GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID ? 'Set' : 'NOT SET');

        if (!GOOGLE_CLIENT_ID) {
            showStatus('❌ Google OAuth not configured. Please set GOOGLE_CLIENT_ID in popup.js', 'error');
            return;
        }

        showStatus('🔄 Signing in...', 'info');
        signInBtn.disabled = true;

        try {
            // Get the extension ID for the redirect URI
            const extensionId = chrome.runtime.id;
            const redirectUri = `https://${extensionId}.chromiumapp.org/`;

            console.log('[Auth] Extension ID:', extensionId);
            console.log('[Auth] Redirect URI:', redirectUri);
            console.log('[Auth] Full redirect URI:', redirectUri);

            // Google OAuth URL
            // Note: redirect_uri must match exactly what's configured in Google Cloud Console
            const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${GOOGLE_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=code&` +
                `scope=openid profile email&` +
                `access_type=offline&` +
                `prompt=consent`;

            // Launch OAuth flow using Chrome Identity API
            chrome.identity.launchWebAuthFlow({
                url: googleOAuthUrl,
                interactive: true
            }, async (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    console.error('OAuth error:', chrome.runtime.lastError);
                    showStatus('❌ Sign in failed: ' + chrome.runtime.lastError.message, 'error');
                    signInBtn.disabled = false;
                    return;
                }

                if (!redirectUrl) {
                    showStatus('❌ Sign in cancelled', 'warning');
                    signInBtn.disabled = false;
                    return;
                }

                // Extract code from redirect URL
                const url = new URL(redirectUrl);
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                if (error) {
                    showStatus('❌ Sign in failed: ' + error, 'error');
                    signInBtn.disabled = false;
                    return;
                }

                if (!code) {
                    showStatus('❌ Failed to get authorization code', 'error');
                    signInBtn.disabled = false;
                    return;
                }

                // Exchange code for tokens via backend
                await exchangeCodeForTokens(code, redirectUri);
                signInBtn.disabled = false;
            });
        } catch (error) {
            console.error('Sign in error:', error);
            showStatus('❌ Sign in failed: ' + error.message, 'error');
            signInBtn.disabled = false;
        }
    }

    async function exchangeCodeForTokens(code, redirectUri) {
        try {
            showStatus('🔄 Completing sign in...', 'info');

            // Exchange authorization code for tokens via backend (needed for Web app OAuth clients with client secret)
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

            // Store tokens and user info from backend response
            googleAccessToken = tokenData.access_token; // ID token for backend authentication
            googleUser = tokenData.user;

            // Save to storage and then update UI
            chrome.storage.local.set({
                googleAccessToken: googleAccessToken,
                googleUser: googleUser
            }, () => {
                // Update UI after storage is saved
                updateAuthUI(true);
                showStatus('✅ Signed in successfully!', 'success');
            });
        } catch (error) {
            console.error('Token exchange error:', error);
            showStatus('❌ Authentication failed: ' + error.message, 'error');
        }
    }

    function signOut() {
        chrome.storage.local.remove(['googleAccessToken', 'googleUser'], () => {
            googleAccessToken = null;
            googleUser = null;
            updateAuthUI(false);
            showStatus('✅ Signed out successfully', 'success');
        });
    }

    function updateAuthUI(isSignedIn) {
        console.log('[Auth] updateAuthUI - isSignedIn:', isSignedIn, 'googleUser:', googleUser);
        try {
            if (isSignedIn && googleUser) {
                console.log('[Auth] Showing signed-in UI');
                if (authNotSignedIn) authNotSignedIn.classList.add('hidden');
                if (authSignedIn) authSignedIn.classList.remove('hidden');
                if (userName) userName.textContent = googleUser.name || googleUser.email || 'User';
                if (userEmail) userEmail.textContent = googleUser.email || '';
                if (userAvatar) {
                    if (googleUser.picture) {
                        userAvatar.style.backgroundImage = `url(${googleUser.picture})`;
                        userAvatar.textContent = '';
                    } else {
                        userAvatar.style.backgroundImage = '';
                        userAvatar.textContent = '👤';
                    }
                }
            } else {
                console.log('[Auth] Showing signed-out UI');
                if (authNotSignedIn) authNotSignedIn.classList.remove('hidden');
                if (authSignedIn) authSignedIn.classList.add('hidden');
                if (userAvatar) {
                    userAvatar.style.backgroundImage = '';
                    userAvatar.textContent = '👤';
                }
            }
        } catch (error) {
            console.error('[Auth] Error updating auth UI:', error);
            // Fallback: show sign-in UI if there's an error
            if (authNotSignedIn) authNotSignedIn.classList.remove('hidden');
            if (authSignedIn) authSignedIn.classList.add('hidden');
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

    async function syncToServer() {
        if (currentOffers.length === 0) {
            showStatus('⚠️ No offers to sync', 'warning');
            return;
        }

        if (!googleAccessToken) {
            showStatus('⚠️ Please sign in to sync offers', 'warning');
            return;
        }

        showStatus('🔄 Syncing to server...', 'info');
        syncBtn.disabled = true;

        try {
            // Prepare offers for API (ensure all required fields)
            const offersToSync = currentOffers.map(offer => ({
                merchant: offer.merchant || offer.title || 'Unknown',
                title: offer.title || offer.merchant || 'Untitled',
                description: offer.description || '',
                discount: offer.discount || '',
                terms: offer.terms || '',
                category: offer.category || '',
                expiry_date: offer.expiryDate || '',
                status: offer.status || 'Available',
                source: offer.source || (currentSite === 'amex' ? 'Amex' : currentSite === 'chase' ? 'Chase' : currentSite === 'capitalone' ? 'Capital One' : 'Unknown')
            }));

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(offersToSync)
            });

            const result = await response.json();

            if (result.success) {
                const newCount = result.count || 0;
                const skippedCount = result.skipped || 0;
                const totalCount = result.total || offersToSync.length;

                let statusMessage = '';
                if (newCount > 0 && skippedCount > 0) {
                    statusMessage = `✅ Added ${newCount} new offer(s), skipped ${skippedCount} duplicate(s)`;
                } else if (newCount > 0) {
                    statusMessage = `✅ Successfully synced ${newCount} offer(s) to server!`;
                } else if (skippedCount > 0) {
                    statusMessage = `ℹ️ All ${totalCount} offer(s) already exist on server`;
                } else {
                    statusMessage = `✅ Sync completed`;
                }

                showStatus(statusMessage, newCount > 0 ? 'success' : 'info');
            } else {
                showStatus(`❌ Sync failed: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Sync error:', error);
            showStatus(`❌ Sync failed: ${error.message}. Make sure the backend is running at ${API_BASE_URL}`, 'error');
        } finally {
            syncBtn.disabled = false;
        }
    }

    function displayOffers(offers) {
        if (offers.length === 0) {
            resultsDiv.classList.add('hidden');
            exportBtn.disabled = true;
            syncBtn.disabled = true;
            return;
        }

        offerCount.textContent = offers.length;
        offersList.innerHTML = '';

        offers.forEach((offer, index) => {
            const offerCard = createOfferCard(offer, index);
            offersList.appendChild(offerCard);
        });

        resultsDiv.classList.remove('hidden');
        exportBtn.disabled = false;
        syncBtn.disabled = false;
    }

    // Helper function to create merchant display with optional favicon and link
    // Note: getMerchantDomain is imported from merchantDomains.js
    function createMerchantDisplay(merchant, includeEmoji = true) {
        const escapedMerchant = escapeHtml(merchant);
        const domain = getMerchantDomain(merchant);

        if (domain) {
            // Has a domain - show with favicon and make clickable - no emoji needed since we have favicon
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;

            return `<a href="https://${domain}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; color: inherit;">
                <img src="${faviconUrl}" alt="" width="16" height="16" loading="lazy" style="flex-shrink: 0;" onerror="this.style.display='none'">
                <span style="text-decoration: underline;">${escapedMerchant}</span>
            </a>`;
        }

        // Return with emoji only if requested and no favicon
        return includeEmoji ? `🏪 ${escapedMerchant}` : escapedMerchant;
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

    // Helper function to create source display with favicon
    function createSourceDisplay(source) {
        const escapedSource = escapeHtml(source);
        const faviconUrl = getSourceFaviconUrl(source);

        if (faviconUrl) {
            // No emoji when we have a favicon
            return `<span style="display: inline-flex; align-items: center; gap: 6px;">
                <img src="${faviconUrl}" alt="" width="16" height="16" loading="lazy" style="flex-shrink: 0; vertical-align: middle;" onerror="this.style.display='none'">
                ${escapedSource}
            </span>`;
        }

        // Show emoji only when there's no favicon
        return `🏦 Source: ${escapedSource}`;
    }

    function createOfferCard(offer, index) {
        const card = document.createElement('div');
        card.className = 'offer-card';
        card.innerHTML = `
      <div class="offer-header">
        <span class="offer-number">#${index + 1}</span>
        <h3 class="offer-title">${escapeHtml(offer.title || 'Untitled Offer')}</h3>
      </div>
      ${offer.source ? `<div class="offer-source">${createSourceDisplay(offer.source)}</div>` : ''}
      ${offer.merchant ? `<div class="offer-merchant">${createMerchantDisplay(offer.merchant, false)}</div>` : ''}
      ${offer.discount ? `<div class="offer-discount">💰 ${escapeHtml(offer.discount)}</div>` : ''}
      ${offer.description ? `<div class="offer-description">${escapeHtml(offer.description)}</div>` : ''}
      ${offer.category ? `<div class="offer-category">📂 Category: ${escapeHtml(offer.category)}</div>` : ''}
      ${offer.terms ? `<div class="offer-terms">📋 Terms: ${escapeHtml(offer.terms)}</div>` : ''}
      ${offer.expiryDate ? `<div class="offer-expiry">⏰ Expires: ${escapeHtml(offer.expiryDate)}</div>` : ''}
      ${offer.status ? `<div class="offer-status">${escapeHtml(offer.status)}</div>` : ''}
    `;
        return card;
    }

    function exportToCSV() {
        if (currentOffers.length === 0) {
            showStatus('⚠️ No offers to export', 'warning');
            return;
        }

        // Create CSV header
        const headers = ['Source', 'Title', 'Merchant', 'Discount', 'Description', 'Category', 'Terms', 'Expiry Date', 'Status'];
        const rows = currentOffers.map(offer => [
            offer.source || '',
            offer.title || '',
            offer.merchant || '',
            offer.discount || '',
            offer.description || '',
            offer.category || '',
            offer.terms || '',
            offer.expiryDate || '',
            offer.status || ''
        ]);

        // Convert to CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const siteName = currentSite === 'amex' ? 'amex' : currentSite === 'chase' ? 'chase' : currentSite === 'capitalone' ? 'capitalone' : 'offers';
        link.download = `${siteName}-offers-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        showStatus('✅ CSV file downloaded!', 'success');
    }

    function clearResults() {
        currentOffers = [];
        resultsDiv.classList.add('hidden');
        offersList.innerHTML = '';
        exportBtn.disabled = true;
        chrome.storage.local.remove(['lastExtractedOffers', 'lastExtractionTime', 'offerDomains']);
        showStatus('🗑️ Results cleared', 'info');
    }

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status status-${type}`;
        statusDiv.classList.remove('hidden');

        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 3000);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds} seconds ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minutes ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        return `${days} days ago`;
    }
});

