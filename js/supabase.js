// Supabase client initialization and auth helpers

const SUPABASE_URL = 'https://uanjytnrxniwmddpvxsa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhbmp5dG5yeG5pd21kZHB2eHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODc2MzYsImV4cCI6MjA4OTI2MzYzNn0.Ujgm-cDXnDde2Z37TG4_vwJGsR4dJaC3UPy1fGLm1qc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// AUTH HELPERS
// ============================================================

const Auth = {
    async signUp(email, password, name, department) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, department }
            }
        });
        if (error) throw error;

        // Update profile with department
        if (data.user) {
            const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'XX';
            await supabase.from('profiles').update({
                name,
                department,
                avatar: initials
            }).eq('id', data.user.id);
        }

        return data;
    },

    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    },

    onAuthChange(callback) {
        supabase.auth.onAuthStateChange(callback);
    }
};

// ============================================================
// DATABASE HELPERS
// ============================================================

const DB = {
    // Markets
    async getMarkets() {
        const { data, error } = await supabase
            .from('markets')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async getMarket(id) {
        const { data, error } = await supabase
            .from('markets')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

    async createMarket(market) {
        const { data, error } = await supabase
            .from('markets')
            .insert(market)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateMarket(id, updates) {
        const { data, error } = await supabase
            .from('markets')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Predictions
    async getPredictions(userId) {
        const { data, error } = await supabase
            .from('predictions')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
    },

    async createPrediction(prediction) {
        const { data, error } = await supabase
            .from('predictions')
            .insert(prediction)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateProfile(userId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Comments
    async getComments(marketId) {
        const { data, error } = await supabase
            .from('comments')
            .select('*, profiles(name, department, avatar)')
            .eq('market_id', marketId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createComment(comment) {
        const { data, error } = await supabase
            .from('comments')
            .insert(comment)
            .select('*, profiles(name, department, avatar)')
            .single();
        if (error) throw error;
        return data;
    },

    // Leaderboard
    async getLeaderboard() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('points', { ascending: false })
            .limit(20);
        if (error) throw error;
        return data;
    }
};
