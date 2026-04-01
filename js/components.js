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

// Escape for use inside JS string literals in onclick attributes
// Handles both HTML entities and JS-special characters (quotes, backslashes)
function escAttr(str) {
    if (str == null) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
                <p class="text-sm text-gray-600 mb-6 leading-relaxed">${esc(message)}</p>
                <div class="flex gap-3 justify-end">
                    <button id="${id}-cancel" class="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800">${esc(cancelText)}</button>
                    <button id="${id}-confirm" class="px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-shark-600 hover:bg-shark-700'}">${esc(confirmText)}</button>
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
    probBadge(prob, size = 'md', traders = -1) {
        const pct = Math.round(prob * 100);
        if (traders === 0) {
            const sizeClass = size === 'lg' ? 'text-xl px-4 py-2' : 'text-sm px-3 py-1';
            return `<span class="inline-flex items-center rounded-full font-medium bg-gray-50 text-gray-400 border border-gray-200 ${sizeClass}">—</span>`;
        }
        let colorClass;
        if (pct >= 70) colorClass = 'bg-green-50 text-green-700 border border-green-200';
        else if (pct >= 40) colorClass = 'bg-amber-50 text-amber-700 border border-amber-200';
        else colorClass = 'bg-red-50 text-red-700 border border-red-200';
        const sizeClass = size === 'lg' ? 'text-2xl px-4 py-2' : 'text-sm px-3 py-1';
        return `<span class="inline-flex items-center rounded-full font-bold ${colorClass} ${sizeClass}">${pct}%</span>`;
    },

    categoryTag(categoryId) {
        const cat = CATEGORIES[Object.keys(CATEGORIES).find(k => CATEGORIES[k].id === categoryId)];
        if (!cat) return '';
        const colors = {
            blue: 'bg-blue-50 text-blue-600', red: 'bg-red-50 text-red-600',
            green: 'bg-green-50 text-green-600', purple: 'bg-purple-50 text-purple-600',
            amber: 'bg-amber-50 text-amber-600', pink: 'bg-pink-50 text-pink-600',
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

    // Returns a consistent cheeky anonymous name for a given numeric trade id
    cheekiName(id) {
        const names = ['The Hammerhead','Silent Mako','Reef Prophet','Shadow Ninja','Deep Current','Tidal Sage','The Barracuda','Stealth Fin','Coral Oracle','Midnight Swimmer','The Great White','Razor Tide','Phantom Gill','Lurking Orca','The Kraken'];
        return names[(id || 0) % names.length];
    },

    // Catmull-Rom spline: smooth SVG path through all data points
    _smoothPath(pts) {
        if (pts.length < 2) return '';
        if (pts.length === 2) return `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)} L${pts[1][0].toFixed(2)},${pts[1][1].toFixed(2)}`;
        let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(pts.length - 1, i + 2)];
            const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
            const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
            const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
            const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
            d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
        }
        return d;
    },

    sparkline(rawData, width = 120, height = 32) {
        if (!rawData || rawData.length < 2) return '';
        // Handle both legacy (number) and new ({t, p}) formats
        const data = rawData.map(v => (v && typeof v === 'object' && v.p !== undefined) ? v.p : v);
        const min = Math.min(...data) - 0.05, max = Math.max(...data) + 0.05;
        const range = max - min || 1, step = width / (data.length - 1);
        const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * height]);
        const linePath = this._smoothPath(pts);
        const lastVal = data[data.length - 1], firstVal = data[0];
        const color = lastVal >= firstVal ? '#22c55e' : '#ef4444';
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="inline-block">
            <path fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="${linePath}"/>
            <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3" fill="${color}"/>
        </svg>`;
    },

    // P&L sparkline: derives position value from market price history
    sparklinePnL(market, pred, width = 80, height = 24) {
        const history = market.history;
        if (!history || history.length < 2) return '';
        const isMulti = market.market_type === 'multi';
        const shares = pred.shares || 0;
        const cost = pred.amount || 0;

        // Convert each history point to estimated position value
        // Handle both legacy (raw value) and new ({t, p}) formats
        const values = history.map(h => {
            const val = (h && typeof h === 'object' && h.p !== undefined) ? h.p : h;
            if (isMulti && Array.isArray(val)) {
                const prob = val[pred.option_index] || 0;
                return shares * prob;
            } else if (!isMulti && typeof val === 'number') {
                return pred.direction === 'yes' ? shares * val : shares * (1 - val);
            }
            return cost; // fallback
        });

        if (values.length < 2) return '';
        // Only show points from when this position was placed (approximate: skip early history)
        // Use the entry point: find the first history index where the value is near entry
        const entryIdx = Math.max(0, values.length - Math.max(2, Math.ceil(values.length * 0.8)));
        const data = values.slice(entryIdx);
        if (data.length < 2) return '';

        const min = Math.min(...data), max = Math.max(...data);
        const range = max - min || 1, step = width / (data.length - 1);
        const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * height]);
        const linePath = this._smoothPath(pts);
        const lastVal = data[data.length - 1];
        const color = lastVal >= cost ? '#22c55e' : '#ef4444';
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="inline-block align-middle">
            <path fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="${linePath}" opacity="0.8"/>
            <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="2" fill="${color}"/>
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

        // Sparkline data
        const sparkData = isMulti ? null : market.history;

        // Category color accent
        const catObj = CATEGORIES[Object.keys(CATEGORIES).find(k => CATEGORIES[k].id === market.category)];
        const accentClass = catObj ? `card-accent-${catObj.color}` : '';

        // 7. Live pulse — market had activity recently (volume > 0 as proxy)
        const isLive = !isResolved && !isExpired && market.traders > 0;

        // 8. Probability change badge
        let probChange = '';
        if (!isMulti && !isResolved && market.history && market.history.length >= 2) {
            const hist = market.history;
            const current = typeof hist[hist.length - 1] === 'object' ? hist[hist.length - 1].p : hist[hist.length - 1];
            // Compare to ~24h ago or earliest available
            const compareIdx = Math.max(0, hist.length - Math.min(hist.length, 5));
            const prev = typeof hist[compareIdx] === 'object' ? hist[compareIdx].p : hist[compareIdx];
            const diff = Math.round((current - prev) * 100);
            if (diff !== 0) {
                probChange = `<span class="px-1.5 py-0.5 rounded text-xs font-bold ${diff > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}">${diff > 0 ? '↑' : '↓'}${Math.abs(diff)}%</span>`;
            }
        }

        return `
            <div class="bg-white rounded-xl border ${market.is_priority && !isResolved ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'} p-4 sm:p-5 card-hover cursor-pointer fade-in ${accentClass} ${isResolved ? 'opacity-70' : ''}"
                 onclick="AppState.navigate('market', { marketId: ${market.id} })">
                <div class="flex items-start justify-between gap-3 mb-2.5">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            ${market.is_priority && !isResolved ? '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">📌 Priority</span>' : ''}
                            ${this.categoryTag(market.category)}
                            ${market.target_dept ? `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">${esc(market.target_dept)}</span>` : ''}
                            ${isMulti ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">Multi</span>' : ''}
                            ${market.trending && !isResolved ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">🔥 Trending</span>' : ''}
                            ${this.statusBadge(market)}
                            ${isExpired && !isResolved ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">Expired</span>' : ''}
                            ${probChange}
                            ${isLive ? '<span class="pulse-live ml-1" title="Active market"></span>' : ''}
                        </div>
                        <h3 class="font-semibold text-gray-900 text-base sm:text-lg leading-snug line-clamp-2">${esc(market.title)}</h3>
                        ${isMulti && multiLeader ? `<div class="text-xs text-gray-500 mt-1.5">Leading: <span class="font-semibold text-gray-700">${esc(multiLeader)}</span> at ${Math.round(Math.max(...(market.probabilities || [0])) * 100)}%</div>` : ''}
                    </div>
                    <div class="flex flex-col items-end gap-1.5 shrink-0">
                        ${isMulti ? `<span class="inline-flex items-center rounded-full font-bold bg-indigo-50 text-indigo-700 text-sm px-3 py-1">${market.options?.length || '?'} options</span>` : this.probBadge(market.probability, 'md', market.traders)}
                        <div class="hidden sm:block">${isMulti ? this.sparklineMulti(market.history, market.options) : this.sparkline(sparkData)}</div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-xs text-gray-400 pt-2.5 border-t border-gray-100">
                    <div class="flex items-center gap-3">
                        ${userPreds.length > 0 ? `<span class="font-medium ${positionPnL >= 0 ? 'text-green-600' : 'text-red-500'}">Your position: ${positionPnL > 0 ? '+' : ''}${positionPnL}t</span>` : ''}
                        <span>${market.traders} trader${market.traders !== 1 ? 's' : ''}</span>
                        <span>${market.volume.toLocaleString()} vol</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span>${isResolved ? 'Resolved' : isExpired ? 'Expired' : days + 'd left'}</span>
                        <button onclick="event.stopPropagation(); handleToggleWatchlist(${market.id})" class="hover:text-shark-600 ${isWatching ? 'text-shark-600' : 'text-gray-300 hover:text-gray-500'}" title="${isWatching ? 'Remove from watchlist' : 'Add to watchlist'}">${isWatching ? '★' : '☆'}</button>
                    </div>
                </div>
            </div>
        `;
    },

    statCard(label, value, subtext, icon) {
        return `<div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-sm transition-shadow">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">${esc(label)}</span>
                <span class="text-lg opacity-60">${icon}</span>
            </div>
            <div class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">${esc(String(value))}</div>
            ${subtext ? `<div class="text-xs text-gray-500 mt-1">${esc(subtext)}</div>` : ''}
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

    // --- Chart helpers ---
    _chartColors: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#6366f1'],

    // Normalize history: handle both legacy (raw values) and new ({t, p}) formats
    _normalizeHistory(rawHistory, createdAt) {
        if (!rawHistory || rawHistory.length === 0) return [];
        return rawHistory.map((entry, i) => {
            if (entry && typeof entry === 'object' && entry.t !== undefined && entry.p !== undefined) {
                return { t: new Date(entry.t), p: entry.p };
            }
            // Legacy: no timestamp, estimate evenly between created_at and now
            const start = createdAt ? new Date(createdAt).getTime() : Date.now() - 86400000 * 7;
            const span = Date.now() - start;
            const step = rawHistory.length > 1 ? span / (rawHistory.length - 1) : 0;
            return { t: new Date(start + i * step), p: entry };
        });
    },

    // Filter history by time window
    _filterByWindow(history, window) {
        if (window === 'all' || !history.length) return history;
        const now = Date.now();
        const cutoffs = { '1d': 86400000, '1w': 7 * 86400000, '1m': 30 * 86400000 };
        const cutoff = now - (cutoffs[window] || cutoffs['1m']);
        const filtered = history.filter(h => h.t.getTime() >= cutoff);
        // Always keep at least 2 points — prepend the last point before cutoff
        if (filtered.length < 2 && history.length >= 2) {
            const beforeCutoff = history.filter(h => h.t.getTime() < cutoff);
            if (beforeCutoff.length) filtered.unshift(beforeCutoff[beforeCutoff.length - 1]);
        }
        return filtered.length >= 2 ? filtered : history;
    },

    // Format date for x-axis
    _formatDate(date, window) {
        const d = new Date(date);
        if (window === '1d') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (window === '1w') return d.toLocaleDateString([], { weekday: 'short' });
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    },

    // Generate smart x-axis tick positions
    _xTicks(history, maxTicks = 5) {
        if (history.length <= maxTicks) return history.map((_, i) => i);
        const ticks = [0];
        const step = (history.length - 1) / (maxTicks - 1);
        for (let i = 1; i < maxTicks - 1; i++) ticks.push(Math.round(i * step));
        ticks.push(history.length - 1);
        return [...new Set(ticks)];
    },

    // Generate unique chart ID
    _chartId: 0,
    _nextChartId() { return `chart-${++this._chartId}-${Math.random().toString(36).slice(2, 6)}`; },

    chart(data, width = 500, height = 200, marketId = null, createdAt = null) {
        if (!data || data.length < 2) return '<div class="text-gray-400 text-sm text-center py-4">Not enough data for chart</div>';
        const chartId = this._nextChartId();
        const fullHistory = this._normalizeHistory(data, createdAt);
        const windows = ['1d', '1w', '1m', 'all'];

        // Store data and schedule initial render after DOM update
        globalThis['_chartData_' + chartId] = fullHistory.map(h => ({ t: h.t.getTime(), p: h.p }));
        setTimeout(() => this._renderBinaryChart(chartId, 'all'), 0);

        return `
        <div id="${chartId}" class="chart-container">
            <div class="flex items-center justify-between mb-3">
                <div class="flex gap-1 bg-gray-100 rounded-lg p-0.5" id="${chartId}-tabs">
                    ${windows.map(w => `<button onclick="Components._renderBinaryChart('${chartId}', '${w}')" data-window="${w}" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${w === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">${w === 'all' ? 'All' : w.toUpperCase()}</button>`).join('')}
                </div>
                <div id="${chartId}-tooltip" class="text-xs text-gray-500 h-4"></div>
            </div>
            <div id="${chartId}-svg"></div>
        </div>`;
    },

    _renderBinaryChart(chartId, timeWindow) {
        const rawData = globalThis['_chartData_' + chartId];
        if (!rawData) return;

        // Update tab styles
        const tabs = document.getElementById(chartId + '-tabs');
        if (tabs) tabs.querySelectorAll('button').forEach(btn => {
            btn.className = btn.dataset.window === timeWindow
                ? 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors bg-white text-gray-900 shadow-sm'
                : 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors text-gray-500 hover:text-gray-700';
        });

        const history = rawData.map(h => ({ t: new Date(h.t), p: h.p }));
        const filtered = this._filterByWindow(history, timeWindow);
        if (filtered.length < 2) return;

        const width = 500, height = 180;
        const padding = { top: 15, right: 15, bottom: 30, left: 42 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const values = filtered.map(h => h.p);
        const min = Math.max(0, Math.min(...values) - 0.05);
        const max = Math.min(1, Math.max(...values) + 0.05);
        const range = max - min || 0.1;

        const toX = (i) => padding.left + (i / (filtered.length - 1)) * chartW;
        const toY = (v) => padding.top + chartH - ((v - min) / range) * chartH;

        const pts = filtered.map((h, i) => [toX(i), toY(h.p)]);
        const linePath = this._smoothPath(pts);
        const areaPath = `M${toX(0)},${toY(min)} ${linePath.slice(1)} L${toX(filtered.length - 1)},${toY(min)} Z`;

        const lastVal = filtered[filtered.length - 1].p;
        const firstVal = filtered[0].p;
        const color = lastVal >= firstVal ? '#22c55e' : '#ef4444';
        const change = lastVal - firstVal;
        const changePct = Math.round(change * 100);

        // Y-axis
        const ySteps = [min, min + range * 0.25, min + range * 0.5, min + range * 0.75, max];
        const yLabels = ySteps.map(v => {
            const y = toY(v);
            return `<text x="${padding.left - 5}" y="${y + 3.5}" text-anchor="end" fill="#9ca3af" font-size="10" font-family="Inter, sans-serif">${Math.round(v * 100)}%</text>
                    <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f0f0f0" stroke-width="1"/>`;
        }).join('');

        // X-axis with real dates
        const ticks = this._xTicks(filtered);
        const xLabels = ticks.map(i => {
            const x = toX(i);
            return `<text x="${x}" y="${height - 5}" text-anchor="middle" fill="#9ca3af" font-size="9" font-family="Inter, sans-serif">${this._formatDate(filtered[i].t, timeWindow)}</text>`;
        }).join('');

        // Invisible hover zones for tooltip
        const hoverZones = filtered.map((h, i) => {
            const x = toX(i);
            const zoneW = chartW / filtered.length;
            const dateStr = h.t.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }) + ' ' + h.t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `<rect x="${x - zoneW / 2}" y="${padding.top}" width="${zoneW}" height="${chartH}" fill="transparent"
                onmouseenter="document.getElementById('${chartId}-tooltip').textContent='${Math.round(h.p * 100)}% — ${dateStr}'; document.getElementById('${chartId}-crosshair').setAttribute('x1','${x}'); document.getElementById('${chartId}-crosshair').setAttribute('x2','${x}'); document.getElementById('${chartId}-crosshair').style.opacity=1; document.getElementById('${chartId}-dot').setAttribute('cx','${x}'); document.getElementById('${chartId}-dot').setAttribute('cy','${toY(h.p)}'); document.getElementById('${chartId}-dot').style.opacity=1;"
                onmouseleave="document.getElementById('${chartId}-tooltip').textContent=''; document.getElementById('${chartId}-crosshair').style.opacity=0; document.getElementById('${chartId}-dot').style.opacity=0;"/>`;
        }).join('');

        const svg = `<svg width="100%" viewBox="0 0 ${width} ${height}" class="block" style="overflow:visible">
            ${yLabels}${xLabels}
            <path fill="${color}" fill-opacity="0.08" d="${areaPath}"/>
            <path fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="${linePath}"/>
            <circle cx="${toX(filtered.length - 1)}" cy="${toY(lastVal)}" r="4" fill="${color}" stroke="white" stroke-width="2"/>
            <line id="${chartId}-crosshair" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + chartH}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="3,3" style="opacity:0;transition:opacity 0.1s"/>
            <circle id="${chartId}-dot" cx="0" cy="0" r="4" fill="${color}" stroke="white" stroke-width="2" style="opacity:0;transition:opacity 0.1s"/>
            ${hoverZones}
        </svg>
        <div class="flex items-center gap-2 mt-1 text-xs">
            <span class="${change >= 0 ? 'text-green-600' : 'text-red-500'} font-medium">${change >= 0 ? '+' : ''}${changePct}pp</span>
            <span class="text-gray-400">since ${this._formatDate(filtered[0].t, timeWindow)}</span>
        </div>`;

        const container = document.getElementById(chartId + '-svg');
        if (container) container.innerHTML = svg;
    },

    // Multi-outcome chart with time windows
    chartMulti(history, options, width = 500, height = 220, marketId = null, createdAt = null) {
        if (!history || history.length < 2 || !options) return '<div class="text-gray-400 text-sm text-center py-4">Not enough data for chart</div>';
        const chartId = this._nextChartId();
        const colors = this._chartColors;

        // Normalize: each entry is {t, p} where p is an array
        const fullHistory = history.map((entry, i) => {
            if (entry && typeof entry === 'object' && entry.t !== undefined && entry.p !== undefined) {
                return { t: new Date(entry.t).getTime(), p: entry.p };
            }
            // Legacy: p is the entry itself (an array of probs)
            const probArr = Array.isArray(entry) ? entry : [];
            const start = createdAt ? new Date(createdAt).getTime() : Date.now() - 86400000 * 7;
            const span = Date.now() - start;
            const step = history.length > 1 ? span / (history.length - 1) : 0;
            return { t: start + i * step, p: probArr };
        });

        const windows = ['1d', '1w', '1m', 'all'];

        // Legend HTML
        const lastEntry = fullHistory[fullHistory.length - 1].p;
        const legend = options.map((opt, i) => {
            const lastProb = Array.isArray(lastEntry) ? (lastEntry[i] || 0) : 0;
            return `<span class="inline-flex items-center gap-1 mr-3 text-xs">
                <span class="inline-block w-3 h-1.5 rounded" style="background:${colors[i % colors.length]}"></span>
                <span class="text-gray-600">${esc(opt.label)}</span>
                <span class="font-medium text-gray-800">${Math.round(lastProb * 100)}%</span>
            </span>`;
        }).join('');

        // Store data and schedule initial render after DOM update
        globalThis['_chartData_' + chartId] = { data: fullHistory, opts: options.map(o => o.label) };
        setTimeout(() => this._renderMultiChart(chartId, 'all'), 0);

        return `
        <div id="${chartId}" class="chart-container">
            <div class="flex items-center justify-between mb-3">
                <div class="flex gap-1 bg-gray-100 rounded-lg p-0.5" id="${chartId}-tabs">
                    ${windows.map(w => `<button onclick="Components._renderMultiChart('${chartId}', '${w}')" data-window="${w}" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${w === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">${w === 'all' ? 'All' : w.toUpperCase()}</button>`).join('')}
                </div>
                <div id="${chartId}-tooltip" class="text-xs text-gray-500 h-4"></div>
            </div>
            <div id="${chartId}-svg"></div>
            <div class="flex flex-wrap gap-y-1 mt-2">${legend}</div>
        </div>`;
    },

    _renderMultiChart(chartId, timeWindow) {
        const raw = globalThis['_chartData_' + chartId];
        if (!raw) return;
        const { data: rawData, opts } = raw;
        const colors = this._chartColors;
        const n = opts.length;

        // Update tabs
        const tabs = document.getElementById(chartId + '-tabs');
        if (tabs) tabs.querySelectorAll('button').forEach(btn => {
            btn.className = btn.dataset.window === timeWindow
                ? 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors bg-white text-gray-900 shadow-sm'
                : 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors text-gray-500 hover:text-gray-700';
        });

        const history = rawData.map(h => ({ t: new Date(h.t), p: h.p }));
        const filtered = this._filterByWindow(history, timeWindow);
        if (filtered.length < 2) return;

        const width = 500, height = 180;
        const padding = { top: 15, right: 15, bottom: 30, left: 42 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const toX = (i) => padding.left + (i / (filtered.length - 1)) * chartW;
        const toY = (v) => padding.top + chartH - v * chartH;

        // Y-axis: 0-100%
        const yLabels = [0, 0.25, 0.5, 0.75, 1].map(v => {
            const y = toY(v);
            return `<text x="${padding.left - 5}" y="${y + 3.5}" text-anchor="end" fill="#9ca3af" font-size="10" font-family="Inter, sans-serif">${Math.round(v * 100)}%</text>
                    <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f0f0f0" stroke-width="1"/>`;
        }).join('');

        // X-axis
        const ticks = this._xTicks(filtered);
        const xLabels = ticks.map(i => {
            return `<text x="${toX(i)}" y="${height - 5}" text-anchor="middle" fill="#9ca3af" font-size="9" font-family="Inter, sans-serif">${this._formatDate(filtered[i].t, timeWindow)}</text>`;
        }).join('');

        // Lines
        const lines = Array.from({ length: n }, (_, optIdx) => {
            const pts = filtered.map((h, i) => {
                const prob = Array.isArray(h.p) ? (h.p[optIdx] || 0) : 0;
                return [toX(i), toY(prob)];
            });
            const linePath = this._smoothPath(pts);
            const color = colors[optIdx % colors.length];
            const lastProb = Array.isArray(filtered[filtered.length - 1].p) ? (filtered[filtered.length - 1].p[optIdx] || 0) : 0;
            return `<path fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="${linePath}" opacity="0.85"/>
                    <circle cx="${toX(filtered.length - 1)}" cy="${toY(lastProb)}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"/>`;
        }).join('');

        // Hover zones
        const hoverZones = filtered.map((h, i) => {
            const x = toX(i);
            const zoneW = chartW / filtered.length;
            const dateStr = h.t.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + h.t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const probTexts = opts.map((label, oi) => {
                const prob = Array.isArray(h.p) ? (h.p[oi] || 0) : 0;
                return label + ': ' + Math.round(prob * 100) + '%';
            }).join(' · ');
            return `<rect x="${x - zoneW / 2}" y="${padding.top}" width="${zoneW}" height="${chartH}" fill="transparent"
                onmouseenter="document.getElementById('${chartId}-tooltip').textContent='${dateStr} — ${probTexts.replace(/'/g, "\\'")}'; document.getElementById('${chartId}-crosshair').setAttribute('x1','${x}'); document.getElementById('${chartId}-crosshair').setAttribute('x2','${x}'); document.getElementById('${chartId}-crosshair').style.opacity=1;"
                onmouseleave="document.getElementById('${chartId}-tooltip').textContent=''; document.getElementById('${chartId}-crosshair').style.opacity=0;"/>`;
        }).join('');

        const svg = `<svg width="100%" viewBox="0 0 ${width} ${height}" class="block" style="overflow:visible">
            ${yLabels}${xLabels}${lines}
            <line id="${chartId}-crosshair" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + chartH}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="3,3" style="opacity:0;transition:opacity 0.1s"/>
            ${hoverZones}
        </svg>`;

        const container = document.getElementById(chartId + '-svg');
        if (container) container.innerHTML = svg;
    },

    // Multi-outcome sparkline: one line per option (compact)
    sparklineMulti(history, options, width = 120, height = 32) {
        if (!history || history.length < 2 || !options) return '';
        const n = options.length;
        const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#6366f1'];
        const step = width / (history.length - 1);

        const lines = Array.from({ length: n }, (_, optIdx) => {
            const pts = history.map((h, i) => {
                const val = (h && typeof h === 'object' && h.p !== undefined) ? h.p : h;
                const prob = Array.isArray(val) ? (val[optIdx] || 0) : 0;
                return [i * step, height - prob * height];
            });
            const linePath = this._smoothPath(pts);
            return `<path fill="none" stroke="${colors[optIdx % colors.length]}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="${linePath}" opacity="0.8"/>`;
        }).join('');

        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="inline-block">${lines}</svg>`;
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
        // Primary nav — always visible
        const primaryNav = [
            { id: 'dashboard',   label: 'Dashboard',   icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>' },
            { id: 'markets',     label: 'Markets',     icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
            { id: 'leaderboard', label: 'Leaderboard', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>' },
            { id: 'create',      label: 'Create',      icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' },
            { id: 'tournaments', label: 'Tournaments',  icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15V9m-3 6V11m6 4v-2M5 20h14M8 20v-3a2 2 0 012-2h4a2 2 0 012 2v3M8 9.5V7a4 4 0 118 0v2.5"/></svg>' },
        ];

        // Secondary nav — lives in "More" dropdown
        const pendingCount = (AppState.pendingMarkets || []).length;
        const moreNav = [
            { id: 'briefing', label: 'Intel Briefing', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' },
            { id: 'analytics', label: 'Analytics',     icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
            { id: 'guide',    label: 'Guide',          icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>' },
        ];
        if (AppState.user?.is_admin) {
            moreNav.push({ id: 'admin', label: 'Admin' + (pendingCount > 0 ? ` (${pendingCount})` : ''), icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>', badge: pendingCount });
        }

        const allMobileNav = [...primaryNav, ...moreNav];
        const moreIds = new Set(moreNav.map(i => i.id));
        const moreActive = moreIds.has(AppState.currentPage);

        const unread = AppState.unreadCount;
        const uid = AppState.session?.user?.id || '';

        return `
            <header class="gradient-bg text-white sticky top-0 z-50 shadow-lg">
                <div class="max-w-7xl mx-auto px-4 sm:px-6">
                    <div class="flex items-center justify-between h-14 sm:h-16">
                        <!-- Logo -->
                        <div class="flex items-center gap-2 cursor-pointer shrink-0" onmousedown="if(event.button===0)AppState.navigate('dashboard')">
                            <svg class="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 32 32" fill="none">
                                <rect width="32" height="32" rx="7" fill="white" fill-opacity="0.15"/>
                                <polyline points="4,26 10,22 15,18 19,10 23,14 28,6" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                <polygon points="19,10 28,6 23,14" fill="white" opacity="0.4"/>
                            </svg>
                            <span class="hidden sm:block font-bold text-lg tracking-tight">SharkPool</span>
                        </div>

                        <!-- Desktop primary nav -->
                        <nav class="hidden md:flex items-center gap-0.5">
                            ${primaryNav.map(item => `
                                <button id="nav-${item.id}" onmousedown="if(event.button===0)AppState.navigate('${item.id}')"
                                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${AppState.currentPage === item.id ? 'bg-white/20 text-white shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}">
                                    ${item.icon} ${item.label}
                                </button>
                            `).join('')}

                            <!-- More dropdown -->
                            <div class="relative" id="more-menu-container">
                                <button onclick="toggleMoreMenu()" id="more-menu-btn"
                                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${moreActive ? 'bg-white/20 text-white shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01"/></svg>
                                    More
                                    ${pendingCount > 0 && AppState.user?.is_admin ? `<span class="bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">${pendingCount}</span>` : ''}
                                </button>
                                <div id="more-menu" class="hidden absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                                    ${moreNav.map(item => `
                                        <button onmousedown="if(event.button===0){AppState.navigate('${item.id}');closeMoreMenu()}"
                                            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors
                                            ${AppState.currentPage === item.id ? 'bg-shark-50 text-shark-700' : 'text-gray-700 hover:bg-gray-50'}">
                                            <span class="${AppState.currentPage === item.id ? 'text-shark-600' : 'text-gray-400'}">${item.icon}</span>
                                            ${item.label}
                                            ${item.badge ? `<span class="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">${item.badge}</span>` : ''}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </nav>

                        <!-- Right controls -->
                        <div class="flex items-center gap-1.5 sm:gap-2">
                            <button onclick="AppState.toggleDarkMode()" class="text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10" title="Toggle dark mode">
                                ${AppState.darkMode
                                    ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
                                    : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>'
                                }
                            </button>
                            <button id="nav-notifications" onmousedown="if(event.button===0)AppState.navigate('notifications')" class="relative text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                ${unread > 0 ? `<span class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">${unread > 9 ? '9+' : unread}</span>` : ''}
                            </button>
                            <div id="tour-balance" class="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                                <span class="text-sm font-semibold">${(AppState.user?.balance || 0).toLocaleString()}</span>
                                <span class="text-xs text-white/50 hidden sm:inline">SB</span>
                            </div>
                            <button onclick="AppState.navigate('profile', { profileId: '${uid}' })" class="cursor-pointer">
                                ${this.avatar(AppState.user?.avatar || 'XX', 'sm')}
                            </button>
                            <button onclick="handleLogout()" class="text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 hidden sm:block" title="Sign Out">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Mobile nav -->
                    <div class="flex md:hidden gap-1 pb-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                        ${allMobileNav.map(item => `
                            <button onmousedown="if(event.button===0)AppState.navigate('${item.id}')"
                                class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                                ${AppState.currentPage === item.id ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}">
                                ${item.label}${item.badge ? ` <span class="bg-red-500 text-white text-xs px-1 rounded-full">${item.badge}</span>` : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </header>
            <div class="bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
                ⚠️ <strong>Testing mode:</strong> This platform is currently in development. All markets are for demonstration purposes only and carry no real-world value.
            </div>
        `;
    },

    footer() {
        const year = new Date().getFullYear();
        return `
        <footer class="border-t border-gray-100 dark:border-gray-800 mt-12 py-6 px-4">
            <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-600">
                <div class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 opacity-60" viewBox="0 0 32 32" fill="none">
                        <rect width="32" height="32" rx="6" fill="#0059a3"/>
                        <path d="M16 6 L18 18 L26 22 L6 22 L14 18 Z" fill="white" opacity="0.9"/>
                    </svg>
                    <span>SharkPool &copy; ${year} &mdash; Built by Dan Bourdeau at SharkNinja. All rights reserved.</span>
                </div>
                <a href="mailto:daniel.bourdeau@sharkninja.com" class="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">daniel.bourdeau@sharkninja.com</a>
            </div>
        </footer>`;
    },
};

// ==================== GUIDED TOUR ====================

const Tour = {
    _step: 0,
    _active: false,

    steps: [
        {
            target: () => document.getElementById('tour-balance'),
            title: 'Your SharkBuck Balance',
            text: 'You start with 1,000 SharkBucks. Use them to buy shares on predictions you believe in. Winning predictions pay out!',
            icon: '💰',
        },
        {
            target: () => document.getElementById('nav-markets'),
            title: 'Browse Markets',
            text: 'Markets are questions about the future. Browse open markets, filter by category, and find questions you have insight on.',
            icon: '📊',
        },
        {
            target: () => document.querySelector('.cursor-pointer.rounded-xl'),
            title: 'Market Cards',
            text: 'Each card shows the current probability and trading activity. Click any market to see details, charts, and place a trade.',
            icon: '🎯',
        },
        {
            target: () => document.getElementById('nav-create'),
            title: 'Create a Market',
            text: 'Got a question worth predicting? Create your own market! Markets need admin approval before going live.',
            icon: '✨',
        },
        {
            target: () => document.getElementById('nav-leaderboard'),
            title: 'Leaderboard & Prizes',
            text: 'Compete with your colleagues! Top forecasters earn points and can win quarterly prizes. Check the leaderboard to see where you stand.',
            icon: '🏆',
        },
        {
            target: () => document.getElementById('nav-notifications'),
            title: 'Stay Updated',
            text: "You'll get notified when markets you're watching move, when your predictions pay out, and when new markets launch. That's it — you're ready to start!",
            icon: '🔔',
        },
    ],

    start() {
        this._step = 0;
        this._active = true;
        this._onKeyDown = (e) => { if (e.key === 'Escape') Tour.end(); else if (e.key === 'ArrowRight') Tour.next(); else if (e.key === 'ArrowLeft') Tour.prev(); };
        this._onResize = () => { if (this._active) this._render(); };
        document.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('resize', this._onResize);
        this._render();
    },

    next() {
        if (this._step < this.steps.length - 1) {
            this._step++;
            this._render();
        } else {
            this.end();
        }
    },

    prev() {
        if (this._step > 0) {
            this._step--;
            this._render();
        }
    },

    end() {
        this._active = false;
        const overlay = document.getElementById('tour-overlay');
        if (overlay) overlay.remove();
        if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        AppState.completeOnboarding();
    },

    _render() {
        const step = this.steps[this._step];
        const el = step.target();

        // Remove existing overlay
        let overlay = document.getElementById('tour-overlay');
        if (overlay) overlay.remove();

        // Create overlay container
        overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.className = 'tour-overlay';
        document.body.appendChild(overlay);

        // Calculate target rect (or center of screen if target not found)
        const pad = 8;
        let rect;
        if (el) {
            const r = el.getBoundingClientRect();
            rect = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
            // Scroll into view if needed
            if (r.top < 0 || r.bottom > window.innerHeight) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const r2 = el.getBoundingClientRect();
                rect = { x: r2.left - pad, y: r2.top - pad, w: r2.width + pad * 2, h: r2.height + pad * 2 };
            }
        } else {
            rect = { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 30, w: 200, h: 60 };
        }

        // SVG overlay with cutout
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';

        const defs = document.createElementNS(svgNS, 'defs');
        const mask = document.createElementNS(svgNS, 'mask');
        mask.id = 'tour-mask';

        const maskBg = document.createElementNS(svgNS, 'rect');
        maskBg.setAttribute('width', '100%');
        maskBg.setAttribute('height', '100%');
        maskBg.setAttribute('fill', 'white');

        const cutout = document.createElementNS(svgNS, 'rect');
        cutout.setAttribute('x', rect.x);
        cutout.setAttribute('y', rect.y);
        cutout.setAttribute('width', rect.w);
        cutout.setAttribute('height', rect.h);
        cutout.setAttribute('rx', '8');
        cutout.setAttribute('fill', 'black');

        mask.appendChild(maskBg);
        mask.appendChild(cutout);
        defs.appendChild(mask);
        svg.appendChild(defs);

        const bg = document.createElementNS(svgNS, 'rect');
        bg.setAttribute('width', '100%');
        bg.setAttribute('height', '100%');
        bg.setAttribute('fill', 'rgba(0,0,0,0.55)');
        bg.setAttribute('mask', 'url(#tour-mask)');
        svg.appendChild(bg);

        // Highlight border around target
        const highlight = document.createElementNS(svgNS, 'rect');
        highlight.setAttribute('x', rect.x);
        highlight.setAttribute('y', rect.y);
        highlight.setAttribute('width', rect.w);
        highlight.setAttribute('height', rect.h);
        highlight.setAttribute('rx', '8');
        highlight.setAttribute('fill', 'none');
        highlight.setAttribute('stroke', '#0c8eeb');
        highlight.setAttribute('stroke-width', '2');
        svg.appendChild(highlight);

        overlay.appendChild(svg);

        // Position tooltip
        const isLast = this._step === this.steps.length - 1;
        const isFirst = this._step === 0;
        const tooltip = document.createElement('div');
        tooltip.className = 'tour-tooltip';

        // Determine if tooltip should go above or below target
        const spaceBelow = window.innerHeight - (rect.y + rect.h);
        const showBelow = spaceBelow > 220 || rect.y < 200;

        if (showBelow) {
            tooltip.classList.add('arrow-top');
            tooltip.style.top = (rect.y + rect.h + 12) + 'px';
        } else {
            tooltip.classList.add('arrow-bottom');
            tooltip.style.bottom = (window.innerHeight - rect.y + 12) + 'px';
        }

        // Horizontal position — try to align with target, clamp to viewport
        let left = rect.x;
        const maxLeft = window.innerWidth - 356; // 340 max-width + 16 padding
        if (left > maxLeft) left = maxLeft;
        if (left < 16) left = 16;
        tooltip.style.left = left + 'px';

        // Adjust arrow position to point at target center
        const arrowLeft = Math.max(16, Math.min(rect.x + rect.w / 2 - left, 300));

        // Step dots
        const dots = this.steps.map((_, i) =>
            `<span class="${i === this._step ? 'active' : ''}"></span>`
        ).join('');

        tooltip.innerHTML = `
            <div class="flex items-start gap-3 mb-3">
                <span class="text-2xl">${step.icon}</span>
                <div>
                    <div class="font-bold text-gray-900 text-sm">${step.title}</div>
                    <div class="text-xs text-gray-400 mt-0.5">Step ${this._step + 1} of ${this.steps.length}</div>
                </div>
            </div>
            <p class="text-sm text-gray-600 mb-4 leading-relaxed">${step.text}</p>
            <div class="flex items-center justify-between">
                <div class="tour-step-dots">${dots}</div>
                <div class="flex gap-2">
                    ${!isFirst ? '<button onclick="Tour.prev()" class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium">Back</button>' : '<button onclick="Tour.end()" class="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 font-medium">Skip</button>'}
                    <button onclick="Tour.next()" class="px-4 py-1.5 bg-shark-600 text-white text-sm font-semibold rounded-lg hover:bg-shark-700 transition-colors">${isLast ? 'Get Started!' : 'Next'}</button>
                </div>
            </div>
        `;

        // Fix arrow position via inline style on the pseudo-element
        const arrowStyle = document.createElement('style');
        arrowStyle.textContent = `#tour-overlay .tour-tooltip::before { left: ${arrowLeft}px !important; }`;
        overlay.appendChild(arrowStyle);

        overlay.appendChild(tooltip);

        // Click on overlay background dismisses tour
        svg.addEventListener('click', () => Tour.end());
    },
};
