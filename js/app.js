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
        default: pageContent = Pages.dashboard();
    }

    if (AppState.currentPage === 'login') {
        app.innerHTML = pageContent;
    } else {
        app.innerHTML = Components.header() + '<main>' + pageContent + '</main>';
    }
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
    if (!password || password.length < 6) { showAuthError('Password must be at least 6 characters'); return; }

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

async function handlePrediction(marketId, direction) {
    const amountInput = document.getElementById('pred-amount');
    const amount = parseInt(amountInput?.value || '50');

    if (amount < 10) { showToast('Minimum prediction is 10 tokens', 'error'); return; }
    if (amount > AppState.user.balance) { showToast('Insufficient token balance', 'error'); return; }

    const result = await AppState.placePrediction(marketId, direction, amount);
    if (result) {
        showToast(`Bought ${result.shares.toFixed(1)} ${direction.toUpperCase()} shares for ${amount} tokens!`, 'success');
    } else {
        showToast('Failed to place prediction.', 'error');
    }
}

function updateTradeEstimate(marketId) {
    const market = AppState.markets.find(m => m.id === marketId);
    if (!market) return;

    const amount = parseInt(document.getElementById('pred-amount')?.value || '50');
    const qYes = market.q_yes || 0, qNo = market.q_no || 0;
    const estYes = AMM.estimatePayout(qYes, qNo, amount, 'yes');
    const estNo = AMM.estimatePayout(qYes, qNo, amount, 'no');

    const el = document.getElementById('trade-estimate');
    if (el) {
        el.innerHTML = `
            <div class="flex justify-between mb-1"><span>YES shares (${amount} tokens):</span><span class="font-semibold">${estYes.shares.toFixed(1)} shares</span></div>
            <div class="flex justify-between"><span>NO shares (${amount} tokens):</span><span class="font-semibold">${estNo.shares.toFixed(1)} shares</span></div>
            <div class="text-xs text-gray-400 mt-2">Each winning share pays out 1 token</div>
        `;
    }
}

// ==================== SELL POSITION ====================

async function handleSellPosition(predictionId) {
    if (!confirm('Sell this position? You will receive tokens at the current market price.')) return;

    const revenue = await AppState.sellPosition(predictionId);
    if (revenue !== false) {
        showToast(`Position sold for ${revenue} tokens!`, 'success');
    } else {
        showToast('Failed to sell position.', 'error');
    }
}

// ==================== MARKET CREATION ====================

async function handleCreateMarket() {
    const title = document.getElementById('create-title')?.value?.trim();
    const desc = document.getElementById('create-desc')?.value?.trim();
    const category = document.getElementById('create-category')?.value;
    const closesAt = document.getElementById('create-closes')?.value;

    if (!title) { showToast('Please enter a question', 'error'); return; }
    if (!desc) { showToast('Please enter a description', 'error'); return; }
    if (!closesAt) { showToast('Please set a closing date', 'error'); return; }

    try {
        const newMarket = await AppState.addMarket({ title, description: desc, category, closesAt });
        showToast('Market created!', 'success');
        await AppState.navigate('market', { marketId: newMarket.id });
    } catch (e) {
        showToast('Failed to create market.', 'error');
    }
}

// ==================== MARKET RESOLUTION ====================

async function handleResolveMarket(marketId, resolution) {
    const market = AppState.markets.find(m => m.id === marketId);
    const label = resolution.toUpperCase();

    if (!confirm(`Resolve "${market?.title || 'this market'}" as ${label}? This will trigger payouts and cannot be undone.`)) return;

    try {
        await AppState.resolveMarket(marketId, resolution);
        showToast(`Market resolved as ${label}! Payouts processed.`, 'success');
    } catch (e) {
        showToast('Failed to resolve: ' + (e.message || 'Unknown error'), 'error');
    }
}

// ==================== COMMENTS ====================

async function handleAddComment(marketId) {
    const input = document.getElementById('comment-input');
    const text = input?.value?.trim();
    if (!text) return;

    try {
        await AppState.addComment(marketId, text);
        showToast('Comment posted!', 'success');
    } catch (e) {
        showToast('Failed to post comment.', 'error');
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

// ==================== INIT ====================

AppState.subscribe(render);
render();
AppState.init();
