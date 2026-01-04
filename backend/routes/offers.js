const express = require('express');
const router = express.Router();
const Offer = require('../models/Offer');
const verifyGoogleToken = require('../middleware/auth');

// GET /api/offers - Get all offers with optional filters
// Note: Auth middleware is optional - remove if you want public access
router.get('/', verifyGoogleToken, async (req, res) => {
  try {
    const filters = {
      user_id: req.user?.id, // Filter by user ID from auth token
      source: req.query.source,
      search: req.query.search || req.query.q,
      expired: req.query.expired === 'true' ? true : req.query.expired === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };

    const offers = await Offer.getAll(filters);
    res.json({ success: true, data: offers, count: offers.length });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/offers/stats - Get statistics
// Note: Auth middleware is optional - remove if you want public access
router.get('/stats', verifyGoogleToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const stats = await Offer.getStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/offers/:id - Get single offer
router.get('/:id', async (req, res) => {
  try {
    const offer = await Offer.getById(req.params.id);
    res.json({ success: true, data: offer });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(404).json({ success: false, error: error.message });
  }
});

// POST /api/offers - Create new offer(s)
// Note: Requires authentication
router.post('/', verifyGoogleToken, async (req, res) => {
  try {
    const offers = req.body;
    const userId = req.user?.id; // Get user ID from auth token

    if (!offers || (Array.isArray(offers) && offers.length === 0)) {
      return res.status(400).json({ success: false, error: 'No offers provided' });
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User authentication required' });
    }

    const created = await Offer.create(offers, userId);
    res.status(201).json({ 
      success: true, 
      data: created,
      count: Array.isArray(created) ? created.length : 1
    });
  } catch (error) {
    console.error('Error creating offers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/offers/:id - Update offer
router.put('/:id', async (req, res) => {
  try {
    const updated = await Offer.update(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/offers/:id - Delete offer
router.delete('/:id', async (req, res) => {
  try {
    await Offer.delete(req.params.id);
    res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

