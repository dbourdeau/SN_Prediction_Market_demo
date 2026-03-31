// ============================================================
// SharkPool Help Chatbot
// Self-contained widget — appended to <body>, survives page navigation
// ============================================================

const ChatWidget = {
    open: false,
    messages: [],   // { role: 'user'|'assistant', text: string }
    loading: false,

    SYSTEM_PROMPT: `You are the SharkPool help assistant — a friendly, concise helper for SharkNinja's internal prediction market platform called SharkPool.

SharkPool lets SharkNinja employees make predictions on real business questions (product launches, sales targets, competitor moves, strategy decisions) using play tokens. It's not real money — it's a forecasting tool to surface collective intelligence.

Key things to know:
- Users start with 500 tokens (and earn a 50-token daily login bonus)
- Markets are questions with a close date; they resolve YES or NO (or a named option for multi-outcome markets)
- Probability = the crowd's current estimate of YES. 72% means the crowd thinks there's a 72% chance it resolves YES
- LMSR AMM pricing: the more people buy YES, the higher the YES price goes
- Winning a trade pays out shares × 1 token each. Losing means you lose your stake
- Anyone can create a market — admins approve it before it goes live (unless you're an admin yourself)
- Multi-outcome markets have multiple named options instead of YES/NO
- The leaderboard ranks users by points (earned from correct predictions)
- The Analytics page shows platform-wide stats including calibration data
- Source of Truth: market creators can optionally link a SharePoint file as the data source for their question

Keep answers short and practical. Use plain language. If someone asks something outside SharkPool (general business, unrelated topics), politely redirect to SharkPool topics.`,

    _promptTimer: null,

    PROMPTS: [
        "👋 Need help getting started?",
        "💡 Not sure how trading works?",
        "🤔 Have a question about SharkPool?",
        "📊 Wondering what probability means?",
        "🦈 I can help you make your first trade!",
    ],

    init() {
        if (document.getElementById('chat-widget')) return; // already initialized
        const el = document.createElement('div');
        el.id = 'chat-widget';
        el.innerHTML = this._html();
        document.body.appendChild(el);
        this._bindEvents();
        this._schedulePrompt();
    },

    _schedulePrompt() {
        // Only prompt once per session
        if (sessionStorage.getItem('sharkpool_chat_prompted')) return;
        clearTimeout(this._promptTimer);
        // Show after 25 seconds
        this._promptTimer = setTimeout(() => {
            if (!this.open) this._showPromptBubble();
        }, 25000);
    },

    _showPromptBubble() {
        if (this.open || document.getElementById('chat-prompt-bubble')) return;
        sessionStorage.setItem('sharkpool_chat_prompted', '1');

        const msg = this.PROMPTS[Math.floor(Math.random() * this.PROMPTS.length)];
        const bubble = document.createElement('div');
        bubble.id = 'chat-prompt-bubble';
        bubble.style.cssText = 'position:fixed;bottom:76px;right:16px;z-index:51;animation:chatBubbleIn 0.3s ease;';
        bubble.innerHTML = `
            <div style="background:#0059a3;color:white;padding:10px 14px;border-radius:16px 16px 4px 16px;font-size:13px;font-weight:500;box-shadow:0 4px 20px rgba(0,89,163,0.35);cursor:pointer;max-width:220px;line-height:1.4;"
                onclick="ChatWidget._dismissPrompt(true)">${msg}</div>
            <button onclick="ChatWidget._dismissPrompt(false)" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#6b7280;color:white;border:none;font-size:10px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>`;
        document.body.appendChild(bubble);

        // Auto-dismiss after 8 seconds
        setTimeout(() => this._dismissPrompt(false), 8000);
    },

    _dismissPrompt(openChat) {
        document.getElementById('chat-prompt-bubble')?.remove();
        if (openChat && !this.open) this.toggle();
    },

    _html() {
        return `
        <!-- Toggle button -->
        <button id="chat-toggle-btn" onclick="ChatWidget.toggle()"
            class="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
            style="width:52px;height:52px;background:linear-gradient(135deg,#0059a3,#0c8eeb);"
            title="SharkPool Help">
            <span id="chat-icon" style="font-size:22px;line-height:1;">💬</span>
        </button>

        <!-- Chat panel -->
        <div id="chat-panel"
            class="fixed bottom-24 right-6 z-50 w-80 sm:w-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
            style="max-height:480px;display:none;background:#fff;border:1px solid #e5e7eb;">

            <!-- Header -->
            <div class="flex items-center justify-between px-4 py-3 shrink-0"
                style="background:linear-gradient(135deg,#0059a3,#0c8eeb);">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base">🦈</div>
                    <div>
                        <div class="text-sm font-bold text-white">SharkPool Assistant</div>
                        <div class="text-xs text-white/60">Ask me how to use SharkPool</div>
                    </div>
                </div>
                <button onclick="ChatWidget.toggle()" class="text-white/70 hover:text-white text-lg leading-none px-1">✕</button>
            </div>

            <!-- Messages -->
            <div id="chat-messages" class="flex-1 overflow-y-auto px-4 py-3 space-y-3"
                style="min-height:200px;max-height:320px;background:#f9fafb;">
                <div class="flex gap-2 items-start">
                    <div class="w-6 h-6 rounded-full bg-shark-100 flex items-center justify-center text-xs shrink-0 mt-0.5">🦈</div>
                    <div class="bg-white rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-700 shadow-sm border border-gray-100 max-w-xs">
                        Hi! I'm here to help you use SharkPool. Ask me anything — how trading works, how to create a market, what the leaderboard means, anything!
                    </div>
                </div>
            </div>

            <!-- Input -->
            <div class="flex gap-2 px-3 py-3 shrink-0 border-t border-gray-100" style="background:#fff;">
                <input id="chat-input" type="text" placeholder="Ask a question…"
                    class="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent"
                    style="focus-ring-color:#0c8eeb;"
                    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ChatWidget.send();}"/>
                <button onclick="ChatWidget.send()" id="chat-send-btn"
                    class="px-3 py-2 rounded-xl text-white text-sm font-semibold shrink-0 transition-colors"
                    style="background:#0059a3;">
                    Send
                </button>
            </div>
        </div>`;
    },

    _bindEvents() {
        // Suggested questions on startup (optional quick-starts)
    },

    toggle() {
        this.open = !this.open;
        const panel = document.getElementById('chat-panel');
        const icon  = document.getElementById('chat-icon');
        if (!panel) return;
        if (this.open) {
            panel.style.display = 'flex';
            panel.style.flexDirection = 'column';
            requestAnimationFrame(() => { panel.style.opacity = '1'; panel.style.transform = 'translateY(0)'; });
            icon.textContent = '✕';
            document.getElementById('chat-input')?.focus();
        } else {
            panel.style.display = 'none';
            icon.textContent = '💬';
        }
    },

    async send() {
        if (this.loading) return;
        const input = document.getElementById('chat-input');
        const text = input?.value?.trim();
        if (!text) return;
        input.value = '';

        this._appendMessage('user', text);
        this.messages.push({ role: 'user', content: text });
        this.loading = true;
        this._setLoading(true);

        try {
            // Build conversation for Claude (last 10 messages for context)
            const history = this.messages.slice(-10);
            const response = await AI._callChat(this.SYSTEM_PROMPT, history);
            this.messages.push({ role: 'assistant', content: response });
            this._appendMessage('assistant', response);
        } catch (err) {
            this._appendMessage('assistant', 'Sorry, I couldn\'t connect right now. Make sure you\'re logged in and try again.');
        } finally {
            this.loading = false;
            this._setLoading(false);
        }
    },

    _appendMessage(role, text) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const isUser = role === 'user';
        const div = document.createElement('div');
        div.className = `flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`;
        div.innerHTML = isUser
            ? `<div class="bg-blue-600 rounded-2xl rounded-tr-sm px-3 py-2 text-sm text-white max-w-xs" style="background:#0059a3;">${esc(text)}</div>`
            : `<div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs shrink-0 mt-0.5">🦈</div>
               <div class="bg-white rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-700 shadow-sm border border-gray-100 max-w-xs" style="white-space:pre-wrap;">${esc(text)}</div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    _setLoading(on) {
        const btn = document.getElementById('chat-send-btn');
        const input = document.getElementById('chat-input');
        const container = document.getElementById('chat-messages');
        if (btn) { btn.disabled = on; btn.style.opacity = on ? '0.5' : '1'; }
        if (input) { input.disabled = on; }
        if (on && container) {
            const dot = document.createElement('div');
            dot.id = 'chat-typing';
            dot.className = 'flex gap-2 items-start';
            dot.innerHTML = `<div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs shrink-0">🦈</div>
                <div class="bg-white rounded-2xl rounded-tl-sm px-3 py-2 border border-gray-100 shadow-sm">
                    <div class="flex gap-1 items-center h-4">
                        <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay:0ms"></span>
                        <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay:150ms"></span>
                        <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay:300ms"></span>
                    </div>
                </div>`;
            container.appendChild(dot);
            container.scrollTop = container.scrollHeight;
        } else {
            document.getElementById('chat-typing')?.remove();
        }
    },
};
