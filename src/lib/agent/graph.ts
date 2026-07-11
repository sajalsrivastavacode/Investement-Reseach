import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { AgentState, AgentStep, FinancialData, NewsArticle } from './types';
import { fetchCompanyNews, resolveTicker, fetchFinancialQuote } from './tools';

/**
 * Dynamically resolves which LLM to use based on available environment variables.
 * Prioritizes NVIDIA NIM, falls back to Gemini, then OpenAI.
 */
function getLLM() {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (nvidiaKey && nvidiaKey.trim() !== '') {
    const nvidiaModel = process.env.NVIDIA_MODEL_NAME || 'meta/llama-3.1-8b-instruct';
    console.log(`Using NVIDIA NIM LLM Model: ${nvidiaModel}`);
    return new ChatOpenAI({
      modelName: nvidiaModel,
      apiKey: nvidiaKey,
      configuration: {
        baseURL: 'https://integrate.api.nvidia.com/v1',
      },
      temperature: 0.1,
    });
  } else if (geminiKey && geminiKey.trim() !== '') {
    return new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-flash',
      apiKey: geminiKey,
      temperature: 0.1,
    });
  } else if (openaiKey && openaiKey.trim() !== '') {
    return new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      apiKey: openaiKey,
      temperature: 0.1,
    });
  } else {
    throw new Error(
      'No LLM API keys found. Please set NVIDIA_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in your env file.'
    );
  }
}

/**
 * Extracts JSON block from markdown response.
 */
function parseJsonMarkdown(text: string): any {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    const rawJson = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(rawJson.trim());
  } catch (error) {
    console.error('Failed to parse JSON from model output:', text);
    throw error;
  }
}

// Define the LangGraph State Annotation
const GraphState = Annotation.Root({
  companyName: Annotation<string>(),
  news: Annotation<NewsArticle[]>(),
  financials: Annotation<FinancialData>(),
  analysis: Annotation<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    financialHealth: string;
    summary: string;
  } | null>(),
  decision: Annotation<'INVEST' | 'PASS' | null>(),
  reasoning: Annotation<string>(),
  riskRating: Annotation<'Low' | 'Medium' | 'High' | null>(),
  targetPrice: Annotation<string>(),
  steps: Annotation<AgentStep[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),
});

// Node 1: Gather News (Runs in Parallel with Financials)
async function gatherNewsNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  const timestamp = new Date().toLocaleTimeString();
  
  try {
    const news = await fetchCompanyNews(state.companyName);
    
    const completedStep: AgentStep = {
      node: 'gatherNews',
      status: 'completed',
      message: `Successfully retrieved ${news.length} news articles.`,
      timestamp,
      output: news.slice(0, 3),
    };

    return {
      news,
      steps: [completedStep],
    };
  } catch (error: any) {
    const failedStep: AgentStep = {
      node: 'gatherNews',
      status: 'failed',
      message: `Error gathering news: ${error.message || error}`,
      timestamp,
    };
    return {
      steps: [failedStep],
      news: [],
    };
  }
}

// Node 2: Gather Financials (Runs in Parallel with News)
async function gatherFinancialsNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  const timestamp = new Date().toLocaleTimeString();

  try {
    // 1. Resolve company name to symbol/ticker
    const ticker = await resolveTicker(state.companyName);

    // 2. Fetch structured financials from real API
    const financials = await fetchFinancialQuote(ticker);

    const completedStep: AgentStep = {
      node: 'gatherFinancials',
      status: 'completed',
      message: `Real financials fetched for resolved ticker: "${ticker}".`,
      timestamp,
      output: financials,
    };

    return {
      companyName: ticker, // Update state to resolved ticker symbol
      financials,
      steps: [completedStep],
    };
  } catch (error: any) {
    console.error('Financial node failed:', error);
    const failedStep: AgentStep = {
      node: 'gatherFinancials',
      status: 'failed',
      message: `Financial error: ${error.message || error}`,
      timestamp,
    };
    
    if (error.message && error.message.includes('NOT_PUBLICLY_LISTED')) {
      return {
        financials: {
          notPubliclyListed: true,
          sourceDescription: `This company is privately held or not independently publicly traded.`
        },
        steps: [failedStep],
      };
    }

    // In case of error, mark fields as "Data unavailable". Do not fabricate!
    return {
      financials: {
        currency: state.companyName.endsWith('.NS') || state.companyName.endsWith('.BO') ? 'INR' : 'USD',
        stockPrice: 'Data unavailable',
        marketCap: 'Data unavailable',
        peRatio: 'Data unavailable',
        revenue: 'Data unavailable',
        netIncome: 'Data unavailable',
        profitMargin: 'Data unavailable',
        debtToEquity: 'Data unavailable',
        dividendYield: 'Data unavailable',
        fiftyTwoWeekHigh: 'Data unavailable',
        fiftyTwoWeekLow: 'Data unavailable',
        sourceDescription: `Failed to fetch data. Error: ${error.message || error}`
      },
      steps: [failedStep],
    };
  }
}

// Node 3: Analyze Company & Make Decision (Single Unified LLM Call for Interpretation)
async function analyzeCompanyNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  const timestamp = new Date().toLocaleTimeString();

  if (state.financials.notPubliclyListed) {
    return {
      analysis: null,
      decision: null,
      riskRating: null,
      targetPrice: 'N/A',
      reasoning: `Company "${state.companyName}" is privately held or not independently publicly traded. As a result, public audited financial statements, historical price tickers, and public market multiples are unavailable, and we cannot perform a standard public equity SWOT or investment verdict.`,
      steps: [{
        node: 'analyzeCompany',
        status: 'completed',
        message: `Skipping qualitative analysis: company is privately held.`,
        timestamp
      }]
    };
  }

  try {
    const model = getLLM();

    const newsContext = state.news.map((a, i) => `[${i+1}] ${a.title}\nSnippet: ${a.snippet}`).join('\n\n');
    const financialsContext = JSON.stringify(state.financials, null, 2);

    const prompt = `You are the Chief Investment Officer of a premium hedge fund. Perform a complete qualitative analysis and investment synthesis for the company "${state.companyName}".
    
    Below is the REAL financial data fetched from our APIs:
    ---
    ${financialsContext}
    ---
    
    Below is the latest news context:
    ---
    ${newsContext}
    ---
    
    CRITICAL INSTRUCTIONS:
    1. DO NOT invent, fabricate, or modify any financial numbers. You must only read and interpret the numbers provided in the financials context block above.
    2. If a financial field is "Data unavailable" or "N/A", you must state that this metric is unavailable in your analysis.
    3. Construct a standard SWOT grid (3-4 bullet points per section).
    4. Provide a definitive investment verdict (INVEST or PASS), target stock price (12-month target), risk rating (Low, Medium, High), and a deep investment memo (4-5 paragraphs outlining your thesis, risk profile, and catalysts).
    
    Return ONLY a JSON block matching this TypeScript format:
    \`\`\`json
    {
      "analysis": {
        "strengths": ["list of strengths"],
        "weaknesses": ["list of weaknesses"],
        "opportunities": ["list of opportunities"],
        "threats": ["list of threats"],
        "financialHealth": "A paragraph interpreting their margins, solvency, valuation multiples based strictly on real data",
        "summary": "Brief executive summary (2-3 sentences)"
      },
      "decision": "INVEST" or "PASS",
      "riskRating": "Low" or "Medium" or "High",
      "targetPrice": "e.g., $245 (12-month target) or N/A",
      "reasoning": "A comprehensive investment memo (4-5 paragraphs) summarizing the thesis, key catalysts, potential risks, and the reason for the final decision."
    }
    \`\`\`
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let response;
    try {
      response = await model.invoke(prompt, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (invokeErr: any) {
      clearTimeout(timeoutId);
      console.error('FULL LLM INVOCATION ERROR OBJECT:', invokeErr);
      throw new Error(`LLM invoke failed: ${invokeErr.message || invokeErr}`);
    }

    let unifiedResult;
    try {
      const rawText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      unifiedResult = parseJsonMarkdown(rawText);
    } catch (parseErr: any) {
      console.error('FULL LLM PARSE ERROR OBJECT:', parseErr);
      console.error('Raw LLM Response content was:', response?.content);
      throw new Error(`SWOT JSON parsing failed: ${parseErr.message || parseErr}`);
    }

    const completedStep: AgentStep = {
      node: 'analyzeCompany',
      status: 'completed',
      message: `SWOT analysis and investment recommendation resolved.`,
      timestamp,
      output: unifiedResult,
    };

    return {
      analysis: unifiedResult.analysis,
      decision: unifiedResult.decision,
      riskRating: unifiedResult.riskRating,
      targetPrice: unifiedResult.targetPrice,
      reasoning: unifiedResult.reasoning,
      steps: [completedStep],
    };
  } catch (error: any) {
    console.error('FULL ERROR OBJECT IN ANALYZE COMPANY NODE:', error);
    throw error;
  }
}

// Node 4: Make Decision (Instantly completes, since Node 3 populated the state)
async function makeDecisionNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  const timestamp = new Date().toLocaleTimeString();
  const completedStep: AgentStep = {
    node: 'makeDecision',
    status: 'completed',
    message: `Research dossier successfully closed.`,
    timestamp,
  };

  return {
    steps: [completedStep],
  };
}

// Compile the state graph workflow with parallel news & financials execution
const workflow = new StateGraph(GraphState)
  .addNode('gatherNews', gatherNewsNode)
  .addNode('gatherFinancials', gatherFinancialsNode)
  .addNode('analyzeCompany', analyzeCompanyNode)
  .addNode('makeDecision', makeDecisionNode)
  .addEdge('__start__', 'gatherNews')
  .addEdge('__start__', 'gatherFinancials')
  .addEdge('gatherNews', 'analyzeCompany')
  .addEdge('gatherFinancials', 'analyzeCompany')
  .addEdge('analyzeCompany', 'makeDecision')
  .addEdge('makeDecision', '__end__');

export const compileAgent = () => workflow.compile();
export { GraphState };
