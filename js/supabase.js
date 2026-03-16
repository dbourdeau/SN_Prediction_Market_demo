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
            email,
            password,
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
    async getMarkets() {
        const { data, error } = await supabaseClient
            .from('markets').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
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

    // ---- Predictions ----
    async getPredictions(userId) {
        const { data, error } = await supabaseClient
            .from('predictions').select('*, markets(title, probability, status, resolution)')
            .eq('user_id', userId).order('created_at', { ascending: false });
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

    async updatePrediction(id, updates) {
        const { data, error } = await supabaseClient
            .from('predictions').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
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

    // ---- Comments ----
    async getComments(marketId) {
        const { data, error } = await supabaseClient
            .from('comments').select('*, profiles(name, department, avatar)')
            .eq('market_id', marketId).order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createComment(comment) {
        const { data, error } = await supabaseClient
            .from('comments').insert(comment)
            .select('*, profiles(name, department, avatar)').single();
        if (error) throw error;
        return data;
    },

    // ---- Leaderboard ----
    async getLeaderboard() {
        const { data, error } = await supabaseClient
            .from('profiles').select('*')
            .order('points', { ascending: false }).limit(50);
        if (error) throw error;
        return data;
    },

    // ---- Notifications ----
    async getNotifications(userId) {
        const { data, error } = await supabaseClient
            .from('notifications').select('*')
            .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
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
        const { error } = await supabaseClient
            .from('notifications').update({ is_read: true }).eq('id', id);
        if (error) throw error;
    },

    async markAllNotificationsRead(userId) {
        const { error } = await supabaseClient
            .from('notifications').update({ is_read: true })
            .eq('user_id', userId).eq('is_read', false);
        if (error) throw error;
    },

    // ---- Realtime ----
    subscribeToMarkets(callback) {
        return supabaseClient.channel('markets-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, callback)
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
