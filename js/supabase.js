// Supabase client initialization and helpers

const SUPABASE_URL = 'https://uanjytnrxniwmddpvxsa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhbmp5dG5yeG5pd21kZHB2eHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODc2MzYsImV4cCI6MjA4OTI2MzYzNn0.Ujgm-cDXnDde2Z37TG4_vwJGsR4dJaC3UPy1fGLm1qc';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// AUTH
// ============================================================

const Auth = {
    async signUp(email, password, name, department) {
        const { data, error } = await supabaseClient.auth.signUp({
            email, password,
            options: { data: { name, department } }
        });
        if (error) throw error;
        if (data.user) {
            const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'XX';
            await supabaseClient.from('profiles').update({
                name, department, avatar: initials
            }).eq('id', data.user.id);
        }
        return data;
    },

    async signIn(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    },

    async resetPassword(email) {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });
        if (error) throw error;
    },

    async getSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session;
    },

    async getProfile(userId) {
        const { data, error } = await supabaseClient
            .from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;
        return data;
    },

    onAuthChange(callback) {
        supabaseClient.auth.onAuthStateChange(callback);
    }
};

// ============================================================
// DATABASE HELPERS
// ============================================================

const DB = {
    // ---- Markets ----
    async getMarkets(limit = 50, offset = 0) {
        const { data, error } = await supabaseClient
            .from('markets').select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;
        return data;
    },

    async getMarketCount() {
        const { count, error } = await supabaseClient
            .from('markets').select('*', { count: 'exact', head: true });
        if (error) throw error;
        return count || 0;
    },

    async getMarket(id) {
        const { data, error } = await supabaseClient
            .from('markets').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async createMarket(market) {
        const { data, error } = await supabaseClient
            .from('markets').insert(market).select().single();
        if (error) throw error;
        return data;
    },

    async deleteMarket(marketId, deletedBy) {
        const { error } = await supabaseClient.rpc('delete_market', {
            p_market_id: marketId,
            p_deleted_by: deletedBy
        });
        if (error) throw error;
    },

    async updateMarket(id, updates) {
        const { data, error } = await supabaseClient
            .from('markets').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async resolveMarket(marketId, resolution, resolvedBy) {
        const { data, error } = await supabaseClient.rpc('resolve_market', {
            p_market_id: marketId,
            p_resolution: resolution,
            p_resolved_by: resolvedBy
        });
        if (error) throw error;
        return data;
    },

    async resolveMultiMarket(marketId, winningIndex, resolvedBy) {
        const { data, error } = await supabaseClient.rpc('resolve_multi_market', {
            p_market_id: marketId,
            p_winning_index: winningIndex,
            p_resolved_by: resolvedBy
        });
        if (error) throw error;
        return data;
    },

    async closeExpiredMarkets() {
        const { data, error } = await supabaseClient.rpc('close_expired_markets');
        if (error) console.warn('Auto-close error:', error);
        return data;
    },

    async notifyClosingSoon() {
        const { data, error } = await supabaseClient.rpc('notify_closing_soon');
        if (error) console.warn('Closing-soon notify error:', error);
        return data;
    },

    // ---- Predictions ----
    async getPredictions(userId, limit = 50, offset = 0) {
        const { data, error } = await supabaseClient
            .from('predictions').select('*, markets(title, probability, status, resolution)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;
        return data;
    },

    async getMarketPredictions(marketId) {
        const { data, error } = await supabaseClient
            .from('predictions').select('*, profiles(name, department, avatar)')
            .eq('market_id', marketId).order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createPrediction(prediction) {
        const { data, error } = await supabaseClient
            .from('predictions').insert(prediction).select().single();
        if (error) throw error;
        return data;
    },

    async placePrediction(params) {
        const { data, error } = await supabaseClient.rpc('place_prediction', params);
        if (error) throw error;
        return data; // returns prediction id
    },

    async sellPositionRPC(params) {
        const { data, error } = await supabaseClient.rpc('sell_position', params);
        if (error) throw error;
        return data; // returns revenue
    },

    async updatePrediction(id, updates) {
        const { data, error } = await supabaseClient
            .from('predictions').update(updates).eq('id', id).select();
        if (error) throw error;
        return data?.[0];
    },

    // ---- Profiles ----
    async updateProfile(userId, updates) {
        const { data, error } = await supabaseClient
            .from('profiles').update(updates).eq('id', userId).select().single();
        if (error) throw error;
        return data;
    },

    async getProfileByID(userId) {
        const { data, error } = await supabaseClient
            .from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;
        return data;
    },

    async getAllProfiles() {
        const { data, error } = await supabaseClient
            .from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // ---- Comments ----
    async getComments(marketId) {
        const { data, error } = await supabaseClient
            .from('comments').select('*, profiles!user_id(name, department, avatar)')
            .eq('market_id', marketId).is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createComment(comment) {
        const { data, error } = await supabaseClient
            .from('comments').insert(comment)
            .select('*, profiles!user_id(name, department, avatar)').single();
        if (error) throw error;
        return data;
    },

    async deleteComment(commentId, deletedBy) {
        const { error } = await supabaseClient
            .from('comments').update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
            .eq('id', commentId);
        if (error) throw error;
    },

    // ---- Transactions ----
    async getTransactions(userId, limit = 50, offset = 0) {
        const { data, error } = await supabaseClient
            .from('transactions').select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;
        return data;
    },

    async logTransaction(tx) {
        const { error } = await supabaseClient
            .from('transactions').insert(tx);
        if (error) console.warn('Transaction log error:', error);
    },

    // ---- Watchlist ----
    async getWatchlist(userId) {
        const { data, error } = await supabaseClient
            .from('watchlist').select('market_id')
            .eq('user_id', userId);
        if (error) throw error;
        return (data || []).map(w => w.market_id);
    },

    async addToWatchlist(userId, marketId) {
        const { error } = await supabaseClient
            .from('watchlist').insert({ user_id: userId, market_id: marketId });
        if (error && error.code !== '23505') throw error; // ignore duplicate
    },

    async removeFromWatchlist(userId, marketId) {
        const { error } = await supabaseClient
            .from('watchlist').delete()
            .eq('user_id', userId).eq('market_id', marketId);
        if (error) throw error;
    },

    // ---- Market Approval ----
    async approveMarket(marketId, approvedBy) {
        const { error } = await supabaseClient.rpc('approve_market', {
            p_market_id: marketId, p_approved_by: approvedBy
        });
        if (error) throw error;
    },

    async rejectMarket(marketId, rejectedBy, reason) {
        const { error } = await supabaseClient.rpc('reject_market', {
            p_market_id: marketId, p_rejected_by: rejectedBy, p_reason: reason
        });
        if (error) throw error;
    },

    async getPendingMarkets() {
        const { data, error } = await supabaseClient
            .from('markets').select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // ---- Quarterly Prize Pool ----
    async getResolvedPredictions(startDate, endDate) {
        const { data, error } = await supabaseClient
            .from('predictions')
            .select('id, user_id, market_id, direction, amount, shares, entry_prob, status, payout, option_index, created_at')
            .in('status', ['won', 'lost'])
            .gte('created_at', startDate)
            .lte('created_at', endDate);
        if (error) throw error;
        return data || [];
    },

    async getAllPredictionsInRange(startDate, endDate) {
        const { data, error } = await supabaseClient
            .from('predictions')
            .select('id, user_id, market_id, created_at, status')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
        if (error) throw error;
        return data || [];
    },

    async getMarketsCreatedInRange(startDate, endDate) {
        const { data, error } = await supabaseClient
            .from('markets')
            .select('id, title, created_by, created_by_name, status, traders, volume, category, created_at')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .neq('status', 'pending');
        if (error) throw error;
        return data || [];
    },

    // ---- Balance Reconciliation ----
    async getAllTransactions() {
        const { data, error } = await supabaseClient
            .from('transactions').select('user_id, amount')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async insertReconciliationTx(userId, amount, balanceAfter) {
        const { error } = await supabaseClient
            .from('transactions').insert({
                user_id: userId,
                type: 'admin_adjust',
                amount,
                balance_after: balanceAfter,
                description: 'Reconciliation adjustment (correcting missing transaction records)',
            });
        if (error) throw error;
    },

    // ---- Referral ----
    async claimReferral(userId, referrerId) {
        const { data, error } = await supabaseClient.rpc('claim_referral', {
            p_user_id: userId, p_referrer_id: referrerId
        });
        if (error) throw error;
        return data; // returns boolean
    },

    // ---- Daily Login Bonus ----
    async claimDailyBonus(userId) {
        const { data, error } = await supabaseClient.rpc('claim_daily_bonus', { p_user_id: userId });
        if (error) throw error;
        return data; // returns bonus amount (0 if already claimed today)
    },

    // ---- Audit Log ----
    async logAuditEvent(actorId, action, targetType, targetId, details = {}) {
        const { error } = await supabaseClient
            .from('audit_log').insert({ actor_id: actorId, action, target_type: targetType, target_id: String(targetId), details });
        if (error) console.warn('Audit log error:', error);
    },

    async getAuditLog(limit = 50) {
        const { data, error } = await supabaseClient
            .from('audit_log').select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    // ---- Activity Feed ----
    async getRecentActivity(limit = 20) {
        const { data, error } = await supabaseClient
            .from('predictions').select('id, user_id, market_id, direction, amount, shares, status, created_at, profiles(name, avatar), markets(title)')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    },

    // ---- Leaderboard ----
    async getLeaderboard(limit = 50, offset = 0) {
        const { data, error } = await supabaseClient
            .from('profiles').select('*')
            .order('points', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;
        return data;
    },

    // ---- Notifications ----
    async getNotifications(userId, limit = 50) {
        const { data, error } = await supabaseClient
            .from('notifications').select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return data;
    },

    async getUnreadCount(userId) {
        const { count, error } = await supabaseClient
            .from('notifications').select('*', { count: 'exact', head: true })
            .eq('user_id', userId).eq('is_read', false);
        if (error) throw error;
        return count || 0;
    },

    async markNotificationRead(id) {
        await supabaseClient.from('notifications').update({ is_read: true }).eq('id', id);
    },

    async markAllNotificationsRead(userId) {
        await supabaseClient.from('notifications').update({ is_read: true })
            .eq('user_id', userId).eq('is_read', false);
    },

    // ---- Realtime ----
    subscribeToMarkets(callback) {
        return supabaseClient.channel('markets-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, callback)
            .subscribe();
    },

    subscribeToPredictions(marketId, callback) {
        return supabaseClient.channel(`predictions-${marketId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'predictions',
                filter: `market_id=eq.${marketId}`
            }, callback)
            .subscribe();
    },

    subscribeToComments(marketId, callback) {
        return supabaseClient.channel(`comments-${marketId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'comments',
                filter: `market_id=eq.${marketId}`
            }, callback)
            .subscribe();
    },

    subscribeToNotifications(userId, callback) {
        return supabaseClient.channel(`notifications-${userId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, callback)
            .subscribe();
    },

    unsubscribe(channel) {
        if (channel) supabaseClient.removeChannel(channel);
    }
};
