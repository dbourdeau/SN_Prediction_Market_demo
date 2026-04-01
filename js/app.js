// Main app initialization and event handlers

function render() {
    const app = document.getElementById('app');

    if (AppState.loading && !AppState.session) {
        app.innerHTML = `<div class="min-h-screen flex items-center justify-center">
            <div class="text-center">
                <div class="inline-block w-8 h-8 border-4 border-shark-200 border-t-shark-600 rounded-full animate-spin mb-4"></div>
                <p class="text-gray-500 text-sm">Loading...</p>
            </div>
        </div>`;
        return;
    }

    try {
        let pageContent = '';
        switch (AppState.currentPage) {
            case 'login': pageContent = Pages.login(); break;
            case 'dashboard': pageContent = Pages.dashboard(); break;
            case 'markets': pageContent = Pages.markets(); break;
            case 'market': pageContent = Pages.market(); break;
            case 'leaderboard': pageContent = Pages.leaderboard(); break;
            case 'create': pageContent = Pages.create(); break;
            case 'notifications': pageContent = Pages.notifications(); break;
            case 'profile': pageContent = Pages.profile(); break;
            case 'admin': pageContent = Pages.admin(); break;
            case 'transactions': pageContent = Pages.transactions(); break;
            case 'analytics': pageContent = Pages.analytics(); break;
            case 'briefing': pageContent = Pages.briefing(); break;
            case 'guide': pageContent = Pages.guide(); break;
            case 'tournaments': pageContent = Pages.tournaments(); break;
            case 'tournament': pageContent = Pages.tournament(); break;
            default: pageContent = Pages.dashboard();
        }

        const progressBar = AppState.navigating ? '<div class="nav-progress"></div>' : '';
        const savedScroll = AppState.navigating ? 0 : window.scrollY;
        if (AppState.currentPage === 'login') {
            app.innerHTML = pageContent;
        } else {
            app.innerHTML = progressBar + Components.header() + '<main>' + pageContent + '</main>' + Components.footer();
        }
        if (savedScroll > 0) window.scrollTo(0, savedScroll);

        // Restore search input value after re-render (debounced search causes re-render)
        const searchInput = document.getElementById('market-search');
        if (searchInput && AppState.searchQuery && searchInput.value !== AppState.searchQuery) {
            searchInput.value = AppState.searchQuery;
        }

        // Animate probability counter on market detail page
        const counter = document.getElementById('prob-counter');
        if (counter && counter.dataset.target) {
            const target = parseInt(counter.dataset.target);
            let current = 0;
            const duration = 3000;
            const start = performance.now();
            const animate = (now) => {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                current = Math.round(eased * target);
                counter.textContent = current + '%';
                if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        }

        // Animate stat counters on dashboard
        document.querySelectorAll('.stat-counter').forEach(el => {
            const target = parseInt(el.dataset.target);
            const prefix = el.dataset.prefix || '';
            const suffix = el.dataset.suffix || '';
            const fallback = el.dataset.fallback;
            if (fallback && (isNaN(target) || target === 0)) {
                el.textContent = fallback;
                return;
            }
            if (isNaN(target)) return;
            const isNeg = target < 0;
            const absTarget = Math.abs(target);
            const duration = 1500;
            const startTime = performance.now();
            const tick = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(eased * absTarget);
                el.textContent = prefix + (isNeg ? '-' : '') + current.toLocaleString() + suffix;
                if (progress < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    } catch (err) {
        console.error('Render error:', err);
        app.innerHTML = Components.header() + `<main>
            <div class="max-w-xl mx-auto px-4 py-16 text-center">
                <div class="text-4xl mb-4">⚠️</div>
                <h2 class="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
                <p class="text-gray-500 text-sm mb-6">An error occurred rendering this page. Try navigating elsewhere.</p>
                <div class="flex gap-3 justify-center">
                    <button onclick="AppState.navigate('dashboard')" class="bg-shark-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-shark-700">Go to Dashboard</button>
                    <button onclick="location.reload()" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">Reload Page</button>
                </div>
                <p class="text-xs text-gray-400 mt-4">${esc(err.message)}</p>
            </div>
        </main>`;
    }
}

// ==================== FEATURED MARKET CAROUSEL ====================

function featuredNext() {
    if (featuredCandidateCount < 2) return;
    featuredIdx = (featuredIdx + 1) % featuredCandidateCount;
    if (AppState.currentPage === 'dashboard') AppState.notify();
}

function featuredPrev() {
    if (featuredCandidateCount < 2) return;
    featuredIdx = (featuredIdx - 1 + featuredCandidateCount) % featuredCandidateCount;
    if (AppState.currentPage === 'dashboard') AppState.notify();
}

function featuredGoTo(idx) {
    featuredIdx = idx;
    if (AppState.currentPage === 'dashboard') AppState.notify();
}

// ==================== AUTH ====================

function switchAuthTab(tab) {
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');

    if (!signinForm || !signupForm || !tabSignin || !tabSignup) return;

    document.getElementById('auth-error')?.classList.add('hidden');
    document.getElementById('auth-success')?.classList.add('hidden');

    if (tab === 'signin') {
        signinForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        tabSignin.className = 'flex-1 py-2 text-sm font-semibold text-center border-b-2 border-shark-600 text-shark-600';
        tabSignup.className = 'flex-1 py-2 text-sm font-semibold text-center border-b-2 border-gray-200 text-gray-400';
    } else {
        signinForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        tabSignup.className = 'flex-1 py-2 text-sm font-semibold text-center border-b-2 border-shark-600 text-shark-600';
        tabSignin.className = 'flex-1 py-2 text-sm font-semibold text-center border-b-2 border-gray-200 text-gray-400';
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const btn = document.getElementById('login-btn');

    if (!email || !password) { showAuthError('Please enter email and password'); return; }
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
        await AppState.login(email, password);
    } catch (e) {
        showAuthError(e.message || 'Sign in failed.');
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

async function handleSignup() {
    const name = document.getElementById('signup-name')?.value?.trim();
    const department = document.getElementById('signup-department')?.value;
    const email = document.getElementById('signup-email')?.value?.trim();
    const password = document.getElementById('signup-password')?.value;
    const btn = document.getElementById('signup-btn');

    if (!name) { showAuthError('Please enter your name'); return; }
    if (!email) { showAuthError('Please enter your email'); return; }
    if (!password || password.length < 8) { showAuthError('Password must be at least 8 characters'); return; }
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Creating account...';
    try {
        const result = await AppState.signup(email, password, name, department);
        if (result === 'confirm') {
            showAuthSuccess('Account created! Check your email to confirm, then sign in.');
            switchAuthTab('signin');
        }
    } catch (e) {
        showAuthError(e.message || 'Sign up failed.');
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

async function handleForgotPassword() {
    const email = document.getElementById('login-email')?.value?.trim();
    if (!email) { showAuthError('Enter your email above, then click Forgot password'); return; }

    try {
        await AppState.resetPassword(email);
        showAuthSuccess('Password reset email sent! Check your inbox.');
    } catch (e) {
        showAuthError(e.message || 'Failed to send reset email.');
    }
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    document.getElementById('auth-success')?.classList.add('hidden');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function showAuthSuccess(msg) {
    const el = document.getElementById('auth-success');
    document.getElementById('auth-error')?.classList.add('hidden');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

async function handleLogout() {
    await AppState.logout();
}

// ==================== SURGICAL DOM PATCHING ====================
// Updates only the price/balance elements on the market page — no full re-render, no scroll jump.

function _patchMarketDOM(market, balance) {
    if (!market) return;
    const isMulti = market.market_type === 'multi';

    // Header balance badge
    const balEl = document.querySelector('#tour-balance span:first-child');
    if (balEl) balEl.textContent = (balance || 0).toLocaleString();

    // Trading panel "of Xt" label
    const ofLabel = document.querySelector('#pred-amount ~ span');
    if (ofLabel && ofLabel.textContent.includes('t')) ofLabel.textContent = `of ${(balance || 0).toLocaleString()}t`;

    if (isMulti) {
        const probs = market.probabilities || [];
        // Probability bar segments
        const bars = document.querySelectorAll('.prob-bar');
        bars.forEach((bar, i) => {
            if (probs[i] !== undefined) bar.style.width = Math.round(probs[i] * 100) + '%';
        });
        // Option buy buttons — update the probability badge inside each
        (market.options || []).forEach((_opt, i) => {
            const btn = document.getElementById(`btn-opt-${i}-${market.id}`);
            if (btn) {
                const badge = btn.querySelector('span:last-child');
                if (badge) badge.textContent = Math.round((probs[i] || 0) * 100) + '%';
            }
        });
    } else {
        const pct = Math.round((market.probability || 0.5) * 100);
        // Big probability counter
        const counter = document.getElementById('prob-counter');
        if (counter) {
            counter.textContent = pct + '%';
            counter.className = counter.className.replace(/text-(green|red)-\d+/, pct >= 50 ? 'text-green-600' : 'text-red-500');
        }
        // Probability bar
        const bar = document.querySelector('.prob-bar');
        if (bar) {
            bar.style.width = pct + '%';
            bar.className = bar.className.replace(/bg-(green|red)-\d+/, pct >= 50 ? 'bg-green-500' : 'bg-red-400');
        }
        // YES/NO labels under buy buttons
        const yesBtn = document.getElementById(`btn-yes-${market.id}`);
        const noBtn = document.getElementById(`btn-no-${market.id}`);
        if (yesBtn) { const sub = yesBtn.querySelector('div'); if (sub) sub.textContent = `at ${pct}%`; }
        if (noBtn)  { const sub = noBtn.querySelector('div');  if (sub) sub.textContent = `at ${100 - pct}%`; }
        // Prob bar YES/NO labels below bar
        const probLabels = document.querySelectorAll('.prob-bar ~ div span');
        if (probLabels[0]) probLabels[0].textContent = `YES ${pct}%`;
        if (probLabels[1]) probLabels[1].textContent = `NO ${100 - pct}%`;
    }

    // Update trade estimate with new AMM state
    const estimateEl = document.getElementById('trade-estimate');
    if (estimateEl) {
        const amount = parseInt(document.getElementById('pred-amount')?.value || '50');
        if (isMulti) {
            estimateEl.innerHTML = _tradeEstimateHTMLMulti(market.q_values || [], market.options || [], amount);
        } else {
            estimateEl.innerHTML = _tradeEstimateHTML(market.q_yes || 0, market.q_no || 0, amount);
        }
    }
}

// ==================== PREDICTIONS ====================

async function handlePrediction(marketId, direction, optionIndex) {
    const amountInput = document.getElementById('pred-amount');
    const amount = parseInt(amountInput?.value || '50');
    const isMulti = optionIndex !== undefined && optionIndex !== null;
    const btn = isMulti
        ? document.getElementById(`btn-opt-${optionIndex}-${marketId}`)
        : document.getElementById(`btn-${direction}-${marketId}`);

    if (amount < 10) { showToast('Minimum prediction is 10 SharkBucks', 'error'); return; }
    if (!AppState.user) { showToast('You must be logged in to trade', 'error'); return; }
    if (amount > AppState.user.balance) { showToast(`Insufficient SharkBucks (you have ${AppState.user.balance})`, 'error'); return; }

    if (btn) { btn.dataset.origText = btn.textContent; btn.disabled = true; btn.textContent = 'Buying...'; }
    try {
        const result = await AppState.placePrediction(marketId, direction, amount, isMulti ? optionIndex : null,
            () => _patchMarketDOM(AppState.selectedMarket, AppState.user.balance)
        );
        if (result && result.error) {
            showToast(result.error, 'error');
        } else if (result) {
            showToast(`Bought ${result.shares.toFixed(1)} shares for ${amount} SharkBucks!`, 'success');
        } else {
            showToast('Trade failed — please try again', 'error');
        }
    } catch (e) {
        console.error('Prediction error:', e);
        showToast(e.message || 'Trade failed — please try again', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText || (direction === 'yes' ? 'Buy YES' : direction === 'no' ? 'Buy NO' : 'Buy'); }
    }
}

function updateTradeEstimate(marketId) {
    const market = AppState.markets.find(m => m.id === marketId);
    if (!market) return;

    const amount = parseInt(document.getElementById('pred-amount')?.value || '50');
    const el = document.getElementById('trade-estimate');
    if (el) {
        if (market.market_type === 'multi') {
            el.innerHTML = _tradeEstimateHTMLMulti(market.q_values || [], market.options || [], amount);
        } else {
            el.innerHTML = _tradeEstimateHTML(market.q_yes || 0, market.q_no || 0, amount);
        }
    }
}

// ==================== SELL POSITION ====================

async function handleSellPosition(predictionId) {
    const confirmed = await showModal({
        title: 'Sell Position',
        message: 'Sell this position? You will receive SharkBucks at the current market price.',
        confirmText: 'Sell',
        danger: false,
    });
    if (!confirmed) return;

    const btn = document.getElementById(`sell-btn-${predictionId}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Selling...'; }

    try {
        const result = await AppState.sellPosition(predictionId);
        if (result && result.error) {
            showToast(result.error, 'error');
        } else if (result && result.revenue !== undefined) {
            const profitLabel = result.profit >= 0 ? `+${result.profit}` : `${result.profit}`;
            showToast(`Position sold for ${result.revenue} SharkBucks (${profitLabel} profit)!`, result.profit >= 0 ? 'success' : 'info');
        } else {
            showToast('Failed to sell position.', 'error');
        }
    } catch (e) {
        showToast('Failed to sell position.', 'error');
    }
}

// ==================== MARKET TEMPLATES ====================

function applyMarketTemplate(index) {
    const t = MARKET_TEMPLATES[index];
    if (!t) return;
    const titleEl = document.getElementById('create-title');
    const descEl = document.getElementById('create-desc');
    const catEl = document.getElementById('create-category');
    if (titleEl) { titleEl.value = t.title; document.getElementById('title-count').textContent = t.title.length + '/200'; }
    if (descEl) { descEl.value = t.description; document.getElementById('desc-count').textContent = t.description.length + '/5000'; }
    if (catEl) catEl.value = t.category;
    titleEl?.focus();
    titleEl?.setSelectionRange(0, 0);
}

// ==================== MARKET CREATION ====================

async function handleCreateMarket() {
    const title = document.getElementById('create-title')?.value?.trim();
    const desc = document.getElementById('create-desc')?.value?.trim();
    const category = document.getElementById('create-category')?.value;
    const closesAt = document.getElementById('create-closes')?.value;
    const sourceUrl = document.getElementById('create-source-url')?.value?.trim() || null;
    const targetDept = document.getElementById('create-target-dept')?.value || null;
    const isPriority = document.getElementById('create-is-priority')?.checked || false;
    const btn = document.getElementById('create-market-btn');
    const isMulti = document.getElementById('type-multi')?.classList.contains('border-shark-600');

    if (!title) { showToast('Please enter a question', 'error'); return; }
    if (!desc) { showToast('Please enter a description', 'error'); return; }
    if (!closesAt) { showToast('Please set a closing date', 'error'); return; }

    let marketData = { title, description: desc, category, closesAt, source_url: sourceUrl, target_dept: targetDept, is_priority: isPriority };

    if (isMulti) {
        const inputs = document.querySelectorAll('.multi-option-input');
        const options = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
        if (options.length < 2) { showToast('Multi-outcome markets need at least 2 options', 'error'); return; }
        if (options.length > 8) { showToast('Maximum 8 options allowed', 'error'); return; }
        marketData.market_type = 'multi';
        marketData.options = options;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    try {
        const newMarket = await AppState.addMarket(marketData);
        if (newMarket.status === 'pending') {
            showToast('Market submitted for admin approval!', 'success');
            await AppState.navigate('markets');
        } else {
            showToast('Market created!', 'success');
            await AppState.navigate('market', { marketId: newMarket.id });
        }
    } catch (e) {
        showToast('Failed to create market.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Create Market'; }
    }
}

// ==================== MARKET EDITING ====================

function toggleEditMarket() {
    const form = document.getElementById('edit-market-form');
    if (form) {
        form.classList.toggle('hidden');
    }
}

async function handleEditMarket(marketId) {
    const title = document.getElementById('edit-title')?.value?.trim();
    const desc = document.getElementById('edit-desc')?.value?.trim();
    const closesAt = document.getElementById('edit-closes')?.value;
    const sourceUrl = document.getElementById('edit-source-url')?.value?.trim() || null;
    const targetDept = document.getElementById('edit-target-dept')?.value || null;
    const isPriority = document.getElementById('edit-is-priority')?.checked ?? false;
    const btn = document.getElementById('save-edit-btn');

    if (!title) { showToast('Title cannot be empty', 'error'); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    try {
        await AppState.editMarket(marketId, { title, description: desc, closes_at: closesAt || undefined, source_url: sourceUrl, target_dept: targetDept, is_priority: isPriority });
        showToast('Market updated!', 'success');
        toggleEditMarket();
    } catch (e) {
        showToast('Failed to update market.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
}

// ==================== MARKET RESOLUTION ====================

async function handleResolveMarket(marketId, resolution, winningIndex) {
    const market = AppState.markets.find(m => m.id === marketId);
    const isMulti = market?.market_type === 'multi';
    let label;
    if (isMulti && winningIndex >= 0 && market.options?.[winningIndex]) {
        label = market.options[winningIndex].label;
    } else {
        label = resolution.toUpperCase();
    }

    const confirmed = await showModal({
        title: `Resolve as ${label}?`,
        message: `Resolve "${market?.title || 'this market'}" as ${label}? This will trigger payouts and cannot be undone.`,
        confirmText: `Resolve ${label}`,
        danger: true,
    });
    if (!confirmed) return;

    const btn = isMulti
        ? document.getElementById(`resolve-opt-${winningIndex}-${marketId}`) || document.getElementById(`resolve-void-${marketId}`)
        : document.getElementById(`resolve-${resolution}-${marketId}`);
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
        await AppState.resolveMarket(marketId, resolution, isMulti ? winningIndex : null);
        showToast(`Market resolved as ${label}! Payouts processed.`, 'success');
    } catch (e) {
        showToast('Failed to resolve: ' + (e.message || 'Unknown error'), 'error');
        if (btn) { btn.disabled = false; btn.textContent = label; }
    }
}

// ==================== COMMENTS ====================

async function handleAddComment(marketId) {
    const input = document.getElementById('comment-input');
    const text = input?.value?.trim();
    if (!text) return;

    try {
        await AppState.addComment(marketId, text);
        if (input) input.value = '';
        showToast('Comment posted!', 'success');
    } catch (e) {
        showToast('Failed to post comment.', 'error');
    }
}

async function handleDeleteComment(commentId) {
    const confirmed = await showModal({
        title: 'Delete Comment',
        message: 'Are you sure you want to delete this comment?',
        confirmText: 'Delete',
        danger: true,
    });
    if (!confirmed) return;

    try {
        await AppState.deleteComment(commentId);
        showToast('Comment deleted.', 'info');
    } catch (e) {
        showToast('Failed to delete comment.', 'error');
    }
}

// ==================== ADMIN: USER MANAGEMENT ====================

async function handleToggleAdmin(userId, isAdmin) {
    const action = isAdmin ? 'grant admin to' : 'remove admin from';
    const confirmed = await showModal({
        title: isAdmin ? 'Grant Admin Access' : 'Remove Admin Access',
        message: `Are you sure you want to ${action} this user?`,
        confirmText: isAdmin ? 'Grant Admin' : 'Remove Admin',
        danger: !isAdmin,
    });
    if (!confirmed) return;

    try {
        await AppState.setUserAdmin(userId, isAdmin);
        showToast(isAdmin ? 'Admin access granted.' : 'Admin access removed.', 'success');
    } catch (e) {
        showToast('Failed to update user role.', 'error');
    }
}

async function handleAdjustBalance(userId, amount) {
    try {
        await AppState.adjustUserBalance(userId, amount);
        showToast(`Added ${amount} SharkBucks to user balance.`, 'success');
    } catch (e) {
        showToast('Failed to adjust balance.', 'error');
    }
}

// ==================== NOTIFICATIONS ====================

async function handleNotificationClick(notifId, marketId) {
    await AppState.markNotificationRead(notifId);
    await AppState.navigate('market', { marketId });
}

async function handleMarkNotifRead(notifId) {
    await AppState.markNotificationRead(notifId);
}

async function handleMarkAllRead() {
    await AppState.markAllRead();
    showToast('All notifications marked as read', 'info');
}

// ==================== MARKET APPROVAL ====================

async function handleApproveMarket(marketId) {
    try {
        await AppState.approveMarket(marketId);
        showToast('Market approved and now live!', 'success');
    } catch (e) {
        showToast('Failed to approve: ' + (e.message || 'Unknown error'), 'error');
    }
}

async function handleRejectMarket(marketId) {
    const reason = prompt('Rejection reason (optional):') || 'Does not meet guidelines';
    try {
        await AppState.rejectMarket(marketId, reason);
        showToast('Market rejected.', 'info');
    } catch (e) {
        showToast('Failed to reject: ' + (e.message || 'Unknown error'), 'error');
    }
}

async function handleDeleteMarket(marketId) {
    const market = AppState.markets.find(m => m.id === marketId);
    const title = market?.title || `Market #${marketId}`;
    showModal('Delete Market',
        `<p class="text-sm text-gray-700 mb-2">Permanently delete <strong>${esc(title)}</strong>?</p>
         <p class="text-xs text-red-600">This will remove the market, all predictions, and comments. This cannot be undone.</p>`,
        'Delete', async () => {
            try {
                await DB.deleteMarket(marketId, AppState.session.user.id);
                DB.logAuditEvent(AppState.session.user.id, 'delete_market', 'market', marketId, { title });
                await AppState._refreshMarkets();
                if (AppState.currentPage === 'market') AppState.navigate('markets');
                else AppState.notify();
                showToast('Market deleted.', 'info');
            } catch (e) {
                showToast('Failed to delete: ' + (e.message || 'Unknown error'), 'error');
            }
        });
}

// ==================== CSV EXPORT ====================

function exportToCSV(filename, headers, rows) {
    const escape = (val) => {
        const s = String(val ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function handleExportTransactions() {
    const txns = AppState.transactions || [];
    if (!txns.length) { showToast('No transactions to export', 'info'); return; }
    exportToCSV('transactions.csv',
        ['Date', 'Type', 'Amount', 'Balance After', 'Description'],
        txns.map(t => [new Date(t.created_at).toISOString(), t.type, t.amount, t.balance_after, t.description])
    );
    showToast('Transactions exported!', 'success');
}

function handleExportPredictions() {
    const preds = AppState.userPredictions || [];
    if (!preds.length) { showToast('No predictions to export', 'info'); return; }
    exportToCSV('predictions.csv',
        ['Date', 'Market', 'Direction', 'Amount', 'Shares', 'Status', 'Payout'],
        preds.map(p => [new Date(p.created_at).toISOString(), p.markets?.title || '', p.direction, p.amount, p.shares?.toFixed(2) || '', p.status, p.payout || 0])
    );
    showToast('Predictions exported!', 'success');
}

function handleExportMarkets() {
    const markets = AppState.markets || [];
    if (!markets.length) { showToast('No markets to export', 'info'); return; }
    exportToCSV('markets.csv',
        ['ID', 'Title', 'Category', 'Status', 'Probability', 'Volume', 'Traders', 'Created', 'Closes', 'Resolution'],
        markets.map(m => [m.id, m.title, m.category, m.status, Math.round(m.probability * 100) + '%', m.volume, m.traders, m.created_at, m.closes_at, m.resolution || ''])
    );
    showToast('Markets exported!', 'success');
}

// ==================== AVATAR ====================

async function handleSetAvatar(avatar) {
    try {
        await DB.updateProfile(AppState.session.user.id, { avatar });
        AppState.user.avatar = avatar;
        if (AppState.viewingProfile?.id === AppState.user.id) AppState.viewingProfile.avatar = avatar;
        AppState.notify();
        showToast('Avatar updated!', 'success');
    } catch (e) {
        showToast('Failed to update avatar.', 'error');
    }
}

// ==================== COMMENTS PAGINATION ====================

function handleShowMoreComments() {
    AppState._commentsShown = (AppState._commentsShown || 10) + 10;
    AppState.notify();
}

// ==================== WATCHLIST ====================

async function handleToggleWatchlist(marketId) {
    try {
        const wasWatching = AppState.isWatching(marketId);
        await AppState.toggleWatchlist(marketId);
        showToast(wasWatching ? 'Removed from watchlist' : 'Added to watchlist', 'info');
    } catch (e) {
        showToast('Failed to update watchlist.', 'error');
    }
}

// ==================== TOAST ====================

function showToast(message, type = 'info') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-shark-600' };
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `fixed bottom-6 right-6 ${colors[type]} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium z-50 fade-in max-w-sm`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== MULTI-OUTCOME HELPERS ====================

function toggleMarketType(type) {
    const binaryBtn = document.getElementById('type-binary');
    const multiBtn = document.getElementById('type-multi');
    const multiSection = document.getElementById('multi-options-section');
    const titleInput = document.getElementById('create-title');
    const descInput = document.getElementById('create-desc');
    const tipsBox = document.getElementById('create-tips');
    if (!binaryBtn || !multiBtn || !multiSection) return;

    if (type === 'multi') {
        multiBtn.className = 'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border-2 border-shark-600 bg-shark-50 text-shark-700';
        binaryBtn.className = 'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border-2 border-gray-200 text-gray-500 hover:border-gray-300';
        multiSection.classList.remove('hidden');
        if (titleInput && !titleInput.value) titleInput.placeholder = 'Which [option] will [outcome]? e.g. "Which product line will have the highest Q3 revenue?"';
        if (descInput && !descInput.value) descInput.placeholder = 'Resolution criteria: This market resolves to the option that [specific condition] as confirmed by [source of truth] by [date]. If none of the options apply, the market will be voided.\n\nBackground: [Provide relevant context for traders]';
        if (tipsBox) tipsBox.innerHTML = `
            <div class="font-semibold mb-1">Tips for multiple choice markets:</div>
            <ul class="list-disc ml-4 space-y-0.5">
                <li><strong>Mutually exclusive:</strong> Options should not overlap — only one can win</li>
                <li><strong>Exhaustive:</strong> Consider adding "Other" if the list may not cover all outcomes</li>
                <li><strong>Clear criteria:</strong> Define exactly how the winning option will be determined</li>
                <li><strong>Name your source:</strong> e.g. "Per the Q3 earnings report" or "As announced by leadership"</li>
            </ul>`;
    } else {
        binaryBtn.className = 'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border-2 border-shark-600 bg-shark-50 text-shark-700';
        multiBtn.className = 'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border-2 border-gray-200 text-gray-500 hover:border-gray-300';
        multiSection.classList.add('hidden');
        if (titleInput && !titleInput.value) titleInput.placeholder = 'Will [specific outcome] happen by [date]? e.g. "Will NinjaCreami exceed 1M units sold by Q3?"';
        if (descInput && !descInput.value) descInput.placeholder = 'Resolution criteria: This market resolves YES if [specific condition] as confirmed by [source of truth] by [date]. It resolves NO if [condition is not met]. If [edge case], the market will be voided.\n\nBackground: [Provide relevant context for traders]';
        if (tipsBox) tipsBox.innerHTML = `
            <div class="font-semibold mb-1">Tips for clear resolution criteria:</div>
            <ul class="list-disc ml-4 space-y-0.5">
                <li><strong>Be specific:</strong> Define exactly what outcome counts as YES vs NO</li>
                <li><strong>Name your source:</strong> e.g. "Per the Q3 earnings report" or "As announced in #general Slack"</li>
                <li><strong>Set a deadline:</strong> "By end of day March 31, 2026"</li>
                <li><strong>Edge cases:</strong> What happens if the event is delayed, cancelled, or ambiguous?</li>
            </ul>`;
    }
}

function addMultiOption() {
    const list = document.getElementById('multi-options-list');
    if (!list) return;
    const count = list.querySelectorAll('.multi-option-input').length;
    if (count >= 8) { showToast('Maximum 8 options', 'info'); return; }
    const div = document.createElement('div');
    div.className = 'flex gap-2';
    div.innerHTML = `<input type="text" class="multi-option-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500" placeholder="Option ${count + 1}" maxlength="100"/>
        <button onclick="this.parentElement.remove()" class="px-2 text-gray-400 hover:text-red-500 text-sm font-bold">✕</button>`;
    list.appendChild(div);
}

function _tradeEstimateHTMLMulti(qValues, options, amount) {
    if (!qValues || !options || options.length === 0) return '';
    const lines = options.map((opt, i) => {
        const est = AMM.estimatePayoutMulti(qValues, amount, i);
        return `<div class="flex justify-between mb-1"><span class="truncate mr-2">${esc(opt.label)} (${amount}t):</span><span class="font-semibold shrink-0">${est.shares.toFixed(1)}sh → ${est.shares.toFixed(0)}t</span></div>`;
    }).join('');

    // Calculate max price impact
    let maxImpact = 0;
    const currentProbs = AMM.multiProbabilities(qValues);
    options.forEach((_, i) => {
        const est = AMM.estimatePayoutMulti(qValues, amount, i);
        const newQ = [...qValues];
        newQ[i] += est.shares;
        const newProbs = AMM.multiProbabilities(newQ);
        const impact = Math.abs(newProbs[i] - currentProbs[i]) * 100;
        if (impact > maxImpact) maxImpact = impact;
    });

    const slippageWarning = maxImpact > 5
        ? `<div class="text-xs mt-2 px-2 py-1 rounded ${maxImpact > 15 ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}">⚠ Price impact: ~${maxImpact.toFixed(1)}%</div>`
        : '';
    return lines + `<div class="text-xs text-gray-400 mt-2">Winning shares pay 1 SharkBuck each</div>${slippageWarning}`;
}

// ==================== BALANCE RECONCILIATION ====================

async function handleRunReconciliation() {
    const btn = document.getElementById('recon-btn');
    const results = document.getElementById('recon-results');
    if (btn) { btn.disabled = true; btn.textContent = 'Running...'; }
    if (results) results.innerHTML = '<div class="text-gray-400">Analyzing balances...</div>';

    try {
        const data = await AppState.runBalanceReconciliation();
        if (data.error) {
            results.innerHTML = `<div class="text-red-500">Error: ${esc(data.error)}</div>`;
        } else if (data.discrepancies.length === 0) {
            results.innerHTML = `<div class="text-green-600 font-medium">All balances match! Checked ${data.totalUsers} users across ${data.totalTransactions} transactions.</div>`;
        } else {
            // Store discrepancies for fix action
            window._reconDiscrepancies = data.discrepancies;
            results.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <div class="text-amber-600 font-medium">Found ${data.discrepancies.length} discrepancies (${data.totalUsers} users, ${data.totalTransactions} transactions):</div>
                    <button onclick="handleFixReconciliation()" id="recon-fix-btn" class="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600">Fix All — Insert Corrective Transactions</button>
                </div>
                <p class="text-xs text-gray-500 mb-2">Fix inserts adjustment transactions so the ledger matches actual balances. No balances are changed.</p>
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    ${data.discrepancies.map(d => `
                        <div class="flex items-center justify-between p-2 bg-amber-50 rounded-lg text-sm">
                            <div>
                                <span class="font-medium text-gray-900">${esc(d.name)}</span>
                                <span class="text-gray-400 text-xs ml-1">${esc(d.department)}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-gray-500">Actual: ${d.actual}t</span>
                                <span class="mx-1 text-gray-300">|</span>
                                <span class="text-gray-500">Expected: ${d.expected}t</span>
                                <span class="ml-1 font-bold ${d.diff > 0 ? 'text-green-600' : 'text-red-500'}">(${d.diff > 0 ? '+' : ''}${d.diff})</span>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
        }
    } catch (e) {
        if (results) results.innerHTML = `<div class="text-red-500">Error: ${esc(e.message)}</div>`;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Run Check'; }
    }
}

async function handleFixReconciliation() {
    const discrepancies = window._reconDiscrepancies || [];
    if (discrepancies.length === 0) return;

    const btn = document.getElementById('recon-fix-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Fixing...'; }

    let fixed = 0;
    for (const d of discrepancies) {
        try {
            // Insert a corrective transaction: diff is (actual - expected), so we need to
            // add a transaction of -diff to make expected match actual
            // e.g. actual=378, expected=927, diff=-549 → insert tx of -549 so new expected = 927 + (-549) = 378
            await DB.insertReconciliationTx(d.userId, d.diff, d.actual);
            fixed++;
        } catch (e) {
            console.error(`Failed to fix ${d.name}:`, e);
        }
    }

    showToast(`Fixed ${fixed}/${discrepancies.length} discrepancies. Run check again to verify.`, 'success');
    if (btn) { btn.disabled = false; btn.textContent = 'Done'; }
    window._reconDiscrepancies = [];
}

// ==================== SHARE / DEEP LINKS ====================

async function handleShareMarket(marketId) {
    const market = AppState.markets.find(m => m.id === marketId);
    const url = window.location.origin + window.location.pathname + '#market=' + marketId;
    const text = market
        ? `🦈 ${market.title} — currently at ${Math.round(market.probability * 100)}%\n${url}`
        : url;

    try {
        await navigator.clipboard.writeText(text);
        showToast('Link copied to clipboard!', 'success');
    } catch (e) {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('Link copied to clipboard!', 'success');
    }
}

// ==================== QUARTERLY PRIZE POOL ====================

async function handleRunQuarterlyAwards(offset = 0) {
    const btn = document.getElementById('qtr-awards-btn');
    const container = document.getElementById('qtr-awards-results');
    if (btn) btn.disabled = true;
    if (container) container.innerHTML = '<div class="text-center py-4 text-gray-400">Calculating awards...</div>';

    try {
        const result = await AppState.computeQuarterlyAwards(offset);
        AppState._quarterlyResults = result;
        AppState._quarterlyOffset = offset;
        AppState.notify();
    } catch (e) {
        console.error('Quarterly awards error:', e);
        if (container) container.innerHTML = `<div class="text-red-600 text-sm">Error: ${esc(e.message)}</div>`;
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ==================== AI FEATURES ====================

async function handleAISuggest() {
    const input = document.getElementById('ai-topic-input');
    const btn = document.getElementById('ai-suggest-btn');
    const container = document.getElementById('ai-suggestions');
    const topic = input?.value?.trim();

    if (!topic) { showToast('Enter a topic to generate market ideas', 'info'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Thinking...'; }
    if (container) { container.classList.remove('hidden'); container.innerHTML = '<div class="text-sm text-gray-400 flex items-center gap-2"><div class="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div> Generating market ideas...</div>'; }

    try {
        const category = document.getElementById('create-category')?.value;
        const suggestions = await AI.suggestMarkets(topic, category);
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-500">No suggestions generated. Try a different topic.</div>';
            return;
        }

        container.innerHTML = `
            <div class="space-y-3">
                ${suggestions.map((s, i) => {
                    const cat = Object.values(CATEGORIES).find(c => c.id === s.category);
                    return `
                    <div class="bg-white border border-purple-200 rounded-xl p-4 card-hover cursor-pointer group" onclick="applyAISuggestion(${i})">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    ${cat ? `<span class="text-xs">${cat.icon}</span>` : ''}
                                    <span class="text-xs font-medium text-purple-600">${esc(cat?.label || s.category)}</span>
                                    ${s.market_type === 'multi' ? '<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">Multi</span>' : '<span class="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Yes/No</span>'}
                                </div>
                                <h4 class="text-sm font-semibold text-gray-900 mb-1">${esc(s.title)}</h4>
                                <p class="text-xs text-gray-500 line-clamp-2">${esc(s.description)}</p>
                                ${s.closes_at ? `<span class="text-xs text-gray-400 mt-1 inline-block">Closes: ${s.closes_at}</span>` : ''}
                            </div>
                            <span class="text-xs text-purple-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">Use this →</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        // Stash suggestions for click handler
        window._aiSuggestions = suggestions;
    } catch (e) {
        console.error('AI suggest error:', e);
        container.innerHTML = `<div class="text-sm text-red-500">Failed to generate ideas: ${esc(e.message)}</div>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg> Generate Ideas';
        }
    }
}

function applyAISuggestion(index) {
    const s = window._aiSuggestions?.[index];
    if (!s) return;

    // Switch market type if needed
    if (s.market_type === 'multi' && s.options?.length >= 2) {
        toggleMarketType('multi');
        // Fill in multi-outcome options
        const list = document.getElementById('multi-options-list');
        if (list) {
            list.innerHTML = s.options.map((opt, i) => `
                <div class="flex gap-2">
                    <input type="text" class="multi-option-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shark-500" placeholder="Option ${i + 1}" maxlength="100" value="${esc(opt)}"/>
                    <button onclick="this.parentElement.remove()" class="px-2 text-gray-400 hover:text-red-500 text-sm font-bold">✕</button>
                </div>
            `).join('');
        }
    } else {
        toggleMarketType('binary');
    }

    const titleEl = document.getElementById('create-title');
    const descEl = document.getElementById('create-desc');
    const catEl = document.getElementById('create-category');
    const closesEl = document.getElementById('create-closes');

    if (titleEl) { titleEl.value = s.title; document.getElementById('title-count').textContent = s.title.length + '/200'; }
    if (descEl) { descEl.value = s.description; document.getElementById('desc-count').textContent = s.description.length + '/5000'; }
    if (catEl && s.category) catEl.value = s.category;
    if (closesEl && s.closes_at) closesEl.value = s.closes_at;

    // Scroll to the form
    titleEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    titleEl?.focus();

    showToast('AI suggestion applied — review and edit before creating!', 'success');
}

// Auto-suggest resolution criteria from title
let _aiDescDebounce = null;
function onTitleInputForAI() {
    const title = document.getElementById('create-title')?.value?.trim();
    const btn = document.getElementById('ai-desc-btn');
    if (!btn) return;
    // Show button once title is long enough
    if (title && title.length > 20) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

async function handleAISuggestCriteria() {
    const title = document.getElementById('create-title')?.value?.trim();
    const category = document.getElementById('create-category')?.value;
    const desc = document.getElementById('create-desc');
    const btn = document.getElementById('ai-desc-btn');
    if (!title || !desc || !btn) return;

    const originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Drafting…';

    try {
        const criteria = await AI.draftResolutionCriteria(title, category);
        desc.value = criteria;
        desc.dispatchEvent(new Event('input'));
        showToast('Resolution criteria drafted!', 'success');
    } catch (e) {
        showToast('AI draft failed: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
    }
}

// Admin: AI resolution suggestion for expired markets
async function handleAISuggestResolution(marketId) {
    const market = AppState.markets.find(m => m.id === marketId);
    if (!market) return;

    const btn = document.getElementById(`ai-suggest-btn-${marketId}`);
    const result = document.getElementById(`ai-suggest-result-${marketId}`);
    if (!btn || !result) return;

    btn.disabled = true;
    btn.textContent = 'Searching…';
    result.className = 'mt-2 p-3 rounded-lg border text-xs bg-gray-50 border-gray-200';
    result.innerHTML = `<div class="flex items-center gap-2 text-gray-400"><div class="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin"></div>Running web research…</div>`;
    result.classList.remove('hidden');

    try {
        const s = await AI.suggestResolution(market);
        const cfg = {
            yes:  { label: 'YES', color: 'text-green-700 bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700' },
            no:   { label: 'NO',  color: 'text-red-700 bg-red-50 border-red-200',       badge: 'bg-red-100 text-red-600' },
            void: { label: 'VOID', color: 'text-gray-700 bg-gray-50 border-gray-200',   badge: 'bg-gray-100 text-gray-600' },
        };
        const confColor = { low: 'text-amber-500', medium: 'text-blue-500', high: 'text-green-600' };
        const c = cfg[s.verdict] || cfg.void;
        result.className = `mt-2 p-3 rounded-lg border text-xs ${c.color}`;
        result.innerHTML = `
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                <span class="font-bold text-sm px-2 py-0.5 rounded ${c.badge}">${c.label}</span>
                <span class="${confColor[s.confidence] || 'text-gray-400'} font-medium">Confidence: ${s.confidence}</span>
                <div class="ml-auto flex gap-1.5">
                    <button onclick="handleResolveMarket(${marketId}, 'yes')" class="px-2.5 py-1 rounded text-xs font-bold bg-green-500 text-white hover:bg-green-600">Resolve YES</button>
                    <button onclick="handleResolveMarket(${marketId}, 'no')" class="px-2.5 py-1 rounded text-xs font-bold bg-red-500 text-white hover:bg-red-600">Resolve NO</button>
                    <button onclick="handleResolveMarket(${marketId}, 'void')" class="px-2.5 py-1 rounded text-xs font-bold bg-gray-400 text-white hover:bg-gray-500">VOID</button>
                </div>
            </div>
            <p class="leading-relaxed mb-1">${esc(s.reasoning)}</p>
            ${s.caveat ? `<p class="opacity-60 italic">${esc(s.caveat)}</p>` : ''}`;
    } catch (e) {
        result.className = 'mt-2 p-3 rounded-lg border text-xs bg-red-50 border-red-200 text-red-600';
        result.innerHTML = esc(e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Re-suggest';
    }
}

// Admin: AI quality review for a pending market
async function handleAIReviewMarket(marketId) {
    const market = (AppState.markets || []).find(m => m.id === marketId);
    if (!market) return;

    const btn = document.getElementById(`ai-review-btn-${marketId}`);
    const result = document.getElementById(`ai-review-result-${marketId}`);
    if (!btn || !result) return;

    btn.disabled = true;
    btn.textContent = 'Reviewing…';

    try {
        const review = await AI.reviewMarketQuality(market);
        const scoreColor = review.score >= 8 ? 'text-green-700 bg-green-50 border-green-200'
                         : review.score >= 5 ? 'text-amber-700 bg-amber-50 border-amber-200'
                         : 'text-red-700 bg-red-50 border-red-200';
        const recLabel = { approve: '✅ Approve', approve_with_edits: '⚠️ Approve with edits', reject: '❌ Reject' }[review.recommendation] || review.recommendation;

        result.className = `mt-1 p-3 rounded-lg border text-xs ${scoreColor}`;
        result.innerHTML = `
            <div class="flex items-center gap-3 mb-1.5">
                <span class="font-bold text-sm">${recLabel}</span>
                <span class="font-semibold">Score: ${review.score}/10</span>
            </div>
            ${review.issues?.length ? `<ul class="list-disc list-inside space-y-0.5 mb-1">${review.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
            ${review.suggestion ? `<p class="italic opacity-80">${esc(review.suggestion)}</p>` : ''}`;
        result.classList.remove('hidden');
    } catch (e) {
        showToast('AI review failed: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Re-review';
    }
}

async function handleAISummarize(marketId) {
    const btn = document.getElementById('ai-summary-btn');
    const container = document.getElementById('ai-summary-content');
    const placeholder = document.getElementById('ai-summary-placeholder');

    AppState._renderLocked = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing…'; }
    if (placeholder) placeholder.classList.add('hidden');
    if (container) {
        container.classList.remove('hidden');
        container.innerHTML = `<div class="flex items-center gap-2 py-4 justify-center text-sm text-purple-400">
            <div class="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
            Analyzing market activity…
        </div>`;
    }

    try {
        const r = await AI.summarizeMarket(marketId);

        const sentimentCfg = {
            bullish: { label: 'Bullish', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500', icon: '↑' },
            bearish: { label: 'Bearish', color: 'bg-red-100 text-red-600 border-red-200',   dot: 'bg-red-500',   icon: '↓' },
            neutral: { label: 'Neutral', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400',  icon: '→' },
        };
        const recCfg = {
            buy_yes: { label: 'Buy YES', color: 'bg-green-600 text-white' },
            buy_no:  { label: 'Buy NO',  color: 'bg-red-600 text-white' },
            hold:    { label: 'Hold',    color: 'bg-amber-500 text-white' },
            watch:   { label: 'Watch',   color: 'bg-blue-500 text-white' },
        };
        const trendLabel = { rising: '↑ Rising', falling: '↓ Falling', stable: '→ Stable' };

        const s = sentimentCfg[r.sentiment] || sentimentCfg.neutral;
        const rec = recCfg[r.recommendation] || recCfg.watch;

        container.innerHTML = `
            <!-- Sentiment row -->
            <div class="flex items-center gap-3 flex-wrap">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${s.color}">
                    <span class="w-1.5 h-1.5 rounded-full ${s.dot}"></span>
                    ${s.icon} ${s.label}
                </span>
                <span class="text-xs text-gray-400">Confidence: ${r.confidence}/10</span>
                <span class="text-xs text-gray-400">Trend: ${trendLabel[r.trend] || r.trend}</span>
                ${r.key_stat ? `<span class="text-xs text-purple-500 font-medium ml-auto">${esc(r.key_stat)}</span>` : ''}
            </div>

            <!-- Signal -->
            <div class="bg-gray-50 rounded-lg px-3 py-2.5">
                <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Market Signal</div>
                <p class="text-sm text-gray-800 leading-relaxed">${esc(r.signal)}</p>
            </div>

            <!-- Rationale -->
            <p class="text-sm text-gray-600 leading-relaxed">${esc(r.rationale)}</p>

            <!-- Risks -->
            ${r.risks?.length ? `
            <div>
                <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Key Risks</div>
                <div class="flex flex-wrap gap-2">
                    ${r.risks.map(risk => `<span class="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">⚠ ${esc(risk)}</span>`).join('')}
                </div>
            </div>` : ''}

            <!-- Recommendation -->
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span class="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${rec.color}">${rec.label}</span>
                <p class="text-xs text-gray-600">${esc(r.rec_reason)}</p>
            </div>

            <!-- Disclaimer -->
            <p class="text-xs text-gray-300 border-t border-gray-100 pt-3">${esc(r.disclaimer || 'AI analysis is based on platform data only.')}</p>`;

    } catch (e) {
        console.error('AI summarize error:', e);
        if (container) container.innerHTML = `<div class="text-sm text-red-500 py-2">${esc(e.message)}</div>`;
        if (placeholder) placeholder.classList.remove('hidden');
    } finally {
        AppState._renderLocked = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Re-analyze'; }
    }
}

function buildResearchHTML(r, cachedAt) {
    const verdictCfg = {
        likely_yes: { label: 'Likely YES', color: 'bg-green-100 text-green-700 border-green-200', bar: 'bg-green-500' },
        likely_no:  { label: 'Likely NO',  color: 'bg-red-100 text-red-600 border-red-200',       bar: 'bg-red-500'   },
        uncertain:  { label: 'Uncertain',  color: 'bg-gray-100 text-gray-600 border-gray-200',    bar: 'bg-gray-400'  },
    };
    const confColor = { low: 'text-amber-500', medium: 'text-blue-500', high: 'text-green-600' };
    const freshnessColor = { recent: 'text-green-500', mixed: 'text-amber-500', stale: 'text-red-400' };
    const market = AppState.selectedMarket;
    const v = verdictCfg[r.verdict] || verdictCfg.uncertain;
    const prob = Math.min(100, Math.max(0, r.estimated_probability || 0));
    const crowdProb = r._crowdProb ?? Math.round((market?.probability || 0.5) * 100);
    const divergence = Math.abs(prob - crowdProb);
    const divergenceDir = prob > crowdProb ? 'higher' : 'lower';

    const divergenceHTML = divergence >= 15 ? `
        <div class="flex items-start gap-2.5 p-3 rounded-lg border ${divergence >= 30 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}">
            <span class="text-lg shrink-0">${divergence >= 30 ? '⚡' : '↕'}</span>
            <div>
                <div class="text-xs font-bold ${divergence >= 30 ? 'text-amber-700' : 'text-blue-700'} mb-0.5">
                    ${divergence >= 30 ? 'Strong' : 'Moderate'} Divergence from Crowd
                </div>
                <p class="text-xs ${divergence >= 30 ? 'text-amber-700' : 'text-blue-600'}">
                    Web research estimates <strong>${prob}%</strong> vs crowd's <strong>${crowdProb}%</strong> — research is <strong>${divergence}pts ${divergenceDir}</strong>. This gap may represent a ${divergenceDir === 'higher' ? 'buying' : 'selling'} opportunity if you trust the external data.
                </p>
            </div>
        </div>` : `
        <div class="flex items-center gap-2 text-xs text-gray-500 py-1">
            <span>Research aligns with crowd:</span>
            <span class="font-semibold text-gray-700">Web ${prob}% · Crowd ${crowdProb}%</span>
            <span class="text-gray-400">(${divergence}pt gap)</span>
        </div>`;

    const cachedBadge = cachedAt ? (() => {
        const ago = Math.round((Date.now() - new Date(cachedAt).getTime()) / 60000);
        const label = ago < 1 ? 'just now' : ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago/60)}h ago` : `${Math.round(ago/1440)}d ago`;
        return `<div class="flex items-center gap-1.5 text-xs text-gray-400 border-t border-gray-100 pt-3 mt-1">
            <svg class="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Cached ${esc(label)} — click <strong>Re-run</strong> to refresh</span>
        </div>`;
    })() : '';

    return `
        <!-- Probability bar -->
        <div class="flex items-center gap-3 flex-wrap">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${v.color}">${v.label}</span>
            <span class="text-xs ${confColor[r.confidence] || 'text-gray-400'} font-medium">Confidence: ${r.confidence || '—'}</span>
            ${r.data_freshness ? `<span class="text-xs ${freshnessColor[r.data_freshness] || 'text-gray-400'}">Data: ${r.data_freshness}</span>` : ''}
            <span class="ml-auto">
                <span class="text-lg font-black text-gray-800">${prob}%</span>
                ${r.probability_range ? `<span class="text-xs text-gray-400 ml-1">range ${esc(r.probability_range)}</span>` : ''}
            </span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="${v.bar} h-2 rounded-full" style="width:${prob}%"></div>
        </div>

        <!-- Divergence alert -->
        ${divergenceHTML}

        <!-- Bull / Bear cases -->
        ${(r.bull_case || r.bear_case) ? `
        <div class="grid grid-cols-2 gap-2">
            ${r.bull_case ? `<div class="bg-green-50 border border-green-100 rounded-lg p-2.5">
                <div class="text-xs font-bold text-green-600 mb-1">Bull Case</div>
                <p class="text-xs text-gray-700 leading-relaxed">${esc(r.bull_case)}</p>
            </div>` : ''}
            ${r.bear_case ? `<div class="bg-red-50 border border-red-100 rounded-lg p-2.5">
                <div class="text-xs font-bold text-red-500 mb-1">Bear Case</div>
                <p class="text-xs text-gray-700 leading-relaxed">${esc(r.bear_case)}</p>
            </div>` : ''}
        </div>` : ''}

        <!-- Key Findings -->
        ${r.key_findings?.length ? `
        <div>
            <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Key Findings</div>
            <ul class="space-y-1.5">
                ${r.key_findings.map(f => `<li class="flex gap-2 text-sm text-gray-700 leading-snug"><span class="text-teal-600 shrink-0 mt-0.5">•</span><span>${esc(f)}</span></li>`).join('')}
            </ul>
        </div>` : ''}

        <!-- Reasoning -->
        <div class="bg-teal-100 rounded-lg px-3 py-2.5">
            <div class="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Research Synthesis</div>
            <p class="text-sm text-gray-800 leading-relaxed">${esc(r.reasoning)}</p>
        </div>

        <!-- Searches performed -->
        ${r.searches_performed?.length ? `
        <div class="text-xs text-gray-500">
            <span class="font-medium">Queries run:</span>
            <ol class="mt-1 space-y-0.5 list-decimal list-inside text-gray-500">
                ${r.searches_performed.map(s => `<li>${esc(s)}</li>`).join('')}
            </ol>
        </div>` : ''}

        <!-- Caveat -->
        <p class="text-xs text-gray-500 border-t border-gray-200 pt-3">${esc(r.caveat || 'External research may not reflect internal SharkNinja data.')}</p>
        ${cachedBadge}`;
}

function switchAITab(tab) {
    AppState._activeAITab = tab; // persist so re-renders restore the right pane
    const isAnalysis = tab === 'analysis';
    document.getElementById('ai-pane-analysis')?.classList.toggle('hidden', !isAnalysis);
    document.getElementById('ai-pane-research')?.classList.toggle('hidden', isAnalysis);

    const btnA = document.getElementById('ai-tab-btn-analysis');
    const btnR = document.getElementById('ai-tab-btn-research');
    if (btnA) {
        btnA.classList.toggle('border-violet-700', isAnalysis);
        btnA.classList.toggle('text-violet-800', isAnalysis);
        btnA.classList.toggle('bg-violet-100', isAnalysis);
        btnA.classList.toggle('border-transparent', !isAnalysis);
        btnA.classList.toggle('text-gray-500', !isAnalysis);
        btnA.classList.remove('bg-violet-100');
        if (isAnalysis) btnA.classList.add('bg-violet-100');
    }
    if (btnR) {
        btnR.classList.toggle('border-teal-700', !isAnalysis);
        btnR.classList.toggle('text-teal-800', !isAnalysis);
        btnR.classList.toggle('bg-teal-100', !isAnalysis);
        btnR.classList.toggle('border-transparent', isAnalysis);
        btnR.classList.toggle('text-gray-500', isAnalysis);
        btnR.classList.remove('bg-teal-100');
        if (!isAnalysis) btnR.classList.add('bg-teal-100');
    }

    // Auto-load cached research when switching to the research tab
    if (!isAnalysis) {
        const market = AppState.selectedMarket;
        const container = document.getElementById('deep-research-content');
        const placeholder = document.getElementById('deep-research-placeholder');
        const btn = document.getElementById('deep-research-btn');
        if (market?.research_cache && container && container.children.length === 0) {
            container.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');
            container.innerHTML = buildResearchHTML(market.research_cache, market.research_cached_at);
            if (btn) btn.textContent = 'Re-run';
        }
    }
}

async function handleDeepResearch() {
    const btn = document.getElementById('deep-research-btn');
    const container = document.getElementById('deep-research-content');
    const placeholder = document.getElementById('deep-research-placeholder');
    const market = AppState.selectedMarket;

    AppState._renderLocked = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Searching…'; }
    if (placeholder) placeholder.classList.add('hidden');
    if (container) {
        container.classList.remove('hidden');
        container.innerHTML = `
            <div id="research-progress" class="flex flex-col gap-2 py-4">
                <div class="flex items-center gap-2 text-sm text-teal-600 font-medium">
                    <div class="w-4 h-4 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin shrink-0"></div>
                    <span id="research-status">Initializing research…</span>
                </div>
                <div class="flex gap-1.5 mt-1">
                    ${[1,2,3,4].map(i => `<div id="search-dot-${i}" class="h-1.5 flex-1 rounded-full bg-gray-100"></div>`).join('')}
                </div>
                <p class="text-xs text-gray-300">Running 4 structured searches — takes ~20 seconds</p>
            </div>`;
    }

    const onProgress = (label, n) => {
        const el = document.getElementById('research-status');
        if (el) el.textContent = label;
        for (let i = 1; i <= 4; i++) {
            const dot = document.getElementById(`search-dot-${i}`);
            if (dot) dot.className = `h-1.5 flex-1 rounded-full ${i <= n ? 'bg-teal-500' : 'bg-gray-100'}`;
        }
    };

    try {
        const r = await AI.deepResearch(market, onProgress);
        const cachedAt = new Date().toISOString();

        // Cache in-memory immediately so any re-render triggered after unlock shows the results
        if (AppState.selectedMarket?.id === market.id) {
            AppState.selectedMarket.research_cache = r;
            AppState.selectedMarket.research_cached_at = cachedAt;
        }

        // Save to DB (fire-and-forget, don't block UI)
        DB.updateMarket(market.id, { research_cache: r, research_cached_at: cachedAt })
            .catch(e => console.warn('Research cache save failed:', e));

        container.innerHTML = buildResearchHTML(r, cachedAt);

    } catch (e) {
        console.error('Deep research error:', e);
        if (container) container.innerHTML = `<div class="text-sm text-red-500 py-2">${esc(e.message)}</div>`;
        if (placeholder) placeholder.classList.remove('hidden');
    } finally {
        AppState._renderLocked = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Re-research'; }
    }
}

// ==================== INTEL BRIEFING ====================

function buildBriefingHTML(r, cachedAt) {
    const sentimentCfg = {
        optimistic: { label: 'Optimistic', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
        cautious:   { label: 'Cautious',   color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
        mixed:      { label: 'Mixed',       color: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-500' },
        uncertain:  { label: 'Uncertain',   color: 'bg-gray-100 text-gray-600 border-gray-200',   dot: 'bg-gray-400' },
    };
    const signalColor = { bullish: 'text-green-600', bearish: 'text-red-500', neutral: 'text-gray-500' };
    const signalIcon  = { bullish: '↑', bearish: '↓', neutral: '→' };
    const s = sentimentCfg[r.overall_sentiment] || sentimentCfg.mixed;

    const categoriesHTML = (r.categories || []).map(cat => `
        <div class="border border-gray-100 rounded-xl overflow-hidden">
            <div class="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">${esc(cat.name)}</span>
                <span class="text-xs text-gray-400">${cat.markets?.length || 0} market${cat.markets?.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="px-4 py-3">
                <p class="text-sm text-gray-600 mb-3">${esc(cat.summary)}</p>
                <div class="space-y-2">
                    ${(cat.markets || []).map(m => `
                        <div class="flex items-start gap-3 py-2 border-t border-gray-50">
                            <div class="shrink-0 w-10 text-center">
                                <span class="text-lg font-black ${m.probability >= 60 ? 'text-green-600' : m.probability <= 40 ? 'text-red-500' : 'text-gray-500'}">${m.probability}%</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-gray-800 leading-tight mb-0.5">${esc(m.title)}</div>
                                <div class="text-xs text-gray-400">${esc(m.notable)}</div>
                            </div>
                            <span class="shrink-0 text-sm font-bold ${signalColor[m.signal] || 'text-gray-400'}">${signalIcon[m.signal] || '→'}</span>
                        </div>`).join('')}
                </div>
            </div>
        </div>`).join('');

    const highConvictionHTML = (r.high_conviction || []).map(m => `
        <div class="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100">
            <div class="shrink-0 px-2 py-1 rounded-lg text-xs font-black ${m.direction === 'YES' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}">${m.direction} ${m.probability}%</div>
            <div class="min-w-0">
                <div class="text-sm font-semibold text-gray-800 leading-tight">${esc(m.title)}</div>
                <div class="text-xs text-gray-500 mt-0.5">${esc(m.reason)}</div>
            </div>
        </div>`).join('');

    const watchListHTML = (r.watch_list || []).map(m => `
        <div class="flex items-start gap-2.5 p-3 bg-amber-50 rounded-lg border border-amber-100">
            <span class="text-amber-500 shrink-0 mt-0.5">⚑</span>
            <div>
                <div class="text-sm font-semibold text-gray-800">${esc(m.title)}</div>
                <div class="text-xs text-amber-700 mt-0.5">${esc(m.reason)}</div>
            </div>
        </div>`).join('');

    const activeCount = (AppState.markets || []).filter(m => m.status === 'active' && !m.resolution && m.traders > 0).length;
    const totalVol = (AppState.markets || []).reduce((s, m) => s + (m.volume || 0), 0);
    const dateLabel = cachedAt
        ? new Date(cachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    window._briefingCopyText = `SharkPool Intel Briefing — ${dateLabel}\n\n${r.headline}\n\nKey Takeaways:\n${(r.key_takeaways || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nHigh Conviction Calls:\n${(r.high_conviction || []).map(m => `• ${m.title} — ${m.direction} at ${m.probability}%`).join('\n')}\n\nWatch List:\n${(r.watch_list || []).map(m => `• ${m.title}: ${m.reason}`).join('\n')}\n\nGenerated by SharkPool`;

    const cachedBadge = cachedAt ? (() => {
        const ago = Math.round((Date.now() - new Date(cachedAt).getTime()) / 60000);
        const label = ago < 1 ? 'just now' : ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago/60)}h ago` : `${Math.round(ago/1440)}d ago`;
        return `<div class="flex items-center gap-1.5 text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
            <svg class="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Generated ${esc(label)} · visible to all SharkPool users</span>
        </div>`;
    })() : '';

    return `
        <!-- Header -->
        <div class="flex items-start justify-between gap-4 mb-6">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${s.color}">
                        <span class="w-1.5 h-1.5 rounded-full ${s.dot}"></span>${s.label} Outlook
                    </span>
                    <span class="text-xs text-gray-400">${activeCount} markets · ${totalVol.toLocaleString()}t volume</span>
                    <span class="text-xs text-gray-300 ml-auto">${dateLabel}</span>
                </div>
                <p class="text-base font-semibold text-gray-900 leading-snug">${esc(r.headline)}</p>
            </div>
            <button onclick="navigator.clipboard.writeText(window._briefingCopyText).then(()=>showToast('Copied to clipboard','success'))"
                class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                Copy
            </button>
        </div>

        <!-- Key Takeaways -->
        <div class="rounded-xl p-4 mb-6" style="background:linear-gradient(135deg,#1e1b4b,#312e81);">
            <div class="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">Key Takeaways for Leadership</div>
            <ol class="space-y-2">
                ${(r.key_takeaways || []).map((t, i) => `
                    <li class="flex gap-3 text-sm text-white/90 leading-relaxed">
                        <span class="shrink-0 w-5 h-5 rounded-full bg-indigo-500/50 flex items-center justify-center text-xs font-bold text-indigo-200">${i + 1}</span>
                        <span>${esc(t)}</span>
                    </li>`).join('')}
            </ol>
        </div>

        <!-- High Conviction + Watch List side by side -->
        <div class="grid sm:grid-cols-2 gap-4 mb-6">
            <div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">High Conviction Calls</div>
                <div class="space-y-2">${highConvictionHTML || '<p class="text-xs text-gray-400 p-3">No high-conviction markets yet.</p>'}</div>
            </div>
            <div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Watch List</div>
                <div class="space-y-2">${watchListHTML || '<p class="text-xs text-gray-400 p-3">Nothing flagged.</p>'}</div>
            </div>
        </div>

        <!-- Category breakdown -->
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">By Category</div>
        <div class="space-y-3">${categoriesHTML}</div>

        <!-- Footer -->
        <p class="text-xs text-gray-300 border-t border-gray-100 pt-4 mt-4">Generated by SharkPool AI · Based on platform data only</p>
        ${cachedBadge}`;
}

async function handleGenerateBriefing() {
    const btn = document.getElementById('briefing-btn');
    const container = document.getElementById('briefing-output');
    const placeholder = document.getElementById('briefing-placeholder');

    AppState._renderLocked = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    if (placeholder) placeholder.classList.add('hidden');
    if (container) {
        container.classList.remove('hidden');
        container.innerHTML = `<div class="flex flex-col items-center gap-3 py-16 text-gray-400">
            <div class="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
            <span class="text-sm">Analyzing ${(AppState.markets || []).filter(m => m.status === 'active' && !m.resolution).length} active markets…</span>
        </div>`;
    }

    try {
        const r = await AI.generateBriefing(AppState.markets || []);
        const cachedAt = new Date().toISOString();

        // Persist so all users can see it (fire-and-forget)
        DB.setBriefingCache(r, cachedAt)
            .then(() => { AppState.briefingCache = r; AppState.briefingCachedAt = cachedAt; })
            .catch(e => console.warn('Briefing cache save failed:', e));

        container.innerHTML = buildBriefingHTML(r, cachedAt);

    } catch (e) {
        console.error('Briefing error:', e);
        if (container) container.innerHTML = `<div class="text-sm text-red-500 py-4 text-center">${esc(e.message || 'Failed to generate briefing')}</div>`;
        if (placeholder) placeholder.classList.remove('hidden');
    } finally {
        AppState._renderLocked = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Regenerate'; }
    }
}

// ==================== TOURNAMENTS ====================

async function handleCreateTournament() {
    const title = document.getElementById('t-title')?.value?.trim();
    const emoji = document.getElementById('t-emoji')?.value?.trim() || '🏆';
    const description = document.getElementById('t-description')?.value?.trim() || '';
    const startDate = document.getElementById('t-start')?.value || null;
    const endDate = document.getElementById('t-end')?.value || null;
    const prize = document.getElementById('t-prize')?.value?.trim() || null;
    const status = document.getElementById('t-status')?.value || 'upcoming';

    if (!title) { showToast('Title is required', 'error'); return; }

    try {
        const t = await DB.createTournament({
            title, emoji, description, start_date: startDate, end_date: endDate,
            prize_description: prize || null, status, created_by: AppState.session.user.id,
        });
        AppState.tournaments = await DB.getTournaments();
        AppState.navigate('tournament', { tournamentId: t.id });
    } catch (e) {
        showToast(e.message || 'Failed to create tournament', 'error');
    }
}

async function handleUpdateTournamentStatus(status) {
    const t = AppState.selectedTournament;
    if (!t) return;
    try {
        await DB.updateTournament(t.id, { status });
        AppState.selectedTournament = { ...t, status };
        AppState.notify();
    } catch (e) {
        showToast(e.message || 'Failed to update status', 'error');
    }
}

async function handleAddMarketToTournament() {
    const select = document.getElementById('add-market-select');
    const marketId = parseInt(select?.value);
    if (!marketId) { showToast('Select a market to add', 'info'); return; }
    const t = AppState.selectedTournament;
    if (!t) return;
    try {
        await DB.addMarketToTournament(t.id, marketId, AppState.session.user.id);
        AppState.selectedTournamentMarkets = await DB.getTournamentMarkets(t.id);
        AppState.selectedTournamentLeaderboard = await DB.getTournamentLeaderboard(t.id);
        AppState.notify();
    } catch (e) {
        showToast(e.message || 'Failed to add market', 'error');
    }
}

async function handleRemoveMarketFromTournament(marketId) {
    const t = AppState.selectedTournament;
    if (!t) return;
    try {
        await DB.removeMarketFromTournament(t.id, marketId);
        AppState.selectedTournamentMarkets = AppState.selectedTournamentMarkets.filter(m => m.id !== marketId);
        AppState.notify();
    } catch (e) {
        showToast(e.message || 'Failed to remove market', 'error');
    }
}

async function handleDeleteTournament() {
    const t = AppState.selectedTournament;
    if (!t || !confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
    try {
        await DB.deleteTournament(t.id);
        AppState.tournaments = AppState.tournaments.filter(x => x.id !== t.id);
        AppState.navigate('tournaments');
    } catch (e) {
        showToast(e.message || 'Failed to delete tournament', 'error');
    }
}

// ==================== INIT ====================

AppState.subscribe(render);
AppState.subscribe(() => { if (AppState.session) ChatWidget.init(); });
render();
AppState.init();
