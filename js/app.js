// Main app initialization and global handlers

function render() {
    const app = document.getElementById('app');

    // Show loading spinner during init
    if (AppState.loading && !AppState.session) {
        app.innerHTML = `
            <div class="min-h-screen flex items-center justify-center">
                <div class="text-center">
                    <div class="inline-block w-8 h-8 border-4 border-shark-200 border-t-shark-600 rounded-full animate-spin mb-4"></div>
                    <p class="text-gray-500 text-sm">Loading...</p>
                </div>
            </div>
        `;
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
        default: pageContent = Pages.dashboard();
    }

    // Only show header when logged in
    if (AppState.currentPage === 'login') {
        app.innerHTML = pageContent;
    } else {
        app.innerHTML = Components.header() + '<main>' + pageContent + '</main>';
    }
}

// ==================== AUTH HANDLERS ====================

function switchAuthTab(tab) {
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');
    const authError = document.getElementById('auth-error');
    const authSuccess = document.getElementById('auth-success');

    if (authError) authError.classList.add('hidden');
    if (authSuccess) authSuccess.classList.add('hidden');

    if (tab === 'signin') {
        signinForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        tabSignin.classList.add('border-shark-600', 'text-shark-600');
        tabSignin.classList.remove('border-gray-200', 'text-gray-400');
        tabSignup.classList.remove('border-shark-600', 'text-shark-600');
        tabSignup.classList.add('border-gray-200', 'text-gray-400');
    } else {
        signinForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        tabSignup.classList.add('border-shark-600', 'text-shark-600');
        tabSignup.classList.remove('border-gray-200', 'text-gray-400');
        tabSignin.classList.remove('border-shark-600', 'text-shark-600');
        tabSignin.classList.add('border-gray-200', 'text-gray-400');
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const errorEl = document.getElementById('auth-error');
    const btn = document.getElementById('login-btn');

    if (!email || !password) {
        showAuthError('Please enter email and password');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
        await AppState.login(email, password);
    } catch (e) {
        showAuthError(e.message || 'Sign in failed. Please check your credentials.');
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
        showAuthError(e.message || 'Sign up failed. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

function showAuthError(message) {
    const el = document.getElementById('auth-error');
    const successEl = document.getElementById('auth-success');
    if (successEl) successEl.classList.add('hidden');
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
    }
}

function showAuthSuccess(message) {
    const el = document.getElementById('auth-success');
    const errorEl = document.getElementById('auth-error');
    if (errorEl) errorEl.classList.add('hidden');
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
    }
}

// ==================== PREDICTION HANDLER ====================

async function handlePrediction(marketId, direction) {
    const amountInput = document.getElementById('pred-amount');
    const amount = parseInt(amountInput?.value || '50');

    if (amount < 10) {
        showToast('Minimum prediction is 10 tokens', 'error');
        return;
    }
    if (amount > AppState.user.balance) {
        showToast('Insufficient token balance', 'error');
        return;
    }

    const success = await AppState.placePrediction(marketId, direction, amount);
    if (success) {
        showToast(`Prediction placed: ${direction.toUpperCase()} with ${amount} tokens!`, 'success');
    } else {
        showToast('Failed to place prediction. Please try again.', 'error');
    }
}

// ==================== MARKET CREATION HANDLER ====================

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
        showToast('Market created successfully!', 'success');
        await AppState.navigate('market', { marketId: newMarket.id });
    } catch (e) {
        showToast('Failed to create market. Please try again.', 'error');
    }
}

// ==================== COMMENT HANDLER ====================

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

// ==================== LOGOUT ====================

async function handleLogout() {
    await AppState.logout();
}

// ==================== UTILITIES ====================

function getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

// Toast notification
function showToast(message, type = 'info') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-shark-600',
    };

    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `fixed bottom-6 right-6 ${colors[type]} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium z-50 fade-in`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== INIT ====================

// Subscribe to state changes
AppState.subscribe(render);

// Initial render (shows loading)
render();

// Initialize auth & data
AppState.init();
