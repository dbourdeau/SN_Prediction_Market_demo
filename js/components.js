// Reusable UI components with XSS protection

// ============================================================
// XSS Protection — escape all user-generated content
// ============================================================

function esc(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ============================================================
// Utility
// ============================================================

function getTimeAgo(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

function daysLeft(dateStr) {
    if (!dateStr) return 0;
    return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)));
}

// ============================================================
// Components
// ============================================================

const Components = {
    probBadge(prob, size = 'md') {
        const pct = Math.round(prob * 100);
        let colorClass;
        if (pct >= 70) colorClass = 'bg-green-100 text-green-800';
        else if (pct >= 40) colorClass = 'bg-yellow-100 text-yellow-800';
        else colorClass = 'bg-red-100 text-red-800';
        const sizeClass = size === 'lg' ? 'text-2xl px-4 py-2' : 'text-sm px-2.5 py-1';
        return `<span class="inline-flex items-center rounded-full font-bold ${colorClass} ${sizeClass}">${pct}%</span>`;
    },

    categoryTag(categoryId) {
        const cat = CATEGORIES[Object.keys(CATEGORIES).find(k => CATEGORIES[k].id === categoryId)];
        if (!cat) return '';
        const colors = {
            blue: 'bg-blue-100 text-blue-700', red: 'bg-red-100 text-red-700',
            green: 'bg-green-100 text-green-700', purple: 'bg-purple-100 text-purple-700',
            amber: 'bg-amber-100 text-amber-700',
        };
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[cat.color]}">${cat.icon} ${esc(cat.label)}</span>`;
    },

    statusBadge(market) {
        if (market.resolution === 'yes') return '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Resolved YES</span>';
        if (market.resolution === 'no') return '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Resolved NO</span>';
        if (market.resolution === 'void') return '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">VOIDED</span>';
        if (market.status === 'closed') return '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Closed</span>';
        return '';
    },

    sparkline(data, width = 120, height = 32) {
        if (!data || data.length < 2) return '';
        const min = Math.min(...data) - 0.05;
        const max = Math.max(...data) + 0.05;
        const range = max - min || 1;
        const step = width / (data.length - 1);
        const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
        const lastVal = data[data.length - 1], firstVal = data[0];
        const color = lastVal >= firstVal ? '#22c55e' : '#ef4444';
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="inline-block">
            <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
            <circle cx="${(data.length - 1) * step}" cy="${height - ((lastVal - min) / range) * height}" r="3" fill="${color}"/>
        </svg>`;
    },

    marketCard(market) {
        const userPreds = AppState.userPredictions.filter(p => p.market_id === market.id && p.status === 'active');
        const days = daysLeft(market.closes_at);
        const isResolved = !!market.resolution;

        return `
            <div class="bg-white rounded-xl border border-gray-200 p-5 card-hover cursor-pointer fade-in ${isResolved ? 'opacity-75' : ''}"
                 onclick="AppState.navigate('market', { marketId: ${market.id} })">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2 flex-wrap">
                            ${this.categoryTag(market.category)}
                            ${market.trending && !isResolved ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">🔥 Trending</span>' : ''}
                            ${this.statusBadge(market)}
                            ${userPreds.length > 0 ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-shark-100 text-shark-700">✓ ${userPreds.length} position${userPreds.length > 1 ? 's' : ''}</span>` : ''}
                        </div>
                        <h3 class="font-semibold text-gray-900 text-base leading-snug">${esc(market.title)}</h3>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                        ${this.probBadge(market.probability)}
                        ${this.sparkline(market.history)}
                    </div>
                </div>
                <div class="flex items-center justify-between text-sm text-gray-500">
                    <div class="flex items-center gap-4">
                        <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            ${market.traders}
                        </span>
                        <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                            ${market.volume.toLocaleString()}
                        </span>
                    </div>
                    <span class="text-xs">${isResolved ? 'Resolved' : days + ' days left'}</span>
                </div>
            </div>
        `;
    },

    statCard(label, value, subtext, icon) {
        return `<div class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-500">${esc(label)}</span>
                <span class="text-2xl">${icon}</span>
            </div>
            <div class="text-2xl font-bold text-gray-900">${esc(String(value))}</div>
            ${subtext ? `<div class="text-sm text-gray-500 mt-1">${esc(subtext)}</div>` : ''}
        </div>`;
    },

    avatar(initials, size = 'md') {
        const sizeClass = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
        return `<div class="rounded-full bg-shark-600 text-white flex items-center justify-center font-semibold shrink-0 ${sizeClass}">${esc(initials)}</div>`;
    },

    probBar(prob) {
        const pct = Math.round(prob * 100);
        return `<div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div class="h-full rounded-full prob-bar ${pct >= 50 ? 'bg-green-500' : 'bg-red-400'}" style="width: ${pct}%"></div>
        </div>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>YES ${pct}%</span><span>NO ${100 - pct}%</span>
        </div>`;
    },

    chart(data, width = 500, height = 160) {
        if (!data || data.length < 2) return '<div class="text-gray-400 text-sm">Not enough data</div>';
        const padding = 30;
        const chartW = width - padding * 2, chartH = height - padding * 2;
        const min = Math.max(0, Math.min(...data) - 0.1), max = Math.min(1, Math.max(...data) + 0.1);
        const range = max - min || 1, step = chartW / (data.length - 1);
        const points = data.map((v, i) => `${padding + i * step},${padding + chartH - ((v - min) / range) * chartH}`).join(' ');
        const areaPoints = `${padding},${padding + chartH} ${points} ${padding + (data.length - 1) * step},${padding + chartH}`;
        const lastVal = data[data.length - 1], firstVal = data[0];
        const color = lastVal >= firstVal ? '#22c55e' : '#ef4444';
        const yLabels = [min, (min + max) / 2, max].map(v => {
            const y = padding + chartH - ((v - min) / range) * chartH;
            return `<text x="${padding - 5}" y="${y + 4}" text-anchor="end" fill="#9ca3af" font-size="11">${Math.round(v * 100)}%</text>
                    <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#f3f4f6" stroke-width="1"/>`;
        }).join('');
        return `<svg width="100%" viewBox="0 0 ${width} ${height}" class="block">
            ${yLabels}
            <polygon fill="${color}" fill-opacity="0.1" points="${areaPoints}"/>
            <polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
            <circle cx="${padding + (data.length - 1) * step}" cy="${padding + chartH - ((lastVal - min) / range) * chartH}" r="4" fill="${color}" stroke="white" stroke-width="2"/>
        </svg>`;
    },

    header() {
        const navItems = [
            { id: 'dashboard', label: 'Dashboard', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>' },
            { id: 'markets', label: 'Markets', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
            { id: 'leaderboard', label: 'Leaderboard', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>' },
            { id: 'create', label: 'Create', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' },
        ];

        if (AppState.user?.is_admin) {
            navItems.push({ id: 'admin', label: 'Admin', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' });
        }

        const unread = AppState.unreadCount;

        return `
            <header class="gradient-bg text-white sticky top-0 z-50 shadow-lg">
                <div class="max-w-7xl mx-auto px-4 sm:px-6">
                    <div class="flex items-center justify-between h-16">
                        <div class="flex items-center gap-3 cursor-pointer" onclick="AppState.navigate('dashboard')">
                            <svg class="w-8 h-8" viewBox="0 0 32 32" fill="none">
                                <rect width="32" height="32" rx="8" fill="white" fill-opacity="0.15"/>
                                <path d="M8 16C8 11.58 11.58 8 16 8s8 3.58 8 8-3.58 8-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                                <path d="M16 12v8l4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <div>
                                <span class="font-bold text-lg tracking-tight">SharkNinja</span>
                                <span class="text-shark-200 text-sm ml-1">Predictions</span>
                            </div>
                        </div>
                        <nav class="hidden md:flex items-center gap-1">
                            ${navItems.map(item => `
                                <button onclick="AppState.navigate('${item.id}')"
                                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${AppState.currentPage === item.id ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}">
                                    ${item.icon} ${item.label}
                                </button>
                            `).join('')}
                        </nav>
                        <div class="flex items-center gap-3">
                            <!-- Notifications bell -->
                            <button onclick="AppState.navigate('notifications')" class="relative text-white/70 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                ${unread > 0 ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">${unread > 9 ? '9+' : unread}</span>` : ''}
                            </button>
                            <div class="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                                <svg class="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 5a1 1 0 112 0v5a1 1 0 01-2 0V5zm1 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                                <span class="text-sm font-semibold">${(AppState.user?.balance || 0).toLocaleString()}</span>
                                <span class="text-xs text-white/60">tokens</span>
                            </div>
                            <button onclick="AppState.navigate('profile', { profileId: '${AppState.session?.user?.id}' })" class="cursor-pointer">
                                ${this.avatar(AppState.user?.avatar || 'XX', 'sm')}
                            </button>
                            <button onclick="handleLogout()" class="text-white/60 hover:text-white transition-colors" title="Sign Out">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                            </button>
                        </div>
                    </div>
                    <!-- Mobile nav -->
                    <div class="flex md:hidden gap-1 pb-2 overflow-x-auto">
                        ${navItems.map(item => `
                            <button onclick="AppState.navigate('${item.id}')"
                                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                                ${AppState.currentPage === item.id ? 'bg-white/20 text-white' : 'text-white/70'}">
                                ${item.icon} ${item.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </header>
        `;
    },
};
