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
                                <path d="M16 6 L18 18 L26 22 L6 22 L14 18 Z" fill="white" opacity="0.9"/>
                            </svg>
                            <span class="font-bold text-2xl text-gray-900">SharkPool</span>
                        </div>
                        <p class="text-gray-500 text-sm">Harness the collective intelligence of SharkNinja</p>
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
        const allActive = AppState.markets.filter(m => m.status === 'active' && !m.resolution);
        const trending = allActive.filter(m => m.trending).slice(0, 6);
        const newest = [...allActive].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
        const highVolume = [...allActive].sort((a, b) => b.volume - a.volume).slice(0, 6);
        const closingSoon = [...allActive].filter(m => daysLeft(m.closes_at) > 0).sort((a, b) => daysLeft(a.closes_at) - daysLeft(b.closes_at)).slice(0, 6);
        const totalVolume = AppState.markets.reduce((s, m) => s + m.volume, 0);
        const userRank = AppState.leaderboard.findIndex(p => p.id === AppState.user?.id) + 1;
        const activePreds = (AppState.userPredictions || []).filter(p => p.status === 'active');
        const portfolio = AppState.getPortfolioSummary();

        // Polymarket-style market card
        const marketCard = (m, featured = false) => {
            const pct = Math.round((m.probability || 0) * 100);
            const days = daysLeft(m.closes_at);
            const isMulti = m.market_type === 'multi';
            const userPos = (AppState.userPredictions || []).find(p => p.market_id === m.id && p.status === 'active');
            const probs = m.probabilities || [];
            const options = m.options || [];
            const cat = CATEGORIES[Object.keys(CATEGORIES).find(k => CATEGORIES[k].id === m.category)];

            // Multi-outcome: show top 3 options
            const multiOutcomes = isMulti ? options.map((opt, i) => ({
                label: opt.label, pct: Math.round((probs[i] || 0) * 100)
            })).sort((a, b) => b.pct - a.pct).slice(0, 3) : [];

            return `<div class="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5" onclick="AppState.navigate('market', { marketId: ${m.id} })">
                <div class="flex items-center gap-2 mb-3">
                    ${cat ? `<span class="text-xs font-medium text-gray-400 uppercase tracking-wide">${cat.icon} ${esc(cat.label)}</span>` : ''}
                    ${userPos ? `<span class="w-1.5 h-1.5 rounded-full bg-shark-500" title="You have a position"></span>` : ''}
                </div>
                <h3 class="${featured ? 'text-base' : 'text-sm'} font-semibold text-gray-900 leading-snug mb-4 line-clamp-2">${esc(m.title)}</h3>
                ${isMulti ? `
                    <div class="space-y-2 mb-4">
                        ${multiOutcomes.map(o => `
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600 truncate mr-3">${esc(o.label)}</span>
                                <span class="text-sm font-bold text-gray-900 shrink-0">${o.pct}%</span>
                            </div>
                        `).join('')}
                        ${options.length > 3 ? `<div class="text-xs text-gray-400">+${options.length - 3} more</div>` : ''}
                    </div>
                ` : `
                    <div class="flex items-center gap-2 mb-4">
                        <div class="flex-1 flex gap-2">
                            <div class="flex-1 bg-green-50 border border-green-200 rounded-lg py-2 text-center transition-colors hover:bg-green-100">
                                <div class="text-xs text-green-600 font-medium">Yes</div>
                                <div class="text-lg font-bold text-green-700">${pct}%</div>
                            </div>
                            <div class="flex-1 bg-red-50 border border-red-200 rounded-lg py-2 text-center transition-colors hover:bg-red-100">
                                <div class="text-xs text-red-500 font-medium">No</div>
                                <div class="text-lg font-bold text-red-600">${100 - pct}%</div>
                            </div>
                        </div>
                    </div>
                `}
                <div class="flex items-center justify-between text-xs text-gray-400">
                    <span>${m.volume.toLocaleString()} vol · ${m.traders} traders</span>
                    <span>${days > 0 ? days + 'd left' : 'Expired'}</span>
                </div>
            </div>`;
        };

        // Market list section helper
        const marketSection = (title, markets, emoji = '', featured = false) => {
            if (!markets.length) return '';
            return `
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">${emoji ? emoji + ' ' : ''}${title}</h3>
                        <button onclick="AppState.navigate('markets')" class="text-xs text-shark-600 font-medium hover:text-shark-800">View all →</button>
                    </div>
                    <div class="grid ${featured ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-3">
                        ${markets.map(m => marketCard(m, featured)).join('')}
                    </div>
                </div>`;
        };

        return `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 fade-in">
                ${!AppState.hasSeenOnboarding ? `
                <div class="bg-white rounded-2xl border-2 border-shark-200 p-6 sm:p-8 mb-5 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-shark-100/50 to-transparent rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div class="relative" id="onboarding-content">
                        <div id="onboard-step-1">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-12 h-12 rounded-xl bg-shark-600 text-white flex items-center justify-center text-2xl">🦈</div>
                                <div>
                                    <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Welcome to SharkPool!</h2>
                                    <p class="text-sm text-gray-500">Forecast what matters, earn points, prove your insight.</p>
                                </div>
                            </div>
                            <div class="grid sm:grid-cols-3 gap-4 mb-6">
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <div class="text-2xl mb-2">🎯</div>
                                    <h3 class="font-semibold text-gray-900 text-sm mb-1">Make Predictions</h3>
                                    <p class="text-xs text-gray-500">Buy YES or NO shares on questions about products, strategy, and more.</p>
                                </div>
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <div class="text-2xl mb-2">💰</div>
                                    <h3 class="font-semibold text-gray-900 text-sm mb-1">You Start with 1,000 Tokens</h3>
                                    <p class="text-xs text-gray-500">Use tokens to trade. Winning predictions pay out — grow your balance!</p>
                                </div>
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <div class="text-2xl mb-2">🏆</div>
                                    <h3 class="font-semibold text-gray-900 text-sm mb-1">Climb the Leaderboard</h3>
                                    <p class="text-xs text-gray-500">Earn points for correct predictions. Compete with your team!</p>
                                </div>
                            </div>
                            <div class="flex gap-3">
                                <button onclick="AppState.navigate('markets')" class="bg-shark-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-shark-700 transition-colors">Browse Markets</button>
                                <button onclick="AppState.navigate('create')" class="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors">Create a Market</button>
                                <button onclick="AppState.completeOnboarding()" class="text-gray-400 text-sm hover:text-gray-600 ml-auto">Skip</button>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Top bar: balance + stats -->
                <div class="flex items-center justify-between mb-5">
                    <div>
                        <h1 class="text-lg sm:text-xl font-bold text-gray-900">Markets</h1>
                        <p class="text-xs text-gray-500">${allActive.length} active · ${totalVolume.toLocaleString()} total volume</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="hidden sm:flex items-center gap-4 text-sm">
                            <div class="text-gray-500">Balance: <span class="font-bold text-gray-900">${(AppState.user?.balance || 0).toLocaleString()}</span></div>
                            ${userRank > 0 ? `<div class="text-gray-500">Rank: <span class="font-bold text-gray-900">#${userRank}</span></div>` : ''}
                        </div>
                        <button onclick="AppState.navigate('create')" class="bg-shark-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-shark-700 transition-colors shrink-0">+ Create</button>
                    </div>
                </div>

                <!-- Portfolio strip (compact) -->
                ${activePreds.length > 0 ? `
                <div class="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-5">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-5 sm:gap-8 text-sm overflow-x-auto">
                            <div><span class="text-gray-500">Positions</span> <span class="font-bold text-gray-900">${activePreds.length}</span></div>
                            <div><span class="text-gray-500">Invested</span> <span class="font-bold text-gray-900">${portfolio.totalInvested.toLocaleString()}</span></div>
                            <div><span class="text-gray-500">Value</span> <span class="font-bold text-gray-900">${portfolio.unrealizedValue.toLocaleString()}</span></div>
                            <div><span class="text-gray-500">P&L</span> <span class="font-bold ${portfolio.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-500'}">${portfolio.unrealizedPnL >= 0 ? '+' : ''}${portfolio.unrealizedPnL.toLocaleString()}</span></div>
                        </div>
                        <button onclick="AppState.navigate('profile', { profileId: '${AppState.session?.user?.id}' })" class="text-xs text-shark-600 font-medium shrink-0 ml-3">Portfolio →</button>
                    </div>
                </div>` : ''}

                <!-- Category pills -->
                <div class="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
                    <button onclick="AppState.navigate('markets')" class="px-3 py-1.5 rounded-full text-xs font-medium bg-shark-600 text-white shrink-0">All Markets</button>
                    ${Object.values(CATEGORIES).slice(0, 6).map(cat => {
                        const count = allActive.filter(m => m.category === cat.id).length;
                        return count > 0 ? `<button onclick="AppState.setFilter('${cat.id}'); AppState.navigate('markets');" class="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 shrink-0 transition-colors">${cat.icon} ${esc(cat.label)} <span class="text-gray-400">${count}</span></button>` : '';
                    }).join('')}
                </div>

                <!-- Featured Market Hero -->
                ${(() => {
                    // Pick featured: trending > high volume active > any active > any market
                    const allMarkets = AppState.markets || [];
                    const candidates = trending.length > 0 ? trending
                        : highVolume.length > 0 ? highVolume
                        : allActive.length > 0 ? allActive
                        : allMarkets.filter(m => m.status !== 'pending').slice(0, 6);
                    // Rotate through candidates based on the hour
                    const rotateIdx = candidates.length > 0 ? Math.floor(Date.now() / 3600000) % candidates.length : -1;
                    const feat = rotateIdx >= 0 ? candidates[rotateIdx] : null;
                    if (!feat) return '';
                    const fPct = Math.round((feat.probability || 0) * 100);
                    const fDays = daysLeft(feat.closes_at);
                    const fIsMulti = feat.market_type === 'multi';
                    const fOptions = feat.options || [];
                    const fProbs = feat.probabilities || [];
                    const fCat = CATEGORIES[Object.keys(CATEGORIES).find(k => CATEGORIES[k].id === feat.category)];
                    const fHistory = feat.history;
                    const fCanTrade = feat.status === 'active' && !feat.resolution;

                    return `
                    <div class="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6 cursor-pointer transition-all hover:shadow-md hover:border-gray-300" onclick="AppState.navigate('market', { marketId: ${feat.id} })">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xs font-semibold text-shark-600 uppercase tracking-wide">Featured Market</span>
                            ${fCat ? `<span class="text-xs text-gray-400">· ${fCat.icon} ${esc(fCat.label)}</span>` : ''}
                            <span class="text-xs text-gray-400">· ${feat.traders} traders · ${feat.volume.toLocaleString()} vol</span>
                        </div>
                        <div class="grid sm:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                                <h2 class="text-lg sm:text-xl font-bold text-gray-900 leading-snug mb-3">${esc(feat.title)}</h2>
                                <p class="text-sm text-gray-500 line-clamp-2 mb-4">${esc(feat.description || '')}</p>
                                ${fIsMulti ? `
                                    <div class="space-y-2">
                                        ${fOptions.slice(0, 4).map((opt, i) => {
                                            const optPct = Math.round((fProbs[i] || 0) * 100);
                                            return `<div class="flex items-center gap-3">
                                                <div class="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden relative">
                                                    <div class="h-full bg-shark-100 rounded-full" style="width:${Math.max(optPct, 5)}%"></div>
                                                    <span class="absolute inset-0 flex items-center px-3 text-xs font-medium text-gray-700">${esc(opt.label)}</span>
                                                </div>
                                                <span class="text-sm font-bold text-gray-900 w-10 text-right">${optPct}%</span>
                                            </div>`;
                                        }).join('')}
                                    </div>
                                ` : fCanTrade ? `
                                    <div class="flex gap-3">
                                        <button onclick="event.stopPropagation(); handlePrediction(${feat.id}, 'yes')" class="flex-1 bg-green-50 border-2 border-green-200 rounded-xl py-3 text-center transition-all hover:bg-green-100 hover:border-green-300 hover:shadow-sm">
                                            <div class="text-xs text-green-600 font-semibold mb-0.5">Yes</div>
                                            <div class="text-2xl font-bold text-green-700">${fPct}%</div>
                                        </button>
                                        <button onclick="event.stopPropagation(); handlePrediction(${feat.id}, 'no')" class="flex-1 bg-red-50 border-2 border-red-200 rounded-xl py-3 text-center transition-all hover:bg-red-100 hover:border-red-300 hover:shadow-sm">
                                            <div class="text-xs text-red-500 font-semibold mb-0.5">No</div>
                                            <div class="text-2xl font-bold text-red-600">${100 - fPct}%</div>
                                        </button>
                                    </div>
                                ` : `
                                    <div class="flex gap-3">
                                        <div class="flex-1 bg-green-50 border border-green-200 rounded-xl py-3 text-center">
                                            <div class="text-xs text-green-600 font-semibold mb-0.5">Yes</div>
                                            <div class="text-2xl font-bold text-green-700">${fPct}%</div>
                                        </div>
                                        <div class="flex-1 bg-red-50 border border-red-200 rounded-xl py-3 text-center">
                                            <div class="text-xs text-red-500 font-semibold mb-0.5">No</div>
                                            <div class="text-2xl font-bold text-red-600">${100 - fPct}%</div>
                                        </div>
                                    </div>
                                `}
                                <div class="text-xs text-gray-400 mt-3">${feat.resolution ? 'Resolved: ' + feat.resolution : fDays > 0 ? fDays + ' days left' : 'Expired'} · Click to view</div>
                            </div>
                            <div class="hidden sm:block">
                                ${fIsMulti
                                    ? Components.chartMulti(fHistory, fOptions, 400, 180)
                                    : Components.chart(fHistory, 400, 180)}
                            </div>
                        </div>
                    </div>`;
                })()}

                <!-- Main content: 2-column on large screens -->
                <div class="grid lg:grid-cols-4 gap-5">
                    <!-- Left: market lists -->
                    <div class="lg:col-span-3">
                        ${trending.length > 0 ? marketSection('Trending', trending, '🔥', true) : ''}
                        ${closingSoon.length > 0 ? marketSection('Closing Soon', closingSoon, '⏰') : ''}
                        ${newest.length > 0 ? marketSection('New', newest, '✨') : ''}
                        ${highVolume.length > 0 ? marketSection('Highest Volume', highVolume, '📊') : ''}
                        ${!trending.length && !closingSoon.length && !newest.length ? `
                        <div class="text-center py-12 bg-white rounded-xl border border-gray-200">
                            <div class="text-3xl mb-3">🦈</div>
                            <div class="text-gray-500 text-sm mb-4">No active markets yet. Be the first to create one!</div>
                            <button onclick="AppState.navigate('create')" class="bg-shark-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-shark-700">+ Create Market</button>
                        </div>` : ''}
                    </div>

                    <!-- Right sidebar -->
                    <div class="space-y-4 sm:space-y-5">
                        <!-- Active positions -->
                        ${activePreds.length > 0 ? `
                        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div class="px-4 py-3 border-b border-gray-100">
                                <h3 class="text-sm font-semibold text-gray-900">Your Positions</h3>
                            </div>
                            ${activePreds.slice(0, 5).map(p => {
                                const market = AppState.markets.find(mk => mk.id === p.market_id) || {};
                                const isMultiPos = market.market_type === 'multi';
                                const sellValue = isMultiPos
                                    ? AMM.sellRevenueMulti(market.q_values || [], p.shares, p.option_index)
                                    : AMM.sellRevenue(market.q_yes || 0, market.q_no || 0, p.shares, p.direction);
                                const roundedSell = Math.round(sellValue);
                                const profit = roundedSell - p.amount;
                                return `<div class="px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer" onclick="AppState.navigate('market', { marketId: ${p.market_id} })">
                                    <div class="flex items-center justify-between">
                                        <div class="flex-1 min-w-0 mr-2">
                                            <div class="text-xs font-medium text-gray-900 truncate">${esc(market.title || 'Unknown')}</div>
                                            <div class="text-xs text-gray-400 mt-0.5">${(p.direction || '?').toUpperCase()} · ${p.amount}t cost</div>
                                        </div>
                                        <div class="text-right shrink-0">
                                            <div class="text-xs font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}">${profit >= 0 ? '+' : ''}${profit}t</div>
                                            <div class="text-xs text-gray-400">${roundedSell}t</div>
                                        </div>
                                    </div>
                                </div>`;
                            }).join('')}
                            ${activePreds.length > 5 ? `<div class="px-4 py-2 text-center"><button onclick="AppState.navigate('profile', { profileId: '${AppState.session?.user?.id}' })" class="text-xs text-shark-600 font-medium">All ${activePreds.length} positions →</button></div>` : ''}
                        </div>` : ''}

                        <!-- Activity feed -->
                        ${AppState.activityFeed.length > 0 ? `
                        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div class="px-4 py-3 border-b border-gray-100">
                                <h3 class="text-sm font-semibold text-gray-900">Recent Activity</h3>
                            </div>
                            ${AppState.activityFeed.slice(0, 6).map(a => {
                                const name = a.profiles?.name?.split(' ')[0] || 'Someone';
                                const title = a.markets?.title || 'a market';
                                const verb = a.status === 'sold' ? 'sold' : 'bought';
                                return `<div class="flex items-center gap-2 px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer" onclick="AppState.navigate('market', { marketId: ${a.market_id} })">
                                    ${Components.avatar(a.profiles?.avatar || name, 'sm')}
                                    <div class="flex-1 min-w-0">
                                        <div class="text-xs text-gray-700 truncate"><span class="font-medium">${esc(name)}</span> ${verb} <span class="${a.direction === 'yes' ? 'text-green-600' : 'text-red-500'} font-medium">${(a.direction || '?').toUpperCase()}</span></div>
                                        <div class="text-xs text-gray-400">${esc(title.length > 35 ? title.slice(0, 35) + '…' : title)}</div>
                                    </div>
                                    <span class="text-xs text-gray-300 shrink-0">${getTimeAgo(a.created_at)}</span>
                                </div>`;
                            }).join('')}
                        </div>` : ''}

                        <!-- Leaderboard preview -->
                        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <h3 class="text-sm font-semibold text-gray-900">Top Forecasters</h3>
                                <button onclick="AppState.navigate('leaderboard')" class="text-xs text-shark-600 font-medium">View all</button>
                            </div>
                            ${AppState.leaderboard.slice(0, 5).map((p, i) => `
                                <div class="flex items-center gap-2 px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer" onclick="AppState.navigate('profile', { profileId: '${p.id}' })">
                                    <span class="text-xs font-bold text-gray-400 w-4">${i + 1}</span>
                                    ${Components.avatar(p.avatar || p.name, 'sm')}
                                    <div class="flex-1 min-w-0">
                                        <div class="text-xs font-medium text-gray-900 truncate">${esc(p.name)}</div>
                                        <div class="text-xs text-gray-400">${esc(p.department || '')}</div>
                                    </div>
                                    <span class="text-xs font-bold text-shark-600">${(p.points || 0).toLocaleString()} pts</span>
                                </div>
                            `).join('')}
                        </div>
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
                            <button onclick="AppState.setFilter('watchlist')" class="px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${AppState.categoryFilter === 'watchlist' ? 'bg-shark-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">★ <span class="hidden sm:inline">Watchlist</span></button>
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
                    ${filtered.length > 0 ? filtered.map(m => Components.marketCard(m)).join('') : `<div class="text-center py-12 bg-white rounded-xl border border-gray-200 p-8">
                        <div class="text-3xl mb-2">🔍</div>
                        <div class="text-gray-500 text-sm mb-3">${AppState.searchQuery ? 'No markets match your search.' : AppState.categoryFilter === 'watchlist' ? 'Your watchlist is empty. Star markets to track them here.' : 'No markets in this category yet.'}</div>
                        <div class="flex gap-2 justify-center">
                            ${AppState.searchQuery || AppState.categoryFilter !== 'all' ? '<button onclick="AppState.setSearch(&quot;&quot;); AppState.setFilter(&quot;all&quot;)" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">Clear filters</button>' : ''}
                            <button onclick="AppState.navigate(\'create\')" class="bg-shark-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-shark-700">+ Create Market</button>
                        </div>
                    </div>`}
                </div>
            </div>`;
    },

    // ==================== MARKET DETAIL ====================
    market() {
        const m = AppState.selectedMarket;
        if (!m) return `
            <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                <div class="skeleton-line mb-6" style="width:140px;height:20px"></div>
                <div class="grid lg:grid-cols-3 gap-4 sm:gap-6">
                    <div class="lg:col-span-2 space-y-4">
                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
                            <div class="skeleton-line" style="width:30%;height:14px"></div>
                            <div class="skeleton-line" style="width:85%;height:22px"></div>
                            <div class="skeleton-line" style="width:60%"></div>
                            <div class="skeleton-line" style="height:12px;border-radius:9999px"></div>
                            <div class="skeleton-line" style="height:120px"></div>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-3">
                            <div class="skeleton-line" style="width:50%;height:16px"></div>
                            <div class="skeleton-line" style="height:40px"></div>
                            <div class="skeleton-line" style="height:40px"></div>
                        </div>
                    </div>
                </div>
            </div>`;

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
        const isWatching = AppState.isWatching(m.id);
        const isMulti = m.market_type === 'multi';
        const options = m.options || [];
        const probs = m.probabilities || [];

        return `
            <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 lg:pb-8 fade-in">
                <div class="flex items-center justify-between mb-4 sm:mb-6">
                    <button onclick="AppState.navigate('markets')" class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                        Back to Markets
                    </button>
                    <div class="flex items-center gap-3">
                        <button onclick="handleShareMarket(${m.id})" class="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-shark-600 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                            Share
                        </button>
                        <button onclick="handleToggleWatchlist(${m.id})" class="flex items-center gap-1 text-sm font-medium ${isWatching ? 'text-shark-600' : 'text-gray-400 hover:text-shark-600'} transition-colors">
                            ${isWatching ? '★ Watching' : '☆ Watch'}
                        </button>
                        ${AppState.user?.is_admin ? `<button onclick="handleDeleteMarket(${m.id})" class="flex items-center gap-1 text-sm font-medium text-red-400 hover:text-red-600 transition-colors">🗑 Delete</button>` : ''}
                    </div>
                </div>

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
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-6" id="market-desc-display">
                                <div class="flex items-start gap-2">
                                    <span class="text-blue-500 shrink-0 mt-0.5">📋</span>
                                    <div>
                                        <div class="text-xs font-semibold text-blue-700 mb-1">Resolution Criteria</div>
                                        <p class="text-gray-700 text-sm">${esc(m.description)}</p>
                                    </div>
                                </div>
                            </div>

                            ${canEdit ? `<button onclick="toggleEditMarket()" id="edit-market-btn" class="text-xs text-shark-600 font-medium hover:text-shark-800 mb-4">Edit market</button>
                            <div id="edit-market-form" class="hidden mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                                <input type="text" id="edit-title" value="${esc(m.title)}" maxlength="200" class="w-full px-3 py-2 border rounded-lg text-sm"/>
                                <textarea id="edit-desc" rows="3" maxlength="5000" class="w-full px-3 py-2 border rounded-lg text-sm">${esc(m.description)}</textarea>
                                <input type="date" id="edit-closes" value="${(m.closes_at || '').split('T')[0]}" class="px-3 py-2 border rounded-lg text-sm"/>
                                <div class="flex gap-2">
                                    <button onclick="handleEditMarket(${m.id})" id="save-edit-btn" class="bg-shark-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Save</button>
                                    <button onclick="toggleEditMarket()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                                </div>
                            </div>` : ''}

                            <div class="mb-4">
                                ${isMulti ? `
                                <div class="mb-2">
                                    <span class="text-sm text-gray-500">${isResolved ? 'Final probabilities' : 'Current probabilities'}</span>
                                </div>
                                ${Components.probBarMulti(options, probs)}
                                ` : `
                                <div class="flex items-center justify-between mb-2">
                                    ${m.traders === 0 && !isResolved ? `
                                        <span class="text-xl sm:text-2xl font-bold text-gray-400">50%</span>
                                        <span class="text-sm text-gray-400">No trades yet — starting price</span>
                                    ` : `
                                        <span class="text-2xl sm:text-3xl font-bold ${pct >= 50 ? 'text-green-600' : 'text-red-500'}">${pct}%</span>
                                        <span class="text-sm text-gray-500">${isResolved ? 'Final' : 'chance of YES'}</span>
                                    `}
                                </div>
                                ${Components.probBar(m.probability)}
                                `}
                            </div>
                            <div class="mt-6">
                                <h3 class="text-sm font-semibold text-gray-700 mb-2">Price History</h3>
                                <div class="bg-gray-50 rounded-lg p-3 sm:p-4">${isMulti ? Components.chartMulti(m.history, m.options) : Components.chart(m.history)}</div>
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
                                            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${p.direction === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${(p.direction || '?').toUpperCase()}</span>
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
                                <input type="text" id="comment-input" placeholder="Share your insight..." maxlength="2000" onkeydown="if(event.key==='Enter') handleAddComment(${m.id})" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500"/>
                                <button onclick="handleAddComment(${m.id})" id="comment-btn" class="bg-shark-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-shark-700 transition-colors shrink-0">Post</button>
                            </div>` : ''}
                            <div class="space-y-4" id="comments-list">
                                ${comments.length > 0 ? comments.slice(0, AppState._commentsShown || 10).map(c => {
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
                                                ${canDelete ? `<button onclick="handleDeleteComment(${c.id})" class="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">delete</button>` : ''}
                                            </div>
                                            <p class="text-sm text-gray-600 mt-1 break-words">${esc(c.text)}</p>
                                        </div>
                                    </div>`;
                                }).join('') : '<div class="text-sm text-gray-400 text-center py-4">No comments yet.</div>'}
                                ${comments.length > (AppState._commentsShown || 10) ? `
                                <button onclick="handleShowMoreComments()" class="w-full text-center text-sm text-shark-600 font-medium hover:text-shark-800 py-2">Show more (${comments.length - (AppState._commentsShown || 10)} remaining)</button>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar -->
                    <div class="space-y-4 sm:space-y-6">
                        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            ${isResolved ? `
                                <h3 class="font-semibold text-gray-900 mb-4">Market Resolved</h3>
                                ${isMulti ? (() => {
                                    const winIdx = parseInt(m.resolution);
                                    const isVoid = m.resolution === 'void' || isNaN(winIdx);
                                    const winLabel = !isVoid && options[winIdx] ? options[winIdx].label : 'VOIDED';
                                    return `<div class="text-center p-4 rounded-lg ${isVoid ? 'bg-gray-50' : 'bg-green-50'}">
                                        <div class="text-2xl font-bold ${isVoid ? 'text-gray-600' : 'text-green-600'}">${isVoid ? 'VOIDED' : esc(winLabel)}</div>
                                        <div class="text-sm text-gray-500 mt-1">Resolved ${getTimeAgo(m.resolved_at)}</div>
                                    </div>`;
                                })() : `
                                <div class="text-center p-4 rounded-lg ${m.resolution === 'yes' ? 'bg-green-50' : m.resolution === 'no' ? 'bg-red-50' : 'bg-gray-50'}">
                                    <div class="text-3xl font-bold ${m.resolution === 'yes' ? 'text-green-600' : m.resolution === 'no' ? 'text-red-600' : 'text-gray-600'}">${m.resolution.toUpperCase()}</div>
                                    <div class="text-sm text-gray-500 mt-1">Resolved ${getTimeAgo(m.resolved_at)}</div>
                                </div>`}
                            ` : canTrade ? `
                                <h3 class="font-semibold text-gray-900 mb-3">Make a Prediction</h3>
                                ${(() => {
                                    const hoursLeft = (new Date(m.closes_at) - new Date()) / 3600000;
                                    if (hoursLeft <= 1 && hoursLeft > 0) return '<div class="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3 text-xs text-amber-700 font-medium">⚠ This market closes in less than 1 hour!</div>';
                                    if (hoursLeft <= 24 && hoursLeft > 0) return '<div class="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3 text-xs text-amber-600">Closing soon — less than 24 hours left</div>';
                                    return '';
                                })()}
                                <div class="space-y-4">
                                    <div>
                                        <label class="block text-sm text-gray-600 mb-1">Amount (tokens)</label>
                                        <input type="range" id="pred-slider" min="10" max="${Math.min(AppState.user?.balance || 500, 500)}" step="10" value="50"
                                            oninput="document.getElementById('pred-amount').value=this.value; updateTradeEstimate(${m.id})"
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-shark-600"/>
                                        <div class="flex items-center gap-2 mt-2">
                                            <input type="number" id="pred-amount" value="50" min="10" max="${AppState.user?.balance || 0}" step="10"
                                                oninput="document.getElementById('pred-slider').value=Math.min(this.value,${Math.min(AppState.user?.balance || 500, 500)}); updateTradeEstimate(${m.id})"
                                                onkeydown="if(event.key==='Enter'){event.preventDefault()}"
                                                class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-shark-500"/>
                                            <span class="text-xs text-gray-400">of ${(AppState.user?.balance || 0).toLocaleString()}t</span>
                                            <div class="flex gap-1 ml-auto">
                                                ${[25, 50, 100].map(v => `<button onclick="document.getElementById('pred-amount').value=${v};document.getElementById('pred-slider').value=${v};updateTradeEstimate(${m.id})" class="px-2 py-1 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600">${v}</button>`).join('')}
                                            </div>
                                        </div>
                                    </div>
                                    <div id="trade-estimate" class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                                        ${isMulti ? _tradeEstimateHTMLMulti(m.q_values || [], options, 50) : _tradeEstimateHTML(qYes, qNo, 50)}
                                    </div>
                                    ${isMulti ? `
                                    <div class="space-y-2">
                                        ${options.map((opt, i) => {
                                            const optPct = Math.round((probs[i] || 0) * 100);
                                            const btnColors = ['bg-blue-500 hover:bg-blue-600', 'bg-green-500 hover:bg-green-600', 'bg-amber-500 hover:bg-amber-600', 'bg-red-500 hover:bg-red-600', 'bg-purple-500 hover:bg-purple-600', 'bg-pink-500 hover:bg-pink-600', 'bg-cyan-500 hover:bg-cyan-600', 'bg-indigo-500 hover:bg-indigo-600'];
                                            return `<button onclick="handlePrediction(${m.id}, '${escAttr(opt.label)}', ${i})" id="btn-opt-${i}-${m.id}" class="prediction-btn w-full ${btnColors[i % btnColors.length]} text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-between px-4">
                                                <span>${esc(opt.label)}</span>
                                                <span class="text-xs font-normal opacity-80">${optPct}%</span>
                                            </button>`;
                                        }).join('')}
                                    </div>
                                    ` : `
                                    <div class="grid grid-cols-2 gap-3">
                                        <button onclick="handlePrediction(${m.id}, 'yes')" id="btn-yes-${m.id}" class="prediction-btn bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold text-sm">
                                            YES ↑<div class="text-xs font-normal opacity-80">at ${pct}%</div>
                                        </button>
                                        <button onclick="handlePrediction(${m.id}, 'no')" id="btn-no-${m.id}" class="prediction-btn bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold text-sm">
                                            NO ↓<div class="text-xs font-normal opacity-80">at ${100 - pct}%</div>
                                        </button>
                                    </div>
                                    `}
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
                                    const sellValue = canTrade ? (isMulti ? AMM.sellRevenueMulti(m.q_values || [], p.shares, p.option_index) : AMM.sellRevenue(qYes, qNo, p.shares, p.direction)) : 0;
                                    const profit = Math.round(sellValue) - p.amount;
                                    return `<div class="bg-gray-50 rounded-lg p-3">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${p.direction === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${(p.direction || '?').toUpperCase()}</span>
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
                                        <button onclick="handleSellPosition(${p.id})" id="sell-btn-${p.id}" class="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 rounded-lg text-xs font-semibold transition-colors">Sell Position</button>
                                        ` : ''}
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>` : ''}

                        ${canResolve && !isResolved ? `
                        <div class="bg-white rounded-xl border-2 border-amber-200 p-4 sm:p-6">
                            <h3 class="font-semibold text-gray-900 mb-2">Resolve Market</h3>
                            <p class="text-xs text-gray-500 mb-4">This will trigger payouts and cannot be undone.</p>
                            ${isMulti ? `
                            <div class="space-y-2">
                                ${options.map((opt, i) => `
                                    <button onclick="handleResolveMarket(${m.id}, '${i}', ${i})" id="resolve-opt-${i}-${m.id}" class="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-bold text-left px-4">${esc(opt.label)} wins</button>
                                `).join('')}
                                <button onclick="handleResolveMarket(${m.id}, 'void', -1)" id="resolve-void-${m.id}" class="w-full bg-gray-400 hover:bg-gray-500 text-white py-2 rounded-lg text-sm font-bold">VOID</button>
                            </div>
                            ` : `
                            <div class="grid grid-cols-3 gap-2">
                                <button onclick="handleResolveMarket(${m.id}, 'yes')" id="resolve-yes-${m.id}" class="bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-bold">YES</button>
                                <button onclick="handleResolveMarket(${m.id}, 'no')" id="resolve-no-${m.id}" class="bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-bold">NO</button>
                                <button onclick="handleResolveMarket(${m.id}, 'void')" id="resolve-void-${m.id}" class="bg-gray-400 hover:bg-gray-500 text-white py-2 rounded-lg text-sm font-bold">VOID</button>
                            </div>
                            `}
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

                ${canTrade ? `
                <!-- Mobile sticky trade bar -->
                <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex items-center gap-2 lg:hidden z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
                    <div class="flex-1 text-xs text-gray-500 min-w-0">
                        ${isMulti ? `<span class="font-bold text-gray-900">${options.length} options</span> · ` : `<span class="font-bold text-gray-900">${pct}%</span> YES · `}<span class="truncate">${(AppState.user?.balance || 0).toLocaleString()}t bal</span>
                    </div>
                    ${isMulti ? options.slice(0, 3).map((opt, i) => {
                        const btnColors = ['bg-blue-500', 'bg-green-500', 'bg-amber-500'];
                        return `<button onclick="handlePrediction(${m.id}, '${escAttr(opt.label)}', ${i})" class="${btnColors[i % 3]} text-white px-3 py-2 rounded-lg text-xs font-bold truncate max-w-[80px]">${esc(opt.label)}</button>`;
                    }).join('') : `
                    <button onclick="handlePrediction(${m.id}, 'yes')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold">YES</button>
                    <button onclick="handlePrediction(${m.id}, 'no')" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold">NO</button>
                    `}
                </div>` : ''}
            </div>`;
    },

    // ==================== LEADERBOARD ====================
    leaderboard() {
        const lb = AppState.leaderboard;
        const top3 = lb.slice(0, 3);
        const tab = AppState.leaderboardTab || 'individual';

        return `
            <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Leaderboard</h1>
                <p class="text-gray-500 text-sm mb-4">Top forecasters ranked by points earned from correct predictions.</p>

                <!-- Incentives Banner -->
                <div class="bg-gradient-to-r from-shark-700 via-shark-600 to-shark-500 rounded-xl p-4 sm:p-5 mb-6 text-white">
                    <div class="flex items-start justify-between flex-wrap gap-3">
                        <div>
                            <h2 class="font-bold text-lg sm:text-xl mb-1">Quarterly Prize Pool</h2>
                            <p class="text-shark-200 text-sm">Win real prizes for accurate forecasting. Awards reset each quarter.</p>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl sm:text-3xl font-bold">~$500+</div>
                            <div class="text-shark-200 text-xs">in prizes per quarter</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                        <div class="bg-white/10 rounded-lg px-3 py-2">
                            <div class="text-sm font-semibold">🏆 Top Forecaster</div>
                            <div class="text-xs text-shark-200">$150-200 gift card</div>
                        </div>
                        <div class="bg-white/10 rounded-lg px-3 py-2">
                            <div class="text-sm font-semibold">🎯 Sharpest Mind</div>
                            <div class="text-xs text-shark-200">$100-150 gift card</div>
                        </div>
                        <div class="bg-white/10 rounded-lg px-3 py-2">
                            <div class="text-sm font-semibold">📈 Best ROI</div>
                            <div class="text-xs text-shark-200">$75-100 gift card</div>
                        </div>
                        <div class="bg-white/10 rounded-lg px-3 py-2">
                            <div class="text-sm font-semibold">⚡ Volume King</div>
                            <div class="text-xs text-shark-200">$50 gift card</div>
                        </div>
                        <div class="bg-white/10 rounded-lg px-3 py-2">
                            <div class="text-sm font-semibold">💡 Best Question</div>
                            <div class="text-xs text-shark-200">$50 gift card</div>
                        </div>
                        <div class="bg-white/10 rounded-lg px-3 py-2">
                            <div class="text-sm font-semibold">🏅 Dept Champion</div>
                            <div class="text-xs text-shark-200">Team lunch $100-150</div>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-4 mt-3 text-xs text-shark-200">
                        <span>🥉 10 predictions = $10 coffee card</span>
                        <span>🥈 25 predictions = $15 coffee card</span>
                        <span>💎 50 predictions = $15 coffee card</span>
                        <span>🔥 Weekly streak = $25 bonus</span>
                        <span>🎟️ 5+ predictions = raffle entry ($50)</span>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="flex gap-1 mb-6 sm:mb-8 bg-gray-100 rounded-lg p-1 max-w-md">
                    <button onclick="AppState.setLeaderboardTab('individual')" class="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'individual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">Individual</button>
                    <button onclick="AppState.setLeaderboardTab('departments')" class="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'departments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">Departments</button>
                    <button onclick="AppState.setLeaderboardTab('awards')" class="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'awards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">Awards</button>
                </div>

                ${tab === 'awards' ? this._awardsTab() : tab === 'departments' ? this._departmentLeaderboard() : `
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
                `}
            </div>`;
    },

    _departmentLeaderboard() {
        const depts = AppState.getDepartmentLeaderboard();
        const medals = ['🥇', '🥈', '🥉'];
        if (depts.length === 0) return '<div class="text-center py-12 text-gray-400">No department data yet.</div>';

        return `
            <div class="grid gap-3 sm:gap-4">
                ${depts.map((d, idx) => {
                    const top = d.topPlayer;
                    return `<div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 card-hover">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-3">
                                <span class="text-xl sm:text-2xl font-bold ${idx < 3 ? 'text-shark-600' : 'text-gray-400'}">${idx < 3 ? medals[idx] : '#' + (idx + 1)}</span>
                                <div>
                                    <h3 class="font-bold text-gray-900 text-sm sm:text-base">${esc(d.department)}</h3>
                                    <span class="text-xs text-gray-500">${d.members} member${d.members !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-lg sm:text-xl font-bold text-shark-600">${d.totalPoints.toLocaleString()}</div>
                                <div class="text-xs text-gray-500">points</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between text-sm">
                            <div class="flex items-center gap-4">
                                <span class="text-gray-500">Avg accuracy: <span class="font-semibold text-gray-700">${Math.round(d.avgAccuracy * 100)}%</span></span>
                            </div>
                            ${top ? `<div class="flex items-center gap-2 text-xs text-gray-500">
                                Top: ${Components.avatar(top.avatar || top.name || 'XX', 'sm')}
                                <span class="font-medium text-gray-700 cursor-pointer hover:text-shark-600" onclick="AppState.navigate('profile', { profileId: '${top.id}' })">${esc(top.name)}</span>
                                <span class="text-gray-400">${top.points.toLocaleString()}pts</span>
                            </div>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
    },

    _awardsTab() {
        // Load awards data (async, will re-render when ready)
        if (!AppState._awardsData) {
            AppState._awardsLoading = true;
            AppState.computeQuarterlyAwards(0).then(data => {
                AppState._awardsData = data;
                AppState._awardsLoading = false;
                AppState.notify();
            }).catch(err => {
                console.warn('Awards load error:', err);
                AppState._awardsLoading = false;
                AppState._awardsData = null;
                AppState.notify();
            });
            return '<div class="text-center py-12"><div class="inline-block w-6 h-6 border-2 border-shark-600 border-t-transparent rounded-full animate-spin mb-3"></div><p class="text-gray-500 text-sm">Loading award standings...</p></div>';
        }

        const data = AppState._awardsData;
        if (!data || data.stats.totalPredictions === 0) {
            return '<div class="text-center py-12 text-gray-400">No predictions this quarter yet. Start trading to compete for awards!</div>';
        }

        const { quarter, awards, milestones, streaks, raffleEligible, stats, leaderboard: qLb } = data;

        return `
            <div class="space-y-6">
                <!-- Quarter Header -->
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-lg font-bold text-gray-900">${quarter} Award Standings</h2>
                        <p class="text-sm text-gray-500">Live standings — updated in real time as markets resolve</p>
                    </div>
                    <button onclick="AppState._awardsData = null; AppState.notify()" class="text-xs text-shark-600 hover:text-shark-700 font-medium px-3 py-1.5 rounded-lg bg-shark-50 hover:bg-shark-100 transition-colors">↻ Refresh</button>
                </div>

                <!-- Quarter Stats -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <div class="text-xl sm:text-2xl font-bold text-gray-900">${stats.participants}</div>
                        <div class="text-xs text-gray-500">Participants</div>
                    </div>
                    <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <div class="text-xl sm:text-2xl font-bold text-gray-900">${stats.totalPredictions}</div>
                        <div class="text-xs text-gray-500">Predictions</div>
                    </div>
                    <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <div class="text-xl sm:text-2xl font-bold text-gray-900">${stats.marketsCreated}</div>
                        <div class="text-xs text-gray-500">Markets</div>
                    </div>
                    <div class="bg-white rounded-xl border border-gray-200 p-3 text-center">
                        <div class="text-xl sm:text-2xl font-bold text-gray-900">${stats.avgAccuracy}%</div>
                        <div class="text-xs text-gray-500">Avg Accuracy</div>
                    </div>
                </div>

                <!-- Main Awards -->
                <div>
                    <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Award Leaders</h3>
                    <div class="grid sm:grid-cols-2 gap-3">
                        ${awards.map(a => `
                            <div class="bg-white rounded-xl border border-gray-200 p-4 card-hover">
                                <div class="flex items-start justify-between mb-3">
                                    <div class="flex items-center gap-2">
                                        <span class="text-2xl">${a.emoji}</span>
                                        <div>
                                            <div class="font-bold text-gray-900 text-sm">${a.title}</div>
                                            <div class="text-xs text-gray-400">${a.description}</div>
                                        </div>
                                    </div>
                                    <span class="text-xs font-medium text-shark-600 bg-shark-50 px-2 py-1 rounded-full">${esc(a.prize)}</span>
                                </div>
                                <div class="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                                    ${typeof a.winner.avatar === 'string' && a.winner.avatar.length <= 4
                                        ? Components.avatar(a.winner.avatar, 'md')
                                        : `<span class="text-2xl">${a.winner.avatar}</span>`}
                                    <div class="flex-1 min-w-0">
                                        <div class="font-semibold text-gray-900 text-sm truncate">${esc(a.winner.name)}</div>
                                        <div class="text-xs text-gray-500 truncate">${esc(a.winner.department)}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-sm font-bold text-shark-600">${a.metric}</div>
                                        <div class="text-[10px] text-gray-400 uppercase">Current leader</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                        ${awards.length === 0 ? '<div class="col-span-2 text-center py-8 text-gray-400">No resolved predictions yet this quarter. Awards will appear as markets resolve.</div>' : ''}
                    </div>
                </div>

                <!-- Quarterly Points Leaderboard -->
                ${qLb.length > 0 ? `
                <div>
                    <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">${quarter} Points Ranking</h3>
                    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table class="w-full">
                            <thead><tr class="border-b border-gray-100">
                                <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-10">#</th>
                                <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Forecaster</th>
                                <th class="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">Record</th>
                                <th class="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">Accuracy</th>
                                <th class="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">ROI</th>
                                <th class="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Points</th>
                            </tr></thead>
                            <tbody>
                                ${qLb.map((u, i) => {
                                    const isUser = u.userId === AppState.user?.id;
                                    return `<tr class="border-b border-gray-50 ${isUser ? 'bg-shark-50' : 'hover:bg-gray-50'}">
                                        <td class="px-3 py-2.5"><span class="text-sm font-bold ${i < 3 ? 'text-shark-600' : 'text-gray-400'}">${i + 1}</span></td>
                                        <td class="px-3 py-2.5">
                                            <div class="flex items-center gap-2">
                                                ${Components.avatar(u.avatar, 'sm')}
                                                <div class="min-w-0">
                                                    <div class="text-sm font-semibold text-gray-900 truncate">${esc(u.name)} ${isUser ? '<span class="text-xs text-shark-600">(You)</span>' : ''}</div>
                                                    <div class="text-xs text-gray-500 truncate">${esc(u.department)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-3 py-2.5 text-right hidden sm:table-cell"><span class="text-sm text-gray-600">${u.wins}W-${u.losses}L</span></td>
                                        <td class="px-3 py-2.5 text-right hidden sm:table-cell"><span class="text-sm ${u.accuracy >= 0.6 ? 'text-green-600 font-medium' : 'text-gray-600'}">${Math.round(u.accuracy * 100)}%</span></td>
                                        <td class="px-3 py-2.5 text-right hidden sm:table-cell"><span class="text-sm ${u.roi >= 0 ? 'text-green-600' : 'text-red-500'}">${u.roi >= 0 ? '+' : ''}${Math.round(u.roi * 100)}%</span></td>
                                        <td class="px-3 py-2.5 text-right"><span class="text-sm font-bold">${u.points}</span></td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}

                <!-- Participation Rewards -->
                <div class="grid sm:grid-cols-3 gap-4">
                    <!-- Milestones -->
                    <div class="bg-white rounded-xl border border-gray-200 p-4">
                        <h3 class="font-bold text-gray-900 text-sm mb-3">🎖️ Milestones</h3>
                        <p class="text-xs text-gray-400 mb-3">Reach prediction counts for coffee cards</p>
                        ${milestones.length > 0 ? `
                            <div class="space-y-2">
                                ${milestones.slice(0, 8).map(m => `
                                    <div class="flex items-center gap-2">
                                        ${Components.avatar(m.avatar, 'sm')}
                                        <div class="flex-1 min-w-0">
                                            <div class="text-xs font-semibold text-gray-900 truncate">${esc(m.name)}</div>
                                            <div class="text-[10px] text-gray-500">${m.count} predictions · ${m.emoji} ${m.label}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="text-xs text-gray-400 text-center py-4">No one has hit 10 predictions yet</div>'}
                    </div>

                    <!-- Streaks -->
                    <div class="bg-white rounded-xl border border-gray-200 p-4">
                        <h3 class="font-bold text-gray-900 text-sm mb-3">🔥 Weekly Streaks</h3>
                        <p class="text-xs text-gray-400 mb-3">Trade every week for a $25 bonus</p>
                        ${streaks.length > 0 ? `
                            <div class="space-y-2">
                                ${streaks.slice(0, 8).map(s => `
                                    <div class="flex items-center gap-2">
                                        ${Components.avatar(s.avatar, 'sm')}
                                        <div class="flex-1 min-w-0">
                                            <div class="text-xs font-semibold text-gray-900 truncate">${esc(s.name)}</div>
                                            <div class="text-[10px] text-gray-500">${s.weeksActive}/${s.weeksTotal} weeks active</div>
                                        </div>
                                        <span class="text-xs font-bold text-orange-500">🔥</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="text-xs text-gray-400 text-center py-4">Trade 4+ weeks in a row to qualify</div>'}
                    </div>

                    <!-- Raffle -->
                    <div class="bg-white rounded-xl border border-gray-200 p-4">
                        <h3 class="font-bold text-gray-900 text-sm mb-3">🎟️ Raffle Pool</h3>
                        <p class="text-xs text-gray-400 mb-3">5+ predictions = entry for $50 draw</p>
                        ${raffleEligible.length > 0 ? `
                            <div class="text-center mb-3">
                                <span class="text-2xl font-bold text-purple-600">${raffleEligible.length}</span>
                                <span class="text-xs text-gray-500 block">eligible entries</span>
                            </div>
                            <div class="space-y-1.5 max-h-40 overflow-y-auto">
                                ${raffleEligible.slice(0, 10).map(r => `
                                    <div class="flex items-center gap-2">
                                        ${Components.avatar(r.avatar, 'sm')}
                                        <span class="text-xs text-gray-700 truncate flex-1">${esc(r.name)}</span>
                                        <span class="text-[10px] text-gray-400">${r.count} preds</span>
                                    </div>
                                `).join('')}
                                ${raffleEligible.length > 10 ? `<div class="text-xs text-gray-400 text-center">+${raffleEligible.length - 10} more</div>` : ''}
                            </div>
                        ` : '<div class="text-xs text-gray-400 text-center py-4">Make 5+ predictions to enter</div>'}
                    </div>
                </div>

                <!-- How It Works -->
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 class="font-bold text-blue-700 text-sm mb-2">How Quarterly Awards Work</h3>
                    <div class="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-blue-700">
                        <div>• Awards are calculated from resolved predictions only</div>
                        <div>• Sharpest Mind requires min 10 resolved predictions</div>
                        <div>• Best ROI requires min 5 resolved predictions</div>
                        <div>• Department Champion requires 3+ members</div>
                        <div>• Weekly Streak requires 4+ consecutive weeks</div>
                        <div>• Same person can win multiple awards</div>
                    </div>
                </div>
            </div>
        `;
    },

    // ==================== CREATE MARKET ====================
    create() {
        return `
            <div class="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Create a New Market</h1>
                <p class="text-gray-500 text-sm mb-4">Create a market for the team.${AppState.user?.is_admin ? '' : ' Markets require admin approval before going live.'}</p>

                <!-- Templates -->
                <div class="mb-6">
                    <div class="text-xs font-semibold text-gray-500 uppercase mb-2">Start from a template</div>
                    <div class="flex gap-2 flex-wrap">
                        ${MARKET_TEMPLATES.map((t, i) => `
                            <button onclick="applyMarketTemplate(${i})" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-shark-100 hover:text-shark-700 transition-colors">${esc(t.label)}</button>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-5">
                    <!-- Market Type Toggle -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Market Type</label>
                        <div class="flex gap-2">
                            <button onclick="toggleMarketType('binary')" id="type-binary" class="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border-2 border-shark-600 bg-shark-50 text-shark-700">Yes / No</button>
                            <button onclick="toggleMarketType('multi')" id="type-multi" class="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border-2 border-gray-200 text-gray-500 hover:border-gray-300">Multiple Choice</button>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Question * <span class="font-normal text-gray-400" id="title-count">0/200</span></label>
                        <input type="text" id="create-title" placeholder="Will [specific outcome] happen by [date]?" maxlength="200"
                            oninput="document.getElementById('title-count').textContent=this.value.length+'/200'"
                            onkeydown="if(event.key==='Enter') event.preventDefault()"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent"/>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Resolution Criteria & Description * <span class="font-normal text-gray-400" id="desc-count">0/5000</span></label>
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2 text-xs text-blue-700">
                            <div class="font-semibold mb-1">Tips for clear resolution criteria:</div>
                            <ul class="list-disc ml-4 space-y-0.5">
                                <li><strong>Be specific:</strong> Define exactly what outcome counts as YES vs NO</li>
                                <li><strong>Name your source:</strong> e.g. "Per the Q3 earnings report" or "As announced in #general Slack"</li>
                                <li><strong>Set a deadline:</strong> "By end of day March 31, 2026"</li>
                                <li><strong>Edge cases:</strong> What happens if the event is delayed, cancelled, or ambiguous?</li>
                            </ul>
                        </div>
                        <textarea id="create-desc" rows="5" maxlength="5000" placeholder="Resolution criteria: This market resolves YES if [specific condition] as confirmed by [source of truth] by [date]. It resolves NO if [condition is not met]. If [edge case], the market will be voided.

Background: [Provide relevant context for traders]"
                            oninput="document.getElementById('desc-count').textContent=this.value.length+'/5000'"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500 focus:border-transparent resize-none"></textarea>
                    </div>
                    <!-- Multi-outcome options (hidden by default) -->
                    <div id="multi-options-section" class="hidden">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">Options * <span class="font-normal text-gray-400">2-8 choices</span></label>
                        <div id="multi-options-list" class="space-y-2">
                            <div class="flex gap-2"><input type="text" class="multi-option-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500" placeholder="Option 1" maxlength="100"/></div>
                            <div class="flex gap-2"><input type="text" class="multi-option-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500" placeholder="Option 2" maxlength="100"/></div>
                        </div>
                        <button onclick="addMultiOption()" class="mt-2 text-sm text-shark-600 font-medium hover:text-shark-800">+ Add option</button>
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
                            onclick="${n.market_id ? `handleNotificationClick(${n.id}, ${n.market_id})` : `handleMarkNotifRead(${n.id})`}">
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
        const preds = (isOwnProfile ? AppState.userPredictions : AppState.viewingProfilePredictions) || [];
        const rank = AppState.leaderboard.findIndex(l => l.id === p.id) + 1;
        const wonPreds = preds.filter(pr => pr.status === 'won');
        const lostPreds = preds.filter(pr => pr.status === 'lost');
        const activePreds = preds.filter(pr => pr.status === 'active');
        const soldPreds = preds.filter(pr => pr.status === 'sold');

        return `
            <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                    <div class="flex items-center gap-4">
                        <div class="relative group">
                            ${Components.avatar(p.avatar || p.name || 'XX', 'lg')}
                            ${isOwnProfile ? `<button onclick="document.getElementById('avatar-picker').classList.toggle('hidden')" class="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors cursor-pointer">
                                <span class="text-white opacity-0 group-hover:opacity-100 text-xs font-bold transition-opacity">Edit</span>
                            </button>` : ''}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h1 class="text-xl sm:text-2xl font-bold text-gray-900 truncate">${esc(p.name)} ${isOwnProfile ? '<span class="text-sm text-shark-600 font-normal">(You)</span>' : ''}</h1>
                            <p class="text-gray-500 truncate">${esc(p.department)}</p>
                            ${p.is_admin ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 mt-1">Admin</span>' : ''}
                        </div>
                    </div>
                    ${isOwnProfile ? `
                    <div id="avatar-picker" class="hidden mt-4 p-3 bg-gray-50 rounded-lg">
                        <div class="text-xs font-semibold text-gray-500 uppercase mb-2">Choose an avatar</div>
                        <div class="flex flex-wrap gap-2">
                            ${AVATAR_PRESETS.map(emoji => `
                                <button onclick="handleSetAvatar('${emoji}')" class="w-10 h-10 rounded-full bg-white border-2 ${p.avatar === emoji ? 'border-shark-500 ring-2 ring-shark-200' : 'border-gray-200 hover:border-shark-300'} flex items-center justify-center text-xl transition-colors">${emoji}</button>
                            `).join('')}
                            <button onclick="handleSetAvatar('${initials(p.name)}')" class="w-10 h-10 rounded-full bg-shark-600 text-white border-2 ${!AVATAR_PRESETS.includes(p.avatar) ? 'border-shark-500 ring-2 ring-shark-200' : 'border-transparent'} flex items-center justify-center text-xs font-bold">${initials(p.name)}</button>
                        </div>
                    </div>` : ''}
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
                    </div>
                    <div class="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div class="text-xs font-semibold text-gray-500 uppercase mb-1.5">Referral Link</div>
                        <div class="flex items-center gap-2">
                            <input type="text" readonly value="${esc(AppState.getReferralLink())}" class="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 truncate" id="referral-link-input"/>
                            <button onclick="navigator.clipboard.writeText(document.getElementById('referral-link-input').value).then(() => showToast('Referral link copied!', 'success'))" class="px-3 py-1.5 bg-shark-600 text-white rounded-lg text-xs font-medium hover:bg-shark-700 shrink-0">Copy</button>
                        </div>
                        <p class="text-xs text-gray-400 mt-1">Share this link — you both earn 100 tokens when someone signs up!</p>
                    </div>` : ''}
                </div>

                <!-- Achievements -->
                ${(() => {
                    const achievements = AppState.getAchievements(preds, p, rank);
                    const earned = achievements.filter(a => a.earned);
                    const locked = achievements.filter(a => !a.earned);
                    return `
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-3">Achievements <span class="text-sm font-normal text-gray-400">${earned.length}/${achievements.length}</span></h2>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                        ${earned.map(a => `
                            <div class="text-center p-2 sm:p-3 bg-gradient-to-b from-amber-50 to-white rounded-xl border border-amber-200" title="${esc(a.desc)}">
                                <div class="text-2xl sm:text-3xl mb-1">${a.icon}</div>
                                <div class="text-xs font-semibold text-gray-900 leading-tight">${esc(a.name)}</div>
                            </div>`).join('')}
                        ${locked.map(a => `
                            <div class="text-center p-2 sm:p-3 bg-gray-50 rounded-xl border border-gray-100 opacity-40" title="${esc(a.desc)}">
                                <div class="text-2xl sm:text-3xl mb-1 grayscale">🔒</div>
                                <div class="text-xs font-semibold text-gray-400 leading-tight">${esc(a.name)}</div>
                            </div>`).join('')}
                    </div>
                </div>`;
                })()}

                <!-- Calibration Chart -->
                ${(() => {
                    const calData = AppState.getCalibrationData(preds);
                    if (!calData) return '';
                    return `
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-2">Forecaster Calibration</h2>
                    <p class="text-xs text-gray-500 mb-4">When you say X%, how often are you right?</p>
                    <div class="flex items-end gap-2 sm:gap-4 h-40 px-4">
                        ${calData.map(b => {
                            const predH = Math.round(b.predicted * 100);
                            const actH = Math.round(b.actual * 100);
                            return `<div class="flex-1 flex flex-col items-center gap-1">
                                <div class="w-full flex items-end justify-center gap-1" style="height:128px">
                                    <div class="w-4 sm:w-6 bg-shark-200 rounded-t" style="height:${predH * 1.28}px" title="You said: ${predH}%"></div>
                                    <div class="w-4 sm:w-6 ${Math.abs(actH - predH) < 15 ? 'bg-green-500' : 'bg-red-400'} rounded-t" style="height:${actH * 1.28}px" title="Actual: ${actH}%"></div>
                                </div>
                                <div class="text-xs text-gray-500">${b.label}</div>
                                <div class="text-xs text-gray-400">(${b.count})</div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="flex items-center gap-4 mt-3 text-xs text-gray-500 justify-center">
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-shark-200 rounded"></span> Your confidence</span>
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-green-500 rounded"></span> Actual (good)</span>
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-red-400 rounded"></span> Actual (off)</span>
                    </div>
                </div>`;
                })()}

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
                            const fullMarket = AppState.markets.find(mk => mk.id === pr.market_id) || market;
                            const statusColors = { active: 'bg-blue-100 text-blue-700', won: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-700', sold: 'bg-gray-100 text-gray-600', voided: 'bg-gray-100 text-gray-600' };
                            return `<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg ${market.title ? 'cursor-pointer hover:bg-gray-100' : ''}" onclick="${market.title ? `AppState.navigate('market', { marketId: ${pr.market_id} })` : ''}">
                                <div class="flex-1 min-w-0 mr-3">
                                    <div class="text-sm font-medium text-gray-900 truncate">${esc(market.title || 'Unknown')}</div>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="px-1.5 py-0.5 rounded text-xs font-bold ${pr.direction === 'yes' ? 'bg-green-100 text-green-700' : pr.direction === 'no' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">${esc((pr.direction || '?').length > 12 ? (pr.direction || '?').slice(0, 12) + '…' : (pr.direction || '?')).toUpperCase()}</span>
                                        <span class="text-xs text-gray-500">${pr.amount}t · ${pr.shares?.toFixed(1) || '?'}sh</span>
                                        ${pr.status === 'active' && fullMarket.history ? Components.sparklinePnL(fullMarket, pr) : ''}
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
        const pending = AppState.pendingMarkets || [];
        const users = AppState.allUsers || [];
        const inactiveUsers = users.filter(u => !u.is_admin && (u.trades || 0) === 0);

        return `
            <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Admin Panel</h1>
                        <p class="text-gray-500 text-sm">Manage markets, users, and moderate content.</p>
                    </div>
                    <button onclick="AppState.navigate('analytics')" class="bg-shark-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-shark-700">Platform Analytics</button>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
                    ${Components.statCard('Pending', pending.length, 'Need approval', '📝')}
                    ${Components.statCard('Active', activeMarkets.length, '', '📊')}
                    ${Components.statCard('Expired', expiredMarkets.length, 'Need resolution', '⏰')}
                    ${Components.statCard('Resolved', resolvedMarkets.length, '', '✅')}
                    ${Components.statCard('Users', users.length, `${inactiveUsers.length} inactive`, '👥')}
                </div>

                <!-- Pending Approval -->
                ${pending.length > 0 ? `
                <div class="bg-white rounded-xl border-2 border-blue-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-blue-700 mb-4">📝 Pending Approval (${pending.length})</h2>
                    <div class="space-y-3">
                        ${pending.map(m => `
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-blue-50 rounded-lg gap-3">
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium text-gray-900">${esc(m.title)}</div>
                                    <div class="text-xs text-gray-500 mt-1">${esc(m.created_by_name || 'Unknown')} · ${esc(m.category)} · closes ${formatDate(m.closes_at)}</div>
                                    <div class="text-xs text-gray-500 mt-1 line-clamp-2">${esc(m.description)}</div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick="event.stopPropagation(); handleApproveMarket(${m.id})" class="px-3 py-1.5 rounded text-xs font-bold bg-green-500 text-white hover:bg-green-600">Approve</button>
                                    <button onclick="event.stopPropagation(); handleRejectMarket(${m.id})" class="px-3 py-1.5 rounded text-xs font-bold bg-red-500 text-white hover:bg-red-600">Reject</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                <!-- Expired needing resolution -->
                ${expiredMarkets.length > 0 ? `
                <div class="bg-white rounded-xl border-2 border-amber-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-amber-700 mb-4">⏰ Needs Resolution (${expiredMarkets.length})</h2>
                    <div class="space-y-3">
                        ${expiredMarkets.map(m => `
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-amber-50 rounded-lg gap-3">
                                <div class="flex-1 min-w-0 cursor-pointer" onclick="AppState.navigate('market', { marketId: ${m.id} })">
                                    <div class="text-sm font-medium text-gray-900 truncate">${esc(m.title)}</div>
                                    <div class="text-xs text-gray-500 mt-1">${m.traders} traders · ${m.volume} vol · expired ${formatDate(m.closes_at)}</div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick="event.stopPropagation(); handleResolveMarket(${m.id}, 'yes')" class="px-3 py-1.5 rounded text-xs font-bold bg-green-500 text-white hover:bg-green-600">YES</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket(${m.id}, 'no')" class="px-3 py-1.5 rounded text-xs font-bold bg-red-500 text-white hover:bg-red-600">NO</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket(${m.id}, 'void')" class="px-3 py-1.5 rounded text-xs font-bold bg-gray-400 text-white hover:bg-gray-500">VOID</button>
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
                                <div class="flex-1 min-w-0 cursor-pointer" onclick="AppState.navigate('market', { marketId: ${m.id} })">
                                    <div class="text-sm font-medium text-gray-900 truncate">${esc(m.title)}</div>
                                    <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                                        ${Components.probBadge(m.probability)}
                                        <span>${m.traders} traders</span>
                                        <span>${daysLeft(m.closes_at)}d left</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button onclick="event.stopPropagation(); AppState.setMarketTrending(${m.id}, ${!m.trending})" class="px-2 py-1 rounded text-xs font-medium ${m.trending ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}">${m.trending ? '🔥' : 'Trend'}</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket(${m.id}, 'yes')" class="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">Y</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket(${m.id}, 'no')" class="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700">N</button>
                                    <button onclick="event.stopPropagation(); handleResolveMarket(${m.id}, 'void')" class="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">V</button>
                                    <button onclick="event.stopPropagation(); handleDeleteMarket(${m.id})" class="px-2 py-1 rounded text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100" title="Delete market">🗑</button>
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

                <!-- Inactive Users -->
                ${inactiveUsers.length > 0 ? `
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mt-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-3">Inactive Users (${inactiveUsers.length})</h2>
                    <p class="text-xs text-gray-500 mb-3">Users who have never made a trade.</p>
                    <div class="flex flex-wrap gap-2">
                        ${inactiveUsers.slice(0, 20).map(u => `
                            <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100" onclick="AppState.navigate('profile', { profileId: '${u.id}' })">
                                ${Components.avatar(u.avatar || u.name || 'XX', 'sm')}
                                <div class="text-xs">
                                    <div class="font-medium text-gray-900">${esc(u.name)}</div>
                                    <div class="text-gray-400">${esc(u.department)}</div>
                                </div>
                            </div>
                        `).join('')}
                        ${inactiveUsers.length > 20 ? `<div class="flex items-center px-3 py-2 text-xs text-gray-400">+${inactiveUsers.length - 20} more</div>` : ''}
                    </div>
                </div>` : ''}

                <!-- Quarterly Prize Pool -->
                <div class="bg-white rounded-xl border-2 border-purple-200 p-4 sm:p-6 mt-6">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-lg font-bold text-purple-700">🏆 Quarterly Awards</h2>
                            <p class="text-xs text-gray-500 mt-1">Automated prize pool analysis for the most accurate forecasters.</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="handleRunQuarterlyAwards((AppState._quarterlyOffset || 0) - 1)" class="px-2 py-1.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">&larr; Prev</button>
                            <button onclick="handleRunQuarterlyAwards(0)" id="qtr-awards-btn" class="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700">Current Quarter</button>
                            <button onclick="handleRunQuarterlyAwards((AppState._quarterlyOffset || 0) + 1)" class="px-2 py-1.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">Next &rarr;</button>
                        </div>
                    </div>
                    <div id="qtr-awards-results">
                    ${(() => {
                        const r = AppState._quarterlyResults;
                        if (!r) return '<div class="text-sm text-gray-400">Click "Current Quarter" to generate awards.</div>';
                        if (r.stats.totalPredictions === 0) return `<div class="text-sm text-gray-400">No predictions in ${esc(r.quarter)}.</div>`;

                        return `
                            <div class="mb-4">
                                <div class="text-sm font-semibold text-gray-900 mb-2">${esc(r.quarter)} Results</div>
                                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                                    <div class="bg-purple-50 rounded-lg p-3 text-center">
                                        <div class="text-lg font-bold text-purple-700">${r.stats.totalPredictions}</div>
                                        <div class="text-xs text-gray-500">Predictions</div>
                                    </div>
                                    <div class="bg-purple-50 rounded-lg p-3 text-center">
                                        <div class="text-lg font-bold text-purple-700">${r.stats.resolvedPredictions}</div>
                                        <div class="text-xs text-gray-500">Resolved</div>
                                    </div>
                                    <div class="bg-purple-50 rounded-lg p-3 text-center">
                                        <div class="text-lg font-bold text-purple-700">${r.stats.participants}</div>
                                        <div class="text-xs text-gray-500">Participants</div>
                                    </div>
                                    <div class="bg-purple-50 rounded-lg p-3 text-center">
                                        <div class="text-lg font-bold text-purple-700">${r.stats.marketsCreated}</div>
                                        <div class="text-xs text-gray-500">Markets</div>
                                    </div>
                                    <div class="bg-purple-50 rounded-lg p-3 text-center">
                                        <div class="text-lg font-bold text-purple-700">${r.stats.totalVolume.toLocaleString()}</div>
                                        <div class="text-xs text-gray-500">Volume</div>
                                    </div>
                                    <div class="bg-purple-50 rounded-lg p-3 text-center">
                                        <div class="text-lg font-bold text-purple-700">${r.stats.avgAccuracy}%</div>
                                        <div class="text-xs text-gray-500">Avg Accuracy</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Top Awards -->
                            ${r.awards.length > 0 ? `
                            <div class="mb-5">
                                <div class="text-sm font-semibold text-gray-900 mb-2">Top Awards</div>
                                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    ${r.awards.map(a => `
                                        <div class="border border-purple-100 rounded-xl p-4 bg-gradient-to-br from-purple-50 to-white">
                                            <div class="flex items-center gap-2 mb-1">
                                                <span class="text-2xl">${a.emoji}</span>
                                                <div>
                                                    <div class="text-sm font-bold text-purple-800">${esc(a.title)}</div>
                                                    <div class="text-xs text-gray-500">${esc(a.description)}</div>
                                                </div>
                                            </div>
                                            ${a.prize ? `<div class="text-xs text-purple-600 font-medium mb-2 ml-10">Prize: ${esc(a.prize)}</div>` : ''}
                                            <div class="flex items-center gap-2 p-2 bg-white rounded-lg border border-purple-100">
                                                ${typeof a.winner.avatar === 'string' && a.winner.avatar.length <= 3 ? Components.avatar(a.winner.avatar, 'sm') : `<span class="text-xl">${a.winner.avatar}</span>`}
                                                <div class="flex-1 min-w-0">
                                                    <div class="text-sm font-semibold text-gray-900 truncate">${esc(a.winner.name)}</div>
                                                    <div class="text-xs text-gray-500">${esc(a.winner.department)}</div>
                                                </div>
                                                <div class="text-xs font-bold text-purple-700 shrink-0">${esc(a.metric)}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>` : ''}

                            <!-- Milestone Rewards + Streaks + Raffle in a 3-col layout -->
                            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                                <!-- Milestone Rewards -->
                                <div class="border border-green-100 rounded-xl p-4 bg-gradient-to-br from-green-50 to-white">
                                    <div class="text-sm font-bold text-green-800 mb-1">🎖️ Milestone Rewards</div>
                                    <div class="text-xs text-gray-500 mb-3">Earned by reaching prediction thresholds this quarter.</div>
                                    ${r.milestones.length > 0 ? `
                                        <div class="space-y-2 max-h-48 overflow-y-auto">
                                            ${r.milestones.map(m => `
                                                <div class="flex items-center gap-2 p-2 bg-white rounded-lg border border-green-100">
                                                    ${Components.avatar(m.avatar, 'sm')}
                                                    <div class="flex-1 min-w-0">
                                                        <div class="text-xs font-semibold text-gray-900 truncate">${esc(m.name)}</div>
                                                        <div class="text-xs text-gray-400">${esc(m.department)}</div>
                                                    </div>
                                                    <div class="text-right shrink-0">
                                                        <div class="text-xs font-bold text-green-700">${m.emoji} ${esc(m.label)}</div>
                                                        <div class="text-xs text-green-600">${esc(m.prize)}</div>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : '<div class="text-xs text-gray-400">No milestones reached yet.</div>'}
                                </div>

                                <!-- Consistency Streaks -->
                                <div class="border border-amber-100 rounded-xl p-4 bg-gradient-to-br from-amber-50 to-white">
                                    <div class="text-sm font-bold text-amber-800 mb-1">🔥 Consistency Streaks</div>
                                    <div class="text-xs text-gray-500 mb-3">Traded every week of the quarter. Prize: $15 gift card.</div>
                                    ${r.streaks.length > 0 ? `
                                        <div class="space-y-2 max-h-48 overflow-y-auto">
                                            ${r.streaks.map(s => `
                                                <div class="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-100">
                                                    ${Components.avatar(s.avatar, 'sm')}
                                                    <div class="flex-1 min-w-0">
                                                        <div class="text-xs font-semibold text-gray-900 truncate">${esc(s.name)}</div>
                                                        <div class="text-xs text-gray-400">${esc(s.department)}</div>
                                                    </div>
                                                    <div class="text-xs font-bold text-amber-700 shrink-0">${s.weeksActive}/${s.weeksTotal} wks</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : '<div class="text-xs text-gray-400">No full-quarter streaks yet.</div>'}
                                </div>

                                <!-- Raffle Eligible -->
                                <div class="border border-blue-100 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-white">
                                    <div class="text-sm font-bold text-blue-800 mb-1">🎲 Lucky Draw Eligible</div>
                                    <div class="text-xs text-gray-500 mb-3">5+ predictions = entered in $50 random draw.</div>
                                    ${r.raffleEligible.length > 0 ? `
                                        <div class="text-xs font-medium text-blue-700 mb-2">${r.raffleEligible.length} participant${r.raffleEligible.length !== 1 ? 's' : ''} eligible</div>
                                        <div class="space-y-1.5 max-h-48 overflow-y-auto">
                                            ${r.raffleEligible.map(u => `
                                                <div class="flex items-center gap-2 p-1.5 bg-white rounded border border-blue-50">
                                                    ${Components.avatar(u.avatar, 'sm')}
                                                    <div class="flex-1 min-w-0 text-xs text-gray-700 truncate">${esc(u.name)}</div>
                                                    <div class="text-xs text-blue-600 shrink-0">${u.count} preds</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : '<div class="text-xs text-gray-400">No eligible participants yet (need 5+ predictions).</div>'}
                                </div>
                            </div>

                            <!-- Quarterly Leaderboard -->
                            ${r.leaderboard.length > 0 ? `
                            <div>
                                <div class="text-sm font-semibold text-gray-900 mb-2">Quarterly Leaderboard (Top 10)</div>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <thead>
                                            <tr class="text-left text-xs text-gray-500 border-b">
                                                <th class="pb-2 pr-2">#</th>
                                                <th class="pb-2 pr-2">Forecaster</th>
                                                <th class="pb-2 pr-2 text-right">Points</th>
                                                <th class="pb-2 pr-2 text-right">W-L</th>
                                                <th class="pb-2 pr-2 text-right">Accuracy</th>
                                                <th class="pb-2 text-right">P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${r.leaderboard.map((u, i) => `
                                                <tr class="border-b border-gray-50 ${i < 3 ? 'font-semibold' : ''}">
                                                    <td class="py-2 pr-2 text-gray-400">${i + 1}</td>
                                                    <td class="py-2 pr-2">
                                                        <div class="flex items-center gap-2">
                                                            ${Components.avatar(u.avatar, 'sm')}
                                                            <div>
                                                                <div class="text-gray-900">${esc(u.name)}</div>
                                                                <div class="text-xs text-gray-400">${esc(u.department)}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td class="py-2 pr-2 text-right font-medium text-purple-700">${u.points}</td>
                                                    <td class="py-2 pr-2 text-right text-gray-600">${u.wins}-${u.losses}</td>
                                                    <td class="py-2 pr-2 text-right">${Math.round(u.accuracy * 100)}%</td>
                                                    <td class="py-2 text-right ${u.profit >= 0 ? 'text-green-600' : 'text-red-500'}">${u.profit >= 0 ? '+' : ''}${Math.round(u.profit)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>` : ''}
                        `;
                    })()}
                    </div>
                </div>

                <!-- Audit Log -->
                ${(() => {
                    const log = AppState.auditLog || [];
                    if (log.length === 0) return '';
                    const actionLabels = {
                        resolve_market: '✅ Resolved market',
                        approve_market: '👍 Approved market',
                        reject_market: '❌ Rejected market',
                        grant_admin: '🔑 Granted admin',
                        revoke_admin: '🔒 Revoked admin',
                        adjust_balance: '💰 Adjusted balance',
                    };
                    return `
                    <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mt-6">
                        <h2 class="text-lg font-bold text-gray-900 mb-4">Audit Log</h2>
                        <div class="space-y-2 max-h-96 overflow-y-auto">
                            ${log.slice(0, 50).map(e => {
                                const label = actionLabels[e.action] || e.action;
                                const detail = e.details?.title || e.details?.userName || e.details?.reason || '';
                                const extra = e.action === 'adjust_balance' && e.details?.amount ? ` (${e.details.amount > 0 ? '+' : ''}${e.details.amount}t)` : '';
                                const resolution = e.details?.resolution ? ` → ${e.details.resolution.toUpperCase()}` : '';
                                return `<div class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 text-sm">
                                    <div class="shrink-0 text-xs text-gray-400 w-28">${new Date(e.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                    <div class="flex-1 min-w-0">
                                        <span class="font-medium text-gray-700">${esc(label)}${resolution}</span>
                                        ${detail ? `<span class="text-gray-500"> — ${esc(detail)}${extra}</span>` : extra ? `<span class="text-gray-500">${extra}</span>` : ''}
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>`;
                })()}

                <!-- Balance Reconciliation -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mt-6">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg font-bold text-gray-900">Balance Reconciliation</h2>
                        <button onclick="handleRunReconciliation()" id="recon-btn" class="bg-shark-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-shark-700">Run Check</button>
                    </div>
                    <p class="text-xs text-gray-500 mb-3">Compares each user's balance against their transaction history to detect discrepancies.</p>
                    <div id="recon-results" class="text-sm text-gray-400">Click "Run Check" to analyze balances.</div>
                </div>
            </div>`;
    },

    // ==================== ANALYTICS ====================
    analytics() {
        const stats = AppState.getPlatformAnalytics();
        const cal = stats.calibration;

        return `
            <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Platform Analytics</h1>
                        <p class="text-gray-500 text-sm">Insights across all markets and forecasters.</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="handleExportMarkets()" class="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-200">Export Markets CSV</button>
                    </div>
                </div>

                <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    ${Components.statCard('Total Markets', stats.totalMarkets, `${stats.activeMarkets} active`, '📊')}
                    ${Components.statCard('Total Volume', stats.totalVolume.toLocaleString(), 'tokens traded', '💰')}
                    ${Components.statCard('Participation', Math.round(stats.participationRate * 100) + '%', 'markets with trades', '👥')}
                    ${Components.statCard('Resolved', stats.resolvedMarkets, 'markets', '✅')}
                </div>

                <!-- Volume by Category -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">Volume by Category</h2>
                    <div class="space-y-3">
                        ${Object.entries(stats.volByCategory).map(([catId, vol]) => {
                            const cat = Object.values(CATEGORIES).find(c => c.id === catId);
                            const maxVol = Math.max(...Object.values(stats.volByCategory), 1);
                            const pct = (vol / maxVol) * 100;
                            return `<div>
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="font-medium text-gray-700">${cat ? cat.icon + ' ' + cat.label : catId}</span>
                                    <span class="text-gray-500">${vol.toLocaleString()}t</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2.5">
                                    <div class="h-full rounded-full bg-shark-500" style="width:${pct}%"></div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Platform Calibration Chart -->
                <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-2">Platform Calibration</h2>
                    <p class="text-xs text-gray-500 mb-4">How well do market prices predict outcomes? Perfect calibration means the diagonal line.</p>
                    ${cal.some(b => b.count > 0) ? `
                    <div class="flex items-end gap-2 sm:gap-4 h-48 px-4">
                        ${cal.map(b => {
                            const predH = Math.round(b.predicted * 100);
                            const actH = b.count > 0 ? Math.round(b.actual * 100) : 0;
                            return `<div class="flex-1 flex flex-col items-center gap-1">
                                <div class="w-full flex items-end justify-center gap-1" style="height:160px">
                                    <div class="w-5 sm:w-8 bg-shark-200 rounded-t" style="height:${predH * 1.6}px" title="Predicted: ${predH}%"></div>
                                    <div class="w-5 sm:w-8 ${Math.abs(actH - predH) < 15 ? 'bg-green-500' : 'bg-red-400'} rounded-t" style="height:${actH * 1.6}px" title="Actual: ${actH}%"></div>
                                </div>
                                <div class="text-xs text-gray-500 text-center">${b.label}</div>
                                <div class="text-xs text-gray-400">(${b.count})</div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="flex items-center gap-4 mt-3 text-xs text-gray-500 justify-center">
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-shark-200 rounded"></span> Predicted</span>
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-green-500 rounded"></span> Actual (calibrated)</span>
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-red-400 rounded"></span> Actual (miscalibrated)</span>
                    </div>` : '<div class="text-center py-8 text-gray-400 text-sm">Not enough resolved markets for calibration data.</div>'}
                </div>

                <!-- Flagged Markets -->
                ${stats.flaggedMarkets.length > 0 ? `
                <div class="bg-white rounded-xl border-2 border-amber-200 p-4 sm:p-6 mb-6">
                    <h2 class="text-lg font-bold text-amber-700 mb-3">Flagged: No Activity (${stats.flaggedMarkets.length})</h2>
                    <p class="text-xs text-gray-500 mb-3">Active markets with 0 traders after 7+ days.</p>
                    <div class="space-y-2">
                        ${stats.flaggedMarkets.map(m => `
                            <div class="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100" onclick="AppState.navigate('market', { marketId: ${m.id} })">
                                <div class="text-sm font-medium text-gray-900 truncate flex-1 mr-3">${esc(m.title)}</div>
                                <span class="text-xs text-gray-500 shrink-0">${daysLeft(m.closes_at)}d left</span>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}
            </div>`;
    },

    // ==================== TRANSACTIONS ====================
    transactions() {
        const txns = AppState.transactions || [];
        const typeColors = {
            buy: 'bg-blue-100 text-blue-700',
            sell: 'bg-green-100 text-green-700',
            payout: 'bg-emerald-100 text-emerald-700',
            void_refund: 'bg-yellow-100 text-yellow-700',
            admin_adjust: 'bg-purple-100 text-purple-700',
            signup_bonus: 'bg-shark-100 text-shark-700',
        };

        return `
            <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Transaction History</h1>
                    <div class="flex gap-2">
                        <button onclick="handleExportTransactions()" class="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-200">Export CSV</button>
                        <button onclick="handleExportPredictions()" class="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-200">Export Predictions</button>
                        <button onclick="AppState.navigate('dashboard')" class="text-sm text-gray-500 hover:text-gray-700">← Dashboard</button>
                    </div>
                </div>
                <div class="bg-white rounded-xl border border-gray-200">
                    ${txns.length > 0 ? `
                    <div class="divide-y divide-gray-100">
                        ${txns.map(tx => `
                            <div class="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50">
                                <div class="flex items-center gap-3 min-w-0">
                                    <span class="px-2 py-0.5 rounded-full text-xs font-bold ${typeColors[tx.type] || 'bg-gray-100 text-gray-600'}">${tx.type.replace('_', ' ')}</span>
                                    <div class="min-w-0">
                                        <div class="text-sm text-gray-900 truncate">${esc(tx.description)}</div>
                                        <div class="text-xs text-gray-400">${new Date(tx.created_at).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div class="text-right shrink-0 ml-3">
                                    <div class="text-sm font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}">${tx.amount >= 0 ? '+' : ''}${tx.amount}t</div>
                                    <div class="text-xs text-gray-400">bal: ${tx.balance_after}t</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>` : `
                    <div class="text-center py-12 text-gray-400 text-sm">No transactions yet. Start trading to see your history!</div>`}
                </div>
            </div>`;
    },
};

// Helper for trade estimates
function _tradeEstimateHTML(qYes, qNo, amount) {
    const estYes = AMM.estimatePayout(qYes, qNo, amount, 'yes');
    const estNo = AMM.estimatePayout(qYes, qNo, amount, 'no');
    const oldPrice = AMM.yesPrice(qYes, qNo);
    const priceAfterYes = AMM.yesPrice(qYes + estYes.shares, qNo);
    const priceAfterNo = AMM.yesPrice(qYes, qNo + estNo.shares);
    const maxImpact = Math.max(Math.abs(priceAfterYes - oldPrice), Math.abs(priceAfterNo - oldPrice)) * 100;
    const slippageWarning = maxImpact > 5
        ? `<div class="text-xs mt-2 px-2 py-1 rounded ${maxImpact > 15 ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}">⚠ Price impact: ~${maxImpact.toFixed(1)}%</div>`
        : '';

    const yesProfit = Math.round(estYes.shares) - amount;
    const noProfit = Math.round(estNo.shares) - amount;
    return `<div class="font-semibold text-gray-700 mb-2">If you spend ${amount} tokens:</div>
        <div class="grid grid-cols-2 gap-2">
            <div class="bg-green-50 rounded-lg p-2 text-center">
                <div class="text-xs text-green-600 font-medium">Buy YES</div>
                <div class="text-sm font-bold text-green-700">${estYes.shares.toFixed(1)} shares</div>
                <div class="text-xs text-green-600">Payout if correct: <strong>${Math.round(estYes.shares)}t</strong></div>
                <div class="text-xs ${yesProfit >= 0 ? 'text-green-600' : 'text-red-500'}">Profit: ${yesProfit >= 0 ? '+' : ''}${yesProfit}t</div>
            </div>
            <div class="bg-red-50 rounded-lg p-2 text-center">
                <div class="text-xs text-red-600 font-medium">Buy NO</div>
                <div class="text-sm font-bold text-red-700">${estNo.shares.toFixed(1)} shares</div>
                <div class="text-xs text-red-600">Payout if correct: <strong>${Math.round(estNo.shares)}t</strong></div>
                <div class="text-xs ${noProfit >= 0 ? 'text-green-600' : 'text-red-500'}">Profit: ${noProfit >= 0 ? '+' : ''}${noProfit}t</div>
            </div>
        </div>
        <div class="text-xs text-gray-400 mt-2 text-center">Each winning share pays 1 token</div>${slippageWarning}`;
}
