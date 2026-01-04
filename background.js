// Background service worker for Credit Card Offers Extractor
// Monitors tabs and shows badge when user is on a merchant site with an active offer

console.log('[Background] Service worker started');

// Extract domain from URL (without protocol and www)
function extractDomain(url) {
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

// Check if current tab domain matches any offer domains
async function checkAndUpdateBadge(tabId, url) {
  if (!url || !url.startsWith('http')) {
    // Hide icon and clear badge for non-http URLs
    chrome.action.disable(tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  const currentDomain = extractDomain(url);
  if (!currentDomain) {
    chrome.action.disable(tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  // Always show icon on credit card offer pages (Amex, Chase, Capital One)
  const isCreditCardSite =
    url.includes('americanexpress.com/') && url.includes('/offers') ||
    url.includes('chase.com/') && url.includes('merchantOffers') ||
    url.includes('capitaloneoffers.com');

  if (isCreditCardSite) {
    chrome.action.enable(tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
    chrome.action.setTitle({ tabId, title: 'Credit Card Offers Extractor - Click to extract offers' });
    return;
  }

  // Get stored offer domains and offers
  chrome.storage.local.get(['offerDomains', 'lastExtractedOffers'], (data) => {
    const offerDomainsArray = data.offerDomains || [];
    const offers = data.lastExtractedOffers || [];

    // Convert to Set for efficient O(1) lookup
    const offerDomainsSet = new Set([offerDomainsArray, offers.map((i) =>
      (i.merchant || '').toLowerCase().replace(/^www\./, ''))].flat());

    console.log('[Background] Checking domain:', currentDomain, 'against offer domains:', offerDomainsSet);

    // Check if current domain is in the offer domains set
    if (!offerDomainsSet.has(currentDomain)) {
      // No matching offers - hide icon and clear badge
      chrome.action.disable(tabId);
      chrome.action.setBadgeText({ tabId, text: '' });
      chrome.action.setTitle({ tabId, title: 'Credit Card Offers Extractor' });
      return;
    }

    // Domain matches - now get the actual offers for this domain to show details
    const matchingOffers = offers.filter(offer => {
      if (!offer.merchant) return false;
      const offerDomain = offer.merchant.toLowerCase().replace(/^www\./, '');
      return offerDomain === currentDomain;
    });

    if (matchingOffers.length > 0) {
      // Show icon with badge and offer count
      chrome.action.enable(tabId);
      const badgeText = matchingOffers.length.toString();
      chrome.action.setBadgeText({ tabId, text: badgeText });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#4CAF50' });

      // Set title to show offer details
      const offerSummary = matchingOffers.map(o => `${o.discount || 'Offer available'}`).join('\n');
      chrome.action.setTitle({
        tabId,
        title: `${matchingOffers.length} offer${matchingOffers.length > 1 ? 's' : ''} available!\n${offerSummary}`
      });

      console.log('[Background] Found', matchingOffers.length, 'offer(s) for', currentDomain);
    } else {
      // Edge case: domain in set but no matching offers (shouldn't happen, but handle it)
      chrome.action.disable(tabId);
      chrome.action.setBadgeText({ tabId, text: '' });
      chrome.action.setTitle({ tabId, title: 'Credit Card Offers Extractor' });
    }
  });
}

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only check when URL changes or page completes loading
  if (changeInfo.url || changeInfo.status === 'complete') {
    checkAndUpdateBadge(tabId, tab.url);
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('[Background] Error getting tab:', chrome.runtime.lastError);
      return;
    }
    checkAndUpdateBadge(activeInfo.tabId, tab.url);
  });
});

// Listen for storage changes (when new offers are extracted)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.lastExtractedOffers || changes.offerDomains)) {
    console.log('[Background] Offers updated, rechecking all tabs');

    // Recheck all open tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          checkAndUpdateBadge(tab.id, tab.url);
        }
      });
    });
  }
});

// Check current tab on extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed/updated, checking current tab');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      checkAndUpdateBadge(tabs[0].id, tabs[0].url);
    }
  });
});
