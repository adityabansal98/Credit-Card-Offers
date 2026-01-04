// Popup script for Credit Card Offers Extractor

document.addEventListener('DOMContentLoaded', () => {
    const extractBtn = document.getElementById('extractBtn');
    const syncBtn = document.getElementById('syncBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const offersList = document.getElementById('offersList');
    const offerCount = document.getElementById('offerCount');
    const instructions = document.getElementById('instructions');

    let currentOffers = [];
    let currentSite = 'unknown';

    // Backend API URL - change this to your backend URL
    // For local development: http://localhost:3000
    // For production: your deployed backend URL
    const API_BASE_URL = 'http://localhost:3001'; // TODO: Update this to your backend URL
    const API_URL = `${API_BASE_URL}/api/offers`;

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

            const offerDomainsSet = new Set([offerDomains, allOffers.map((i) =>
                (i.merchant || '').toLowerCase().replace(/^www\./, ''))].flat());
            console.log('[Popup] Stored offer domains and merchants:', offerDomainsSet, ' looking up: ', domain);
            console.log(data);

            // Check if this domain has offers
            if (!offerDomainsSet.has(domain)) {
                // No offers for this domain
                showStatus('⚠️ Please navigate to Amex, Chase or Capital One offers page first', 'warning');
                extractBtn.disabled = true;
                instructions.style.display = 'block';
                return;
            }

            // Filter offers for this specific domain
            const merchantOffers = allOffers.filter(offer => {
                if (!offer.merchant) return false;
                const offerDomain = offer.merchant.toLowerCase().replace(/^www\./, '');
                return offerDomain === domain;
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const url = currentTab.url || '';

        const isAmexPage = url.includes('americanexpress.com') &&
            (url.includes('/offers/eligible') || url.includes('/offers'));
        const isChasePage = url.includes('chase.com') && url.includes('merchantOffers');
        const isCapitalOnePage = url.includes('capitaloneoffers.com');

        if (isAmexPage) {
            currentSite = 'amex';
            instructions.style.display = 'none';
            loadStoredOffers();
        } else if (isChasePage) {
            currentSite = 'chase';
            instructions.style.display = 'none';
            loadStoredOffers();
        } else if (isCapitalOnePage) {
            currentSite = 'capitalone';
            instructions.style.display = 'none';
            loadStoredOffers();
        } else {
            // Check if this is a merchant page with offers
            const currentDomain = getDomainFromUrl(url);
            if (currentDomain) {
                loadMerchantOffers(currentDomain);
            } else {
                showStatus('⚠️ Please navigate to Amex, Chase or Capital One offers page first', 'warning');
                extractBtn.disabled = true;
                instructions.style.display = 'block';
            }
        }
    });

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

    function extractOffers() {
        showStatus('🔄 Extracting offers...', 'info');
        extractBtn.disabled = true;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;
            console.log('[Popup] Sending extract message to tab', tabId);

            chrome.tabs.sendMessage(tabId, { action: 'extractOffers' }, (response) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message;
                    console.error('[Popup] Error:', errorMsg);
                    showStatus('❌ Error: ' + errorMsg + '. Make sure the content script is loaded. Try refreshing the page.', 'error');
                    extractBtn.disabled = false;
                    return;
                }

                console.log('[Popup] Received response:', response);

                if (response && response.success) {
                    currentOffers = response.offers || [];
                    console.log('[Popup] Displaying', currentOffers.length, 'offers');
                    displayOffers(currentOffers);

                    if (currentOffers.length > 0) {
                        showStatus(`✅ Successfully extracted ${currentOffers.length} offers!`, 'success');
                        // Store offers and domains
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

    async function syncToServer() {
        if (currentOffers.length === 0) {
            showStatus('⚠️ No offers to sync', 'warning');
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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(offersToSync)
            });

            const result = await response.json();

            if (result.success) {
                const count = result.count || offersToSync.length;
                showStatus(`✅ Successfully synced ${count} offers to server!`, 'success');
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

    function createOfferCard(offer, index) {
        const card = document.createElement('div');
        card.className = 'offer-card';
        card.innerHTML = `
      <div class="offer-header">
        <span class="offer-number">#${index + 1}</span>
        <h3 class="offer-title">${escapeHtml(offer.title || 'Untitled Offer')}</h3>
      </div>
      ${offer.source ? `<div class="offer-source">🏦 Source: ${escapeHtml(offer.source)}</div>` : ''}
      ${offer.merchant ? `<div class="offer-merchant">🏪 ${escapeHtml(offer.merchant)}</div>` : ''}
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

