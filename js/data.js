// Constants for the SharkNinja Prediction Market

const CATEGORIES = {
    PRODUCT_LAUNCH: { id: 'product_launch', label: 'Product Launches', icon: '🚀', color: 'blue' },
    COMPETITOR: { id: 'competitor', label: 'Competitor Intel', icon: '🔍', color: 'red' },
    SALES: { id: 'sales', label: 'Sales Forecasts', icon: '📊', color: 'green' },
    STRATEGY: { id: 'strategy', label: 'Strategic Insights', icon: '🎯', color: 'purple' },
    INNOVATION: { id: 'innovation', label: 'Innovation & R&D', icon: '💡', color: 'amber' },
    FUN: { id: 'fun', label: 'For Fun', icon: '🎉', color: 'pink' },
};

const MARKET_TEMPLATES = [
    { label: 'Product Launch', category: 'product_launch',
      title: 'Will [product name] launch by [date]?',
      description: 'Resolution: YES if the product is officially available for purchase by the specified date. NO otherwise.' },
    { label: 'Revenue Target', category: 'sales',
      title: 'Will [product/region] exceed $[X]M in revenue by [quarter]?',
      description: 'Resolution: Based on official finance reports for the specified period. YES if revenue meets or exceeds the target.' },
    { label: 'Competitor Move', category: 'competitor',
      title: 'Will [competitor] launch a competing product in [category] by [date]?',
      description: 'Resolution: YES if the competitor announces or ships a product in the specified category. Based on public announcements.' },
    { label: 'Strategic Decision', category: 'strategy',
      title: 'Will SharkNinja [expand into/partner with/acquire] [target] by [date]?',
      description: 'Resolution: YES if an official announcement or SEC filing confirms the action. NO if the date passes without action.' },
    { label: 'Innovation Milestone', category: 'innovation',
      title: 'Will the [project/feature] prototype be completed by [date]?',
      description: 'Resolution: YES if a working prototype is demonstrated to stakeholders by the specified date.' },
    { label: 'Market Share', category: 'sales',
      title: 'Will SharkNinja reach [X]% market share in [category] by [quarter]?',
      description: 'Resolution: Based on NPD/Circana data for the specified period. YES if share meets or exceeds target.' },
    { label: 'Go/No-Go', category: 'strategy',
      title: 'Will the [initiative/project] receive go-ahead by [date]?',
      description: 'Resolution: YES if leadership approves the initiative with budget allocation. NO if deferred or cancelled.' },
    { label: 'Customer Metric', category: 'sales',
      title: 'Will [product] NPS score exceed [X] by end of [quarter]?',
      description: 'Resolution: Based on official NPS survey results for the specified period.' },
];

const AVATAR_PRESETS = [
    '🦈', '🥷', '🚀', '🎯', '💡', '🔥', '⚡', '🌊',
    '🏔️', '🌟', '🎲', '🧠', '🦁', '🐉', '🦅', '🐺',
    '🍀', '💎', '🛡️', '⚔️', '🎭', '🌈', '🔮', '🧊',
];

const DEPARTMENTS = [
    'Product Strategy', 'Engineering', 'Marketing', 'Sales', 'Finance',
    'E-commerce', 'Supply Chain', 'R&D', 'IT & Analytics',
    'Customer Experience', 'Competitive Intelligence', 'Corporate Strategy',
    'Operations', 'AI/ML Team', 'International', 'Retail', 'Sustainability',
    'Legal', 'HR', 'Design', 'Other'
];
