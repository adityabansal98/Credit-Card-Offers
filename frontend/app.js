// API Configuration
const API_BASE_URL = window.location.origin; // Use same origin as frontend
const API_URL = `${API_BASE_URL}/api/offers`;

// State
let allOffers = [];
let filteredOffers = [];
let currentSourceFilter = 'all';
let currentSearchQuery = '';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const offersContainer = document.getElementById('offersContainer');
const emptyState = document.getElementById('emptyState');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const filterButtons = document.querySelectorAll('.filter-btn');
const statsElements = {
    total: document.getElementById('totalOffers'),
    amex: document.getElementById('amexCount'),
    chase: document.getElementById('chaseCount'),
    email: document.getElementById('emailCount')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadOffers();
    loadStats();
});

// Event Listeners
function setupEventListeners() {
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
    showLoading();
    hideError();
    
    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        
        if (result.success) {
            allOffers = result.data || [];
            filterOffers();
            updateStats();
        } else {
            showError(result.error || 'Failed to load offers');
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
    try {
        const response = await fetch(`${API_URL}/stats`);
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
    const statusClass = (offer.status || 'Available').toLowerCase();
    
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

