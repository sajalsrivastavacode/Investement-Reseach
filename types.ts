export interface NewsArticle {
  title: string;
  snippet: string;
  url: string;
  source?: string;
  date?: string;
}

export interface FinancialData {
  currency?: string;
  marketCap?: string;
  stockPrice?: string;
  peRatio?: string;
  revenue?: string;
  netIncome?: string;
  profitMargin?: string;
  debtToEquity?: string;
  dividendYield?: string;
  fiftyTwoWeekHigh?: string;
  fiftyTwoWeekLow?: string;
  historicalPrices?: { date: string; price: number }[];
  notPubliclyListed?: boolean;
  sourceDescription?: string;
}

export interface AgentStep {
  node: 'init' | 'gatherNews' | 'gatherFinancials' | 'analyzeCompany' | 'makeDecision' | 'error';
  status: 'idle' | 'running' | 'completed' | 'failed';
  message: string;
  timestamp: string;
  output?: any;
}

export interface AgentState {
  companyName: string;
  news: NewsArticle[];
  financials: FinancialData;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    financialHealth: string;
    summary: string;
  } | null;
  decision: 'INVEST' | 'PASS' | null;
  reasoning: string;
  riskRating: 'Low' | 'Medium' | 'High' | null;
  targetPrice: string;
  steps: AgentStep[];
}
