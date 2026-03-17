// All page renderers

const Pages = {
    // ==================== LOGIN / SIGNUP ====================
    login() {
        return `
            <div class="min-h-screen flex items-center justify-center px-4 py-12">
                <div class="w-full max-w-md">
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center gap-2 mb-4">
                            <svg class="w-10 h-10" viewBox="0 0 32 32" fill="none">
                                <rect width="32" height="32" rx="8" fill="#0059a3"/>
                                <path d="M8 16C8 11.58 11.58 8 16 8s8 3.58 8 8-3.58 8-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                                <path d="M16 12v8l4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <div>
                                <span class="font-bold text-2xl text-gray-900">SharkNinja</span>
                                <span class="text-shark-500 text-lg ml-1">Predictions</span>
                            </div>
                        </div>
                        <p class="text-gray-500 text-sm">Harness the collective intelligence of SharkNinja employees</p>
                    </div>
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
                        <div class="flex mb-6">
                            <button onclick="switchAuthTab('signin')" id="tab-signin" class="flex-1 py-2 text-sm font-semibold text-center border-b-2 border-shark-600 text-shark-600">Sign In</button>
                            <button onclick="switchAuthTab('signup')" id="tab-signup" class="flex-1 py-2 text-sm font-semibold text-center border-b-2 border-gray-200 text-gray-400">Create Account</button>
                        </div>
                        <div id="signin-form">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" id="login-email" placeholder="you@sharkninja.com" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <input type="password" id="login-password" placeholder="Enter your password" onkeydown="if(event.key==='Enter') handleLogin()" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                                </div>
                                <button onclick="handleLogin()" id="login-btn" class="w-full bg-shark-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-shark-700 transition-colors">Sign In</button>
                                <button onclick="handleForgotPassword()" class="w-full text-sm text-shark-600 hover:text-shark-800 font-medium">Forgot password?</button>
                            </div>
                        </div>
                        <div id="signup-form" class="hidden">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <input type="text" id="signup-name" placeholder="Jane Smith" maxlength="100" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                    <select id="signup-department" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 bg-white">
                                        ${DEPARTMENTS.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" id="signup-email" placeholder="you@sharkninja.com" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <input type="password" id="signup-password" placeholder="At least 8 characters" onkeydown="if(event.key==='Enter') handleSignup()" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                                </div>
                                <button onclick="handleSignup()" id="signup-btn" class="w-full bg-shark-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-shark-700 transition-colors">Create Account</button>
                            </div>
                        </div>
                        <div id="auth-error" class="hidden mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"></div>
                        <div id="auth-success" class="hidden mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700"></div>
                    </div>
                </div>
            </div>`;
    },

    // ==================== DASHBOARD ====================
    dashboard() {
        const trending = AppState.markets.filter(m => m.trending && !m.resolution).slice(0, 4);
        const totalVolume = AppState.markets.reduce((s, m) => s + m.volume, 0);
        const activeMarkets = AppState.markets.filter(m => m.status === 'active' && !m.resolution).length;
        const userRank = AppState.leaderboard.findIndex(p => p.id === AppState.user?.id) + 1;
        const activePreds = (AppState.userPredictions || []).filter(p => p.status === 'active');

        return `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <div class="bg-gradient-to-r from-shark-800 to-shark-600 rounded-2xl p-5 sm:p-8 text-white mb-6 sm:mb-8">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h1 class="text-xl sm:text-3xl font-bold mb-2">Welcome back, ${esc(AppState.user?.name?.split(' ')[0] || 'Forecaster')}</h1>
                            <p class="text-shark-200 text-sm">Harness the collective intelligence of SharkNinja employees to forecast what matters.</p>
                        </div>
                        <button onclick="AppState.navigate('create')" class="bg-white text-shark-800 px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-shark-50 transition-colors shrink-0">+ Create Market</button>
                    </div>
                </div>

                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    ${Components.statCard('Active Markets', activeMarkets, '', '📊')}
                    ${Components.statCard('Total Volume', totalVolume.toLocaleString(), '', '💰')}
                    ${Components.statCard('Your Positions', activePreds.length, `${(AppState.user?.balance || 0).toLocaleString()} tokens`, '🎯')}
                    ${Components.statCard('Your Rank', userRank > 0 ? '#' + userRank : '—', `${(AppState.user?.points || 0).toLocaleString()} pts`, '🏆')}
                </div>

                ${activePreds.length > 0 ? `
                <div class="mb-6 sm:mb-8">
                    <h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-4">Your Active Positions</h2>
                    <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                        ${activePreds.slice(0, 5).map(p => {
                            const market = p.markets || {};
                            return `<div class="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 cursor-pointer" onclick="AppState.navigate('market', { marketId: ${p.market_id} })">
                                <div class="flex-1 min-w-0 mr-3">
                                    <div class="text-sm font-medium text-gray-900 truncate">${esc(market.title || 'Unknown')}</div>
                                    <span class="text-xs text-gray-500">${p.shares?.toFixed(1) || '?'} shares · ${p.amount} tokens</span>
                                </div>
                                <span class="px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${p.direction === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${p.direction.toUpperCase()}</span>
                            </div>`;
                        }).join('')}
                        ${activePreds.length > 5 ? `<div class="p-3 text-center"><button onclick="AppState.navigate('profile', { profileId: '${AppState.session?.user?.id}' })" class="text-sm text-shark-600 font-medium">View all ${activePreds.length} positions →</button></div>` : ''}
                    </div>
                </div>` : ''}

                <div class="mb-6 sm:mb-8">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg sm:text-xl font-bold text-gray-900">🔥 Trending Markets</h2>
                        <button onclick="AppState.navigate('markets')" class="text-sm text-shark-600 font-medium hover:text-shark-800">View all →</button>
                    </div>
                    <div class="grid gap-3 sm:gap-4 md:grid-cols-2">
                        ${trending.length > 0 ? trending.map(m => Components.marketCard(m)).join('') : '<div class="text-gray-400 text-sm col-span-2 text-center py-8">No trending markets yet.</div>'}
                    </div>
                </div>

                <div class="mb-6 sm:mb-8">
                    <h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-4">Browse by Category</h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        ${Object.values(CATEGORIES).map(cat => {
                            const count = AppState.markets.filter(m => m.category === cat.id && !m.resolution).length;
                            return `<button onclick="AppState.setFilter('${cat.id}'); AppState.navigate('markets');" class="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-left card-hover">
                                <div class="text-xl sm:text-2xl mb-1">${cat.icon}</div>
                                <div class="font-semibold text-xs sm:text-sm text-gray-900">${esc(cat.label)}</div>
                                <div class="text-xs text-gray-500">${count} active</div>
                            </button>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
    },

    // ==================== MARKETS LIST ====================
    markets() {
        const filtered = AppState.getFilteredMarkets();
        return `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <h1 class="text-xl sm:text-2xl font-bold text-gray-900">All Markets</h1>
                    <button onclick="AppState.navigate('create')" class="bg-shark-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-shark-700 transition-colors">+ Create Market</button>
                </div>
                <div class="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 mb-6">
                    <div class="flex flex-col sm:flex-row gap-3">
                        <input type="text" placeholder="Search markets..." value="${esc(AppState.searchQuery)}" oninput="AppState.setSearch(this.value)" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                        <div class="flex gap-1.5 flex-wrap">
                            <button onclick="AppState.setFilter('all')" class="px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${AppState.categoryFilter === 'all' ? 'bg-shark-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">All</button>
                            ${Object.values(CATEGORIES).map(cat => `
                                <button onclick="AppState.setFilter('${cat.id}')" class="px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${AppState.categoryFilter === cat.id ? 'bg-shark-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">${cat.icon} <span class="hidden sm:inline">${esc(cat.label)}</span></button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <span class="text-xs text-gray-500 self-center">Sort:</span>
                        ${['trending', 'newest', 'volume', 'closing'].map(s => `
                            <button onclick="AppState.setSort('${s}')" class="px-2 py-1 rounded text-xs font-medium ${AppState.sortBy === s ? 'bg-shark-100 text-shark-700' : 'text-gray-500 hover:text-gray-700'}">${s.charAt(0).toUpperCase() + s.slice(1)}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="grid gap-3 sm:gap-4">
                    ${filtered.length > 0 ? filtered.map(m => Components.marketCard(m)).join('') : '<div class="text-center py-12 text-gray-400">No markets found.</div>'}
                </div>
            </div>`;
    },

    // ==================== MARKET DETAIL ====================
    market() {
        const m = AppState.selectedMarket;
        if (!m) return '<div class="text-center py-12">Market not found.</div>';

        const userPreds = (AppState.userPredictions || []).filter(p => p.market_id === m.id && p.status === 'active');
        const allPreds = AppState.selectedMarketPredictions || [];
        const pct = Math.round(m.probability * 100);
        const days = daysLeft(m.closes_at);
        const comments = AppState.selectedMarketComments || [];
        const isResolved = !!m.resolution;
        const isExpired = !isResolved && days <= 0;
        const canResolve = AppState.user?.is_admin || (m.created_by === AppState.session?.user?.id);
        const canEdit = !isResolved && (AppState.user?.is_admin || m.created_by === AppState.session?.user?.id);
        const qYes = m.q_yes || 0, qNo = m.q_no || 0;
        const canTrade = !isResolved && !isExpired && m.status === 'active';

        return `
            <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <button onclick="AppState.navigate('markets')" class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 sm:mb-6">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    Back to Markets
                </button>

                <div class="grid lg:grid-cols-3 gap-4 sm:gap-6">
                    <div class="lg:col-span-2 space-y-4 sm:space-y-6">
                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                ${Components.categoryTag(m.category)}
                                ${m.trending && !isResolved ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">🔥 Trending</span>' : ''}
                                ${Components.statusBadge(m)}
                                ${isExpired ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Expired</span>' : ''}
                                ${m.edited_at ? '<span class="text-xs text-gray-400">(edited)</span>' : ''}
                            </div>
                            <h1 class="text-lg sm:text-2xl font-bold text-gray-900 mb-3" id="market-title-display">${esc(m.title)}</h1>
                            <p class="text-gray-600 text-sm mb-6" id="market-desc-display">${esc(m.description)}</p>

                            ${canEdit ? `<button onclick="toggleEditMarket()" id="edit-market-btn" class="text-xs text-shark-600 font-medium hover:text-shark-800 mb-4">Edit market</button>
                            <div id="edit-market-form" class="hidden mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                                <input type="text" id="edit-title" value="${esc(m.title)}" maxlength="200" class="w-full px-3 py-2 border rounded-lg text-sm"/>
                                <textarea id="edit-desc" rows="3" maxlength="5000" class="w-full px-3 py-2 border rounded-lg text-sm">${esc(m.description)}</textarea>
                                <input type="date" id="edit-closes" value="${m.closes_at}" class="px-3 py-2 border rounded-lg text-sm"/>
                                <div class="flex gap-2">
                                    <button onclick="handleEditMarket('${m.id}')" id="save-edit-btn" class="bg-shark-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Save</button>
                                    <button onclick="toggleEditMarket()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                                </div>
                            </div>` : ''}

                            <div class="mb-4">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-2xl sm:text-3xl font-bold ${pct >= 50 ? 'text-green-600' : 'text-red-500'}">${pct}%</span>
                                    <span class="text-sm text-gray-500">${isResolved ? 'Final' : 'chance of YES'}</span>
                                </div>
                                ${Components.probBar(m.probability)}
                            </div>
                            <div class="mt-6">
                                <h3 class="text-sm font-semibold text-gray-700 mb-2">Price History</h3>
                                <div class="bg-gray-50 rounded-lg p-3 sm:p-4">${Components.chart(m.history)}</div>
                            </div>
                        </div>

                        ${allPreds.length > 0 ? `
                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            <h3 class="font-semibold text-gray-900 mb-4">Recent Trades (${allPreds.length})</h3>
                            <div class="space-y-2 max-h-60 overflow-y-auto">
                                ${allPreds.slice(0, 20).map(p => {
                                    const profile = p.profiles || {};
                                    return `<div class="flex items-center justify-between text-sm py-1">
                                        <div class="flex items-center gap-2 min-w-0">
                                            ${Components.avatar(profile.avatar || profile.name || 'XX', 'sm')}
                                            <span class="font-medium text-gray-900 truncate">${esc(profile.name || 'Unknown')}</span>
                                        </div>
                                        <div class="flex items-center gap-2 shrink-0">
                                            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${p.direction === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${p.direction.toUpperCase()}</span>
                                            <span class="text-gray-500 text-xs">${p.amount}t</span>
                                            <span class="text-gray-400 text-xs hidden sm:inline">${getTimeAgo(p.created_at)}</span>
                                        </div>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>` : ''}

                        <!-- Comments -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            <h3 class="font-semibold text-gray-900 mb-4">Discussion (${comments.length})</h3>
                            ${!isResolved ? `
                            <div class="flex gap-2 sm:gap-3 mb-6">
                                <div class="hidden sm:block">${Components.avatar(AppState.user?.avatar || 'XX', 'sm')}</div>
                                <input type="text" id="comment-input" placeholder="Share your insight..." maxlength="2000" onkeydown="if(event.key==='Enter') handleAddComment('${m.id}')" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500"/>
                                <button onclick="handleAddComment('${m.id}')" id="comment-btn" class="bg-shark-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-shark-700 transition-colors shrink-0">Post</button>
                            </div>` : ''}
                            <div class="space-y-4">
                                ${comments.length > 0 ? comments.map(c => {
                                    const profile = c.profiles || {};
                                    const userName = profile.name || 'Unknown';
                                    const dept = profile.department || '';
                                    const displayName = dept ? `${esc(userName)} (${esc(dept)})` : esc(userName);
                                    const canDelete = AppState.user?.is_admin || c.user_id === AppState.session?.user?.id;
                                    return `<div class="flex gap-2 sm:gap-3 group">
                                        ${Components.avatar(profile.avatar || userName, 'sm')}
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="text-sm font-semibold text-gray-900 truncate">${displayName}</span>
                                                <span class="text-xs text-gray-400 shrink-0">${getTimeAgo(c.created_at)}</span>
                                                ${canDelete ? `<button onclick="handleDeleteComment('${c.id}')" class="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">delete</button>` : ''}
                                            </div>
                                            <p class="text-sm text-gray-600 mt-1 break-words">${esc(c.text)}</p>
                                        </div>
                                    </div>`;
                                }).join('') : '<div class="text-sm text-gray-400 text-center py-4">No comments yet.</div>'}
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar -->
                    <div class="space-y-4 sm:space-y-6">
                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            ${isResolved ? `
                                <h3 class="font-semibold text-gray-900 mb-4">Market Resolved</h3>
                                <div class="text-center p-4 rounded-lg ${m.resolution === 'yes' ? 'bg-green-50' : m.resolution === 'no' ? 'bg-red-50' : 'bg-gray-50'}">
                                    <div class="text-3xl font-bold ${m.resolution === 'yes' ? 'text-green-600' : m.resolution === 'no' ? 'text-red-600' : 'text-gray-600'}">${m.resolution.toUpperCase()}</div>
                                    <div class="text-sm text-gray-500 mt-1">Resolved ${getTimeAgo(m.resolved_at)}</div>
                                </div>
                            ` : canTrade ? `
                                <h3 class="font-semibold text-gray-900 mb-4">Make a Prediction</h3>
                                <div class="space-y-4">
                                    <div>
                                        <label class="block text-sm text-gray-600 mb-1">Amount (tokens)</label>
                                        <input type="number" id="pred-amount" value="50" min="10" max="${AppState.user?.balance || 0}" step="10"
                                            oninput="updateTradeEstimate('${m.id}')"
                                            onkeydown="if(event.key==='Enter'){event.preventDefault()}"
                                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500"/>
                                        <div class="text-xs text-gray-400 mt-1">Balance: ${(AppState.user?.balance || 0).toLocaleString()} tokens</div>
                                    </div>
                                    <div id="trade-estimate" class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                                        ${_tradeEstimateHTML(qYes, qNo, 50)}
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <button onclick="handlePrediction('${m.id}', 'yes')" id="btn-yes-${m.id}" class="prediction-btn bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold text-sm">
                                            YES ↑<div class="text-xs font-normal opacity-80">at ${pct}%</div>
                                        </button>
                                        <button onclick="handlePrediction('${m.id}', 'no')" id="btn-no-${m.id}" class="prediction-btn bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold text-sm">
                                            NO ↓<div class="text-xs font-normal opacity-80">at ${100 - pct}%</div>
                                        </button>
                                    </div>
                                </div>
                            ` : `
                                <h3 class="font-semibold text-gray-900 mb-4">Trading Closed</h3>
                                <p class="text-sm text-gray-500">This market has expired and is awaiting resolution.</p>
                            `}
                        </div>

                        ${userPreds.length > 0 ? `
                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            <h3 class="font-semibold text-gray-900 mb-4">Your Positions</h3>
                            <div class="space-y-3">
                                ${userPreds.map(p => {
                                    const sellValue = canTrade ? AMM.sellRevenue(qYes, qNo, p.shares, p.direction) : 0;
                                    const profit = Math.round(sellValue) - p.amount;
                                    return `<div class="bg-gray-50 rounded-lg p-3">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${p.direction === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${p.direction.toUpperCase()}</span>
                                            <span class="text-xs text-gray-500">${getTimeAgo(p.created_at)}</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-x-4 text-sm">
                                            <div class="flex justify-between"><span class="text-gray-500">Cost</span><span class="font-semibold">${p.amount}t</span></div>
                                            <div class="flex justify-between"><span class="text-gray-500">Shares</span><span class="font-semibold">${p.shares?.toFixed(1) || '—'}</span></div>
                                        </div>
                                        ${canTrade ? `
                                        <div class="flex justify-between text-sm mt-1">
                                            <span class="text-gray-500">Sell value</span>
                                            <span class="font-semibold">${Math.round(sellValue)}t <span class="${profit >= 0 ? 'text-green-600' : 'text-red-500'}">(${profit >= 0 ? '+' : ''}${profit})</span></span>
                                        </div>
                                        <button onclick="handleSellPosition('${p.id}')" id="sell-btn-${p.id}" class="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 rounded-lg text-xs font-semibold transition-colors">Sell Position</button>
                                        ` : ''}
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>` : ''}

                        ${canResolve && !isResolved ? `
                        <div class="bg-white rounded-xl border-2 border-amber-200 p-4 sm:p-6">
                            <h3 class="font-semibold text-gray-900 mb-2">Resolve Market</h3>
                            <p class="text-xs text-gray-500 mb-4">This will trigger payouts and cannot be undone.</p>
                            <div class="grid grid-cols-3 gap-2">
                                <button onclick="handleResolveMarket('${m.id}', 'yes')" id="resolve-yes-${m.id}" class="bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-bold">YES</button>
                                <button onclick="handleResolveMarket('${m.id}', 'no')" id="resolve-no-${m.id}" class="bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-bold">NO</button>
                                <button onclick="handleResolveMarket('${m.id}', 'void')" id="resolve-void-${m.id}" class="bg-gray-400 hover:bg-gray-500 text-white py-2 rounded-lg text-sm font-bold">VOID</button>
                            </div>
                        </div>` : ''}

                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            <h3 class="font-semibold text-gray-900 mb-4">Market Info</h3>
                            <div class="space-y-2.5 text-sm">
                                <div class="flex justify-between"><span class="text-gray-500">Created by</span><span class="font-medium text-gray-900 text-right max-w-[60%] truncate">${esc(m.created_by_name)}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Created</span><span class="font-medium text-gray-900">${formatDate(m.created_at)}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Closes</span><span class="font-medium text-gray-900">${formatDate(m.closes_at)}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Days left</span><span class="font-medium text-gray-900">${isResolved ? 'Resolved' : isExpired ? 'Expired' : days}</span></div>
                                <hr class="border-gray-100">
                                <div class="flex justify-between"><span class="text-gray-500">Volume</span><span class="font-bold text-gray-900">${m.volume.toLocaleString()}</span></div>
                                <div class="flex justify-between"><span class="text-gray-500">Traders</span><span class="font-bold text-gray-900">${m.traders}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    // ==================== LEADERBOARD ====================
    leaderboard() {
        const lb = AppState.leaderboard;
        const top3 = lb.slice(0, 3);

        return `
            <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Leaderboard</h1>
                <p class="text-gray-500 text-sm mb-6 sm:mb-8">Top forecasters ranked by points earned from correct predictions.</p>

                ${top3.length >= 3 ? `
                <div class="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    ${[1, 0, 2].map(idx => {
                        const p = top3[idx];
                        const medals = ['🥇', '🥈', '🥉'];
                        const order = idx === 0 ? 'order-2' : idx === 1 ? 'order-1' : 'order-3';
                        return `<div class="${order} flex flex-col items-center cursor-pointer" onclick="AppState.navigate('profile', { profileId: '${p.id}' })">
                            <div class="text-2xl sm:text-3xl mb-1 sm:mb-2">${medals[idx]}</div>
                            ${Components.avatar(p.avatar || p.name || 'XX', 'lg')}
                            <div class="font-bold text-gray-900 mt-2 text-sm sm:text-base text-center">${esc(p.name)}</div>
                            <div class="text-xs text-gray-500 text-center">${esc(p.department)}</div>
                            <div class="text-sm sm:text-lg font-bold text-shark-600 mt-1">${p.points.toLocaleString()}</div>
                        </div>`;
                    }).join('')}
                </div>` : ''}

                <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead><tr class="border-b border-gray-100">
                                <th class="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-12">#</th>
                                <th class="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Forecaster</th>
                                <th class="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Accuracy</th>
                                <th class="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Trades</th>
                                <th class="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Points</th>
                            </tr></thead>
                            <tbody>
                                ${lb.map((p, idx) => {
                                    const isUser = p.id === AppState.user?.id;
                                    const rank = idx + 1;
                                    return `<tr class="border-b border-gray-50 ${isUser ? 'bg-shark-50' : 'hover:bg-gray-50'} cursor-pointer" onclick="AppState.navigate('profile', { profileId: '${p.id}' })">
                                        <td class="px-3 sm:px-4 py-3"><span class="text-sm font-bold ${rank <= 3 ? 'text-shark-600' : 'text-gray-400'}">${rank}</span></td>
                                        <td class="px-3 sm:px-4 py-3">
                                            <div class="flex items-center gap-2 sm:gap-3">
                                                ${Components.avatar(p.avatar || p.name || 'XX', 'sm')}
                                                <div class="min-w-0">
                                                    <div class="text-sm font-semibold text-gray-900 truncate">${esc(p.name)} ${isUser ? '<span class="text-xs text-shark-600">(You)</span>' : ''}</div>
                                                    <div class="text-xs text-gray-500 truncate">${esc(p.department)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-3 sm:px-4 py-3 text-right hidden sm:table-cell"><span class="text-sm">${Math.round((p.accuracy || 0) * 100)}%</span></td>
                                        <td class="px-3 sm:px-4 py-3 text-right hidden sm:table-cell"><span class="text-sm text-gray-600">${p.trades || 0}</span></td>
                                        <td class="px-3 sm:px-4 py-3 text-right"><span class="text-sm font-bold">${p.points.toLocaleString()}</span></td>
                                    </tr>`;
                                }).join('')}
                                ${lb.length === 0 ? '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No forecasters yet.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    },

    // ==================== CREATE MARKET ====================
    create() {
        return `
            <div class="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Create a New Market</h1>
                <p class="text-gray-500 text-sm mb-6 sm:mb-8">Ask a yes/no question with clear resolution criteria.</p>
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Question * <span class="font-normal text-gray-400" id="title-count">0/200</span></label>
                        <input type="text" id="create-title" placeholder="Will [specific outcome] happen by [date]?" maxlength="200"
                            oninput="document.getElementById('title-count').textContent=this.value.length+'/200'"
                            onkeydown="if(event.key==='Enter') event.preventDefault()"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Description * <span class="font-normal text-gray-400" id="desc-count">0/5000</span></label>
                        <textarea id="create-desc" rows="4" maxlength="5000" placeholder="Provide context, resolution criteria, and relevant background..."
                            oninput="document.getElementById('desc-count').textContent=this.value.length+'/5000'"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent resize-none"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Category *</label>
                            <select id="create-category" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 bg-white">
                                ${Object.values(CATEGORIES).map(cat => `<option value="${cat.id}">${cat.icon} ${esc(cat.label)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Closes On *</label>
                            <input type="date" id="create-closes" min="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500"/>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="handleCreateMarket()" id="create-market-btn" class="flex-1 bg-shark-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-shark-700 transition-colors">Create Market</button>
                        <button onclick="AppState.navigate('markets')" class="px-6 py-3 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                    </div>
                </div>
            </div>`;
    },

    // ==================== NOTIFICATIONS ====================
    notifications() {
        const notifs = AppState.notifications;
        return `
            <div class="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Notifications</h1>
                    ${notifs.some(n => !n.is_read) ? `<button onclick="handleMarkAllRead()" class="text-sm text-shark-600 font-medium hover:text-shark-800">Mark all read</button>` : ''}
                </div>
                <div class="space-y-2 sm:space-y-3">
                    ${notifs.length > 0 ? notifs.map(n => {
                        const icons = { resolution: '📊', payout: '💰', comment: '💬', closing_soon: '⏰', welcome: '👋' };
                        return `<div class="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 ${!n.is_read ? 'border-l-4 border-l-shark-500' : ''} ${n.market_id ? 'cursor-pointer hover:bg-gray-50' : ''}"
                            onclick="${n.market_id ? `handleNotificationClick('${n.id}', '${n.market_id}')` : `handleMarkNotifRead('${n.id}')`}">
                            <div class="flex items-start gap-3">
                                <span class="text-lg sm:text-xl shrink-0">${icons[n.type] || '📢'}</span>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center justify-between gap-2">
                                        <span class="text-sm font-semibold text-gray-900 truncate">${esc(n.title)}</span>
                                        <span class="text-xs text-gray-400 shrink-0">${getTimeAgo(n.created_at)}</span>
                                    </div>
                                    <p class="text-sm text-gray-600 mt-1">${esc(n.message)}</p>
                                </div>
                                ${!n.is_read ? '<div class="w-2 h-2 rounded-full bg-shark-500 mt-2 shrink-0"></div>' : ''}
                            </div>
                        </div>`;
                    }).join('') : '<div class="text-center py-12 text-gray-400">No notifications yet.</div>'}
                </div>
            </div>`;
    },

    // ==================== USER PROFILE ====================
    profile() {
        const p = AppState.viewingProfile;
        if (!p) return '<div class="text-center py-12">Profile not found.</div>';

        const isOwnProfile = p.id === AppState.user?.id;
        const preds = isOwnProfile ? AppState.userPredictions : AppState.viewingProfilePredictions;
        const rank = AppState.leaderboard.findIndex(l => l.id === p.id) + 1;
        const wonPreds = preds.filter(pr => pr.status === 'won');
        const lostPreds = preds.filter(pr => pr.status === 'lost');
        const activePreds = preds.filter(pr => pr.status === 'active');
        const soldPreds = preds.filter(pr => pr.status === 'sold');

        return `
            <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                    <div class="flex items-center gap-4">
                        ${Components.avatar(p.avatar || p.name || 'XX', 'lg')}
                        <div class="flex-1 min-w-0">
                            <h1 class="text-xl sm:text-2xl font-bold text-gray-900 truncate">${esc(p.name)} ${isOwnProfile ? '<span class="text-sm text-shark-600 font-normal">(You)</span>' : ''}</h1>
                            <p class="text-gray-500 truncate">${esc(p.department)}</p>
                            ${p.is_admin ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 mt-1">Admin</span>' : ''}
                        </div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                        <div class="text-center p-2.5 bg-gray-50 rounded-lg">
                            <div class="text-xl sm:text-2xl font-bold text-gray-900">${rank > 0 ? '#' + rank : '—'}</div>
                            <div class="text-xs text-gray-500">Rank</div>
                        </div>
                        <div class="text-center p-2.5 bg-gray-50 rounded-lg">
                            <div class="text-xl sm:text-2xl font-bold text-gray-900">${(p.points || 0).toLocaleString()}</div>
                            <div class="text-xs text-gray-500">Points</div>
                        </div>
                        <div class="text-center p-2.5 bg-gray-50 rounded-lg">
                            <div class="text-xl sm:text-2xl font-bold text-gray-900">${Math.round((p.accuracy || 0) * 100)}%</div>
                            <div class="text-xs text-gray-500">Accuracy</div>
                        </div>
                        <div class="text-center p-2.5 bg-gray-50 rounded-lg">
                            <div class="text-xl sm:text-2xl font-bold text-gray-900">${p.trades || 0}</div>
                            <div class="text-xs text-gray-500">Trades</div>
                        </div>
                    </div>
                    ${isOwnProfile ? `
                    <div class="mt-4 p-3 bg-shark-50 rounded-lg flex items-center justify-between">
                        <span class="text-sm text-shark-700 font-medium">Token Balance</span>
                        <span class="text-lg sm:text-xl font-bold text-shark-700">${(p.balance || 0).toLocaleString()}</span>
                    </div>` : ''}
                </div>

                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-3">Prediction History</h2>
                    <div class="flex gap-3 sm:gap-4 mb-4 text-xs sm:text-sm flex-wrap">
                        <span class="text-blue-600">Active: <strong>${activePreds.length}</strong></span>
                        <span class="text-green-600">Won: <strong>${wonPreds.length}</strong></span>
                        <span class="text-red-500">Lost: <strong>${lostPreds.length}</strong></span>
                        <span class="text-gray-500">Sold: <strong>${soldPreds.length}</strong></span>
                    </div>
                    ${preds.length > 0 ? `
                    <div class="space-y-2">
                        ${preds.slice(0, 30).map(pr => {
                            const market = pr.markets || {};
                            const statusColors = { active: 'bg-blue-100 text-blue-700', won: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-700', sold: 'bg-gray-100 text-gray-600', voided: 'bg-gray-100 text-gray-600' };
                            return `<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg ${market.title ? 'cursor-pointer hover:bg-gray-100' : ''}" onclick="${market.title ? `AppState.navigate('market', { marketId: ${pr.market_id} })` : ''}">
                                <div class="flex-1 min-w-0 mr-3">
                                    <div class="text-sm font-medium text-gray-900 truncate">${esc(market.title || 'Unknown')}</div>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="px-1.5 py-0.5 rounded text-xs font-bold ${pr.direction === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${pr.direction.toUpperCase()}</span>
                                        <span class="text-xs text-gray-500">${pr.amount}t · ${pr.shares?.toFixed(1) || '?'}sh</span>
                                    </div>
                                </div>
                                <div class="text-right shrink-0">
                                    <span class="px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[pr.status] || ''}">${pr.status.toUpperCase()}</span>
                                    ${pr.payout > 0 ? `<div class="text-xs font-semibold mt-1 ${pr.status === 'won' ? 'text-green-600' : 'text-gray-500'}">+${Math.round(pr.payout)}t</div>` : ''}
                                </div>
                            </div>`;
                        }).join('')}
                        ${preds.length > 30 ? `<div class="text-center text-sm text-gray-400 py-2">Showing 30 of ${preds.length}</div>` : ''}
                    </div>` : '<div class="text-center py-8 text-gray-400">No predictions yet.</div>'}
                </div>
            </div>`;
    },

    // ==================== ADMIN PANEL ====================
    admin() {
        if (!AppState.user?.is_admin) return '<div class="text-center py-12 text-gray-400">Access denied.</div>';

        const activeMarkets = AppState.markets.filter(m => m.status === 'active' && !m.resolution);
        const expiredMarkets = AppState.markets.filter(m => !m.resolution && daysLeft(m.closes_at) <= 0);
        const resolvedMarkets = AppState.markets.filter(m => !!m.resolution);
        const users = AppState.allUsers || [];

        return `
            <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Admin Panel</h1>
                <p class="text-gray-500 text-sm mb-6">Manage markets, users, and moderate content.</p>

                <div class="grid sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    ${Components.statCard('Active', activeMarkets.length, '', '📊')}
                    ${Components.statCard('Expired', expiredMarkets.length, 'Need resolution', '⏰')}
                    ${Components.statCard('Resolved', resolvedMarkets.length, '', '✅')}
                    ${Components.statCard('Users', users.length, '', '👥')}
                </div>

                <!-- Expired needing resolution -->
                ${expiredMarkets.length > 0 ? `
                <div class="bg-white rounded-xl border-2 border-amber-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-amber-700 mb-4">⏰ Needs Resolution (${expiredMarkets.length})</h2>
                    <div class="space-y-3">
                        ${expiredMarkets.map(m => `
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-amber-50 rounded-lg gap-3">
                                <div class="flex-1 min-w-0 cursor-pointer" onclick="AppState.navigate('market', { marketId: '${m.id}' })">
                                    <div class="text-sm font-medium text-gray-900 truncate">${esc(m.title)}</div>
                                    <div class="text-xs text-gray-500 mt-1">${m.traders} traders · ${m.volume} vol · expired ${formatDate(m.closes_at)}</div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick="event.stopPropagation(); handleResolveMarket('${m.id}', 'yes')" class="px-3 py-1.5 rounded text-xs font-bold bg-green-500 text-white hover:bg-green-600">YES</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket('${m.id}', 'no')" class="px-3 py-1.5 rounded text-xs font-bold bg-red-500 text-white hover:bg-red-600">NO</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket('${m.id}', 'void')" class="px-3 py-1.5 rounded text-xs font-bold bg-gray-400 text-white hover:bg-gray-500">VOID</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                <!-- Active markets -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">Active Markets (${activeMarkets.length})</h2>
                    <div class="space-y-3 max-h-96 overflow-y-auto">
                        ${activeMarkets.length > 0 ? activeMarkets.map(m => `
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-lg gap-2">
                                <div class="flex-1 min-w-0 cursor-pointer" onclick="AppState.navigate('market', { marketId: '${m.id}' })">
                                    <div class="text-sm font-medium text-gray-900 truncate">${esc(m.title)}</div>
                                    <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                                        ${Components.probBadge(m.probability)}
                                        <span>${m.traders} traders</span>
                                        <span>${daysLeft(m.closes_at)}d left</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick="event.stopPropagation(); AppState.setMarketTrending('${m.id}', ${!m.trending})" class="px-2 py-1 rounded text-xs font-medium ${m.trending ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}">${m.trending ? '🔥' : 'Trend'}</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket('${m.id}', 'yes')" class="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">Y</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket('${m.id}', 'no')" class="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700">N</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket('${m.id}', 'void')" class="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">V</button>
                                </div>
                            </div>
                        `).join('') : '<div class="text-center py-6 text-gray-400">No active markets.</div>'}
                    </div>
                </div>

                <!-- User management -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">Users (${users.length})</h2>
                    <div class="space-y-2 max-h-96 overflow-y-auto">
                        ${users.map(u => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex items-center gap-3 min-w-0 cursor-pointer" onclick="AppState.navigate('profile', { profileId: '${u.id}' })">
                                    ${Components.avatar(u.avatar || u.name || 'XX', 'sm')}
                                    <div class="min-w-0">
                                        <div class="text-sm font-medium text-gray-900 truncate">${esc(u.name)} ${u.is_admin ? '<span class="text-xs text-purple-600">Admin</span>' : ''}</div>
                                        <div class="text-xs text-gray-500">${esc(u.department)} · ${u.balance}t · ${u.points}pts</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick="event.stopPropagation(); handleAdjustBalance('${u.id}', 100)" class="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700" title="Add 100 tokens">+100</button>
                                    <button onclick="event.stopPropagation(); handleToggleAdmin('${u.id}', ${!u.is_admin})" class="px-2 py-1 rounded text-xs font-medium ${u.is_admin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}">${u.is_admin ? 'Remove Admin' : 'Make Admin'}</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    },
};

// Helper for trade estimates
function _tradeEstimateHTML(qYes, qNo, amount) {
    const estYes = AMM.estimatePayout(qYes, qNo, amount, 'yes');
    const estNo = AMM.estimatePayout(qYes, qNo, amount, 'no');
    return `<div class="flex justify-between mb-1"><span>YES (${amount}t):</span><span class="font-semibold">${estYes.shares.toFixed(1)} shares → ${estYes.shares.toFixed(0)}t if YES</span></div>
        <div class="flex justify-between"><span>NO (${amount}t):</span><span class="font-semibold">${estNo.shares.toFixed(1)} shares → ${estNo.shares.toFixed(0)}t if NO</span></div>
        <div class="text-xs text-gray-400 mt-2">Winning shares pay 1 token each</div>`;
}
