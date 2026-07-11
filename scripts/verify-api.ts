import * as dotenv from 'dotenv';
import { resolveTicker, fetchFinancialQuote } from '../src/lib/agent/tools';

// Load env variables
dotenv.config();

async function runVerification() {
  console.log('=== STARTING REAL FINANCIAL API VERIFICATION ===\n');

  // Test 3 companies: Tesla, TCS, and Infosys
  const companies = ['Tesla', 'TCS', 'Infosys'];

  for (const company of companies) {
    try {
      console.log(`\n>>> Resolving & Fetching Data for: "${company}"`);
      
      const ticker = await resolveTicker(company);
      console.log(`Ticker Resolved To: "${ticker}"`);
      
      const financials = await fetchFinancialQuote(ticker);
      console.log(`Real API Response JSON:`);
      console.log(JSON.stringify(financials, null, 2));
      console.log('--------------------------------------------------');
    } catch (err: any) {
      console.error(`Verification failed for "${company}":`, err.message || err);
    }
  }

  console.log('\n=== VERIFICATION FINISHED ===');
}

runVerification();
