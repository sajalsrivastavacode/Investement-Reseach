import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function testSearch() {
  const queries = ['Flipkart', 'Myntra', 'asdkjfh'];
  for (const q of queries) {
    console.log(`\n=== SEARCHING FOR "${q}" ===`);
    try {
      const results = await yahooFinance.search(q);
      console.log('Quotes returned:', results.quotes.length);
      console.log('First 3 quotes:', JSON.stringify(results.quotes.slice(0, 3), null, 2));
    } catch (err) {
      console.error('Search failed:', err);
    }
  }
}

testSearch();
