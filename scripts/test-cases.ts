import * as dotenv from 'dotenv';
import { compileAgent } from '../src/lib/agent/graph';

// Load env variables
dotenv.config();

const app = compileAgent();

async function runTestCase(label: string, companyName: string) {
  console.log(`\n==================================================`);
  console.log(`TEST CASE [${label}]: "${companyName}"`);
  console.log(`==================================================`);
  
  try {
    const result = await app.invoke({
      companyName,
      steps: [],
      news: [],
    });
    
    console.log('Result State fields:');
    console.log(`- resolved companyName: "${result.companyName}"`);
    console.log(`- news count: ${result.news?.length || 0}`);
    console.log(`- financials notPubliclyListed: ${!!result.financials?.notPubliclyListed}`);
    console.log(`- financials currency: "${result.financials?.currency}"`);
    console.log(`- financials stockPrice: "${result.financials?.stockPrice}"`);
    console.log(`- financials sourceDescription: "${result.financials?.sourceDescription}"`);
    console.log(`- decision: "${result.decision}"`);
    console.log(`- riskRating: "${result.riskRating}"`);
    console.log(`- targetPrice: "${result.targetPrice}"`);
    console.log(`- reasoning memo (first 100 chars): "${result.reasoning?.substring(0, 100)}..."`);
    
    console.log('\nSteps Log:');
    result.steps?.forEach((step: any, idx: number) => {
      console.log(`  [Step ${idx + 1}] Node: ${step.node}, Status: ${step.status}, Message: ${step.message}`);
    });
  } catch (err: any) {
    console.error(`Graph execution FAILED for "${companyName}" with error:`);
    console.error(err.message || err);
  }
}

async function runAll() {
  // a) Infosys
  await runTestCase('a) Normal Public Company', 'Infosys');
  
  // b) Flipkart
  await runTestCase('b) Private - No Ticker', 'Flipkart');
  
  // c) Myntra
  await runTestCase('c) Private - No Ticker', 'Myntra');
  
  // d) Random Misspelled Input
  await runTestCase('d) Misspelled Input', 'asdkjfh');
}

runAll();
