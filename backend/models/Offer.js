const supabase = require('../database/supabase');

class Offer {
  // Get all offers with optional filters
  static async getAll(filters = {}) {
    let query = supabase.from('offers').select('*');

    // Apply filters
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

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

  // Helper function to normalize field values for comparison
  static normalizeField(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
  }

  // Helper function to check if two offers are duplicates
  static areOffersDuplicate(offer1, offer2) {
    // Compare all relevant fields (case-insensitive, trimmed)
    const fields = ['merchant', 'title', 'description', 'discount', 'source', 'expiry_date', 'category'];
    
    for (const field of fields) {
      const val1 = this.normalizeField(offer1[field]);
      const val2 = this.normalizeField(offer2[field]);
      
      // If any field differs, they are not duplicates
      if (val1 !== val2) {
        return false;
      }
    }
    
    // All fields match - they are duplicates
    return true;
  }

  // Check if an offer already exists in the existing offers array (in-memory check)
  static offerExistsInArray(offer, existingOffers) {
    // Check if any existing offer matches the new one
    return existingOffers.some(existing => this.areOffersDuplicate(offer, existing));
  }

  // Create new offer(s) with duplicate checking (optimized - fetches existing offers once)
  static async create(offers, userId = null) {
    if (!userId) {
      throw new Error('User ID is required to create offers');
    }

    // Ensure offers is an array
    const offersArray = Array.isArray(offers) ? offers : [offers];

    // Fetch all existing offers ONCE at the start (instead of fetching for each offer)
    const existingOffers = await this.getAll({ user_id: userId });
    console.log(`[Offer.create] Fetched ${existingOffers.length} existing offers for duplicate checking`);

    // Separate new offers from duplicates (all comparisons done in memory)
    const newOffers = [];
    const skippedOffers = [];

    for (const offer of offersArray) {
      // Prepare offer with user_id
      const offerWithUser = {
        ...offer,
        user_id: userId
      };

      // Check if this offer already exists (in-memory comparison - no DB query)
      const exists = this.offerExistsInArray(offerWithUser, existingOffers);
      
      if (exists) {
        skippedOffers.push(offer);
      } else {
        newOffers.push(offerWithUser);
      }
    }

    // Only insert new offers
    let insertedOffers = [];
    if (newOffers.length > 0) {
      // Add timestamps
      const now = new Date().toISOString();
      const offersWithTimestamps = newOffers.map(offer => ({
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

      insertedOffers = data || [];
    }

    // Return result with metadata
    return {
      inserted: insertedOffers,
      skipped: skippedOffers.length,
      total: offersArray.length,
      newCount: insertedOffers.length,
      skippedCount: skippedOffers.length
    };
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

  // Delete all offers for a user
  static async deleteAll(userId) {
    if (!userId) {
      throw new Error('User ID is required to delete offers');
    }

    const { data, error } = await supabase
      .from('offers')
      .delete()
      .eq('user_id', userId)
      .select();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { success: true, deletedCount: data?.length || 0 };
  }

  // Get statistics
  static async getStats(userId = null) {
    let query = supabase.from('offers').select('source');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data: allOffers, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const stats = {
      total: allOffers.length,
      bySource: {
        Amex: allOffers.filter(o => o.source === 'Amex').length,
        Chase: allOffers.filter(o => o.source === 'Chase').length,
        'Capital One': allOffers.filter(o => o.source === 'Capital One').length,
        Email: allOffers.filter(o => o.source === 'Email').length
      }
    };

    return stats;
  }
}

module.exports = Offer;

