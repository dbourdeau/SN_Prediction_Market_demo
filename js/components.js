// Reusable UI components with XSS protection

// ============================================================
// XSS Protection
// ============================================================

function esc(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ============================================================
// Utilities
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

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysLeft(dateStr) {
    if (!dateStr) return 0;
    return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)));
}

function initials(name) {
    if (!name) return 'XX';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name.slice(0, 2)).toUpperCase();
}

// Disable a button during async operation
function withLoading(btnId, asyncFn) {
    return async function (...args) {
        const btn = document.getElementById(btnId);
        if (!btn || btn.disabled) return;
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>' + original;
        try {
            return await asyncFn.apply(this, args);
        } finally {
            if (document.getElementById(btnId)) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.innerHTML = original;
            }
        }
    };
}

// ============================================================
// Modal System
// ============================================================

function showModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
        const id = 'modal-' + Date.now();
        const backdrop = document.createElement('div');
        backdrop.id = id;
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
            <div class="modal-content">
                <h3 class="text-lg font-bold text-gray-900 mb-2">${esc(title)}</h3>
                <p class="text-sm text-gray-600 mb-6">${esc(message)}</p>
                <div class="flex gap-3 justify-end">
                    <button id="${id}-cancel" class="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">${esc(cancelText)}</button>
                    <button id="${id}-confirm" class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-shark-600 hover:bg-shark-700'}">${esc(confirmText)}</button>
                </div>
            </div>`;
        document.body.appendChild(backdrop);

        const close = (result) => { backdrop.remove(); resolve(result); };
        document.getElementById(`${id}-cancel`).onclick = () => close(false);
        document.getElementById(`${id}-confirm`).onclick = () => close(true);
        backdrop.onclick = (e) => { if (e.target === backdrop) close(false); };
    });
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
            amber: 'bg-amber-100 text-amber-700', pink: 'bg-pink-100 text-pink-700',
        };
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[cat.color]}">${cat.icon} ${esc(cat.label)}</span>`;
    },

    statusBadge(market) {
        if (market.resolution === 'void') return '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">VOIDED</span>';
        if (market.market_type === 'multi' && market.resolution) {
            const winIdx = parseInt(market.resolution);
            const label = !isNaN(winIdx) && market.options?.[winIdx] ? market.options[winIdx].label : market.resolution;
            return `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Winner: ${esc(label)}</span>`;
        }
        if (market.resolution === 'yes') return '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Resolved YES</span>';
        if (market.resolution === 'no') return '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Resolved NO</span>';
        if (market.status === 'closed') return '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Closed</span>';
        return '';
    },

    sparkline(data, width = 120, height = 32) {
        if (!data || data.length < 2) return '';
        const min = Math.min(...data) - 0.05, max = Math.max(...data) + 0.05;
        const range = max - min || 1, step = width / (data.length - 1);
        const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
        const lastVal = data[data.length - 1], firstVal = data[0];
        const color = lastVal >= firstVal ? '#22c55e' : '#ef4444';
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="inline-block">
            <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
            <circle cx="${(data.length - 1) * step}" cy="${height - ((lastVal - min) / range) * height}" r="3" fill="${color}"/>
        </svg>`;
    },

    marketCard(market) {
        const userPreds = (AppState.userPredictions || []).filter(p => p.market_id === market.id && p.status === 'active');
        const days = daysLeft(market.closes_at);
        const isResolved = !!market.resolution;
        const isExpired = !isResolved && days <= 0;
        const isWatching = AppState.isWatching(market.id);
        const isMulti = market.market_type === 'multi';

        // Calculate unrealized P&L for user's active positions
        let positionPnL = 0;
        userPreds.forEach(p => {
            let currentValue;
            if (isMulti) {
                currentValue = AMM.sellRevenueMulti(market.q_values || [], p.shares, p.option_index);
            } else {
                currentValue = AMM.sellRevenue(market.q_yes || 0, market.q_no || 0, p.shares, p.direction);
            }
            positionPnL += Math.round(currentValue) - p.amount;
        });

        // For multi markets, show the leading option label
        let multiLeader = '';
        if (isMulti && market.options && market.probabilities) {
            const maxIdx = market.probabilities.indexOf(Math.max(...market.probabilities));
            multiLeader = market.options[maxIdx]?.label || '';
        }

        // Sparkline data: for multi, extract the max probability from each history entry
        const sparkData = isMulti && market.history
            ? market.history.map(h => Array.isArray(h) ? Math.max(...h) : h)
            : market.history;

        return `
            <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 card-hover cursor-pointer fade-in ${isResolved ? 'opacity-75' : ''}"
                 onclick="AppState.navigate('market', { marketId: ${market.id} })">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                            ${this.categoryTag(market.category)}
                            ${isMulti ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Multi</span>' : ''}
                            ${market.trending && !isResolved ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">🔥</span>' : ''}
                            ${this.statusBadge(market)}
                            ${isExpired ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Expired</span>' : ''}
                            ${userPreds.length > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${positionPnL >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">✓ ${userPreds.length} ${positionPnL !== 0 ? (positionPnL > 0 ? '+' : '') + positionPnL + 't' : ''}</span>` : ''}
                        </div>
                        <h3 class="font-semibold text-gray-900 text-sm sm:text-base leading-snug line-clamp-2">${esc(market.title)}</h3>
                        ${isMulti && multiLeader ? `<div class="text-xs text-gray-500 mt-1">Leading: <span class="font-medium text-gray-700">${esc(multiLeader)}</span> at ${Math.round(Math.max(...(market.probabilities || [0])) * 100)}%</div>` : ''}
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                        ${isMulti ? `<span class="inline-flex items-center rounded-full font-bold bg-indigo-100 text-indigo-800 text-sm px-2.5 py-1">${market.options?.length || '?'} options</span>` : this.probBadge(market.probability)}
                        <div class="hidden sm:block">${this.sparkline(sparkData)}</div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-xs sm:text-sm text-gray-500">
                    <div class="flex items-center gap-3">
                        <span>${market.traders} traders</span>
                        <span>${market.volume.toLocaleString()} vol</span>
                        <button onclick="event.stopPropagation(); handleToggleWatchlist(${market.id})" class="hover:text-shark-600 transition-colors ${isWatching ? 'text-shark-600' : ''}" title="${isWatching ? 'Remove from watchlist' : 'Add to watchlist'}">${isWatching ? '★' : '☆'}</button>
                    </div>
                    <span>${isResolved ? 'Resolved' : isExpired ? 'Expired' : days + 'd left'}</span>
                </div>
            </div>
        `;
    },

    statCard(label, value, subtext, icon) {
        return `<div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs sm:text-sm font-medium text-gray-500">${esc(label)}</span>
                <span class="text-xl sm:text-2xl">${icon}</span>
            </div>
            <div class="text-xl sm:text-2xl font-bold text-gray-900">${esc(String(value))}</div>
            ${subtext ? `<div class="text-xs sm:text-sm text-gray-500 mt-1">${esc(subtext)}</div>` : ''}
        </div>`;
    },

    avatar(name_or_initials, size = 'md') {
        const sizeClass = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
        const emojiSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl';
        // Check if it's an emoji (single character outside ASCII range)
        const isEmoji = name_or_initials && /^\p{Emoji}/u.test(name_or_initials) && name_or_initials.length <= 4;
        if (isEmoji) {
            return `<div class="rounded-full bg-gray-100 flex items-center justify-center shrink-0 ${sizeClass} ${emojiSize}">${name_or_initials}</div>`;
        }
        const letters = name_or_initials.length > 2 ? initials(name_or_initials) : name_or_initials;
        return `<div class="rounded-full bg-shark-600 text-white flex items-center justify-center font-semibold shrink-0 ${sizeClass}">${esc(letters)}</div>`;
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

    probBarMulti(options, probabilities) {
        if (!options || !probabilities) return '';
        const colors = ['bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500'];
        const textColors = ['text-blue-700', 'text-green-700', 'text-amber-700', 'text-red-700', 'text-purple-700', 'text-pink-700', 'text-cyan-700', 'text-indigo-700'];
        return `<div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden flex">
            ${probabilities.map((p, i) => `<div class="h-full ${colors[i % colors.length]} prob-bar" style="width:${Math.round(p * 100)}%"></div>`).join('')}
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-2">
            ${options.map((opt, i) => {
                const pct = Math.round((probabilities[i] || 0) * 100);
                return `<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full ${colors[i % colors.length]} inline-block"></span><span class="${textColors[i % textColors.length]} font-medium">${esc(opt.label)} ${pct}%</span></span>`;
            }).join('')}
        </div>`;
    },

    chart(data, width = 500, height = 160) {
        if (!data || data.length < 2) return '<div class="text-gray-400 text-sm">Not enough data</div>';
        const padding = { top: 20, right: 15, bottom: 25, left: 40 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const min = Math.max(0, Math.min(...data) - 0.1), max = Math.min(1, Math.max(...data) + 0.1);
        const range = max - min || 1, step = chartW / (data.length - 1);

        const points = data.map((v, i) => {
            const x = padding.left + i * step;
            const y = padding.top + chartH - ((v - min) / range) * chartH;
            return `${x},${y}`;
        }).join(' ');

        const areaPoints = `${padding.left},${padding.top + chartH} ${points} ${padding.left + (data.length - 1) * step},${padding.top + chartH}`;
        const lastVal = data[data.length - 1], firstVal = data[0];
        const color = lastVal >= firstVal ? '#22c55e' : '#ef4444';

        // Y-axis labels
        const yLabels = [min, (min + max) / 2, max].map(v => {
            const y = padding.top + chartH - ((v - min) / range) * chartH;
            return `<text x="${padding.left - 5}" y="${y + 4}" text-anchor="end" fill="#9ca3af" font-size="10">${Math.round(v * 100)}%</text>
                    <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f3f4f6" stroke-width="1"/>`;
        }).join('');

        // X-axis labels (first, middle, last)
        const xPositions = [0, Math.floor(data.length / 2), data.length - 1];
        const xLabels = xPositions.map(i => {
            const x = padding.left + i * step;
            return `<text x="${x}" y="${height - 3}" text-anchor="middle" fill="#9ca3af" font-size="9">${i === 0 ? 'Start' : i === data.length - 1 ? 'Now' : 'Mid'}</text>`;
        }).join('');

        return `<svg width="100%" viewBox="0 0 ${width} ${height}" class="block">
            ${yLabels}${xLabels}
            <polygon fill="${color}" fill-opacity="0.1" points="${areaPoints}"/>
            <polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
            <circle cx="${padding.left + (data.length - 1) * step}" cy="${padding.top + chartH - ((lastVal - min) / range) * chartH}" r="4" fill="${color}" stroke="white" stroke-width="2"/>
        </svg>`;
    },

    // Skeleton loading placeholder
    skeleton(height = '20px', width = '100%') {
        return `<div class="animate-pulse bg-gray-200 rounded" style="height:${height};width:${width}"></div>`;
    },

    loadingSpinner(size = 'md') {
        const s = size === 'sm' ? 'w-5 h-5 border-2' : 'w-8 h-8 border-4';
        return `<div class="inline-block ${s} border-shark-200 border-t-shark-600 rounded-full animate-spin"></div>`;
    },

    skeletonCards(count = 4) {
        return Array.from({ length: count }, () => `
            <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex-1 space-y-2">
                        <div class="skeleton-line" style="width:40%"></div>
                        <div class="skeleton-line" style="width:90%"></div>
                        <div class="skeleton-line" style="width:70%"></div>
                    </div>
                    <div class="skeleton-line" style="width:48px;height:32px;border-radius:9999px"></div>
                </div>
                <div class="flex justify-between">
                    <div class="skeleton-line" style="width:30%"></div>
                    <div class="skeleton-line" style="width:15%"></div>
                </div>
            </div>`).join('');
    },

    skeletonPage() {
        return `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                <div class="skeleton-line mb-6" style="width:200px;height:28px"></div>
                <div class="grid gap-3 sm:gap-4 md:grid-cols-2">
                    ${this.skeletonCards(4)}
                </div>
            </div>`;
    },

    header() {
        const navItems = [
            { id: 'dashboard', label: 'Dashboard', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>' },
            { id: 'markets', label: 'Markets', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
            { id: 'leaderboard', label: 'Leaderboard', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>' },
            { id: 'create', label: 'Create', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' },
        ];

        if (AppState.user?.is_admin) {
            const pendingCount = (AppState.pendingMarkets || []).length;
            navItems.push({ id: 'admin', label: 'Admin' + (pendingCount > 0 ? ` (${pendingCount})` : ''), icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' });
        }

        const unread = AppState.unreadCount;
        const uid = AppState.session?.user?.id || '';

        return `
            <header class="gradient-bg text-white sticky top-0 z-50 shadow-lg">
                <div class="max-w-7xl mx-auto px-4 sm:px-6">
                    <div class="flex items-center justify-between h-14 sm:h-16">
                        <div class="flex items-center gap-2 cursor-pointer shrink-0" onclick="AppState.navigate('dashboard')">
                            <svg class="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 32 32" fill="none">
                                <rect width="32" height="32" rx="8" fill="white" fill-opacity="0.15"/>
                                <path d="M8 16C8 11.58 11.58 8 16 8s8 3.58 8 8-3.58 8-8 8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                                <path d="M16 12v8l4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <div class="hidden sm:block">
                                <span class="font-bold text-lg tracking-tight">SharkNinja</span>
                                <span class="text-shark-200 text-sm ml-1">Predictions</span>
                            </div>
                        </div>
                        <nav class="hidden md:flex items-center gap-1">
                            ${navItems.map(item => `
                                <button onclick="AppState.navigate('${item.id}')"
                                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${AppState.currentPage === item.id ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}">
                                    ${item.icon} ${item.label}
                                </button>
                            `).join('')}
                        </nav>
                        <div class="flex items-center gap-2 sm:gap-3">
                            <button onclick="AppState.toggleDarkMode()" class="text-white/70 hover:text-white transition-colors p-1" title="Toggle dark mode">
                                ${AppState.darkMode
                                    ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
                                    : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>'
                                }
                            </button>
                            <button onclick="AppState.navigate('notifications')" class="relative text-white/70 hover:text-white transition-colors p-1">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                ${unread > 0 ? `<span class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">${unread > 9 ? '9+' : unread}</span>` : ''}
                            </button>
                            <div class="flex items-center gap-1 sm:gap-2 bg-white/10 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5">
                                <span class="text-xs sm:text-sm font-semibold">${(AppState.user?.balance || 0).toLocaleString()}</span>
                                <span class="text-xs text-white/60 hidden sm:inline">tokens</span>
                                <span class="text-xs text-white/60 sm:hidden">t</span>
                            </div>
                            <button onclick="AppState.navigate('profile', { profileId: '${uid}' })" class="cursor-pointer">
                                ${this.avatar(AppState.user?.avatar || 'XX', 'sm')}
                            </button>
                            <button onclick="handleLogout()" class="text-white/60 hover:text-white transition-colors p-1" title="Sign Out">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                            </button>
                        </div>
                    </div>
                    <!-- Mobile nav -->
                    <div class="flex md:hidden gap-1 pb-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                        ${navItems.map(item => `
                            <button onclick="AppState.navigate('${item.id}')"
                                class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                                ${AppState.currentPage === item.id ? 'bg-white/20 text-white' : 'text-white/70'}">
                                ${item.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </header>
        `;
    },
};
