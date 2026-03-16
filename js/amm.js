// Automated Market Maker using Logistic/LMSR pricing
// This provides proper price discovery for the prediction market

const AMM = {
    // Liquidity parameter: higher = more stable prices, lower = more volatile
    // At b=100, a 50-token trade moves price ~1.2%
    b: 100,

    // Get YES probability from logit score
    // logit = ln(p / (1-p)), so p = sigmoid(logit) = 1 / (1 + e^(-logit))
    probability(logit) {
        // Clamp to avoid extreme values
        const clamped = Math.max(-10, Math.min(10, logit));
        return 1 / (1 + Math.exp(-clamped));
    },

    // Get logit from probability
    logitFromProb(prob) {
        const p = Math.max(0.01, Math.min(0.99, prob));
        return Math.log(p / (1 - p));
    },

    // Calculate cost to buy `shares` of an outcome
    // Uses LMSR cost function with log-sum-exp for numerical stability
    _C(qYes, qNo) {
        const a = qYes / this.b;
        const bv = qNo / this.b;
        const maxVal = Math.max(a, bv);
        return this.b * (maxVal + Math.log(Math.exp(a - maxVal) + Math.exp(bv - maxVal)));
    },

    // Cost to buy shares of YES or NO
    buyCost(qYes, qNo, shares, direction) {
        const newQYes = direction === 'yes' ? qYes + shares : qYes;
        const newQNo = direction === 'no' ? qNo + shares : qNo;
        return this._C(newQYes, newQNo) - this._C(qYes, qNo);
    },

    // How many shares can you buy with a given budget?
    // Uses binary search since the cost function is monotonic
    sharesForBudget(qYes, qNo, budget, direction) {
        if (budget <= 0) return 0;
        let lo = 0;
        let hi = budget * 20; // generous upper bound
        for (let i = 0; i < 60; i++) {
            const mid = (lo + hi) / 2;
            const cost = this.buyCost(qYes, qNo, mid, direction);
            if (cost < budget) lo = mid;
            else hi = mid;
        }
        return Math.floor(lo * 100) / 100; // round down to 2 decimals
    },

    // Revenue from selling shares back
    sellRevenue(qYes, qNo, shares, direction) {
        const newQYes = direction === 'yes' ? qYes - shares : qYes;
        const newQNo = direction === 'no' ? qNo - shares : qNo;
        if (newQYes < 0 || newQNo < 0) return 0;
        return this._C(qYes, qNo) - this._C(newQYes, newQNo);
    },

    // Get YES price given share quantities
    yesPrice(qYes, qNo) {
        const diff = (qYes - qNo) / this.b;
        return this.probability(diff);
    },

    // Calculate new logit after a trade
    newLogit(qYes, qNo) {
        return this.logitFromProb(this.yesPrice(qYes, qNo));
    },

    // Estimate potential payout for a trade
    // If you buy YES shares and YES wins, each share = 1 token
    estimatePayout(qYes, qNo, budget, direction) {
        const shares = this.sharesForBudget(qYes, qNo, budget, direction);
        return {
            shares: shares,
            costPerShare: shares > 0 ? budget / shares : 0,
            potentialPayout: shares, // each winning share = 1 token
            potentialProfit: shares - budget,
            impliedProbability: shares > 0 ? budget / shares : 0,
        };
    }
};
