// AI integration — calls Claude API via Postgres RPC functions
// The API key is stored in app_config table (server-side only, no RLS read access).
// Browser calls supabase.rpc() → Postgres function → Claude API → response.

const AI = {
    _loading: false,

    // Feature A: Generate market suggestions from a topic
    async suggestMarkets(topic, category) {
        if (this._loading) return null;
        this._loading = true;
        try {
            const { data, error } = await supabaseClient.rpc('ai_suggest_markets', {
                p_topic: topic,
                p_category: category || null,
            });
            if (error) throw new Error(error.message);
            // Parse JSON from response (Claude may wrap it in markdown code fences)
            const cleaned = (data || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
            const { data, error } = await supabaseClient.rpc('ai_summarize_market', {
                p_market_id: marketId,
            });
            if (error) throw new Error(error.message);
            return data;
        } finally {
            this._loading = false;
        }
    },
};
