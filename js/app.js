// Main app initialization and global handlers

function render() {
    const app = document.getElementById('app');
    let pageContent = '';

    switch (AppState.currentPage) {
        case 'dashboard': pageContent = Pages.dashboard(); break;
        case 'markets': pageContent = Pages.markets(); break;
        case 'market': pageContent = Pages.market(); break;
        case 'leaderboard': pageContent = Pages.leaderboard(); break;
        case 'create': pageContent = Pages.create(); break;
        default: pageContent = Pages.dashboard();
    }

    app.innerHTML = Components.header() + '<main>' + pageContent + '</main>';
}

// Handle prediction placement
function handlePrediction(marketId, direction) {
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

    const success = AppState.placePrediction(marketId, direction, amount);
    if (success) {
        showToast(`Prediction placed: ${direction.toUpperCase()} with ${amount} tokens!`, 'success');
    }
}

// Handle market creation
function handleCreateMarket() {
    const title = document.getElementById('create-title')?.value?.trim();
    const desc = document.getElementById('create-desc')?.value?.trim();
    const category = document.getElementById('create-category')?.value;
    const closesAt = document.getElementById('create-closes')?.value;

    if (!title) { showToast('Please enter a question', 'error'); return; }
    if (!desc) { showToast('Please enter a description', 'error'); return; }
    if (!closesAt) { showToast('Please set a closing date', 'error'); return; }

    const newMarket = AppState.addMarket({ title, description: desc, category, closesAt });
    showToast('Market created successfully!', 'success');
    AppState.navigate('market', { marketId: newMarket.id });
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

// Subscribe to state changes
AppState.subscribe(render);

// Initial render
render();
