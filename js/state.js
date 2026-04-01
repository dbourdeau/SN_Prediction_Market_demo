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
    departmentFilter: 'all',
    statusFilter: 'active',
    searchQuery: '',
    sortBy: 'trending',
    loading: false,
    navigating: false,
    darkMode: localStorage.getItem('sn_darkMode') === 'true',

    // New state for Tier 1/2 features
    transactions: [],
    watchlist: [], // array of market IDs
    marketsPage: 0,
    marketsTotal: 0,
    marketsPageSize: 20,
    _lastTradeTime: 0, // rate limiting
    _commentsShown: 10, // comment pagination
    activityFeed: [], // global recent trades
    pendingMarkets: [], // markets awaiting admin approval
    auditLog: [], // admin audit trail
    leaderboardTab: 'individual', // 'individual' or 'departments'
    leaderboardSort: 'points', // 'points' or 'brier'
    hasSeenOnboarding: localStorage.getItem('sn_onboarded') === 'true',

    _marketsChannel: null,
    _notificationsChannel: null,
    _commentsChannel: null,
    _predictionsChannel: null,

    _renderLocked: false, // set true during long AI calls to prevent re-render wiping the panel
    _activeAITab: 'analysis', // persists across re-renders so research results survive realtime updates
    listeners: [],
    subscribe(fn) { this.listeners.push(fn); },
    notify() { if (!this._renderLocked) this.listeners.forEach(fn => fn()); },

    // ==================== AUTH ====================

    async init() {
        this._applyDarkMode();
        this._checkReferral(); // stash referral code from URL before auth
        this.loading = true;
        this.notify();
        try {
            const session = await Auth.getSession();
            if (session) {
                this.session = session;
                await this.loadUserData(session.user.id);
                // Check for deep link in URL hash
                const hashMatch = window.location.hash.match(/^#market=(\d+)$/);
                if (hashMatch) {
                    const marketId = parseInt(hashMatch[1]);
                    this.currentPage = 'market';
                    this.notify();
                    await this.navigate('market', { marketId });
                } else {
                    this.currentPage = 'dashboard';
                }
                this._setupRealtime();
                // Daily login bonus + referral claim
                this._claimDailyBonus();
                this._claimReferralIfPending();
                // Auto-close expired markets + notify closing soon
                DB.closeExpiredMarkets().then(() => this._refreshMarkets());
                DB.notifyClosingSoon();
                DB.getRecentActivity().then(a => { this.activityFeed = a || []; this.notify(); }).catch(() => {});
                if (this.user?.is_admin) DB.getPendingMarkets().then(p => { this.pendingMarkets = p || []; this.notify(); }).catch(() => {});
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
                    leaderboard: [], notifications: [], unreadCount: 0, currentPage: 'login',
                    transactions: [], watchlist: [],
                });
                this.notify();
            }
        });
    },

    async loadUserData(userId) {
        try {
            const [profile, markets, predictions, leaderboard, notifications, unreadCount, watchlist] = await Promise.all([
                Auth.getProfile(userId), DB.getMarkets(), DB.getPredictions(userId),
                DB.getLeaderboard(), DB.getNotifications(userId), DB.getUnreadCount(userId),
                DB.getWatchlist(userId).catch(() => []),
            ]);
            Object.assign(this, { user: profile, markets, userPredictions: predictions, leaderboard, notifications, unreadCount, watchlist });
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
        this.selectedMarketComments = [];
        this.selectedMarketPredictions = [];
        this._commentsShown = 10;
        if (!data?.profileId) { this.viewingProfile = null; this.viewingProfilePredictions = []; }
        if (!data?.marketId || data.marketId !== this.selectedMarket?.id) this._activeAITab = 'analysis';

        if (data?.marketId) {
            const mid = data.marketId;

            // Render immediately from cache so the page is instant
            const cached = this.markets.find(m => m.id === mid) || null;
            this.selectedMarket = cached;
            this.navigating = !cached; // only show skeleton if we have nothing cached
            this.notify();

            const withTimeout = (promise, ms = 8000) =>
                Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

            // Fetch fresh market data + secondary data in parallel, background
            try {
                const [market, comments, predictions] = await withTimeout(Promise.all([
                    DB.getMarket(mid).catch(e => { console.error('Failed to load market:', e); return cached; }),
                    DB.getComments(mid).catch(() => []),
                    DB.getMarketPredictions(mid).catch(() => []),
                ]));
                this.selectedMarket = market;
                this.selectedMarketComments = comments || [];
                this.selectedMarketPredictions = predictions || [];
            } catch (e) {
                console.error('Market load timed out:', e);
                this.selectedMarket = cached;
            }
            this.navigating = false;
            this.notify();

            // Subscribe to realtime (non-blocking, don't await)
            try {
                this._commentsChannel = DB.subscribeToComments(mid, async () => {
                    try { this.selectedMarketComments = await DB.getComments(mid); this.notify(); } catch (e) {}
                });
                this._predictionsChannel = DB.subscribeToPredictions(mid, async () => {
                    try {
                        const [preds, updatedMarket] = await Promise.all([
                            DB.getMarketPredictions(mid), DB.getMarket(mid)
                        ]);
                        this.selectedMarketPredictions = preds;
                        this.selectedMarket = updatedMarket;
                        const idx = this.markets.findIndex(m => m.id === mid);
                        if (idx >= 0) this.markets[idx] = updatedMarket;
                        this.notify();
                    } catch (e) {}
                });
            } catch (e) { console.error('Realtime subscription failed:', e); }
        }

        if (data?.profileId) {
            const withTimeout = (promise, ms = 8000) =>
                Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
            try {
                const [profile, predictions] = await withTimeout(Promise.all([
                    DB.getProfileByID(data.profileId).catch(() => null),
                    DB.getPredictions(data.profileId).catch(() => []),
                ]));
                this.viewingProfile = profile;
                this.viewingProfilePredictions = predictions || [];
            } catch (e) { console.error('Failed to load profile:', e); }
        }

        if (page === 'leaderboard') {
            try { this.leaderboard = await DB.getLeaderboard(); } catch (e) {}
        }

        if (page === 'admin' && this.user?.is_admin) {
            try {
                const [users, pending, audit] = await Promise.all([
                    DB.getAllProfiles(), DB.getPendingMarkets().catch(() => []), DB.getAuditLog().catch(() => [])
                ]);
                this.allUsers = users;
                this.pendingMarkets = pending;
                this.auditLog = audit;
            } catch (e) {}
        }

        if (page === 'transactions') {
            try { this.transactions = await DB.getTransactions(this.session.user.id); } catch (e) { this.transactions = []; }
        }

        if (page === 'briefing') {
            try {
                const cached = await DB.getBriefingCache();
                this.briefingCache = cached?.cache || null;
                this.briefingCachedAt = cached?.cached_at || null;
            } catch (e) { this.briefingCache = null; this.briefingCachedAt = null; }

            // Auto-regenerate on Monday if admin and briefing is stale (>6 days) or missing
            if (this.user?.is_admin) {
                const isMonday = new Date().getDay() === 1;
                const isStale = !this.briefingCachedAt ||
                    (Date.now() - new Date(this.briefingCachedAt).getTime()) > 6 * 24 * 60 * 60 * 1000;
                if (isMonday && isStale) {
                    setTimeout(() => handleGenerateBriefing(), 500);
                }
            }
        }

        this.navigating = false;
        this.notify();
        window.scrollTo(0, 0);
    },

    // ==================== RATE LIMITING ====================

    _checkRateLimit() {
        const now = Date.now();
        if (now - this._lastTradeTime < 2000) {
            return false; // 2 second cooldown
        }
        this._lastTradeTime = now;
        return true;
    },

    // ==================== PREDICTIONS (AMM) ====================

    async placePrediction(marketId, direction, amount, optionIndex = null, onOptimistic = null) {
        if (!this._checkRateLimit()) return { error: 'Please wait a moment between trades' };

        const market = this.markets.find(m => m.id === marketId);
        if (!market) return { error: 'Market not found' };
        if (market.status !== 'active' || market.resolution) return { error: 'Market is no longer active' };
        if (amount > this.user.balance) return { error: 'Insufficient SharkBuck balance' };
        if (amount < 10) return { error: 'Minimum trade is 10 SharkBucks' };

        const isMulti = market.market_type === 'multi';
        let shares, marketUpdates, predDirection, entryProb, priceImpact;

        if (isMulti) {
            const qValues = [...(market.q_values || [])];
            shares = AMM.sharesForBudgetMulti(qValues, amount, optionIndex);
            if (shares <= 0) return { error: 'Trade too small' };

            const newQ = [...qValues];
            newQ[optionIndex] += shares;
            const newProbs = AMM.multiProbabilities(newQ);
            const newHistory = [...(market.history || []), { t: new Date().toISOString(), p: newProbs }];
            priceImpact = Math.abs(newProbs[optionIndex] - (market.probabilities?.[optionIndex] || 0));
            predDirection = market.options[optionIndex].label;
            entryProb = newProbs[optionIndex];

            marketUpdates = {
                q_values: newQ, probabilities: newProbs,
                probability: Math.max(...newProbs), // store max prob for card display
                volume: market.volume + amount, traders: market.traders + 1, history: newHistory,
            };
        } else {
            const qYes = market.q_yes || 0, qNo = market.q_no || 0;
            shares = AMM.sharesForBudget(qYes, qNo, amount, direction);
            if (shares <= 0) return { error: 'Trade too small' };

            const newQYes = direction === 'yes' ? qYes + shares : qYes;
            const newQNo = direction === 'no' ? qNo + shares : qNo;
            const newProb = AMM.yesPrice(newQYes, newQNo);
            const newLogit = AMM.logitFromProb(newProb);
            const newHistory = [...(market.history || []), { t: new Date().toISOString(), p: newProb }];
            priceImpact = Math.abs(newProb - market.probability);
            predDirection = direction;
            entryProb = direction === 'yes' ? newProb : 1 - newProb;

            marketUpdates = {
                probability: newProb, logit: newLogit, q_yes: newQYes, q_no: newQNo,
                volume: market.volume + amount, traders: market.traders + 1, history: newHistory,
            };
        }

        // Snapshot previous state for rollback
        const prevBalance = this.user.balance;
        const prevTrades = this.user.trades;
        const prevMarket = { ...market };

        // Apply optimistic state update immediately — before the network call
        this.user.balance -= amount;
        this.user.trades += 1;
        market.version = (market.version || 0) + 1;
        Object.assign(market, marketUpdates);
        if (this.selectedMarket?.id === marketId) this.selectedMarket = market;
        if (onOptimistic) onOptimistic(); // patch DOM surgically, no full re-render

        try {
            // Use server-side RPC to atomically place prediction + update market + deduct balance
            const rpcParams = {
                p_user_id: this.session.user.id,
                p_market_id: marketId,
                p_direction: predDirection,
                p_amount: amount,
                p_shares: shares,
                p_entry_prob: entryProb,
                p_option_index: isMulti ? optionIndex : null,
                p_new_probability: marketUpdates.probability,
                p_new_logit: marketUpdates.logit ?? null,
                p_new_q_yes: marketUpdates.q_yes ?? null,
                p_new_q_no: marketUpdates.q_no ?? null,
                p_new_q_values: isMulti ? marketUpdates.q_values : null,
                p_new_probabilities: isMulti ? marketUpdates.probabilities : null,
                p_new_history: marketUpdates.history,
                p_expected_version: prevMarket.version ?? null,
            };

            await DB.placePrediction(rpcParams);

            // Refresh predictions in background — don't block the return
            Promise.all([
                DB.getPredictions(this.session.user.id).then(p => { this.userPredictions = p; }),
                this.selectedMarket?.id === marketId
                    ? DB.getMarketPredictions(marketId).then(p => { this.selectedMarketPredictions = p; })
                    : Promise.resolve(),
            ]).then(() => this.notify()).catch(e => console.error('Failed to refresh predictions:', e));

            return { shares, priceImpact };
        } catch (e) {
            // Rollback optimistic state
            this.user.balance = prevBalance;
            this.user.trades = prevTrades;
            Object.assign(market, prevMarket);
            if (this.selectedMarket?.id === marketId) this.selectedMarket = market;
            if (onOptimistic) onOptimistic(); // restore DOM to pre-trade state

            console.error('Prediction error:', e);
            if (e.message?.includes('balance')) return { error: 'Insufficient balance' };
            if (e.message?.includes('updated by another trade')) {
                await this._refreshMarkets();
                return { error: 'Price changed — please review and try again' };
            }
            return { error: e.message || 'Trade failed' };
        }
    },

    // ==================== SELL POSITION ====================

    async sellPosition(predictionId) {
        if (!this._checkRateLimit()) return { error: 'Please wait a moment between trades' };

        const pred = this.userPredictions.find(p => p.id === predictionId);
        if (!pred || pred.status !== 'active') return { error: 'Position not found or already closed' };

        const market = this.markets.find(m => m.id === pred.market_id);
        if (!market || market.status !== 'active' || market.resolution) return { error: 'Market is no longer active' };

        const isMulti = market.market_type === 'multi';
        let revenue, marketUpdates;

        if (isMulti) {
            const qValues = [...(market.q_values || [])];
            const optIdx = pred.option_index;
            revenue = AMM.sellRevenueMulti(qValues, pred.shares, optIdx);
            if (revenue <= 0) return { error: 'Position has no sell value' };

            const newQ = [...qValues];
            newQ[optIdx] -= pred.shares;
            const newProbs = AMM.multiProbabilities(newQ);
            const newHistory = [...(market.history || []), { t: new Date().toISOString(), p: newProbs }];

            marketUpdates = {
                q_values: newQ, probabilities: newProbs,
                probability: Math.max(...newProbs),
                volume: market.volume + Math.round(revenue), history: newHistory,
            };
        } else {
            const qYes = market.q_yes || 0, qNo = market.q_no || 0;
            revenue = AMM.sellRevenue(qYes, qNo, pred.shares, pred.direction);
            if (revenue <= 0) return { error: 'Position has no sell value' };

            const newQYes = pred.direction === 'yes' ? Math.max(0, qYes - pred.shares) : qYes;
            const newQNo = pred.direction === 'no' ? Math.max(0, qNo - pred.shares) : qNo;
            const newProb = AMM.yesPrice(newQYes, newQNo);
            const newHistory = [...(market.history || []), { t: new Date().toISOString(), p: newProb }];

            marketUpdates = {
                probability: newProb, logit: AMM.logitFromProb(newProb),
                q_yes: newQYes, q_no: newQNo,
                volume: market.volume + Math.round(revenue), history: newHistory,
            };
        }

        const roundedRevenue = Math.round(revenue);

        // Snapshot previous state for rollback
        const prevBalance = this.user.balance;
        const prevMarket = { ...market };
        const prevPred = { ...pred };

        // Apply optimistic update immediately
        this.user.balance += roundedRevenue;
        market.version = (market.version || 0) + 1;
        Object.assign(market, marketUpdates);
        pred.status = 'sold';
        if (this.selectedMarket?.id === market.id) this.selectedMarket = market;
        _patchMarketDOM(market, this.user.balance);

        try {
            // Use server-side RPC to atomically sell position + update market + credit balance
            const rpcParams = {
                p_user_id: this.session.user.id,
                p_prediction_id: pred.id,
                p_revenue: roundedRevenue,
                p_new_probability: marketUpdates.probability,
                p_new_logit: marketUpdates.logit ?? null,
                p_new_q_yes: marketUpdates.q_yes ?? null,
                p_new_q_no: marketUpdates.q_no ?? null,
                p_new_q_values: isMulti ? marketUpdates.q_values : null,
                p_new_probabilities: isMulti ? marketUpdates.probabilities : null,
                p_new_history: marketUpdates.history,
                p_expected_version: prevMarket.version ?? null,
            };

            await DB.sellPositionRPC(rpcParams);

            // Refresh predictions in background — don't block the return
            Promise.all([
                DB.getPredictions(this.session.user.id).then(p => { this.userPredictions = p; }),
                this.selectedMarket?.id === market.id
                    ? DB.getMarketPredictions(market.id).then(p => { this.selectedMarketPredictions = p; })
                    : Promise.resolve(),
            ]).then(() => this.notify()).catch(e => console.error('Failed to refresh predictions:', e));

            return { revenue: roundedRevenue, profit: roundedRevenue - prevPred.amount };
        } catch (e) {
            // Rollback optimistic state
            this.user.balance = prevBalance;
            Object.assign(market, prevMarket);
            Object.assign(pred, prevPred);
            if (this.selectedMarket?.id === market.id) this.selectedMarket = market;
            _patchMarketDOM(market, this.user.balance);

            console.error('Sell error:', e.message || e);
            if (e.message?.includes('updated by another trade')) {
                await this._refreshMarkets();
                return { error: 'Price changed — please review and try again' };
            }
            return { error: e.message || 'Sell failed' };
        }
    },

    // ==================== MARKET RESOLUTION ====================

    async resolveMarket(marketId, resolution, winningIndex = null) {
        try {
            const market = this.markets.find(m => m.id === marketId);
            if (market?.market_type === 'multi') {
                await DB.resolveMultiMarket(marketId, winningIndex ?? -1, this.session.user.id);
            } else {
                await DB.resolveMarket(marketId, resolution, this.session.user.id);
            }
            DB.logAuditEvent(this.session.user.id, 'resolve_market', 'market', marketId, { resolution, winningIndex, title: market?.title });
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
        const isAdmin = this.user?.is_admin;
        const isMulti = marketData.market_type === 'multi' && marketData.options?.length >= 2;
        const baseFields = {
            title: marketData.title.slice(0, 200),
            description: marketData.description.slice(0, 5000),
            category: marketData.category, closes_at: marketData.closesAt,
            volume: 0, traders: 0,
            created_by: this.session.user.id,
            created_by_name: `${this.user.name} (${this.user.department})`,
            status: isAdmin ? 'active' : 'pending',
            approved_by: isAdmin ? this.session.user.id : null,
            approved_at: isAdmin ? new Date().toISOString() : null,
            trending: false,
            source_url: marketData.source_url || null,
        };

        if (isMulti) {
            const n = marketData.options.length;
            const options = marketData.options.map((label, i) => ({ id: i, label }));
            const qValues = new Array(n).fill(0);
            const probs = new Array(n).fill(1 / n);
            Object.assign(baseFields, {
                market_type: 'multi', options, q_values: qValues, probabilities: probs,
                probability: 1 / n, logit: 0, q_yes: 0, q_no: 0, history: [{ t: new Date().toISOString(), p: probs }],
            });
        } else {
            Object.assign(baseFields, {
                market_type: 'binary', probability: 0.50, logit: 0,
                q_yes: 0, q_no: 0, history: [{ t: new Date().toISOString(), p: 0.50 }],
            });
        }

        try {
            const newMarket = await DB.createMarket(baseFields);
            if (isAdmin) this.markets.unshift(newMarket);
            this.notify();
            return newMarket;
        } catch (e) { console.error('Create market error:', e); throw e; }
    },

    async approveMarket(marketId) {
        await DB.approveMarket(marketId, this.session.user.id);
        DB.logAuditEvent(this.session.user.id, 'approve_market', 'market', marketId, {});
        this.pendingMarkets = (this.pendingMarkets || []).filter(m => m.id !== marketId);
        await this._refreshMarkets();
    },

    async rejectMarket(marketId, reason) {
        await DB.rejectMarket(marketId, this.session.user.id, reason);
        DB.logAuditEvent(this.session.user.id, 'reject_market', 'market', marketId, { reason });
        this.pendingMarkets = (this.pendingMarkets || []).filter(m => m.id !== marketId);
        this.notify();
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
        if (!this._checkRateLimit()) throw new Error('Please wait a moment between comments');
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

    // ==================== WATCHLIST ====================

    async toggleWatchlist(marketId) {
        const idx = this.watchlist.indexOf(marketId);
        if (idx >= 0) {
            await DB.removeFromWatchlist(this.session.user.id, marketId);
            this.watchlist.splice(idx, 1);
        } else {
            await DB.addToWatchlist(this.session.user.id, marketId);
            this.watchlist.push(marketId);
        }
        this.notify();
    },

    isWatching(marketId) {
        return this.watchlist.includes(marketId);
    },

    // ==================== TRANSACTIONS ====================

    async loadTransactions() {
        try {
            this.transactions = await DB.getTransactions(this.session.user.id);
            this.notify();
        } catch (e) { this.transactions = []; }
    },

    // ==================== PORTFOLIO P&L ====================

    getPortfolioSummary() {
        const active = this.userPredictions.filter(p => p.status === 'active');
        const resolved = this.userPredictions.filter(p => ['won', 'lost', 'sold', 'voided'].includes(p.status));

        let totalInvested = 0, unrealizedValue = 0;
        active.forEach(p => {
            totalInvested += p.amount;
            const market = this.markets.find(m => m.id === p.market_id);
            if (market) {
                let currentValue;
                if (market.market_type === 'multi') {
                    currentValue = AMM.sellRevenueMulti(market.q_values || [], p.shares, p.option_index);
                } else {
                    currentValue = AMM.sellRevenue(market.q_yes || 0, market.q_no || 0, p.shares, p.direction);
                }
                unrealizedValue += Math.round(currentValue);
            }
        });

        let realizedPnL = 0;
        resolved.forEach(p => {
            realizedPnL += (p.payout || 0) - p.amount;
        });

        return {
            activePositions: active.length,
            totalInvested,
            unrealizedValue,
            unrealizedPnL: unrealizedValue - totalInvested,
            realizedPnL,
            totalPnL: (unrealizedValue - totalInvested) + realizedPnL,
        };
    },

    // ==================== ACHIEVEMENTS ====================

    getAchievements(preds, profile, rank) {
        const won = preds.filter(p => p.status === 'won').length;
        const lost = preds.filter(p => p.status === 'lost').length;
        const sold = preds.filter(p => p.status === 'sold').length;
        const total = preds.length;
        const active = preds.filter(p => p.status === 'active').length;

        const all = [
            { id: 'first_trade',    icon: '🎯', name: 'First Trade',      desc: 'Place your first prediction',              earned: total >= 1 },
            { id: 'ten_trades',     icon: '📈', name: 'Active Trader',    desc: 'Make 10 predictions',                       earned: total >= 10 },
            { id: 'fifty_trades',   icon: '🔥', name: 'Power Trader',    desc: 'Make 50 predictions',                       earned: total >= 50 },
            { id: 'first_win',      icon: '🏆', name: 'First Win',       desc: 'Win your first prediction',                 earned: won >= 1 },
            { id: 'ten_wins',       icon: '⭐', name: 'Winning Streak',  desc: 'Win 10 predictions',                        earned: won >= 10 },
            { id: 'sharp_shooter',  icon: '🎯', name: 'Sharpshooter',    desc: 'Maintain 70%+ accuracy (10+ trades)',        earned: (profile.accuracy || 0) >= 0.7 && (profile.trades || 0) >= 10 },
            { id: 'diversified',    icon: '🌐', name: 'Diversified',     desc: 'Hold 5+ active positions',                  earned: active >= 5 },
            { id: 'profit_taker',   icon: '💰', name: 'Profit Taker',    desc: 'Sell a position for profit',                 earned: sold >= 1 },
            { id: 'top3',           icon: '🥇', name: 'Top Forecaster',  desc: 'Reach top 3 on the leaderboard',            earned: rank > 0 && rank <= 3 },
            { id: 'points_100',     icon: '💎', name: 'Century Club',    desc: 'Earn 100+ points',                           earned: (profile.points || 0) >= 100 },
            { id: 'points_500',     icon: '👑', name: 'Elite Forecaster', desc: 'Earn 500+ points',                          earned: (profile.points || 0) >= 500 },
            { id: 'resilient',      icon: '💪', name: 'Resilient',       desc: 'Win after 3+ losses',                        earned: won >= 1 && lost >= 3 },
        ];
        return all;
    },

    // ==================== CALIBRATION ====================

    getCalibrationData(preds) {
        // Group resolved predictions by confidence bucket
        const resolved = preds.filter(p => p.status === 'won' || p.status === 'lost');
        if (resolved.length < 3) return null;

        const buckets = [
            { label: '0-20%', min: 0, max: 0.2, count: 0, correct: 0 },
            { label: '20-40%', min: 0.2, max: 0.4, count: 0, correct: 0 },
            { label: '40-60%', min: 0.4, max: 0.6, count: 0, correct: 0 },
            { label: '60-80%', min: 0.6, max: 0.8, count: 0, correct: 0 },
            { label: '80-100%', min: 0.8, max: 1.01, count: 0, correct: 0 },
        ];

        resolved.forEach(p => {
            const conf = p.entry_prob || 0.5;
            const bucket = buckets.find(b => conf >= b.min && conf < b.max);
            if (bucket) {
                bucket.count++;
                if (p.status === 'won') bucket.correct++;
            }
        });

        return buckets.map(b => ({
            label: b.label,
            predicted: (b.min + b.max) / 2,
            actual: b.count > 0 ? b.correct / b.count : 0,
            count: b.count,
        }));
    },

    // ==================== PLATFORM ANALYTICS ====================

    getPlatformAnalytics() {
        const markets = this.markets;
        const active = markets.filter(m => m.status === 'active' && !m.resolution);
        const resolved = markets.filter(m => !!m.resolution);
        const totalVolume = markets.reduce((s, m) => s + (m.volume || 0), 0);
        const totalTraders = new Set(this.leaderboard.map(u => u.id)).size;

        // Volume by category
        const volByCategory = {};
        markets.forEach(m => {
            volByCategory[m.category] = (volByCategory[m.category] || 0) + (m.volume || 0);
        });

        // Participation rate (markets with >0 traders / total)
        const participationRate = markets.length > 0
            ? markets.filter(m => m.traders > 0).length / markets.length : 0;

        // Platform calibration (across all resolved markets)
        const resolvedWithProb = resolved.filter(m => m.resolution === 'yes' || m.resolution === 'no');
        const calBuckets = [
            { label: '0-20%', min: 0, max: 0.2, count: 0, yesResolved: 0 },
            { label: '20-40%', min: 0.2, max: 0.4, count: 0, yesResolved: 0 },
            { label: '40-60%', min: 0.4, max: 0.6, count: 0, yesResolved: 0 },
            { label: '60-80%', min: 0.6, max: 0.8, count: 0, yesResolved: 0 },
            { label: '80-100%', min: 0.8, max: 1.01, count: 0, yesResolved: 0 },
        ];
        resolvedWithProb.forEach(m => {
            // Use last probability before resolution from history, or stored probability
            const rawEntry = m.history?.length > 1 ? m.history[m.history.length - 2] : null;
            const finalProb = rawEntry ? (rawEntry && typeof rawEntry === 'object' && rawEntry.p !== undefined ? rawEntry.p : rawEntry) : m.probability;
            const bucket = calBuckets.find(b => finalProb >= b.min && finalProb < b.max);
            if (bucket) {
                bucket.count++;
                if (m.resolution === 'yes') bucket.yesResolved++;
            }
        });

        // Inactive users (no trades)
        const allUsers = this.allUsers || [];
        const inactiveUsers = allUsers.filter(u =>
            !u.is_admin && (u.trades || 0) === 0
        );

        // Low-activity markets (active but 0 traders after 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const flaggedMarkets = active.filter(m =>
            m.traders === 0 && m.created_at < sevenDaysAgo
        );

        return {
            totalMarkets: markets.length, activeMarkets: active.length,
            resolvedMarkets: resolved.length, totalVolume, totalTraders,
            participationRate, volByCategory,
            calibration: calBuckets.map(b => ({
                label: b.label,
                predicted: (b.min + b.max) / 2,
                actual: b.count > 0 ? b.yesResolved / b.count : 0,
                count: b.count,
            })),
            inactiveUsers, flaggedMarkets,
        };
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
        DB.logAuditEvent(this.session.user.id, isAdmin ? 'grant_admin' : 'revoke_admin', 'user', userId, {});
        const user = this.allUsers.find(u => u.id === userId);
        if (user) user.is_admin = isAdmin;
        this.notify();
    },

    async adjustUserBalance(userId, amount) {
        const user = this.allUsers.find(u => u.id === userId);
        if (!user) return;
        const newBalance = Math.max(0, user.balance + amount);
        await DB.updateProfile(userId, { balance: newBalance });

        DB.logTransaction({
            user_id: userId, type: 'admin_adjust', amount: amount,
            balance_after: newBalance,
            description: `Admin adjustment: ${amount > 0 ? '+' : ''}${amount} SharkBucks`,
        });
        DB.logAuditEvent(this.session.user.id, 'adjust_balance', 'user', userId, { amount, newBalance, userName: user.name });

        user.balance = newBalance;
        if (userId === this.user.id) this.user.balance = newBalance;
        this.notify();
    },

    // ==================== BALANCE RECONCILIATION ====================

    async runBalanceReconciliation() {
        try {
            const [users, txns] = await Promise.all([
                DB.getAllProfiles(),
                DB.getAllTransactions(),
            ]);

            // Sum transactions per user (signup bonus = 1000 starting balance is implicit)
            const txnSums = {};
            txns.forEach(t => {
                txnSums[t.user_id] = (txnSums[t.user_id] || 0) + (t.amount || 0);
            });

            // Starting balance is 1000 for all users
            const discrepancies = [];
            users.forEach(u => {
                const expectedBalance = 1000 + (txnSums[u.id] || 0);
                const actualBalance = u.balance || 0;
                const diff = actualBalance - expectedBalance;
                if (Math.abs(diff) > 1) { // tolerance of 1 SharkBuck for rounding
                    discrepancies.push({
                        userId: u.id,
                        name: u.name,
                        department: u.department,
                        actual: actualBalance,
                        expected: expectedBalance,
                        diff,
                    });
                }
            });

            return {
                totalUsers: users.length,
                totalTransactions: txns.length,
                discrepancies: discrepancies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
            };
        } catch (e) {
            console.error('Reconciliation error:', e);
            return { totalUsers: 0, totalTransactions: 0, discrepancies: [], error: e.message };
        }
    },

    // ==================== QUARTERLY PRIZE POOL ====================

    getQuarterDates(quarterOffset = 0) {
        const now = new Date();
        let year = now.getFullYear();
        let quarter = Math.floor(now.getMonth() / 3); // 0-indexed: 0=Q1, 1=Q2, 2=Q3, 3=Q4
        quarter += quarterOffset;
        while (quarter < 0) { quarter += 4; year--; }
        while (quarter > 3) { quarter -= 4; year++; }
        const startMonth = quarter * 3;
        const start = new Date(year, startMonth, 1).toISOString();
        const end = new Date(year, startMonth + 3, 0, 23, 59, 59).toISOString();
        const label = `Q${quarter + 1} ${year}`;
        return { start, end, label, quarter: quarter + 1, year };
    },

    async computeQuarterlyAwards(quarterOffset = 0) {
        const { start, end, label } = this.getQuarterDates(quarterOffset);
        const [preds, allPreds, markets] = await Promise.all([
            DB.getResolvedPredictions(start, end),
            DB.getAllPredictionsInRange(start, end),
            DB.getMarketsCreatedInRange(start, end),
        ]);
        const profiles = this.allUsers?.length ? this.allUsers : this.leaderboard;

        if (!preds.length && !allPreds.length) return { quarter: label, awards: [], milestones: [], streaks: [], raffleEligible: [], bestMarket: null, stats: { totalPredictions: 0, participants: 0 } };

        // Aggregate resolved predictions per user
        const byUser = {};
        preds.forEach(p => {
            if (!byUser[p.user_id]) byUser[p.user_id] = { wins: 0, losses: 0, totalInvested: 0, totalPayout: 0, points: 0, preds: [] };
            const u = byUser[p.user_id];
            u.preds.push(p);
            u.totalInvested += p.amount;
            u.totalPayout += (p.payout || 0);
            if (p.status === 'won') {
                u.wins++;
                u.points += Math.max(10, Math.round((p.payout || 0) - p.amount));
            } else {
                u.losses++;
            }
        });

        const userList = Object.entries(byUser).map(([userId, data]) => {
            const profile = profiles.find(p => p.id === userId) || {};
            const total = data.wins + data.losses;
            return {
                userId,
                name: profile.name || 'Unknown',
                department: profile.department || 'Unknown',
                avatar: profile.avatar || '??',
                wins: data.wins,
                losses: data.losses,
                total,
                accuracy: total > 0 ? data.wins / total : 0,
                points: data.points,
                invested: data.totalInvested,
                payout: data.totalPayout,
                profit: data.totalPayout - data.totalInvested,
                roi: data.totalInvested > 0 ? (data.totalPayout - data.totalInvested) / data.totalInvested : 0,
            };
        });

        // Count all predictions per user (including active/sold, for milestones)
        const allPredsByUser = {};
        allPreds.forEach(p => {
            if (!allPredsByUser[p.user_id]) allPredsByUser[p.user_id] = [];
            allPredsByUser[p.user_id].push(p);
        });

        // --- AWARDS (top prizes) ---
        const awards = [];

        // 1. Top Forecaster
        const topForecaster = [...userList].sort((a, b) => b.points - a.points)[0];
        if (topForecaster) {
            awards.push({
                title: 'Top Forecaster',
                emoji: '🏆',
                description: 'Most points earned this quarter',
                prize: '$150-200 gift card',
                winner: topForecaster,
                metric: `${topForecaster.points} pts`,
            });
        }

        // 2. Sharpest Mind
        const accuracyCandidates = userList.filter(u => u.total >= 10);
        const sharpest = [...accuracyCandidates].sort((a, b) => b.accuracy - a.accuracy || b.total - a.total)[0];
        if (sharpest) {
            awards.push({
                title: 'Sharpest Mind',
                emoji: '🎯',
                description: 'Best accuracy (min 10 predictions)',
                prize: '$100-150 gift card',
                winner: sharpest,
                metric: `${Math.round(sharpest.accuracy * 100)}% (${sharpest.wins}/${sharpest.total})`,
            });
        }

        // 3. Best ROI
        const roiCandidates = userList.filter(u => u.total >= 5 && u.invested > 0);
        const bestROI = [...roiCandidates].sort((a, b) => b.roi - a.roi || b.profit - a.profit)[0];
        if (bestROI) {
            awards.push({
                title: 'Best ROI',
                emoji: '📈',
                description: 'Highest return on investment (min 5 trades)',
                prize: '$75-100 gift card',
                winner: bestROI,
                metric: `${bestROI.roi >= 0 ? '+' : ''}${Math.round(bestROI.roi * 100)}% (${bestROI.profit >= 0 ? '+' : ''}${Math.round(bestROI.profit)}t)`,
            });
        }

        // 4. Volume King
        const volumeKing = [...userList].sort((a, b) => b.total - a.total || b.points - a.points)[0];
        if (volumeKing && volumeKing.total >= 3) {
            awards.push({
                title: 'Volume King',
                emoji: '⚡',
                description: 'Most predictions resolved this quarter',
                prize: '$50 gift card',
                winner: volumeKing,
                metric: `${volumeKing.total} predictions`,
            });
        }

        // 5. Department Champion
        const byDept = {};
        userList.forEach(u => {
            if (!byDept[u.department]) byDept[u.department] = { department: u.department, members: [], totalPoints: 0 };
            byDept[u.department].members.push(u);
            byDept[u.department].totalPoints += u.points;
        });
        const deptCandidates = Object.values(byDept).filter(d => d.members.length >= 3);
        const topDept = [...deptCandidates].sort((a, b) => (b.totalPoints / b.members.length) - (a.totalPoints / a.members.length))[0];
        if (topDept) {
            const avgPts = Math.round(topDept.totalPoints / topDept.members.length);
            const star = [...topDept.members].sort((a, b) => b.points - a.points)[0];
            awards.push({
                title: 'Department Champion',
                emoji: '🏅',
                description: 'Best avg points per member (min 3)',
                prize: 'Team lunch ($100-150)',
                winner: { name: topDept.department, department: `${topDept.members.length} members`, avatar: '🏢' },
                metric: `${avgPts} avg pts · Star: ${star.name}`,
            });
        }

        // 6. Best Market Creator: market with most engagement (traders * volume)
        let bestMarket = null;
        if (markets.length > 0) {
            const sorted = [...markets].sort((a, b) => (b.traders || 0) * (b.volume || 0) - (a.traders || 0) * (a.volume || 0));
            const top = sorted[0];
            if (top && (top.traders || 0) >= 2) {
                const creator = profiles.find(p => p.id === top.created_by) || {};
                bestMarket = {
                    title: top.title,
                    traders: top.traders || 0,
                    volume: top.volume || 0,
                    creatorName: top.created_by_name || creator.name || 'Unknown',
                    creatorAvatar: creator.avatar || '??',
                    creatorDept: creator.department || 'Unknown',
                    creatorId: top.created_by,
                };
                awards.push({
                    title: 'Best Question',
                    emoji: '💡',
                    description: 'Most engaging market created this quarter',
                    prize: '$50 gift card',
                    winner: { name: bestMarket.creatorName, department: bestMarket.creatorDept, avatar: bestMarket.creatorAvatar },
                    metric: `"${top.title.length > 40 ? top.title.slice(0, 40) + '…' : top.title}" · ${bestMarket.traders} traders`,
                });
            }
        }

        // --- MILESTONES (participation rewards) ---
        const milestones = [];
        const milestoneTiers = [
            { threshold: 50, label: '50 Predictions', emoji: '💎', prize: '$15 coffee card' },
            { threshold: 25, label: '25 Predictions', emoji: '🥈', prize: '$15 coffee card' },
            { threshold: 10, label: '10 Predictions', emoji: '🥉', prize: '$10 coffee card' },
        ];
        Object.entries(allPredsByUser).forEach(([userId, userPreds]) => {
            const count = userPreds.length;
            const profile = profiles.find(p => p.id === userId) || {};
            // Award highest milestone only
            for (const tier of milestoneTiers) {
                if (count >= tier.threshold) {
                    milestones.push({
                        userId,
                        name: profile.name || 'Unknown',
                        avatar: profile.avatar || '??',
                        department: profile.department || 'Unknown',
                        count,
                        ...tier,
                    });
                    break;
                }
            }
        });
        milestones.sort((a, b) => b.count - a.count);

        // --- STREAKS (traded every week of the quarter) ---
        const streaks = [];
        const qStart = new Date(start);
        const qEnd = new Date(end);
        // Count weeks in this quarter
        const totalWeeks = Math.ceil((qEnd - qStart) / (7 * 24 * 60 * 60 * 1000));
        Object.entries(allPredsByUser).forEach(([userId, userPreds]) => {
            const weeks = new Set();
            userPreds.forEach(p => {
                const d = new Date(p.created_at);
                // Week number relative to quarter start
                const weekNum = Math.floor((d - qStart) / (7 * 24 * 60 * 60 * 1000));
                weeks.add(weekNum);
            });
            const weeksActive = weeks.size;
            // Streak = traded in every week of the quarter (or every week so far if current quarter)
            const now = new Date();
            const weeksElapsed = now < qEnd
                ? Math.max(1, Math.floor((now - qStart) / (7 * 24 * 60 * 60 * 1000)))
                : totalWeeks;
            if (weeksActive >= weeksElapsed && weeksElapsed >= 4) {
                const profile = profiles.find(p => p.id === userId) || {};
                streaks.push({
                    userId,
                    name: profile.name || 'Unknown',
                    avatar: profile.avatar || '??',
                    department: profile.department || 'Unknown',
                    weeksActive,
                    weeksTotal: weeksElapsed,
                });
            }
        });
        streaks.sort((a, b) => b.weeksActive - a.weeksActive);

        // --- RAFFLE ELIGIBLE (5+ predictions in quarter) ---
        const raffleEligible = [];
        Object.entries(allPredsByUser).forEach(([userId, userPreds]) => {
            if (userPreds.length >= 5) {
                const profile = profiles.find(p => p.id === userId) || {};
                raffleEligible.push({
                    userId,
                    name: profile.name || 'Unknown',
                    avatar: profile.avatar || '??',
                    department: profile.department || 'Unknown',
                    count: userPreds.length,
                });
            }
        });
        raffleEligible.sort((a, b) => b.count - a.count);

        const participants = new Set([...Object.keys(byUser), ...Object.keys(allPredsByUser)]).size;
        return {
            quarter: label,
            dateRange: { start, end },
            awards,
            milestones,
            streaks,
            raffleEligible,
            bestMarket,
            stats: {
                totalPredictions: allPreds.length,
                resolvedPredictions: preds.length,
                participants,
                marketsCreated: markets.length,
                totalVolume: preds.reduce((s, p) => s + p.amount, 0),
                avgAccuracy: userList.length > 0 ? Math.round(userList.reduce((s, u) => s + u.accuracy, 0) / userList.length * 100) : 0,
            },
            leaderboard: [...userList].sort((a, b) => b.points - a.points).slice(0, 10),
        };
    },

    // ==================== DEPARTMENT LEADERBOARD ====================

    setLeaderboardTab(tab) {
        this.leaderboardTab = tab;
        this.notify();
    },

    setLeaderboardSort(sort) {
        this.leaderboardSort = sort;
        this.notify();
    },

    getDepartmentLeaderboard() {
        const byDept = {};
        this.leaderboard.forEach(p => {
            const dept = p.department || 'Unknown';
            if (!byDept[dept]) byDept[dept] = { department: dept, totalPoints: 0, totalAccuracy: 0, accCount: 0, members: 0, topPlayer: null, topPoints: 0 };
            const d = byDept[dept];
            d.totalPoints += (p.points || 0);
            d.members++;
            if ((p.trades || 0) > 0) { d.totalAccuracy += (p.accuracy || 0); d.accCount++; }
            if ((p.points || 0) > d.topPoints) { d.topPoints = p.points || 0; d.topPlayer = p; }
        });
        return Object.values(byDept)
            .map(d => ({ ...d, avgAccuracy: d.accCount > 0 ? d.totalAccuracy / d.accCount : 0 }))
            .sort((a, b) => b.totalPoints - a.totalPoints);
    },

    // ==================== ONBOARDING ====================

    completeOnboarding() {
        this.hasSeenOnboarding = true;
        localStorage.setItem('sn_onboarded', 'true');
        this.notify();
    },

    // ==================== REFERRAL ====================

    getReferralLink() {
        if (!this.session?.user?.id) return '';
        const base = window.location.origin + window.location.pathname;
        return `${base}#ref=${this.session.user.id}`;
    },

    async _checkReferral() {
        const refMatch = window.location.hash.match(/^#ref=([a-f0-9-]+)$/i);
        if (refMatch) {
            const referrerId = refMatch[1];
            localStorage.setItem('sn_referrer', referrerId);
            // Clear hash so it doesn't interfere with navigation
            history.replaceState(null, '', window.location.pathname);
        }
    },

    async _claimReferralIfPending() {
        const referrerId = localStorage.getItem('sn_referrer');
        if (!referrerId || !this.session?.user?.id) return;
        if (referrerId === this.session.user.id) return; // can't self-refer
        try {
            const result = await DB.claimReferral(this.session.user.id, referrerId);
            if (result) {
                this.user.balance += 100;
                this.notify();
                setTimeout(() => {
                    if (typeof showToast === 'function') showToast('Referral bonus: +100 SharkBucks!', 'success');
                }, 600);
            }
            localStorage.removeItem('sn_referrer');
        } catch (e) {
            console.warn('Referral claim error:', e);
            localStorage.removeItem('sn_referrer');
        }
    },

    // ==================== DAILY LOGIN BONUS ====================

    async _claimDailyBonus() {
        try {
            const bonus = await DB.claimDailyBonus(this.session.user.id);
            if (bonus && bonus > 0) {
                this.user.balance += bonus;
                this.notify();
                // Show toast after a brief delay so the page has rendered
                setTimeout(() => {
                    if (typeof showToast === 'function') showToast(`Daily bonus: +${bonus} SharkBucks!`, 'success');
                }, 500);
            }
        } catch (e) {
            console.warn('Daily bonus error:', e);
        }
    },

    // ==================== DARK MODE ====================

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('sn_darkMode', this.darkMode);
        document.documentElement.classList.toggle('dark', this.darkMode);
        this.notify();
    },

    _applyDarkMode() {
        document.documentElement.classList.toggle('dark', this.darkMode);
    },

    // ==================== FILTERING ====================

    getFilteredMarkets() {
        let filtered = [...this.markets];
        // Status filter
        if (this.statusFilter === 'active') {
            filtered = filtered.filter(m => m.status === 'active' && !m.resolution);
        } else if (this.statusFilter === 'resolved') {
            filtered = filtered.filter(m => !!m.resolution);
        } else if (this.statusFilter === 'closed') {
            filtered = filtered.filter(m => m.status === 'closed' || m.status === 'voided');
        }
        // Category / watchlist filter
        if (this.categoryFilter === 'watchlist') {
            filtered = filtered.filter(m => this.watchlist.includes(m.id));
        } else if (this.categoryFilter !== 'all') {
            filtered = filtered.filter(m => m.category === this.categoryFilter);
        }
        // Department filter
        if (this.departmentFilter !== 'all') {
            filtered = filtered.filter(m => m.target_dept === this.departmentFilter);
        }
        // Search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(m => m.title.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q));
        }
        // Sort
        switch (this.sortBy) {
            case 'trending': filtered.sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0) || b.volume - a.volume); break;
            case 'newest': filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
            case 'volume': filtered.sort((a, b) => b.volume - a.volume); break;
            case 'closing': filtered.sort((a, b) => new Date(a.closes_at) - new Date(b.closes_at)); break;
        }
        // Priority markets always float to top (stable, preserves relative order)
        filtered.sort((a, b) => (b.is_priority ? 1 : 0) - (a.is_priority ? 1 : 0));
        return filtered;
    },

    setFilter(category) { this.categoryFilter = category; this.notify(); },
    setDeptFilter(dept) { this.departmentFilter = dept; this.notify(); },
    setSearch(query) {
        this.searchQuery = query;
        clearTimeout(this._searchDebounce);
        this._searchDebounce = setTimeout(() => this.notify(), 300);
    },
    setStatusFilter(status) { this.statusFilter = status; this.notify(); },
    setSort(sort) { this.sortBy = sort; this.notify(); },
};
