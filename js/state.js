// Simple state management for the prediction market app

const AppState = {
    currentPage: 'dashboard',
    selectedMarket: null,
    markets: [...MOCK_MARKETS],
    user: { ...CURRENT_USER },
    userPredictions: {},
    categoryFilter: 'all',
    searchQuery: '',
    sortBy: 'trending',

    listeners: [],

    subscribe(fn) {
        this.listeners.push(fn);
    },

    notify() {
        this.listeners.forEach(fn => fn());
    },

    navigate(page, data) {
        this.currentPage = page;
        if (data) {
            if (data.marketId) {
                this.selectedMarket = this.markets.find(m => m.id === data.marketId);
            }
        }
        this.notify();
        window.scrollTo(0, 0);
    },

    placePrediction(marketId, direction, amount) {
        const market = this.markets.find(m => m.id === marketId);
        if (!market || amount > this.user.balance) return false;

        this.user.balance -= amount;

        // Adjust probability based on prediction
        const shift = (amount / 1000) * (direction === 'yes' ? 0.02 : -0.02);
        market.probability = Math.max(0.01, Math.min(0.99, market.probability + shift));
        market.volume += amount;
        market.traders += 1;
        market.history.push(market.probability);

        this.userPredictions[marketId] = {
            direction,
            amount,
            timestamp: new Date().toISOString(),
            entryProb: market.probability,
        };

        this.selectedMarket = market;
        this.notify();
        return true;
    },

    addMarket(marketData) {
        const newMarket = {
            id: this.markets.length + 1,
            ...marketData,
            probability: 0.50,
            volume: 0,
            traders: 0,
            createdBy: `${this.user.name} (${this.user.department})`,
            createdAt: new Date().toISOString().split('T')[0],
            status: 'active',
            trending: false,
            comments: [],
            history: [0.50],
        };
        this.markets.unshift(newMarket);
        this.notify();
        return newMarket;
    },

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
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'volume':
                filtered.sort((a, b) => b.volume - a.volume);
                break;
            case 'closing':
                filtered.sort((a, b) => new Date(a.closesAt) - new Date(b.closesAt));
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
};
