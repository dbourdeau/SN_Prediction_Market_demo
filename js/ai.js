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

    // Deep research: agentic loop using Claude's built-in web_search tool
    async deepResearch(market) {
        const apiKey = await this._getKey();

        const systemPrompt = `You are a research analyst for SharkPool, SharkNinja's internal prediction market (SharkNinja makes Shark vacuum cleaners, hair tools, and Ninja kitchen appliances).

Your job: use web search to research the topic of the given prediction market question, then form an evidence-based opinion on its likely outcome.

Search strategy:
- Search for recent news and developments directly related to the question
- Look for industry data, analyst reports, or expert forecasts
- Find historical context or comparable past events
- Consider the question's close date when assessing likelihood

After researching, respond ONLY with this JSON object:
{
  "estimated_probability": <integer 0-100, your best estimate of YES likelihood>,
  "confidence": "low" | "medium" | "high",
  "verdict": "likely_yes" | "likely_no" | "uncertain",
  "key_findings": ["<finding>", "<finding>", "<finding>"],
  "reasoning": "<2-3 sentences summarizing your conclusion based on the research>",
  "searches_performed": ["<brief label of what you searched for>"],
  "caveat": "<one sentence — note if external research may not reflect internal SharkNinja data>"
}

Respond ONLY with the JSON object.`;

        const userPrompt = `Research this prediction market question and estimate its probability:\n\nQuestion: "${market.title}"\nCategory: ${market.category}\nClose date: ${market.closes_at}\nDescription/Resolution criteria: ${market.description || 'None provided'}`;

        const messages = [{ role: 'user', content: userPrompt }];
        let iterations = 0;

        const _fetchWithRetry = async (body) => {
            for (let attempt = 0; attempt < 3; attempt++) {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-beta': 'web-search-2025-03-05',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify(body),
                });
                if (res.status === 529 && attempt < 2) {
                    await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
                    continue;
                }
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || `Research error (${res.status})`);
                }
                return res;
            }
        };

        while (iterations < 10) {
            iterations++;

            const res = await _fetchWithRetry({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 2048,
                    system: systemPrompt,
                    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
                    messages,
            });

            const data = await res.json();

            if (data.stop_reason === 'end_turn') {
                const textBlock = data.content.find(b => b.type === 'text');
                const raw = (textBlock?.text || '').replace(/<cite[^>]*>|<\/cite>/gi, '');
                const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                return JSON.parse(cleaned);
            }

            // Add assistant turn and continue the loop
            messages.push({ role: 'assistant', content: data.content });

            if (data.stop_reason === 'tool_use') {
                const toolResults = data.content
                    .filter(b => b.type === 'tool_use')
                    .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }));
                messages.push({ role: 'user', content: toolResults });
            } else {
                // Unexpected stop — try to extract text anyway
                const textBlock = data.content?.find(b => b.type === 'text');
                if (textBlock?.text) {
                    const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    return JSON.parse(cleaned);
                }
                throw new Error('Unexpected research agent response');
            }
        }

        throw new Error('Research agent did not complete');
    },

    // Chat: multi-turn conversation (array of {role, content} objects)
    async _callChat(systemPrompt, messages, maxTokens = 512) {
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
                model: 'claude-haiku-4-5-20251001',
                max_tokens: maxTokens,
                system: systemPrompt,
                messages,
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

    // Feature C: Draft resolution criteria from a market title
    async draftResolutionCriteria(title, category) {
        const systemPrompt = `You are a market designer for SharkPool, an internal prediction market at SharkNinja (makes Shark vacuums/hair tools and Ninja kitchen appliances).

Given a market question title, write clear resolution criteria and background context. Format your response as two short paragraphs:
1. "Resolution Criteria:" — exactly how this market resolves YES, NO, or void. Be specific. Reference measurable thresholds, official sources, or dates.
2. "Background:" — 1-2 sentences of relevant context for traders.

Keep the total under 400 characters. Plain text only, no markdown.`;
        return await this._call(systemPrompt, `Title: ${title}\nCategory: ${category || 'general'}`, 300);
    },

    // Feature D: AI quality review for a pending market (admin use)
    async reviewMarketQuality(market) {
        const systemPrompt = `You are a market quality reviewer for SharkPool, an internal prediction market at SharkNinja.

Review the submitted market and respond with a JSON object:
{
  "score": <1-10 integer, 10 = perfect>,
  "recommendation": "approve" | "approve_with_edits" | "reject",
  "issues": [<short string per issue, max 3>],
  "suggestion": "<one sentence improvement tip, or empty string if none>"
}

Score criteria:
- 8-10: Clear question, specific resolution criteria, measurable outcome, realistic timeframe → approve
- 5-7: Mostly good but has minor clarity or specificity issues → approve_with_edits
- 1-4: Vague, unresolvable, duplicate, or inappropriate → reject

Respond ONLY with the JSON object.`;

        const userPrompt = `Title: ${market.title}
Category: ${market.category}
Closes: ${market.closes_at}
Description/Criteria: ${market.description || '(none provided)'}`;

        const raw = await this._call(systemPrompt, userPrompt, 300);
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    },

    // Feature B: Structured market analysis
    async summarizeMarket(marketId) {
        if (this._loading) return null;
        this._loading = true;
        try {
            const market = AppState.selectedMarket;
            const predictions = AppState.selectedMarketPredictions || [];
            const comments = AppState.selectedMarketComments || [];

            const systemPrompt = `You are a sharp, concise analyst for SharkPool, SharkNinja's internal prediction market. Analyze the market data and return a JSON object with this exact shape:

{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": <integer 1-10>,
  "trend": "rising" | "falling" | "stable",
  "signal": "<1 sentence: what the market probability is telling us about the underlying question>",
  "rationale": "<2-3 sentences of analytical reasoning covering trading patterns, momentum, and what drives the current probability>",
  "risks": ["<short risk phrase>", "<short risk phrase>"],
  "recommendation": "buy_yes" | "buy_no" | "hold" | "watch",
  "rec_reason": "<1 sentence explaining the recommendation>",
  "key_stat": "<one punchy stat or observation, e.g. '73% of volume came in the last 48h'>",
  "disclaimer": "AI analysis is based on platform data only and does not constitute financial advice."
}

Be direct and insightful. Base everything only on the data provided. Respond ONLY with the JSON object.`;

            // Compute probability trend from history
            const hist = market.history || [];
            let trend = 'stable';
            if (hist.length >= 3) {
                const recent = typeof hist[hist.length-1] === 'object' ? hist[hist.length-1].p : hist[hist.length-1];
                const older = typeof hist[Math.max(0, hist.length-5)] === 'object' ? hist[Math.max(0, hist.length-5)].p : hist[Math.max(0, hist.length-5)];
                const delta = recent - older;
                if (delta > 0.05) trend = 'rising';
                else if (delta < -0.05) trend = 'falling';
            }

            const tradesSummary = predictions.slice(0, 20).map(p =>
                `${p.profiles?.name || 'User'}: ${p.amount}t on ${(p.direction || '?').toUpperCase()} (${p.shares?.toFixed(1) || '?'} shares)`
            ).join('; ') || 'No trades yet';

            const commentsSummary = comments.slice(0, 10).map(c =>
                `${c.profiles?.name || 'User'}: "${c.text}"`
            ).join('\n') || 'No comments yet';

            const daysLeft = Math.max(0, Math.ceil((new Date(market.closes_at) - Date.now()) / 86400000));
            const probPct = Math.round((market.probability || 0) * 100);

            // Current user's position on this market
            const myPositions = (AppState.userPredictions || []).filter(
                p => p.market_id === market.id && p.status === 'active'
            );
            let userPositionText = 'None — user has no position on this market.';
            if (myPositions.length > 0) {
                const posLines = myPositions.map(p => {
                    const currentValue = market.market_type === 'multi'
                        ? AMM.sellRevenueMulti(market.q_values || [], p.shares, p.option_index)
                        : AMM.sellRevenue(market.q_yes || 0, market.q_no || 0, p.shares, p.direction);
                    const pnl = Math.round(currentValue) - p.amount;
                    const entryProb = Math.round((p.entry_prob || 0) * 100);
                    return `Direction: ${(p.direction || '?').toUpperCase()} | Invested: ${p.amount}t | Shares: ${p.shares?.toFixed(1)} | Entry prob: ${entryProb}% | Current sell value: ${Math.round(currentValue)}t | Unrealized P&L: ${pnl >= 0 ? '+' : ''}${pnl}t`;
                });
                userPositionText = posLines.join('\n');
            }

            const userPrompt = `Market: "${market.title}"
Category: ${market.category}
Description/Resolution Criteria: ${market.description}
Current probability: ${probPct}% YES
Probability trend: ${trend}
Volume: ${market.volume} tokens | Traders: ${market.traders}
Days remaining: ${daysLeft}

USER'S CURRENT POSITION:
${userPositionText}

Recent trades (all users): ${tradesSummary}

Discussion:
${commentsSummary}`;

            const raw = await this._call(systemPrompt, userPrompt, 600);
            const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned);
        } finally {
            this._loading = false;
        }
    },

    // Executive Briefing: synthesize all active markets into a leadership-ready report
    async generateBriefing(markets) {
        const systemPrompt = `You are a strategic intelligence analyst for SharkNinja's internal prediction market platform, SharkPool.

Your job is to synthesize the current state of all active prediction markets into a concise executive briefing — something a VP or executive could read in 2 minutes to understand what the collective intelligence of SharkNinja employees currently believes about the business.

Respond ONLY with this JSON object:
{
  "headline": "<one punchy sentence summarizing the overall mood/outlook>",
  "overall_sentiment": "optimistic" | "cautious" | "mixed" | "uncertain",
  "generated_at": "<ISO timestamp>",
  "categories": [
    {
      "name": "<category name>",
      "summary": "<1-2 sentences on what markets in this category collectively show>",
      "markets": [
        {
          "title": "<market title>",
          "probability": <integer 0-100>,
          "signal": "bullish" | "bearish" | "neutral",
          "notable": "<one short observation, e.g. 'High conviction — 89% YES with strong volume' or 'Crowd shifted 15pts in 3 days'>",
          "volume": <integer tokens>
        }
      ]
    }
  ],
  "high_conviction": [
    { "title": "<market title>", "probability": <integer>, "direction": "YES" | "NO", "reason": "<why this is notable>" }
  ],
  "watch_list": [
    { "title": "<market title>", "reason": "<why leadership should watch this one>" }
  ],
  "key_takeaways": ["<takeaway 1>", "<takeaway 2>", "<takeaway 3>"],
  "total_markets": <integer>,
  "total_volume": <integer>,
  "total_traders": <integer>
}

Rules:
- high_conviction: markets with probability > 75% or < 25% AND volume > 100 (max 4)
- watch_list: markets with sharp recent movement, low volume but important topic, or probability near 50% on a critical question (max 3)
- key_takeaways: 3 bullets written for a C-suite audience — strategic, direct, no jargon
- Skip markets with 0 traders
- Group by category, use readable category names (e.g. "Product Launch" not "product_launch")

Respond ONLY with the JSON object.`;

        const activeMarkets = markets.filter(m => m.status === 'active' && !m.resolution && m.traders > 0);
        const marketData = activeMarkets.map(m => {
            const pct = Math.round((m.probability || 0) * 100);
            const hist = m.history || [];
            let trend = 'stable';
            if (hist.length >= 3) {
                const recent = typeof hist[hist.length-1] === 'object' ? hist[hist.length-1].p : hist[hist.length-1];
                const older = typeof hist[Math.max(0, hist.length-5)] === 'object' ? hist[Math.max(0, hist.length-5)].p : hist[Math.max(0, hist.length-5)];
                const delta = recent - older;
                if (delta > 0.05) trend = 'rising';
                else if (delta < -0.05) trend = 'falling';
            }
            return `- [${m.category}] "${m.title}" | ${pct}% YES | Volume: ${m.volume}t | Traders: ${m.traders} | Trend: ${trend} | Closes: ${(m.closes_at || '').split('T')[0]}`;
        }).join('\n');

        const totalVolume = activeMarkets.reduce((s, m) => s + (m.volume || 0), 0);
        const totalTraders = activeMarkets.reduce((s, m) => s + (m.traders || 0), 0);

        const userPrompt = `Generate an executive briefing for SharkNinja leadership based on these ${activeMarkets.length} active prediction markets (total platform volume: ${totalVolume} tokens, ${totalTraders} total trades):\n\n${marketData}\n\nToday's date: ${new Date().toISOString().split('T')[0]}`;

        const raw = await this._call(systemPrompt, userPrompt, 2000);
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    },
};
