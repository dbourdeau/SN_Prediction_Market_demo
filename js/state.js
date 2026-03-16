// State management with Supabase persistence

const AppState = {
    currentPage: 'login',
    selectedMarket: null,
    selectedMarketComments: [],
    markets: [],
    user: null,        // profile from DB
    session: null,     // supabase auth session
    userPredictions: {},
    leaderboard: [],
    categoryFilter: 'all',
    searchQuery: '',
    sortBy: 'trending',
    loading: false,

    listeners: [],

    subscribe(fn) {
        this.listeners.push(fn);
    },

    notify() {
        this.listeners.forEach(fn => fn());
    },

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
            }
        } catch (e) {
            console.error('Init error:', e);
        }

        this.loading = false;
        this.notify();

        // Listen for auth changes
        Auth.onAuthChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.session = session;
                await this.loadUserData(session.user.id);
                this.currentPage = 'dashboard';
                this.notify();
            } else if (event === 'SIGNED_OUT') {
                this.session = null;
                this.user = null;
                this.markets = [];
                this.userPredictions = {};
                this.leaderboard = [];
                this.currentPage = 'login';
                this.notify();
            }
        });
    },

    async loadUserData(userId) {
        try {
            const [profile, markets, predictions, leaderboard] = await Promise.all([
                Auth.getProfile(userId),
                DB.getMarkets(),
                DB.getPredictions(userId),
                DB.getLeaderboard()
            ]);

            this.user = profile;
            this.markets = markets;
            this.leaderboard = leaderboard;

            // Build predictions map
            this.userPredictions = {};
            predictions.forEach(p => {
                this.userPredictions[p.market_id] = {
                    direction: p.direction,
                    amount: p.amount,
                    timestamp: p.created_at,
                    entryProb: p.entry_prob,
                };
            });
        } catch (e) {
            console.error('Load user data error:', e);
        }
    },

    async login(email, password) {
        this.loading = true;
        this.notify();
        try {
            await Auth.signIn(email, password);
            // Auth state change listener handles the rest
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
            // If email confirmation is disabled, user is auto-signed-in
            if (data.session) {
                // Auth state change listener handles the rest
            } else {
                this.loading = false;
                this.currentPage = 'login';
                this.notify();
                return 'confirm'; // needs email confirmation
            }
        } catch (e) {
            this.loading = false;
            this.notify();
            throw e;
        }
    },

    async logout() {
        await Auth.signOut();
        // Auth state change listener handles the rest
    },

    // ==================== NAVIGATION ====================

    async navigate(page, data) {
        this.currentPage = page;
        if (data && data.marketId) {
            try {
                const [market, comments] = await Promise.all([
                    DB.getMarket(data.marketId),
                    DB.getComments(data.marketId)
                ]);
                this.selectedMarket = market;
                this.selectedMarketComments = comments;
            } catch (e) {
                console.error('Failed to load market:', e);
            }
        }
        this.notify();
        window.scrollTo(0, 0);
    },

    // ==================== PREDICTIONS ====================

    async placePrediction(marketId, direction, amount) {
        const market = this.markets.find(m => m.id === marketId);
        if (!market || amount > this.user.balance) return false;

        // Calculate new probability
        const shift = (amount / 1000) * (direction === 'yes' ? 0.02 : -0.02);
        const newProb = Math.max(0.01, Math.min(0.99, market.probability + shift));
        const newHistory = [...(market.history || []), newProb];

        try {
            // Save prediction to DB
            await DB.createPrediction({
                user_id: this.session.user.id,
                market_id: marketId,
                direction,
                amount,
                entry_prob: newProb,
            });

            // Update market in DB
            await DB.updateMarket(marketId, {
                probability: newProb,
                volume: market.volume + amount,
                traders: market.traders + 1,
                history: newHistory,
            });

            // Update user balance
            const newBalance = this.user.balance - amount;
            await DB.updateProfile(this.session.user.id, {
                balance: newBalance,
                trades: this.user.trades + 1,
            });

            // Update local state
            this.user.balance = newBalance;
            this.user.trades += 1;
            market.probability = newProb;
            market.volume += amount;
            market.traders += 1;
            market.history = newHistory;
            this.selectedMarket = market;

            this.userPredictions[marketId] = {
                direction,
                amount,
                timestamp: new Date().toISOString(),
                entryProb: newProb,
            };

            this.notify();
            return true;
        } catch (e) {
            console.error('Prediction error:', e);
            return false;
        }
    },

    // ==================== MARKET CREATION ====================

    async addMarket(marketData) {
        try {
            const newMarket = await DB.createMarket({
                title: marketData.title,
                description: marketData.description,
                category: marketData.category,
                closes_at: marketData.closesAt,
                probability: 0.50,
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

    setFilter(category) {
        this.categoryFilter = category;
        this.notify();
    },

    setSearch(query) {
        this.searchQuery = query;
        this.notify();
    },

    setSort(sort) {
        this.sortBy = sort;
        this.notify();
    },

    // ==================== PROFILE ====================

    async updateDepartment(department) {
        try {
            await DB.updateProfile(this.session.user.id, { department });
            this.user.department = department;
            this.notify();
        } catch (e) {
            console.error('Update department error:', e);
            throw e;
        }
    },
};
