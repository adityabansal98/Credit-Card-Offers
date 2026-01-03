const supabase = require('../database/supabase');

class Offer {
  // Get all offers with optional filters
  static async getAll(filters = {}) {
    let query = supabase.from('offers').select('*');

    // Apply filters
    if (filters.source) {
      query = query.eq('source', filters.source);
    }

    if (filters.search) {
      query = query.ilike('merchant', `%${filters.search}%`);
    }

    if (filters.expired !== undefined) {
      if (filters.expired === false) {
        // Only non-expired offers (expiry_date is null or in future)
        // This is a simplified check - you might want to parse dates
        query = query.or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString().split('T')[0]);
      }
    }

    // Order by created_at descending (newest first)
    query = query.order('created_at', { ascending: false });

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  // Get single offer by ID
  static async getById(id) {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  // Create new offer(s)
  static async create(offers) {
    // Ensure offers is an array
    const offersArray = Array.isArray(offers) ? offers : [offers];

    // Add timestamps
    const now = new Date().toISOString();
    const offersWithTimestamps = offersArray.map(offer => ({
      ...offer,
      created_at: now,
      updated_at: now
    }));

    const { data, error } = await supabase
      .from('offers')
      .insert(offersWithTimestamps)
      .select();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return Array.isArray(offers) ? data : data[0];
  }

  // Update offer
  static async update(id, updates) {
    const { data, error } = await supabase
      .from('offers')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  // Delete offer
  static async delete(id) {
    const { error } = await supabase
      .from('offers')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { success: true };
  }

  // Get statistics
  static async getStats() {
    const { data: allOffers, error } = await supabase
      .from('offers')
      .select('source');

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const stats = {
      total: allOffers.length,
      bySource: {
        Amex: allOffers.filter(o => o.source === 'Amex').length,
        Chase: allOffers.filter(o => o.source === 'Chase').length,
        Email: allOffers.filter(o => o.source === 'Email').length
      }
    };

    return stats;
  }
}

module.exports = Offer;

