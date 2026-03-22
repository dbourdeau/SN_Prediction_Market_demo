// Supabase Edge Function: Claude API Proxy
// Keeps the Anthropic API key server-side (stored as a Supabase secret).
// The browser calls this function; this function calls Claude.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated via Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { action, payload } = await req.json();

    let systemPrompt: string;
    let userPrompt: string;

    if (action === "suggest_markets") {
      // Feature A: Generate market suggestions from a topic
      const { topic, category } = payload;
      systemPrompt = `You are a market question generator for SharkPool, an internal prediction market at SharkNinja (consumer electronics company that makes Shark vacuums/hair tools and Ninja kitchen appliances).

Generate 3 prediction market questions based on the user's topic. Each question should:
- Be specific and time-bound (include a date or quarter)
- Have clear YES/NO resolution criteria
- Be relevant to SharkNinja employees
- Include a suggested category from: product_launch, competitor, sales, strategy, innovation, fun

Respond with a JSON array of exactly 3 objects, each with these fields:
- "title": the market question (under 200 chars)
- "description": resolution criteria and background (200-500 chars)
- "category": one of the categories listed above
- "closes_at": suggested closing date in YYYY-MM-DD format

Respond ONLY with the JSON array, no other text.`;

      userPrompt = `Topic: ${topic}${category ? `\nPreferred category: ${category}` : ""}`;

    } else if (action === "summarize_market") {
      // Feature B: Summarize market activity
      const { market, predictions, comments } = payload;
      systemPrompt = `You are an analyst for SharkPool, an internal prediction market at SharkNinja. Provide a brief, insightful summary of market activity.

Your summary should be 2-4 sentences covering:
- Current market sentiment and probability trend
- Key trading patterns (large bets, recent momentum shifts)
- Notable points from the discussion (if any comments)
- What the market signal means for the underlying question

Be concise and analytical. Use plain language. Do not use markdown formatting — just plain text paragraphs.`;

      const tradesSummary = (predictions || []).slice(0, 20).map((p: any) =>
        `${p.profiles?.name || "User"} bet ${p.amount}t on ${(p.direction || "?").toUpperCase()} (${p.shares?.toFixed(1) || "?"} shares)`
      ).join("; ");

      const commentsSummary = (comments || []).slice(0, 10).map((c: any) =>
        `${c.profiles?.name || "User"}: "${c.text}"`
      ).join("\n");

      userPrompt = `Market: "${market.title}"
Description: ${market.description}
Current probability: ${Math.round(market.probability * 100)}%
Status: ${market.status}
Volume: ${market.volume} tokens across ${market.traders} traders
Days remaining: ${Math.ceil((new Date(market.closes_at).getTime() - Date.now()) / 86400000)}

Recent trades: ${tradesSummary || "None yet"}

Comments:
${commentsSummary || "No comments yet"}`;

    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Claude API
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errBody);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResponse.json();
    const content = claudeData.content?.[0]?.text || "";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
