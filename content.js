// Content script to extract offers from Amex and Chase pages

(function () {
  'use strict';

  // Detect which site we're on
  function detectSite() {
    const url = window.location.href;
    if (url.includes('americanexpress.com') && url.includes('/offers')) {
      return 'amex';
    } else if (url.includes('chase.com') && url.includes('merchantOffers')) {
      return 'chase';
    } else if (url.includes('capitaloneoffers.com')) {
      return 'capitalone';
    }
    return 'unknown';
  }

  // Function to extract offer data from the page
  function extractOffers() {
    const site = detectSite();

    if (site === 'amex') {
      return extractAmexOffers();
    } else if (site === 'chase') {
      return extractChaseOffers();
    } else if (site === 'capitalone') {
      return extractCapitalOneOffers();
    }

    return [];
  }

  // Smart deduplication function for offers - STRICT: only merge truly identical offers
  function areOffersSimilar(offer1, offer2) {
    // Normalize strings for comparison
    const normalize = (str) => (str || '').toLowerCase().trim().replace(/\s+/g, ' ');

    const title1 = normalize(offer1.title || '');
    const title2 = normalize(offer2.title || '');
    const merchant1 = normalize(offer1.merchant || '');
    const merchant2 = normalize(offer2.merchant || '');
    const desc1 = normalize(offer1.description || '');
    const desc2 = normalize(offer2.description || '');

    // Check 1: Exact merchant match AND exact description match
    // Only merge if BOTH merchant AND description are exactly the same
    // Different descriptions = different offers, even if merchant is the same
    if (merchant1 && merchant2 && merchant1 === merchant2 && merchant1.length > 2) {
      if (desc1 && desc2 && desc1 === desc2 && desc1.length > 10) {
        return true;
      }
    }

    // Check 2: Exact title match AND exact description match
    // Only merge if BOTH title AND description are exactly the same
    // This handles non-merchant offers (like card offers) but still requires description match
    if (title1 && title2 && title1 === title2 && title1.length > 5) {
      // Make sure it's not a generic title
      if (!title1.match(/^(spend|earn|back|off)$/i)) {
        // Also require description to match - same title but different description = different offers
        if (desc1 && desc2 && desc1 === desc2 && desc1.length > 10) {
          return true;
        }
        // If no descriptions, only merge if both have no descriptions
        if (!desc1 && !desc2) {
          return true;
        }
      }
    }

    return false;
  }

  // Deduplicate offers array
  function deduplicateOffers(offers) {
    const unique = [];
    const duplicates = [];

    offers.forEach((offer, index) => {
      // Check if this offer is similar to any already in unique array
      const existingIndex = unique.findIndex(existing => areOffersSimilar(existing, offer));
      const isDuplicate = existingIndex !== -1;

      if (!isDuplicate) {
        unique.push(offer);
      } else {
        // Merge with existing offer - keep the most complete version
        const existing = unique[existingIndex];

        // Log the duplicate for debugging
        const duplicateInfo = {
          existing: {
            merchant: existing.merchant || '(no merchant)',
            title: existing.title || '(no title)',
            description: existing.description ? existing.description.substring(0, 80) + (existing.description.length > 80 ? '...' : '') : '(no description)',
            expiry: existing.expiryDate || '(no expiry)'
          },
          duplicate: {
            merchant: offer.merchant || '(no merchant)',
            title: offer.title || '(no title)',
            description: offer.description ? offer.description.substring(0, 80) + (offer.description.length > 80 ? '...' : '') : '(no description)',
            expiry: offer.expiryDate || '(no expiry)'
          },
          reason: getDuplicateReason(existing, offer)
        };
        duplicates.push(duplicateInfo);

        // Merge: keep longer/more complete fields
        // Prefer description that has "Spend X, earn Y" pattern
        if (offer.description && offer.description.match(/spend.*?earn/i)) {
          existing.description = offer.description;
        } else if ((!existing.description || existing.description.length < offer.description.length) && offer.description) {
          existing.description = offer.description;
        }

        // Prefer merchant name over generic titles
        if (offer.merchant && offer.merchant.length > 2 &&
          !offer.merchant.match(/spend|earn|back/i)) {
          existing.merchant = offer.merchant;
        } else if ((!existing.merchant || existing.merchant.length < offer.merchant.length) && offer.merchant) {
          existing.merchant = offer.merchant;
        }

        // Prefer title that's a merchant name (not a description)
        if (offer.title && !offer.title.match(/spend.*?earn/i) &&
          offer.title.length < 50 && offer.title.length > 1) {
          existing.title = offer.title;
        } else if ((!existing.title || existing.title.length < offer.title.length) && offer.title &&
          !offer.title.match(/spend.*?earn/i)) {
          existing.title = offer.title;
        }

        if (!existing.discount && offer.discount) {
          existing.discount = offer.discount;
        }
        if (!existing.expiryDate && offer.expiryDate) {
          existing.expiryDate = offer.expiryDate;
        }
        if (!existing.terms && offer.terms) {
          existing.terms = offer.terms;
        }

        // If we have merchant but no title, use merchant as title
        if (existing.merchant && (!existing.title || existing.title.match(/spend.*?earn/i))) {
          existing.title = existing.merchant;
        }
      }
    });

    // Log all duplicates found
    if (duplicates.length > 0) {
      console.log(`[Amex Offers Extractor] Found ${duplicates.length} duplicate offers (merged):`);
      duplicates.forEach((dup, i) => {
        console.log(`\n  Duplicate #${i + 1}:`);
        console.log(`    Existing: "${dup.existing.merchant}" - ${dup.existing.description}`);
        console.log(`    Duplicate: "${dup.duplicate.merchant}" - ${dup.duplicate.description}`);
        console.log(`    Reason: ${dup.reason}`);
      });
    } else {
      console.log('[Amex Offers Extractor] No duplicates found - all offers are unique');
    }

    return unique;
  }

  // Helper function to determine why two offers are considered duplicates
  function getDuplicateReason(offer1, offer2) {
    const normalize = (str) => (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const merchant1 = normalize(offer1.merchant || '');
    const merchant2 = normalize(offer2.merchant || '');
    const desc1 = normalize(offer1.description || '');
    const desc2 = normalize(offer2.description || '');
    const title1 = normalize(offer1.title || '');
    const title2 = normalize(offer2.title || '');

    // Check 1: Same merchant AND same exact description
    // Different descriptions = different offers, even if merchant is the same
    if (merchant1 && merchant2 && merchant1 === merchant2 && merchant1.length > 2) {
      if (desc1 && desc2 && desc1 === desc2 && desc1.length > 10) {
        return 'Same merchant and same exact description';
      }
    }

    // Check 2: Exact title match AND exact description match
    if (title1 && title2 && title1 === title2 && title1.length > 5) {
      if (!title1.match(/^(spend|earn|back|off)$/i)) {
        if (desc1 && desc2 && desc1 === desc2 && desc1.length > 10) {
          return 'Same exact title and same exact description';
        }
        if (!desc1 && !desc2) {
          return 'Same exact title (both have no description)';
        }
      }
    }

    return 'Unknown reason (should not happen)';
  }

  // Extract offers from Amex page - using actual HTML structure
  function extractAmexOffers() {
    // Based on actual HTML structure: all offers are in recommendedOffersContainer
    function findOffers() {
      let foundOffers = [];

      // Find the container with all offers
      let offersContainer = document.querySelector('[data-testid="recommendedOffersContainer"]');
      if (!offersContainer) {
        // Try alternative container
        offersContainer = document.querySelector('[data-testid="listViewContainer"]');
      }
      if (!offersContainer) {
        console.log('[Amex Offers Extractor] Could not find offers container');
        return [];
      }

      // Find all offer rows using the specific class name
      // Each offer row has class _listViewRow_tupp2_26
      let offerRows = Array.from(offersContainer.querySelectorAll('div[class*="_listViewRow_"]'));

      // If that doesn't work, try finding rows in listViewContainer (nested)
      if (offerRows.length === 0) {
        const listViewContainer = offersContainer.querySelector('[data-testid="listViewContainer"]');
        if (listViewContainer) {
          offerRows = Array.from(listViewContainer.querySelectorAll('div[class*="_listViewRow_"]'));
        }
      }

      // Also try searching the entire document if still no results
      if (offerRows.length === 0) {
        offerRows = Array.from(document.querySelectorAll('div[class*="_listViewRow_"]'));
        console.log('[Amex Offers Extractor] Found', offerRows.length, 'rows in entire document');
      }

      // Fallback: find rows by structure (h3 + description + expiry pattern)
      if (offerRows.length === 0) {
        console.log('[Amex Offers Extractor] Trying fallback method to find offer rows');
        const allDivs = offersContainer.querySelectorAll('div');
        offerRows = [];

        allDivs.forEach(div => {
          // Check if this div contains an offer structure
          const hasCompanyName = div.querySelector('h3.heading-sans-small-medium, h3[class*="heading"]');
          const hasDescription = Array.from(div.querySelectorAll('[data-testid="overflowTextContainer"]')).some(
            el => {
              const span = el.querySelector('span');
              return span && span.textContent.match(/spend.*?earn|earn.*?back|earn.*?%|back.*?on/i);
            }
          );
          const hasExpiry = div.textContent && div.textContent.match(/expires?\s+[\d\/]+/i);

          // If it has company name and (description or expiry), it's likely an offer row
          if (hasCompanyName && (hasDescription || hasExpiry)) {
            // Make sure it's not a parent container (too many children = likely container)
            const childDivs = div.querySelectorAll('div').length;
            if (childDivs < 30) { // Increased threshold
              offerRows.push(div);
            }
          }
        });
      }

      console.log('[Amex Offers Extractor] Found', offerRows.length, 'offer rows');

      // Filter out duplicate DOM elements and incomplete offers
      const uniqueRows = [];
      const seenElements = new Set();
      const rowSignatures = new Set(); // Track by merchant+description pattern
      const filteredOut = {
        duplicateElement: [],
        missingBoth: [],
        duplicateSignature: []
      };

      offerRows.forEach((row, index) => {
        // Skip if we've already seen this exact element
        if (seenElements.has(row)) {
          filteredOut.duplicateElement.push({
            index: index + 1,
            reason: 'Duplicate DOM element'
          });
          return;
        }
        seenElements.add(row);

        // Quick check: does this row look like a complete offer?
        const merchantEl = row.querySelector('h3.heading-sans-small-medium, h3[class*="heading"]');
        const hasMerchant = !!merchantEl;
        const merchantText = merchantEl ? (merchantEl.querySelector('span')?.textContent || merchantEl.textContent || '').trim() : '';

        const descContainers = row.querySelectorAll('[data-testid="overflowTextContainer"]');
        let descText = '';
        let hasDescription = false;
        descContainers.forEach(container => {
          const span = container.querySelector('span');
          if (span) {
            const text = span.textContent.trim();
            if (text.match(/spend.*?earn|earn.*?back|earn.*?%|back.*?on/i)) {
              descText = text;
              hasDescription = true;
            }
          }
        });

        // Accept rows that have merchant OR description (less strict)
        // But log what we're filtering out for debugging
        if (!hasMerchant && !hasDescription) {
          // No merchant and no description - definitely filter out
          filteredOut.missingBoth.push({
            index: index + 1,
            merchant: '(none)',
            description: '(none)',
            reason: 'Missing both merchant name and description'
          });
        } else {
          // Has at least merchant OR description - check for duplicate signature
          const normalizedMerchant = (merchantText || '').toLowerCase();
          const normalizedDesc = descText.toLowerCase();

          // Create signature from merchant + FULL description
          // This ensures same merchant with different descriptions = different offers
          let signature = '';
          if (normalizedMerchant && normalizedDesc) {
            // Merchant + full description (use longer portion to catch differences)
            signature = normalizedMerchant + '_' + normalizedDesc.replace(/\s+/g, ' ').substring(0, 200);
          } else if (normalizedMerchant) {
            // Just merchant, no description
            signature = normalizedMerchant;
          } else if (normalizedDesc) {
            // Just description, no merchant - use full description
            signature = 'desc_' + normalizedDesc.replace(/\s+/g, ' ').substring(0, 200);
          } else {
            // Neither - shouldn't happen but handle it
            signature = 'unknown_' + index;
          }

          // Only add if we haven't seen this signature before
          if (!rowSignatures.has(signature)) {
            rowSignatures.add(signature);
            uniqueRows.push(row);
          } else {
            filteredOut.duplicateSignature.push({
              index: index + 1,
              merchant: merchantText || '(none)',
              description: descText.substring(0, 60) || '(none)',
              reason: 'Duplicate signature (same merchant + same description)'
            });
          }
        }

      });

      // Log all filtered rows
      const totalFiltered = filteredOut.duplicateElement.length +
        filteredOut.missingBoth.length +
        filteredOut.duplicateSignature.length;

      if (totalFiltered > 0) {
        console.log(`[Amex Offers Extractor] Filtered out ${totalFiltered} rows:`);
        if (filteredOut.duplicateElement.length > 0) {
          console.log(`  - ${filteredOut.duplicateElement.length} duplicate DOM elements`);
        }
        if (filteredOut.missingBoth.length > 0) {
          console.log(`  - ${filteredOut.missingBoth.length} missing both merchant and description:`);
          filteredOut.missingBoth.forEach(item => {
            console.log(`    Row ${item.index}: No merchant, no description`);
          });
        }
        if (filteredOut.duplicateSignature.length > 0) {
          console.log(`  - ${filteredOut.duplicateSignature.length} duplicate signatures (same merchant + same description):`);
          filteredOut.duplicateSignature.forEach(item => {
            console.log(`    Row ${item.index}: "${item.merchant}" - "${item.description.substring(0, 50)}${item.description.length > 50 ? '...' : ''}"`);
          });
        }
      } else {
        console.log('[Amex Offers Extractor] No rows filtered out');
      }

      console.log('[Amex Offers Extractor] After filtering:', uniqueRows.length, 'unique complete offer rows');

      // Extract offer from each row
      uniqueRows.forEach((row, index) => {
        const offer = extractAmexOfferFromRow(row);
        // Accept offers that have at least merchant OR description
        if (offer && (offer.merchant || offer.description)) {
          foundOffers.push(offer);
        }
      });

      console.log('[Amex Offers Extractor] Extracted', foundOffers.length, 'offers from rows');

      // Deduplicate offers
      foundOffers = deduplicateOffers(foundOffers);
      console.log('[Amex Offers Extractor] After deduplication:', foundOffers.length, 'offers');

      return foundOffers;
    }

    // Extract offer from a specific row element
    function extractAmexOfferFromRow(row) {
      const offer = {
        title: '',
        description: '',
        discount: '',
        terms: '',
        merchant: '',
        category: '',
        expiryDate: '',
        status: '',
        source: 'Amex'
      };

      // Extract company/merchant name from h3
      const companyNameEl = row.querySelector('h3.heading-sans-small-medium, h3[class*="heading"]');
      if (companyNameEl) {
        const nameSpan = companyNameEl.querySelector('span');
        if (nameSpan) {
          offer.merchant = nameSpan.textContent.trim();
          offer.title = offer.merchant;
        } else {
          offer.merchant = companyNameEl.textContent.trim();
          offer.title = offer.merchant;
        }
      }

      // Extract offer description from overflowTextContainer
      // There are multiple overflowTextContainers - one for title, one for description
      const descContainers = row.querySelectorAll('[data-testid="overflowTextContainer"]');
      descContainers.forEach(container => {
        const span = container.querySelector('span');
        if (span) {
          const text = span.textContent.trim();
          // Check if this looks like a description (contains "Spend", "earn", "%", "back", etc.)
          // Description containers have class "body color-text-regular"
          const isDescription = container.classList.contains('body') ||
            container.classList.contains('color-text-regular') ||
            text.match(/spend.*?earn|earn.*?back|earn.*?%|back.*?on|%.*?back/i);

          if (isDescription && text.length > 10 && !text.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/)) {
            // Not just a simple title (like "Levi's" or "Disney+")
            // This is likely the description
            if (!offer.description || text.length > offer.description.length) {
              offer.description = text;
            }
          }
        }
      });

      // If no description found yet, look for any text that matches offer patterns
      if (!offer.description) {
        const rowText = row.textContent || '';
        // Look for common offer patterns
        const descPatterns = [
          /spend\s+\$?[\d,]+\s*(?:or\s*more)?\s*,\s*earn\s+\$?[\d,]+.*?back/i,
          /earn\s+\$?[\d,]+\s*back.*?on/i,
          /earn\s+[\d]+%\s*back.*?on/i,
          /spend\s+\$?[\d,]+.*?earn\s+\$?[\d,]+/i
        ];

        for (const pattern of descPatterns) {
          const match = rowText.match(pattern);
          if (match) {
            offer.description = match[0].trim();
            break;
          }
        }
      }

      // Extract discount from description
      if (offer.description) {
        const discountMatch = offer.description.match(/(earn\s+\$?[\d,]+|[\d]+%\s*(?:back|off)|spend\s+\$?[\d,]+)/i);
        if (discountMatch) {
          offer.discount = discountMatch[0];
        }
      }

      // Extract expiry date from p tag with specific classes
      const expiryEls = row.querySelectorAll('p.color-text-subtle, p[class*="body-small"]');
      for (const expiryEl of expiryEls) {
        const expiryText = expiryEl.textContent.trim();
        const expiryMatch = expiryText.match(/expires?\s+([\d\/]+)/i);
        if (expiryMatch) {
          offer.expiryDate = expiryMatch[1].trim();
          break;
        }
      }

      // Also look for expiry in any text if not found yet
      if (!offer.expiryDate) {
        const rowText = row.textContent || '';
        const expiryMatch = rowText.match(/expires?\s+([\d\/]+)/i);
        if (expiryMatch) {
          offer.expiryDate = expiryMatch[1].trim();
        }
      }

      // Extract terms if available
      const termsButton = row.querySelector('button[data-testid="merchantOfferTermsLink"]');
      if (termsButton && termsButton.textContent.toLowerCase().includes('terms')) {
        offer.terms = 'Terms apply';
      }

      // Check if offer is added (look for button state)
      const addButton = row.querySelector('button[data-testid="merchantOfferListAddButton"]');
      if (addButton) {
        const buttonTitle = addButton.getAttribute('title') || '';
        const buttonAriaLabel = addButton.getAttribute('aria-label') || '';
        if (buttonTitle.toLowerCase().includes('added') ||
          buttonTitle.toLowerCase().includes('saved') ||
          buttonAriaLabel.toLowerCase().includes('added') ||
          buttonAriaLabel.toLowerCase().includes('saved')) {
          offer.status = 'Added';
        } else {
          offer.status = 'Available';
        }
      }

      return offer;
    }

    // Extract offers using the structured approach
    let foundOffers = findOffers();

    console.log('[Amex Offers Extractor] Total offers extracted:', foundOffers.length);
    return foundOffers;
  }

  // Extract offers from Chase page
  function extractChaseOffers() {
    const offers = [];

    console.log('[Chase Extractor] Starting extraction...');

    // Chase uses specific data-testid attributes for offer tiles
    // Primary selector: offer-tile-grid-item-container or commerce-tile
    function findChaseOffers() {
      let foundOffers = [];

      // Strategy 1: Use Chase-specific data-testid selectors (most reliable)
      const chaseSelectors = [
        '[data-testid="offer-tile-grid-item-container"]',
        '[data-testid="commerce-tile"]'
      ];

      const offerContainers = [];

      chaseSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          console.log(`[Chase Extractor] Found ${elements.length} elements with selector: ${selector}`);
          elements.forEach(el => {
            // For offer-tile-grid-item-container, get the commerce-tile inside
            if (selector.includes('grid-item-container')) {
              const tile = el.querySelector('[data-testid="commerce-tile"]');
              if (tile) {
                offerContainers.push(tile);
              }
            } else {
              offerContainers.push(el);
            }
          });
        } catch (e) {
          console.error('[Chase Extractor] Error with selector', selector, e);
        }
      });

      console.log(`[Chase Extractor] Total offer containers found: ${offerContainers.length}`);

      // Extract offers from each container
      offerContainers.forEach((container, index) => {
        const offer = extractChaseOfferFromElement(container);
        if (offer) {
          console.log(`[Chase Extractor] Extracted offer ${index + 1}:`, offer.merchant, '-', offer.discount);
          // Check for duplicates
          if (!foundOffers.find(o => o.title === offer.title && o.merchant === offer.merchant)) {
            foundOffers.push(offer);
          }
        }
      });

      console.log(`[Chase Extractor] Total unique offers extracted: ${foundOffers.length}`);
      return foundOffers;
    }

    // Extract offer details from a Chase offer element
    function extractChaseOfferFromElement(element) {
      if (!element) return null;

      const offer = {
        title: '',
        description: '',
        discount: '',
        terms: '',
        merchant: '',
        category: '',
        expiryDate: '',
        status: '',
        source: 'Chase'
      };

      // Extract merchant name using Chase-specific classes
      // Merchant name: mds-body-small-heavier with r9jbijk class (excludes "Expiring soon" labels which use _1eg0h8u0)
      // Need to find the merchant name in the r9jbije container, not the "Expiring soon" label
      const merchantEl = element.querySelector('.r9jbije .mds-body-small-heavier.r9jbijk, .r9jbijl .mds-body-small-heavier.r9jbijk');
      if (merchantEl) {
        const merchantText = merchantEl.textContent.trim();
        if (merchantText && merchantText.length >= 2 && merchantText.length <= 100) {
          offer.merchant = merchantText;
          offer.title = merchantText;
        }
      }

      // Extract discount using Chase-specific classes
      // Discount: mds-body-large-heavier with r9jbijj class
      const discountEl = element.querySelector('.r9jbije .mds-body-large-heavier.r9jbijj, .r9jbijl .mds-body-large-heavier.r9jbijj');
      if (discountEl) {
        const discountText = discountEl.textContent.trim();
        if (discountText) {
          offer.discount = discountText;
          offer.description = discountText;
        }
      }

      // Check if offer has "New" banner
      const banner = element.querySelector('[data-testid="tile-banner"]');
      if (banner) {
        const bannerText = banner.textContent.trim();
        if (bannerText && bannerText.toLowerCase() === 'new') {
          offer.status = 'New';
        }
      }

      // Check if offer is expiring soon
      const expiringLabel = element.querySelector('[data-testid="expiring-soon"]');
      if (expiringLabel) {
        offer.status = offer.status ? offer.status + ', Expiring soon' : 'Expiring soon';
      }

      // Fallback: if Chase classes don't work, try generic extraction
      if (!offer.merchant || !offer.discount) {
        const text = element.innerText || element.textContent || '';

        // Extract merchant from text lines if not found
        if (!offer.merchant) {
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          for (const line of lines) {
            // Skip common UI text and "New"
            if (!line.match(/^(Add|View|Terms|Details|Expires|Sort|Filter|Results|Online|In-store|New|Added)$/i) &&
              line.length >= 2 && line.length <= 50 &&
              !line.match(/[\d]+%|^\$[\d,]+/)) {
              offer.merchant = line;
              offer.title = line;
              break;
            }
          }
        }

        // Extract discount if not found
        if (!offer.discount) {
          const discountPatterns = [
            /\$[\d,]+\s*(?:cash\s*)?back/i,
            /[\d]+%\s*(?:cash\s*)?back/i,
            /\$[\d,]+\s*off/i,
            /[\d]+%\s*off/i
          ];

          for (const pattern of discountPatterns) {
            const match = text.match(pattern);
            if (match) {
              offer.discount = match[0];
              offer.description = match[0];
              break;
            }
          }
        }
      }

      // Extract status from aria-label if available
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) {
        if (ariaLabel.match(/added\s+to\s+card/i)) {
          offer.status = offer.status ? offer.status + ', Added to card' : 'Added to card';
        }
      }

      // Only return offer if it has meaningful content
      if (offer.merchant && offer.merchant.length > 1 && offer.discount) {
        return offer;
      }

      return null;
    }

    return findChaseOffers();
  }

  // Extract Capital One offers
  function extractCapitalOneOffers() {
    console.log('[Capital One] Starting Capital One offers extraction');

    // Click "View More Offers" button if it exists
    function clickViewMoreButton() {
      const buttons = Array.from(document.querySelectorAll('button[type="button"]'));
      const viewMoreButton = buttons.find(btn =>
        btn.textContent.trim() === 'View More Offers' &&
        btn.classList.contains('font-semibold')
      );

      if (viewMoreButton) {
        console.log('[Capital One] Found "View More Offers" button, clicking...');
        viewMoreButton.click();
        return true;
      }
      console.log('[Capital One] "View More Offers" button not found');
      return false;
    }

    function findCapitalOneOffers() {
      const offers = [];

      // Find all offer tiles - Capital One uses standard-tile class and feed-tile data-testid
      const tiles = document.querySelectorAll('.standard-tile, [data-testid^="feed-tile-"]');
      console.log('[Capital One] Found', tiles.length, 'tiles');

      tiles.forEach((tile, index) => {
        try {
          const offer = {
            source: 'Capital One',
            merchant: '',
            title: '',
            discount: '',
            description: '',
            category: '',
            terms: '',
            expiryDate: '',
            status: 'Available'
          };

          // Extract merchant domain from image domain parameter (keep full domain with TLD)
          // Example: src="https://images.capitaloneshopping.com/api/v1/logos?height=170&domain=woodlanddirect.com&type=cropped&fallback=true"
          // Returns: "woodlanddirect.com"
          const merchantImage = tile.querySelector('img[src*="domain="]');
          if (merchantImage) {
            const imageUrl = merchantImage.getAttribute('src') || '';
            const domainMatch = imageUrl.match(/domain=([^&]+)/);
            if (domainMatch && domainMatch[1]) {
              offer.merchant = domainMatch[1];
              offer.title = domainMatch[1];
            }
          }

          // Extract discount/reward text from font-semibold elements
          const discountElements = tile.querySelectorAll('.font-semibold, [class*="font-semibold"]');
          const discounts = [];
          discountElements.forEach(el => {
            const text = el.textContent.trim();
            // Filter out common non-discount text
            if (text &&
              !text.match(/^(online|in-store|activate|shop now|new offer|view more offers)$/i) &&
              text.length > 2 &&
              text.length < 150) {
              discounts.push(text);
            }
          });

          if (discounts.length > 0) {
            offer.discount = discounts.join(' • ');
            offer.description = offer.discount;
          }

          // Extract category (Online, In-Store & Online, Standard, etc.)
          const categoryElement = tile.querySelector('h2.font-light, h2 [class*="font-light"]');
          if (categoryElement) {
            const categoryText = categoryElement.textContent.trim();
            if (categoryText && categoryText.length < 50) {
              offer.category = categoryText;
            }
          }

          // Check for "New Offer" badge
          const newBadge = tile.querySelector('[class*="absolute"][class*="top-0"]');
          if (newBadge && newBadge.textContent.toLowerCase().includes('new')) {
            offer.status = 'New Offer';
          }

          // Alternative: look for any element containing "new offer"
          const allText = tile.textContent.toLowerCase();
          if (allText.includes('new offer') && offer.status === 'Available') {
            offer.status = 'New Offer';
          }

          // Filter out "Standard" offers with "2X miles"
          const isStandardOffer = offer.category && offer.category.toLowerCase().includes('standard');
          const isTwoXMiles = offer.discount && offer.discount.toLowerCase().includes('2x miles');

          if (isStandardOffer && isTwoXMiles) {
            console.log('[Capital One] Skipping Standard offer with 2X miles:', offer.merchant);
            return;
          }

          // Only return offer if it has meaningful content
          if (offer.merchant && offer.merchant.length > 1 && offer.discount) {
            offers.push(offer);
            console.log('[Capital One] Extracted offer', index + 1, ':', offer.merchant, '-', offer.discount, '(Category:', offer.category + ')');
          } else {
            console.log('[Capital One] Skipped tile', index + 1, '- insufficient data:', {
              merchant: offer.merchant,
              discount: offer.discount
            });
          }
        } catch (error) {
          console.error('[Capital One] Error extracting tile', index + 1, ':', error);
        }
      });

      console.log('[Capital One] Extracted', offers.length, 'offers total');
      return offers;
    }

    // Click "View More Offers" button and wait for new offers to load
    const buttonClicked = clickViewMoreButton();

    if (buttonClicked) {
      // Wait for new offers to load after clicking
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(findCapitalOneOffers());
        }, 2000);
      });
    } else {
      // Return immediately if button wasn't found
      return Promise.resolve(findCapitalOneOffers());
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Health check ping
    if (request.action === 'ping') {
      console.log('[Offers Extractor] Ping received, responding with success');
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'extractOffers') {
      console.log('[Offers Extractor] Extraction requested, site:', detectSite());
      console.log('[Offers Extractor] Page ready state:', document.readyState);

      // Immediately acknowledge receipt of message
      const messageReceived = true;

      // Wait a bit for dynamic content to load
      setTimeout(async () => {
        try {
          const result = extractOffers();
          // Handle both Promise and direct array returns
          const offers = result instanceof Promise ? await result : result;
          console.log('[Offers Extractor] Sending', offers.length, 'offers to popup');

          // Check if response callback is still valid
          if (sendResponse) {
            sendResponse({ success: true, offers: offers, count: offers.length });
          } else {
            console.error('[Offers Extractor] sendResponse callback no longer available');
          }
        } catch (error) {
          console.error('[Offers Extractor] Error during extraction:', error);
          if (sendResponse) {
            sendResponse({ success: false, error: error.message, offers: [] });
          }
        }
      }, 1500); // Wait for dynamic content to load

      return true; // Keep channel open for async response
    }
    return false;
  });

  // Log that content script is loaded
  console.log('[Offers Extractor] Content script loaded on:', window.location.href);

  // Also try to extract on page load and store
  window.addEventListener('load', () => {
    setTimeout(async () => {
      const result = extractOffers();
      const offers = result instanceof Promise ? await result : result;
      chrome.storage.local.set({ lastExtractedOffers: offers, lastExtractionTime: Date.now() });
    }, 3000);
  });

  // Listen for DOM changes (for dynamically loaded offers)
  const observer = new MutationObserver(() => {
    setTimeout(async () => {
      const result = extractOffers();
      const offers = result instanceof Promise ? await result : result;
      chrome.storage.local.set({ lastExtractedOffers: offers, lastExtractionTime: Date.now() });
    }, 2000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();

