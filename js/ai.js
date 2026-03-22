// AI integration — calls the Claude proxy Edge Function
// The API key never touches the browser; it lives in Supabase secrets.

const AI = {
    _loading: false,

    // Call the Edge Function proxy
    async _call(action, payload) {
        const session = await Auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const res = await fetch(`${SUPABASE_URL}/functions/v1/claude-proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action, payload }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `AI request failed (${res.status})`);
        }

        const data = await res.json();
        return data.result;
    },

    // Feature A: Generate market suggestions from a topic
    async suggestMarkets(topic, category) {
        if (this._loading) return null;
        this._loading = true;
        try {
            const raw = await this._call('suggest_markets', { topic, category });
            // Parse JSON from response (Claude may wrap it in markdown code fences)
            const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const suggestions = JSON.parse(cleaned);
            if (!Array.isArray(suggestions)) throw new Error('Invalid response format');
            return suggestions;
        } finally {
            this._loading = false;
        }
    },

    // Feature B: Summarize a market's activity
    async summarizeMarket(market, predictions, comments) {
        if (this._loading) return null;
        this._loading = true;
        try {
            return await this._call('summarize_market', { market, predictions, comments });
        } finally {
            this._loading = false;
        }
    },
};
