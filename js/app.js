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
            default: pageContent = Pages.dashboard();
        }

        const progressBar = AppState.navigating ? '<div class="nav-progress"></div>' : '';
        if (AppState.currentPage === 'login') {
            app.innerHTML = pageContent;
        } else {
            app.innerHTML = progressBar + Components.header() + '<main>' + pageContent + '</main>' + Components.footer();
        }

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

// ==================== PREDICTIONS ====================

async function handlePrediction(marketId, direction, optionIndex) {
    const amountInput = document.getElementById('pred-amount');
    const amount = parseInt(amountInput?.value || '50');
    const isMulti = optionIndex !== undefined && optionIndex !== null;
    const btn = isMulti
        ? document.getElementById(`btn-opt-${optionIndex}-${marketId}`)
        : document.getElementById(`btn-${direction}-${marketId}`);

    if (amount < 10) { showToast('Minimum prediction is 10 tokens', 'error'); return; }
    if (amount > AppState.user.balance) { showToast('Insufficient token balance', 'error'); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Buying...'; }
    try {
        const result = await AppState.placePrediction(marketId, direction, amount, isMulti ? optionIndex : null);
        if (result && result.error) {
            showToast(result.error, 'error');
        } else if (result) {
            showToast(`Bought ${result.shares.toFixed(1)} ${direction.toUpperCase()} shares for ${amount} tokens!`, 'success');
        } else {
            showToast('Failed to place prediction.', 'error');
        }
    } catch (e) {
        showToast('Failed to place prediction.', 'error');
    } finally {
        if (btn) { btn.disabled = false; }
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
        message: 'Sell this position? You will receive tokens at the current market price.',
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
            showToast(`Position sold for ${result.revenue} tokens (${profitLabel} profit)!`, result.profit >= 0 ? 'success' : 'info');
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
    const btn = document.getElementById('create-market-btn');
    const isMulti = document.getElementById('type-multi')?.classList.contains('border-shark-600');

    if (!title) { showToast('Please enter a question', 'error'); return; }
    if (!desc) { showToast('Please enter a description', 'error'); return; }
    if (!closesAt) { showToast('Please set a closing date', 'error'); return; }

    let marketData = { title, description: desc, category, closesAt, source_url: sourceUrl };

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
    const btn = document.getElementById('save-edit-btn');

    if (!title) { showToast('Title cannot be empty', 'error'); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    try {
        await AppState.editMarket(marketId, { title, description: desc, closes_at: closesAt || undefined, source_url: sourceUrl });
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
        showToast(`Added ${amount} tokens to user balance.`, 'success');
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
    return lines + `<div class="text-xs text-gray-400 mt-2">Winning shares pay 1 token each</div>${slippageWarning}`;
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

async function handleAISummarize(marketId) {
    const btn = document.getElementById('ai-summary-btn');
    const container = document.getElementById('ai-summary-content');

    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
    if (container) { container.classList.remove('hidden'); container.innerHTML = '<div class="flex items-center gap-2 text-xs text-gray-400"><div class="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div> Analyzing market activity...</div>'; }

    try {
        const summary = await AI.summarizeMarket(marketId);
        if (container) {
            container.innerHTML = `
                <p class="text-sm text-gray-700 leading-relaxed">${esc(summary)}</p>
                <p class="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    AI-generated summary — may not reflect all nuances
                </p>`;
        }
    } catch (e) {
        console.error('AI summarize error:', e);
        if (container) container.innerHTML = `<div class="text-sm text-red-500">${esc(e.message)}</div>`;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
    }
}

// ==================== INIT ====================

AppState.subscribe(render);
AppState.subscribe(() => { if (AppState.session) ChatWidget.init(); });
render();
AppState.init();
