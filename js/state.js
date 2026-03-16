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
    categoryFilter: 'all',
    searchQuery: '',
    sortBy: 'trending',
    loading: false,

    // Realtime channels
    _marketsChannel: null,
    _notificationsChannel: null,
    _commentsChannel: null,

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
                this.session = null;
                this.user = null;
                this.markets = [];
                this.userPredictions = [];
                this.leaderboard = [];
                this.notifications = [];
                this.unreadCount = 0;
                this.currentPage = 'login';
                this.notify();
            }
        });
    },

    async loadUserData(userId) {
        try {
            const [profile, markets, predictions, leaderboard, notifications, unreadCount] = await Promise.all([
                Auth.getProfile(userId),
                DB.getMarkets(),
                DB.getPredictions(userId),
                DB.getLeaderboard(),
                DB.getNotifications(userId),
                DB.getUnreadCount(userId)
            ]);

            this.user = profile;
            this.markets = markets;
            this.userPredictions = predictions;
            this.leaderboard = leaderboard;
            this.notifications = notifications;
            this.unreadCount = unreadCount;
        } catch (e) {
            console.error('Load user data error:', e);
        }
    },

    async login(email, password) {
        this.loading = true;
        this.notify();
        try {
            await Auth.signIn(email, password);
        } catch (e) {
            this.loading = false;
            this.notify();
            throw e;
        }
    },

    async signup(email, password, name, department) {
        this.loading = true;
        this.notify();
        try {
            const data = await Auth.signUp(email, password, name, department);
            if (!data.session) {
                this.loading = false;
                this.currentPage = 'login';
                this.notify();
                return 'confirm';
            }
        } catch (e) {
            this.loading = false;
            this.notify();
            throw e;
        }
    },

    async logout() {
        await Auth.signOut();
    },

    // ==================== REALTIME ====================

    _setupRealtime() {
        // Markets updates
        this._marketsChannel = DB.subscribeToMarkets(async (payload) => {
            if (payload.eventType === 'UPDATE') {
                const idx = this.markets.findIndex(m => m.id === payload.new.id);
                if (idx >= 0) this.markets[idx] = payload.new;
                if (this.selectedMarket?.id === payload.new.id) {
                    this.selectedMarket = payload.new;
                }
                this.notify();
            } else if (payload.eventType === 'INSERT') {
                this.markets.unshift(payload.new);
                this.notify();
            }
        });

        // Notifications
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
        DB.unsubscribe(this._marketsChannel);
        DB.unsubscribe(this._notificationsChannel);
        DB.unsubscribe(this._commentsChannel);
        this._marketsChannel = null;
        this._notificationsChannel = null;
        this._commentsChannel = null;
    },

    // ==================== NAVIGATION ====================

    async navigate(page, data) {
        // Unsubscribe from previous comment channel
        if (this._commentsChannel) {
            DB.unsubscribe(this._commentsChannel);
            this._commentsChannel = null;
        }

        this.currentPage = page;

        if (data?.marketId) {
            try {
                const [market, comments, predictions] = await Promise.all([
                    DB.getMarket(data.marketId),
                    DB.getComments(data.marketId),
                    DB.getMarketPredictions(data.marketId)
                ]);
                this.selectedMarket = market;
                this.selectedMarketComments = comments;
                this.selectedMarketPredictions = predictions;

                // Subscribe to live comments
                this._commentsChannel = DB.subscribeToComments(data.marketId, async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        // Reload to get joined profile data
                        const comments = await DB.getComments(data.marketId);
                        this.selectedMarketComments = comments;
                        this.notify();
                    }
                });
            } catch (e) {
                console.error('Failed to load market:', e);
            }
        }

        if (data?.profileId) {
            try {
                const [profile, predictions] = await Promise.all([
                    DB.getProfileByID(data.profileId),
                    DB.getPredictions(data.profileId)
                ]);
                this.viewingProfile = profile;
                this.viewingProfilePredictions = predictions;
            } catch (e) {
                console.error('Failed to load profile:', e);
            }
        }

        this.notify();
        window.scrollTo(0, 0);
    },

    // ==================== PREDICTIONS (AMM-based) ====================

    async placePrediction(marketId, direction, amount) {
        const market = this.markets.find(m => m.id === marketId);
        if (!market || amount > this.user.balance || market.status !== 'active') return false;

        const qYes = market.q_yes || 0;
        const qNo = market.q_no || 0;

        // Calculate shares using AMM
        const shares = AMM.sharesForBudget(qYes, qNo, amount, direction);
        if (shares <= 0) return false;

        const newQYes = direction === 'yes' ? qYes + shares : qYes;
        const newQNo = direction === 'no' ? qNo + shares : qNo;
        const newProb = AMM.yesPrice(newQYes, newQNo);
        const newLogit = AMM.logitFromProb(newProb);
        const newHistory = [...(market.history || []), newProb];

        try {
            await DB.createPrediction({
                user_id: this.session.user.id,
                market_id: marketId,
                direction,
                amount,
                shares,
                entry_prob: direction === 'yes' ? newProb : 1 - newProb,
                status: 'active',
            });

            await DB.updateMarket(marketId, {
                probability: newProb,
                logit: newLogit,
                q_yes: newQYes,
                q_no: newQNo,
                volume: market.volume + amount,
                traders: market.traders + 1,
                history: newHistory,
            });

            const newBalance = this.user.balance - amount;
            await DB.updateProfile(this.session.user.id, {
                balance: newBalance,
                trades: this.user.trades + 1,
            });

            // Update local state
            this.user.balance = newBalance;
            this.user.trades += 1;
            market.probability = newProb;
            market.logit = newLogit;
            market.q_yes = newQYes;
            market.q_no = newQNo;
            market.volume += amount;
            market.traders += 1;
            market.history = newHistory;
            this.selectedMarket = market;

            // Refresh user predictions
            this.userPredictions = await DB.getPredictions(this.session.user.id);
            if (this.selectedMarket?.id === marketId) {
                this.selectedMarketPredictions = await DB.getMarketPredictions(marketId);
            }

            this.notify();
            return { shares, newProb };
        } catch (e) {
            console.error('Prediction error:', e);
            return false;
        }
    },

    // ==================== SELL POSITION ====================

    async sellPosition(predictionId) {
        const pred = this.userPredictions.find(p => p.id === predictionId);
        if (!pred || pred.status !== 'active') return false;

        const market = this.markets.find(m => m.id === pred.market_id);
        if (!market || market.status !== 'active') return false;

        const qYes = market.q_yes || 0;
        const qNo = market.q_no || 0;

        // Calculate sell revenue
        const revenue = AMM.sellRevenue(qYes, qNo, pred.shares, pred.direction);
        if (revenue <= 0) return false;

        const newQYes = pred.direction === 'yes' ? qYes - pred.shares : qYes;
        const newQNo = pred.direction === 'no' ? qNo - pred.shares : qNo;
        const newProb = AMM.yesPrice(Math.max(0, newQYes), Math.max(0, newQNo));
        const newLogit = AMM.logitFromProb(newProb);
        const newHistory = [...(market.history || []), newProb];

        try {
            await DB.updatePrediction(pred.id, {
                status: 'sold',
                payout: revenue,
            });

            await DB.updateMarket(market.id, {
                probability: newProb,
                logit: newLogit,
                q_yes: Math.max(0, newQYes),
                q_no: Math.max(0, newQNo),
                volume: market.volume + Math.round(revenue),
                history: newHistory,
            });

            const newBalance = this.user.balance + Math.round(revenue);
            await DB.updateProfile(this.session.user.id, { balance: newBalance });

            this.user.balance = newBalance;
            market.probability = newProb;
            market.q_yes = Math.max(0, newQYes);
            market.q_no = Math.max(0, newQNo);
            market.history = newHistory;

            this.userPredictions = await DB.getPredictions(this.session.user.id);
            if (this.selectedMarket?.id === market.id) {
                this.selectedMarket = market;
                this.selectedMarketPredictions = await DB.getMarketPredictions(market.id);
            }

            this.notify();
            return Math.round(revenue);
        } catch (e) {
            console.error('Sell error:', e);
            return false;
        }
    },

    // ==================== MARKET RESOLUTION ====================

    async resolveMarket(marketId, resolution) {
        try {
            await DB.resolveMarket(marketId, resolution, this.session.user.id);

            // Refresh data
            const [markets, leaderboard, predictions] = await Promise.all([
                DB.getMarkets(),
                DB.getLeaderboard(),
                DB.getPredictions(this.session.user.id),
            ]);
            this.markets = markets;
            this.leaderboard = leaderboard;
            this.userPredictions = predictions;

            // Refresh profile for updated balance
            this.user = await Auth.getProfile(this.session.user.id);

            if (this.selectedMarket?.id === marketId) {
                this.selectedMarket = this.markets.find(m => m.id === marketId);
                this.selectedMarketPredictions = await DB.getMarketPredictions(marketId);
            }

            this.notify();
            return true;
        } catch (e) {
            console.error('Resolution error:', e);
            throw e;
        }
    },

    // ==================== MARKET CREATION ====================

    async addMarket(marketData) {
        try {
            const initLogit = 0; // starts at 50%
            const newMarket = await DB.createMarket({
                title: marketData.title,
                description: marketData.description,
                category: marketData.category,
                closes_at: marketData.closesAt,
                probability: 0.50,
                logit: initLogit,
                q_yes: 0,
                q_no: 0,
                volume: 0,
                traders: 0,
                created_by: this.session.user.id,
                created_by_name: `${this.user.name} (${this.user.department})`,
                status: 'active',
                trending: false,
                history: [0.50],
            });

            this.markets.unshift(newMarket);
            this.notify();
            return newMarket;
        } catch (e) {
            console.error('Create market error:', e);
            throw e;
        }
    },

    // ==================== COMMENTS ====================

    async addComment(marketId, text) {
        try {
            const comment = await DB.createComment({
                user_id: this.session.user.id,
                market_id: marketId,
                text,
            });
            this.selectedMarketComments.unshift(comment);
            this.notify();
            return comment;
        } catch (e) {
            console.error('Comment error:', e);
            throw e;
        }
    },

    // ==================== NOTIFICATIONS ====================

    async markNotificationRead(id) {
        await DB.markNotificationRead(id);
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.is_read) {
            notif.is_read = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
            this.notify();
        }
    },

    async markAllRead() {
        await DB.markAllNotificationsRead(this.session.user.id);
        this.notifications.forEach(n => n.is_read = true);
        this.unreadCount = 0;
        this.notify();
    },

    // ==================== ADMIN ====================

    async setMarketTrending(marketId, trending) {
        await DB.updateMarket(marketId, { trending });
        const market = this.markets.find(m => m.id === marketId);
        if (market) market.trending = trending;
        this.notify();
    },

    // ==================== FILTERING ====================

    getFilteredMarkets() {
        let filtered = [...this.markets];

        if (this.categoryFilter !== 'all') {
            filtered = filtered.filter(m => m.category === this.categoryFilter);
        }

        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                m.title.toLowerCase().includes(q) ||
                m.description.toLowerCase().includes(q)
            );
        }

        switch (this.sortBy) {
            case 'trending':
                filtered.sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0) || b.volume - a.volume);
                break;
            case 'newest':
                filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'volume':
                filtered.sort((a, b) => b.volume - a.volume);
                break;
            case 'closing':
                filtered.sort((a, b) => new Date(a.closes_at) - new Date(b.closes_at));
                break;
        }

        return filtered;
    },

    setFilter(category) { this.categoryFilter = category; this.notify(); },
    setSearch(query) { this.searchQuery = query; this.notify(); },
    setSort(sort) { this.sortBy = sort; this.notify(); },
};
