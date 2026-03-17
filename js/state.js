// State management with full Supabase persistence

const AppState = {
    currentPage: 'login',
    selectedMarket: null,
    selectedMarketComments: [],
    selectedMarketPredictions: [],
    markets: [],
    user: null,
    session: null,
    userPredictions: [],
    leaderboard: [],
    notifications: [],
    unreadCount: 0,
    viewingProfile: null,
    viewingProfilePredictions: [],
    allUsers: [],
    categoryFilter: 'all',
    searchQuery: '',
    sortBy: 'trending',
    loading: false,
    actionLoading: false, // for button-level loading

    _marketsChannel: null,
    _notificationsChannel: null,
    _commentsChannel: null,
    _predictionsChannel: null,

    listeners: [],
    subscribe(fn) { this.listeners.push(fn); },
    notify() { this.listeners.forEach(fn => fn()); },

    // ==================== AUTH ====================

    async init() {
        this.loading = true;
        this.notify();
        try {
            const session = await Auth.getSession();
            if (session) {
                this.session = session;
                await this.loadUserData(session.user.id);
                this.currentPage = 'dashboard';
                this._setupRealtime();
                // Auto-close expired markets on load
                DB.closeExpiredMarkets().then(() => this._refreshMarkets());
            }
        } catch (e) {
            console.error('Init error:', e);
        }
        this.loading = false;
        this.notify();

        Auth.onAuthChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.session = session;
                await this.loadUserData(session.user.id);
                this.currentPage = 'dashboard';
                this._setupRealtime();
                this.notify();
            } else if (event === 'SIGNED_OUT') {
                this._teardownRealtime();
                Object.assign(this, {
                    session: null, user: null, markets: [], userPredictions: [],
                    leaderboard: [], notifications: [], unreadCount: 0, currentPage: 'login'
                });
                this.notify();
            }
        });
    },

    async loadUserData(userId) {
        try {
            const [profile, markets, predictions, leaderboard, notifications, unreadCount] = await Promise.all([
                Auth.getProfile(userId), DB.getMarkets(), DB.getPredictions(userId),
                DB.getLeaderboard(), DB.getNotifications(userId), DB.getUnreadCount(userId)
            ]);
            Object.assign(this, { user: profile, markets, userPredictions: predictions, leaderboard, notifications, unreadCount });
        } catch (e) { console.error('Load user data error:', e); }
    },

    async login(email, password) {
        this.loading = true; this.notify();
        try { await Auth.signIn(email, password); }
        catch (e) { this.loading = false; this.notify(); throw e; }
    },

    async signup(email, password, name, department) {
        this.loading = true; this.notify();
        try {
            const data = await Auth.signUp(email, password, name, department);
            if (!data.session) { this.loading = false; this.currentPage = 'login'; this.notify(); return 'confirm'; }
        } catch (e) { this.loading = false; this.notify(); throw e; }
    },

    async logout() { await Auth.signOut(); },

    async resetPassword(email) { await Auth.resetPassword(email); },

    // ==================== REALTIME ====================

    _setupRealtime() {
        this._marketsChannel = DB.subscribeToMarkets(async (payload) => {
            if (payload.eventType === 'UPDATE') {
                const idx = this.markets.findIndex(m => m.id === payload.new.id);
                if (idx >= 0) this.markets[idx] = payload.new;
                if (this.selectedMarket?.id === payload.new.id) this.selectedMarket = payload.new;
                this.notify();
            } else if (payload.eventType === 'INSERT') {
                this.markets.unshift(payload.new);
                this.notify();
            }
        });

        if (this.session?.user?.id) {
            this._notificationsChannel = DB.subscribeToNotifications(this.session.user.id, (payload) => {
                if (payload.eventType === 'INSERT') {
                    this.notifications.unshift(payload.new);
                    this.unreadCount++;
                    this.notify();
                }
            });
        }
    },

    _teardownRealtime() {
        [this._marketsChannel, this._notificationsChannel, this._commentsChannel, this._predictionsChannel]
            .forEach(ch => DB.unsubscribe(ch));
        this._marketsChannel = this._notificationsChannel = this._commentsChannel = this._predictionsChannel = null;
    },

    async _refreshMarkets() {
        try { this.markets = await DB.getMarkets(); this.notify(); } catch (e) {}
    },

    // ==================== NAVIGATION ====================

    async navigate(page, data) {
        DB.unsubscribe(this._commentsChannel);
        DB.unsubscribe(this._predictionsChannel);
        this._commentsChannel = this._predictionsChannel = null;

        this.currentPage = page;

        if (data?.marketId) {
            try {
                this.selectedMarket = await DB.getMarket(data.marketId);
            } catch (e) { console.error('Failed to load market:', e); }

            try {
                this.selectedMarketComments = await DB.getComments(data.marketId);
            } catch (e) { this.selectedMarketComments = []; console.warn('Comments load failed:', e); }

            try {
                this.selectedMarketPredictions = await DB.getMarketPredictions(data.marketId);
            } catch (e) { this.selectedMarketPredictions = []; console.warn('Predictions load failed:', e); }

            // Live comments
            this._commentsChannel = DB.subscribeToComments(data.marketId, async () => {
                try {
                    this.selectedMarketComments = await DB.getComments(data.marketId);
                    this.notify();
                } catch (e) {}
            });
            // Live trades
            this._predictionsChannel = DB.subscribeToPredictions(data.marketId, async () => {
                try {
                    this.selectedMarketPredictions = await DB.getMarketPredictions(data.marketId);
                    const updatedMarket = await DB.getMarket(data.marketId);
                    this.selectedMarket = updatedMarket;
                    const idx = this.markets.findIndex(m => m.id === data.marketId);
                    if (idx >= 0) this.markets[idx] = updatedMarket;
                    this.notify();
                } catch (e) {}
            });
        }

        if (data?.profileId) {
            try {
                const [profile, predictions] = await Promise.all([
                    DB.getProfileByID(data.profileId), DB.getPredictions(data.profileId)
                ]);
                this.viewingProfile = profile;
                this.viewingProfilePredictions = predictions;
            } catch (e) { console.error('Failed to load profile:', e); }
        }

        // Refresh leaderboard when viewing it
        if (page === 'leaderboard') {
            try { this.leaderboard = await DB.getLeaderboard(); } catch (e) {}
        }

        // Load all users for admin
        if (page === 'admin' && this.user?.is_admin) {
            try { this.allUsers = await DB.getAllProfiles(); } catch (e) {}
        }

        this.notify();
        window.scrollTo(0, 0);
    },

    // ==================== PREDICTIONS (AMM) ====================

    async placePrediction(marketId, direction, amount) {
        const market = this.markets.find(m => m.id === marketId);
        console.log('placePrediction:', { marketId, direction, amount, found: !!market, balance: this.user?.balance, status: market?.status, resolution: market?.resolution });
        if (!market || amount > this.user.balance || market.status !== 'active' || market.resolution) return false;

        const qYes = market.q_yes || 0, qNo = market.q_no || 0;
        const shares = AMM.sharesForBudget(qYes, qNo, amount, direction);
        if (shares <= 0) return false;

        const newQYes = direction === 'yes' ? qYes + shares : qYes;
        const newQNo = direction === 'no' ? qNo + shares : qNo;
        const newProb = AMM.yesPrice(newQYes, newQNo);
        const newLogit = AMM.logitFromProb(newProb);
        const newHistory = [...(market.history || []), newProb];

        try {
            await DB.createPrediction({
                user_id: this.session.user.id, market_id: marketId,
                direction, amount, shares,
                entry_prob: direction === 'yes' ? newProb : 1 - newProb,
                status: 'active',
            });

            await DB.updateMarket(marketId, {
                probability: newProb, logit: newLogit, q_yes: newQYes, q_no: newQNo,
                volume: market.volume + amount, traders: market.traders + 1, history: newHistory,
            });

            const newBalance = this.user.balance - amount;
            await DB.updateProfile(this.session.user.id, { balance: newBalance, trades: this.user.trades + 1 });

            this.user.balance = newBalance;
            this.user.trades += 1;
            Object.assign(market, { probability: newProb, logit: newLogit, q_yes: newQYes, q_no: newQNo, volume: market.volume + amount, traders: market.traders + 1, history: newHistory });
            this.selectedMarket = market;

            this.userPredictions = await DB.getPredictions(this.session.user.id);
            if (this.selectedMarket?.id === marketId) {
                this.selectedMarketPredictions = await DB.getMarketPredictions(marketId);
            }
            this.notify();
            return { shares, newProb };
        } catch (e) {
            console.error('Prediction error:', e);
            if (e.message?.includes('balance')) showToast('Insufficient balance', 'error');
            return false;
        }
    },

    // ==================== SELL POSITION ====================

    async sellPosition(predictionId) {
        const pred = this.userPredictions.find(p => p.id === predictionId);
        if (!pred || pred.status !== 'active') return false;

        const market = this.markets.find(m => m.id === pred.market_id);
        if (!market || market.status !== 'active' || market.resolution) return false;

        const qYes = market.q_yes || 0, qNo = market.q_no || 0;
        const revenue = AMM.sellRevenue(qYes, qNo, pred.shares, pred.direction);
        if (revenue <= 0) return false;

        const newQYes = pred.direction === 'yes' ? Math.max(0, qYes - pred.shares) : qYes;
        const newQNo = pred.direction === 'no' ? Math.max(0, qNo - pred.shares) : qNo;
        const newProb = AMM.yesPrice(newQYes, newQNo);
        const newHistory = [...(market.history || []), newProb];
        const roundedRevenue = Math.round(revenue);

        try {
            await DB.updatePrediction(pred.id, { status: 'sold', payout: roundedRevenue });
            await DB.updateMarket(market.id, {
                probability: newProb, logit: AMM.logitFromProb(newProb),
                q_yes: newQYes, q_no: newQNo,
                volume: market.volume + roundedRevenue, history: newHistory,
            });
            await DB.updateProfile(this.session.user.id, { balance: this.user.balance + roundedRevenue });

            this.user.balance += roundedRevenue;
            Object.assign(market, { probability: newProb, q_yes: newQYes, q_no: newQNo, history: newHistory });

            this.userPredictions = await DB.getPredictions(this.session.user.id);
            if (this.selectedMarket?.id === market.id) {
                this.selectedMarket = market;
                this.selectedMarketPredictions = await DB.getMarketPredictions(market.id);
            }
            this.notify();
            return { revenue: roundedRevenue, profit: roundedRevenue - pred.amount };
        } catch (e) { console.error('Sell error:', e); return false; }
    },

    // ==================== MARKET RESOLUTION ====================

    async resolveMarket(marketId, resolution) {
        try {
            await DB.resolveMarket(marketId, resolution, this.session.user.id);
            const [markets, leaderboard, predictions] = await Promise.all([
                DB.getMarkets(), DB.getLeaderboard(), DB.getPredictions(this.session.user.id),
            ]);
            Object.assign(this, { markets, leaderboard, userPredictions: predictions });
            this.user = await Auth.getProfile(this.session.user.id);
            if (this.selectedMarket?.id === marketId) {
                this.selectedMarket = this.markets.find(m => m.id === marketId);
                this.selectedMarketPredictions = await DB.getMarketPredictions(marketId);
            }
            this.notify();
            return true;
        } catch (e) { console.error('Resolution error:', e); throw e; }
    },

    // ==================== MARKET CREATION ====================

    async addMarket(marketData) {
        try {
            const newMarket = await DB.createMarket({
                title: marketData.title.slice(0, 200),
                description: marketData.description.slice(0, 5000),
                category: marketData.category, closes_at: marketData.closesAt,
                probability: 0.50, logit: 0, q_yes: 0, q_no: 0,
                volume: 0, traders: 0,
                created_by: this.session.user.id,
                created_by_name: `${this.user.name} (${this.user.department})`,
                status: 'active', trending: false, history: [0.50],
            });
            this.markets.unshift(newMarket);
            this.notify();
            return newMarket;
        } catch (e) { console.error('Create market error:', e); throw e; }
    },

    // ==================== MARKET EDITING ====================

    async editMarket(marketId, updates) {
        try {
            const clean = {};
            if (updates.title) clean.title = updates.title.slice(0, 200);
            if (updates.description) clean.description = updates.description.slice(0, 5000);
            if (updates.closes_at) clean.closes_at = updates.closes_at;
            clean.edited_at = new Date().toISOString();

            const updated = await DB.updateMarket(marketId, clean);
            const idx = this.markets.findIndex(m => m.id === marketId);
            if (idx >= 0) this.markets[idx] = updated;
            if (this.selectedMarket?.id === marketId) this.selectedMarket = updated;
            this.notify();
            return updated;
        } catch (e) { console.error('Edit market error:', e); throw e; }
    },

    // ==================== COMMENTS ====================

    async addComment(marketId, text) {
        try {
            const comment = await DB.createComment({
                user_id: this.session.user.id, market_id: marketId,
                text: text.slice(0, 2000),
            });
            this.selectedMarketComments.unshift(comment);
            this.notify();
            return comment;
        } catch (e) { console.error('Comment error:', e); throw e; }
    },

    async deleteComment(commentId) {
        try {
            await DB.deleteComment(commentId, this.session.user.id);
            this.selectedMarketComments = this.selectedMarketComments.filter(c => c.id !== commentId);
            this.notify();
        } catch (e) { console.error('Delete comment error:', e); throw e; }
    },

    // ==================== NOTIFICATIONS ====================

    async markNotificationRead(id) {
        await DB.markNotificationRead(id);
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.is_read) { notif.is_read = true; this.unreadCount = Math.max(0, this.unreadCount - 1); this.notify(); }
    },

    async markAllRead() {
        await DB.markAllNotificationsRead(this.session.user.id);
        this.notifications.forEach(n => n.is_read = true);
        this.unreadCount = 0; this.notify();
    },

    // ==================== ADMIN ====================

    async setMarketTrending(marketId, trending) {
        await DB.updateMarket(marketId, { trending });
        const market = this.markets.find(m => m.id === marketId);
        if (market) market.trending = trending;
        this.notify();
    },

    async setUserAdmin(userId, isAdmin) {
        await DB.updateProfile(userId, { is_admin: isAdmin });
        const user = this.allUsers.find(u => u.id === userId);
        if (user) user.is_admin = isAdmin;
        this.notify();
    },

    async adjustUserBalance(userId, amount) {
        const user = this.allUsers.find(u => u.id === userId);
        if (!user) return;
        const newBalance = Math.max(0, user.balance + amount);
        await DB.updateProfile(userId, { balance: newBalance });
        user.balance = newBalance;
        if (userId === this.user.id) this.user.balance = newBalance;
        this.notify();
    },

    // ==================== FILTERING ====================

    getFilteredMarkets() {
        let filtered = [...this.markets];
        if (this.categoryFilter !== 'all') filtered = filtered.filter(m => m.category === this.categoryFilter);
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(m => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
        }
        switch (this.sortBy) {
            case 'trending': filtered.sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0) || b.volume - a.volume); break;
            case 'newest': filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
            case 'volume': filtered.sort((a, b) => b.volume - a.volume); break;
            case 'closing': filtered.sort((a, b) => new Date(a.closes_at) - new Date(b.closes_at)); break;
        }
        return filtered;
    },

    setFilter(category) { this.categoryFilter = category; this.notify(); },
    setSearch(query) { this.searchQuery = query; this.notify(); },
    setSort(sort) { this.sortBy = sort; this.notify(); },
};
