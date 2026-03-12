// Page renderers

const Pages = {
    // ==================== DASHBOARD ====================
    dashboard() {
        const trending = AppState.markets.filter(m => m.trending).slice(0, 4);
        const totalTraders = new Set(MOCK_LEADERBOARD.map(l => l.name)).size;
        const totalVolume = AppState.markets.reduce((s, m) => s + m.volume, 0);
        const activeMarkets = AppState.markets.filter(m => m.status === 'active').length;

        return `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
                <!-- Welcome banner -->
                <div class="bg-gradient-to-r from-shark-800 to-shark-600 rounded-2xl p-6 sm:p-8 text-white mb-8">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h1 class="text-2xl sm:text-3xl font-bold mb-2">Welcome back, ${AppState.user.name.split('.')[0]} 👋</h1>
                            <p class="text-shark-200 text-sm sm:text-base">Harness the collective intelligence of SharkNinja employees to forecast what matters.</p>
                        </div>
                        <button onclick="AppState.navigate('create')" class="bg-white text-shark-800 px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-shark-50 transition-colors shrink-0">
                            + Create Market
                        </button>
                    </div>
                </div>

                <!-- Stats row -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    ${Components.statCard('Active Markets', activeMarkets, 'Across all categories', '📊')}
                    ${Components.statCard('Total Volume', totalVolume.toLocaleString(), 'Prediction tokens traded', '💰')}
                    ${Components.statCard('Active Forecasters', totalTraders + '+', 'Employees participating', '👥')}
                    ${Components.statCard('Your Rank', '#11', `${AppState.user.points.toLocaleString()} points`, '🏆')}
                </div>

                <!-- Trending Markets -->
                <div class="mb-8">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-bold text-gray-900">🔥 Trending Markets</h2>
                        <button onclick="AppState.navigate('markets')" class="text-sm text-shark-600 font-medium hover:text-shark-800">View all →</button>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2">
                        ${trending.map(m => Components.marketCard(m)).join('')}
                    </div>
                </div>

                <!-- Quick Categories -->
                <div class="mb-8">
                    <h2 class="text-xl font-bold text-gray-900 mb-4">Browse by Category</h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        ${Object.values(CATEGORIES).map(cat => {
                            const count = AppState.markets.filter(m => m.category === cat.id).length;
                            return `
                                <button onclick="AppState.setFilter('${cat.id}'); AppState.navigate('markets');"
                                    class="bg-white rounded-xl border border-gray-200 p-4 text-left card-hover">
                                    <div class="text-2xl mb-2">${cat.icon}</div>
                                    <div class="font-semibold text-sm text-gray-900">${cat.label}</div>
                                    <div class="text-xs text-gray-500">${count} active</div>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- How it works -->
                <div class="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                    <h2 class="text-xl font-bold text-gray-900 mb-6">How It Works</h2>
                    <div class="grid sm:grid-cols-3 gap-6">
                        <div class="text-center">
                            <div class="w-12 h-12 rounded-full bg-shark-100 text-shark-600 flex items-center justify-center text-xl font-bold mx-auto mb-3">1</div>
                            <h3 class="font-semibold mb-1">Browse Markets</h3>
                            <p class="text-sm text-gray-500">Explore questions about product launches, sales, competitors, and company strategy.</p>
                        </div>
                        <div class="text-center">
                            <div class="w-12 h-12 rounded-full bg-ninja-100 text-ninja-600 flex items-center justify-center text-xl font-bold mx-auto mb-3">2</div>
                            <h3 class="font-semibold mb-1">Make Predictions</h3>
                            <p class="text-sm text-gray-500">Use your tokens to predict YES or NO. Share your unique expertise and insights.</p>
                        </div>
                        <div class="text-center">
                            <div class="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl font-bold mx-auto mb-3">3</div>
                            <h3 class="font-semibold mb-1">Earn Points</h3>
                            <p class="text-sm text-gray-500">Accurate predictions earn points. Climb the leaderboard and demonstrate your forecasting ability.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ==================== MARKETS LIST ====================
    markets() {
        const filtered = AppState.getFilteredMarkets();

        return `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <h1 class="text-2xl font-bold text-gray-900">All Markets</h1>
                    <button onclick="AppState.navigate('create')" class="bg-shark-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-shark-700 transition-colors">
                        + Create Market
                    </button>
                </div>

                <!-- Filters -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <div class="flex-1">
                            <input type="text" placeholder="Search markets..."
                                value="${AppState.searchQuery}"
                                oninput="AppState.setSearch(this.value)"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <button onclick="AppState.setFilter('all')"
                                class="px-3 py-1.5 rounded-lg text-sm font-medium ${AppState.categoryFilter === 'all' ? 'bg-shark-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
                                All
                            </button>
                            ${Object.values(CATEGORIES).map(cat => `
                                <button onclick="AppState.setFilter('${cat.id}')"
                                    class="px-3 py-1.5 rounded-lg text-sm font-medium ${AppState.categoryFilter === cat.id ? 'bg-shark-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
                                    ${cat.icon} ${cat.label}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <span class="text-xs text-gray-500 self-center">Sort:</span>
                        ${['trending', 'newest', 'volume', 'closing'].map(s => `
                            <button onclick="AppState.setSort('${s}')"
                                class="px-2 py-1 rounded text-xs font-medium ${AppState.sortBy === s ? 'bg-shark-100 text-shark-700' : 'text-gray-500 hover:text-gray-700'}">
                                ${s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Market list -->
                <div class="grid gap-4">
                    ${filtered.length > 0
                        ? filtered.map(m => Components.marketCard(m)).join('')
                        : '<div class="text-center py-12 text-gray-400">No markets found matching your criteria.</div>'
                    }
                </div>
            </div>
        `;
    },

    // ==================== MARKET DETAIL ====================
    market() {
        const m = AppState.selectedMarket;
        if (!m) return '<div class="text-center py-12">Market not found.</div>';

        const userPred = AppState.userPredictions[m.id];
        const pct = Math.round(m.probability * 100);
        const daysLeft = Math.max(0, Math.ceil((new Date(m.closesAt) - new Date()) / (1000 * 60 * 60 * 24)));

        return `
            <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 fade-in">
                <!-- Back button -->
                <button onclick="AppState.navigate('markets')" class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    Back to Markets
                </button>

                <div class="grid lg:grid-cols-3 gap-6">
                    <!-- Main content -->
                    <div class="lg:col-span-2 space-y-6">
                        <!-- Market header -->
                        <div class="bg-white rounded-xl border border-gray-200 p-6">
                            <div class="flex items-center gap-2 mb-3">
                                ${Components.categoryTag(m.category)}
                                ${m.trending ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">🔥 Trending</span>' : ''}
                            </div>
                            <h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-4">${m.title}</h1>
                            <p class="text-gray-600 text-sm mb-6">${m.description}</p>

                            <!-- Probability display -->
                            <div class="mb-4">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-3xl font-bold ${pct >= 50 ? 'text-green-600' : 'text-red-500'}">${pct}%</span>
                                    <span class="text-sm text-gray-500">chance of YES</span>
                                </div>
                                ${Components.probBar(m.probability)}
                            </div>

                            <!-- Chart -->
                            <div class="mt-6">
                                <h3 class="text-sm font-semibold text-gray-700 mb-2">Price History</h3>
                                <div class="bg-gray-50 rounded-lg p-4">
                                    ${Components.chart(m.history)}
                                </div>
                            </div>
                        </div>

                        <!-- Comments -->
                        <div class="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 class="font-semibold text-gray-900 mb-4">Discussion (${m.comments.length})</h3>
                            <div class="space-y-4">
                                ${m.comments.map(c => `
                                    <div class="flex gap-3">
                                        ${Components.avatar(c.user.split(' ').map(w => w[0]).slice(0, 2).join(''), 'sm')}
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                <span class="text-sm font-semibold text-gray-900">${c.user}</span>
                                                <span class="text-xs text-gray-400">${c.time}</span>
                                            </div>
                                            <p class="text-sm text-gray-600 mt-1">${c.text}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar -->
                    <div class="space-y-6">
                        <!-- Trading panel -->
                        <div class="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 class="font-semibold text-gray-900 mb-4">Make a Prediction</h3>
                            ${userPred ? `
                                <div class="bg-shark-50 rounded-lg p-4 text-center">
                                    <div class="text-sm text-shark-600 font-medium mb-1">You predicted</div>
                                    <div class="text-2xl font-bold ${userPred.direction === 'yes' ? 'text-green-600' : 'text-red-500'}">
                                        ${userPred.direction.toUpperCase()}
                                    </div>
                                    <div class="text-sm text-gray-500 mt-1">${userPred.amount} tokens at ${Math.round(userPred.entryProb * 100)}%</div>
                                </div>
                            ` : `
                                <div class="space-y-4">
                                    <div>
                                        <label class="block text-sm text-gray-600 mb-1">Amount (tokens)</label>
                                        <input type="number" id="pred-amount" value="50" min="10" max="${AppState.user.balance}" step="10"
                                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500"/>
                                        <div class="text-xs text-gray-400 mt-1">Balance: ${AppState.user.balance} tokens</div>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <button onclick="handlePrediction(${m.id}, 'yes')"
                                            class="prediction-btn bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold text-sm">
                                            YES ↑
                                            <div class="text-xs font-normal opacity-80">Buy at ${pct}%</div>
                                        </button>
                                        <button onclick="handlePrediction(${m.id}, 'no')"
                                            class="prediction-btn bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold text-sm">
                                            NO ↓
                                            <div class="text-xs font-normal opacity-80">Buy at ${100 - pct}%</div>
                                        </button>
                                    </div>
                                </div>
                            `}
                        </div>

                        <!-- Market info -->
                        <div class="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 class="font-semibold text-gray-900 mb-4">Market Info</h3>
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Created by</span>
                                    <span class="font-medium text-gray-900">${m.createdBy}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Created</span>
                                    <span class="font-medium text-gray-900">${m.createdAt}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Closes</span>
                                    <span class="font-medium text-gray-900">${m.closesAt}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Days remaining</span>
                                    <span class="font-medium text-gray-900">${daysLeft}</span>
                                </div>
                                <hr class="border-gray-100">
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Total volume</span>
                                    <span class="font-bold text-gray-900">${m.volume.toLocaleString()}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Traders</span>
                                    <span class="font-bold text-gray-900">${m.traders}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ==================== LEADERBOARD ====================
    leaderboard() {
        return `
            <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 fade-in">
                <h1 class="text-2xl font-bold text-gray-900 mb-2">Leaderboard</h1>
                <p class="text-gray-500 text-sm mb-8">Top forecasters across SharkNinja. Rankings based on prediction accuracy and participation.</p>

                <!-- Top 3 podium -->
                <div class="grid grid-cols-3 gap-4 mb-8">
                    ${[1, 0, 2].map(idx => {
                        const p = MOCK_LEADERBOARD[idx];
                        const heights = ['h-32', 'h-24', 'h-20'];
                        const medals = ['🥇', '🥈', '🥉'];
                        const bg = idx === 0 ? 'bg-gradient-to-b from-yellow-50 to-white border-yellow-200' : 'bg-white border-gray-200';
                        const order = idx === 0 ? 'order-2' : idx === 1 ? 'order-1' : 'order-3';
                        return `
                            <div class="${order} flex flex-col items-center">
                                <div class="text-3xl mb-2">${medals[idx]}</div>
                                ${Components.avatar(p.avatar, 'lg')}
                                <div class="font-bold text-gray-900 mt-2">${p.name}</div>
                                <div class="text-xs text-gray-500">${p.department}</div>
                                <div class="text-lg font-bold text-shark-600 mt-1">${p.points.toLocaleString()} pts</div>
                                <div class="text-xs text-gray-500">${Math.round(p.accuracy * 100)}% accuracy</div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Full table -->
                <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table class="w-full">
                        <thead>
                            <tr class="border-b border-gray-100">
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rank</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Forecaster</th>
                                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Accuracy</th>
                                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Trades</th>
                                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${MOCK_LEADERBOARD.map(p => {
                                const isUser = p.name === 'Daniel B.';
                                return `
                                    <tr class="border-b border-gray-50 ${isUser ? 'bg-shark-50' : 'hover:bg-gray-50'}">
                                        <td class="px-4 py-3">
                                            <span class="text-sm font-bold ${p.rank <= 3 ? 'text-shark-600' : 'text-gray-400'}">#${p.rank}</span>
                                        </td>
                                        <td class="px-4 py-3">
                                            <div class="flex items-center gap-3">
                                                ${Components.avatar(p.avatar, 'sm')}
                                                <div>
                                                    <div class="text-sm font-semibold text-gray-900">${p.name} ${isUser ? '<span class="text-xs text-shark-600">(You)</span>' : ''}</div>
                                                    <div class="text-xs text-gray-500">${p.department}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-4 py-3 text-right hidden sm:table-cell">
                                            <span class="text-sm font-medium text-gray-900">${Math.round(p.accuracy * 100)}%</span>
                                        </td>
                                        <td class="px-4 py-3 text-right hidden sm:table-cell">
                                            <span class="text-sm text-gray-600">${p.trades}</span>
                                        </td>
                                        <td class="px-4 py-3 text-right">
                                            <span class="text-sm font-bold text-gray-900">${p.points.toLocaleString()}</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // ==================== CREATE MARKET ====================
    create() {
        return `
            <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8 fade-in">
                <h1 class="text-2xl font-bold text-gray-900 mb-2">Create a New Market</h1>
                <p class="text-gray-500 text-sm mb-8">Ask a question that SharkNinja employees can forecast on. Great markets have clear resolution criteria and a specific timeframe.</p>

                <div class="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Question *</label>
                        <input type="text" id="create-title" placeholder="Will [specific outcome] happen by [date]?"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                        <p class="text-xs text-gray-400 mt-1">Tip: Frame as a yes/no question with a clear deadline.</p>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Description *</label>
                        <textarea id="create-desc" rows="4" placeholder="Provide context, resolution criteria, and any relevant background..."
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent resize-none"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Category *</label>
                            <select id="create-category"
                                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 bg-white">
                                ${Object.values(CATEGORIES).map(cat => `
                                    <option value="${cat.id}">${cat.icon} ${cat.label}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Closes On *</label>
                            <input type="date" id="create-closes"
                                min="${new Date().toISOString().split('T')[0]}"
                                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500"/>
                        </div>
                    </div>

                    <!-- Example markets -->
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="text-sm font-semibold text-gray-700 mb-2">Example Market Ideas</h4>
                        <ul class="text-xs text-gray-500 space-y-1">
                            <li>• "Will the Ninja Woodfire Grill exceed 1M units sold in 2026?"</li>
                            <li>• "Will Dyson release a kitchen appliance by end of 2026?"</li>
                            <li>• "Will our TikTok Shop revenue exceed $10M in Q2 2026?"</li>
                            <li>• "Will SharkNinja stock price exceed $100 by June 2026?"</li>
                            <li>• "Will we expand into 5+ new international markets in 2026?"</li>
                        </ul>
                    </div>

                    <div class="flex gap-3">
                        <button onclick="handleCreateMarket()"
                            class="flex-1 bg-shark-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-shark-700 transition-colors">
                            Create Market
                        </button>
                        <button onclick="AppState.navigate('markets')"
                            class="px-6 py-3 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
};
