// AI integration — calls Claude API from browser using a key fetched via secure RPC.
// The API key is stored in app_config (no RLS read policy), fetched once per session
// through a SECURITY DEFINER function, cached in memory only (never in localStorage).

const AI = {
    _loading: false,
    _key: null,

    // Fetch API key from server (cached for session)
    async _getKey() {
        if (this._key) return this._key;
        const { data, error } = await supabaseClient.rpc('get_ai_key');
        if (error) throw new Error('AI not configured: ' + error.message);
        if (!data) throw new Error('AI API key not configured — ask an admin to set it up');
        this._key = data;
        return data;
    },

    // Call Claude API directly
    async _call(systemPrompt, userPrompt, maxTokens = 1024) {
        const apiKey = await this._getKey();

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Claude API error (${res.status})`);
        }

        const data = await res.json();
        return data.content?.[0]?.text || '';
    },

    // Feature A: Generate market suggestions from a topic
    async suggestMarkets(topic, category) {
        if (this._loading) return null;
        this._loading = true;
        try {
            const systemPrompt = `You are a market question generator for SharkPool, an internal prediction market at SharkNinja (consumer electronics company that makes Shark vacuums/hair tools and Ninja kitchen appliances).

Generate 3 prediction market questions based on the user's topic. For each question, decide whether it works best as a binary (YES/NO) market or a multiple choice market:
- Use binary for questions with a clear yes/no outcome (e.g. "Will X happen by Y date?")
- Use multiple choice when there are 3+ distinct possible outcomes (e.g. "Which product will sell the most?")

Each question should:
- Be specific and time-bound (include a date or quarter)
- Have clear resolution criteria
- Be relevant to SharkNinja employees
- Include a suggested category from: product_launch, competitor, sales, strategy, innovation, fun
- Include at least one multiple choice market if the topic naturally lends itself to it

Respond with a JSON array of exactly 3 objects, each with these fields:
- "title": the market question (under 200 chars)
- "description": resolution criteria and background (200-500 chars)
- "category": one of the categories listed above
- "closes_at": suggested closing date in YYYY-MM-DD format
- "market_type": "binary" or "multi"
- "options": array of 3-6 option strings (ONLY if market_type is "multi", omit for binary)

Respond ONLY with the JSON array, no other text.`;

            const userPrompt = `Topic: ${topic}${category ? `\nPreferred category: ${category}` : ''}`;

            const raw = await this._call(systemPrompt, userPrompt);
            const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const suggestions = JSON.parse(cleaned);
            if (!Array.isArray(suggestions)) throw new Error('Invalid response format');
            return suggestions;
        } finally {
            this._loading = false;
        }
    },

    // Feature B: Summarize a market's activity
    async summarizeMarket(marketId) {
        if (this._loading) return null;
        this._loading = true;
        try {
            const market = AppState.selectedMarket;
            const predictions = AppState.selectedMarketPredictions || [];
            const comments = AppState.selectedMarketComments || [];

            const systemPrompt = `You are an analyst for SharkPool, an internal prediction market at SharkNinja. Provide a brief, insightful summary of market activity.

Your summary should be 2-4 sentences covering:
- Current market sentiment and probability trend
- Key trading patterns (large bets, recent momentum shifts)
- Notable points from the discussion (if any comments)
- What the market signal means for the underlying question

Be concise and analytical. Use plain language. Do not use markdown formatting — just plain text paragraphs.`;

            const tradesSummary = predictions.slice(0, 20).map(p =>
                `${p.profiles?.name || 'User'} bet ${p.amount}t on ${(p.direction || '?').toUpperCase()} (${p.shares?.toFixed(1) || '?'} shares)`
            ).join('; ') || 'None yet';

            const commentsSummary = comments.slice(0, 10).map(c =>
                `${c.profiles?.name || 'User'}: "${c.text}"`
            ).join('\n') || 'No comments yet';

            const daysLeft = Math.max(0, Math.ceil((new Date(market.closes_at) - Date.now()) / 86400000));

            const userPrompt = `Market: "${market.title}"
Description: ${market.description}
Current probability: ${Math.round(market.probability * 100)}%
Status: ${market.status}
Volume: ${market.volume} tokens across ${market.traders} traders
Days remaining: ${daysLeft}

Recent trades: ${tradesSummary}

Comments:
${commentsSummary}`;

            return await this._call(systemPrompt, userPrompt, 512);
        } finally {
            this._loading = false;
        }
    },
};
