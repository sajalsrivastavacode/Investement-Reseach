import * as dotenv from 'dotenv';
import { compileAgent } from '../src/lib/agent/graph';

// Load environment variables
dotenv.config();

async function runTest() {
  const company = process.argv[2] || 'Tesla';
  console.log(`\n=== Running AURA Investment Research Agent Test for: "${company}" ===\n`);

  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!nvidiaKey && !geminiKey && !openaiKey) {
    console.error('Error: No LLM API keys found. Please define NVIDIA_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in your .env file.');
    process.exit(1);
  }

  try {
    const agent = compileAgent();
    console.log('Compiling LangGraph workflow successful.');
    console.log('Invoking research nodes (search, financial, SWOT, decision)...');

    const result = await agent.invoke({
      companyName: company,
      news: [],
      financials: {},
      analysis: null,
      decision: null,
      reasoning: '',
      riskRating: null,
      targetPrice: '',
      steps: [],
    });

    console.log('\n====================================');
    console.log('            AGENTS RESULTS           ');
    console.log('====================================');
    console.log(`Company:      ${result.companyName}`);
    console.log(`Decision:     ${result.decision}`);
    console.log(`Target Price: ${result.targetPrice}`);
    console.log(`Risk Rating:  ${result.riskRating}`);
    console.log('\n--- Execution Steps ---');
    console.log(JSON.stringify(result.steps, null, 2));
    console.log('\n--- Financials Extracted ---');
    console.log(JSON.stringify(result.financials, null, 2));
    console.log('\n--- SWOT Analysis ---');
    console.log(JSON.stringify(result.analysis, null, 2));
    console.log('\n--- Final Investment Thesis ---');
    console.log(result.reasoning);
    console.log('====================================\n');
    
  } catch (error) {
    console.error('Test run failed with error:', error);
  }
}

runTest();
