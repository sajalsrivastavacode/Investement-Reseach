import YahooFinance from 'yahoo-finance2';
import { NseIndia } from 'stock-nse-india';
import { NewsArticle, FinancialData } from './types';

const yahooFinance = new YahooFinance();

// Simple helper to strip HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
}

/**
 * Fallback Web Search using DuckDuckGo HTML page parsing.
 * Used strictly for qualitative news and sentiment.
 */
async function fallbackSearch(query: string): Promise<NewsArticle[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    // Web search timeout is 10 seconds as requested by user
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`DDG search returned status ${response.status}`);
    }

    const html = await response.text();
    const articles: NewsArticle[] = [];
    
    const resultBlockRegex = /<div class="result results_links results_links_deep[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
    const titleRegex = /<a class="result__a" href="([^"]+)">([\s\S]*?)<\/a>/;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

    let match;
    let count = 0;
    while ((match = resultBlockRegex.exec(html)) !== null && count < 6) {
      const block = match[1];
      const titleMatch = titleRegex.exec(block);
      const snippetMatch = snippetRegex.exec(block);

      if (titleMatch && snippetMatch) {
        const link = titleMatch[1];
        const title = stripHtml(titleMatch[2]);
        const snippet = stripHtml(snippetMatch[1]);

        let actualUrl = link;
        if (link.includes('uddg=')) {
          const parts = link.split('uddg=');
          if (parts[1]) {
            actualUrl = decodeURIComponent(parts[1].split('&')[0]);
          }
        }

        articles.push({
          title,
          snippet,
          url: actualUrl,
          source: new URL(actualUrl).hostname.replace('www.', ''),
          date: new Date().toLocaleDateString()
        });
        count++;
      }
    }

    return articles;
  } catch (error) {
    console.error('Error during DDG fallback search:', error);
    return [];
  }
}

/**
 * Tavily Web Search.
 */
async function tavilySearch(query: string, apiKey: string): Promise<NewsArticle[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'advanced',
        max_results: 6
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Tavily search returned status ${response.status}`);
    }

    const data = await response.json();
    return (data.results || []).map((res: any) => ({
      title: res.title || 'No Title',
      snippet: res.content || res.snippet || '',
      url: res.url || '',
      source: res.url ? new URL(res.url).hostname.replace('www.', '') : 'Web',
      date: new Date().toLocaleDateString()
    }));
  } catch (error) {
    console.error('Error during Tavily search:', error);
    return [];
  }
}

/**
 * GNews Web Search.
 */
async function gnewsSearch(query: string, apiKey: string): Promise<NewsArticle[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // GNews API search syntax works best with simple keywords
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=6&apikey=${apiKey}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`GNews search returned status ${response.status}`);
    }

    const data = await response.json();
    return (data.articles || []).map((res: any) => ({
      title: res.title || 'No Title',
      snippet: res.description || res.content || '',
      url: res.url || '',
      source: res.source?.name || 'GNews',
      date: res.publishedAt ? new Date(res.publishedAt).toLocaleDateString() : new Date().toLocaleDateString()
    }));
  } catch (error) {
    console.error('Error during GNews search:', error);
    return [];
  }
}

/**
 * Searches qualitative news for a company.
 */
export async function fetchCompanyNews(companyName: string): Promise<NewsArticle[]> {
  const query = `"${companyName}" latest business news investment events`;
  const tavilyKey = process.env.TAVILY_API_KEY;
  const gnewsKey = process.env.GNEWS_API_KEY;

  const fetchPromises: Promise<NewsArticle[]>[] = [];

  if (tavilyKey && tavilyKey.trim() !== '') {
    fetchPromises.push(tavilySearch(query, tavilyKey));
  }
  if (gnewsKey && gnewsKey.trim() !== '') {
    fetchPromises.push(gnewsSearch(companyName, gnewsKey));
  }

  // If no keys are provided, use fallback search
  if (fetchPromises.length === 0) {
    console.log('No Tavily or GNews keys found, using DuckDuckGo web search fallback.');
    return fallbackSearch(query);
  }

  try {
    console.log(`Executing parallel searches (Tavily: ${!!tavilyKey}, GNews: ${!!gnewsKey}) for "${companyName}"...`);
    const resultsArray = await Promise.all(fetchPromises);
    const combined = resultsArray.flat();
    
    // If we gathered no results from the APIs, try fallback
    if (combined.length === 0) {
      console.warn('API searches returned 0 articles. Falling back to DuckDuckGo search.');
      return fallbackSearch(query);
    }

    // De-duplicate by URL and normalized title
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const uniqueArticles: NewsArticle[] = [];

    for (const article of combined) {
      const urlKey = article.url.trim().toLowerCase();
      const titleKey = article.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (!seenUrls.has(urlKey) && !seenTitles.has(titleKey)) {
        seenUrls.add(urlKey);
        seenTitles.add(titleKey);
        uniqueArticles.push(article);
      }
    }

    console.log(`Successfully fetched and merged ${uniqueArticles.length} unique articles.`);
    return uniqueArticles.slice(0, 8); // return top 8 unique articles
  } catch (error) {
    console.error('Error combining news searches:', error);
    return fallbackSearch(query);
  }
}

/**
 * Ticker Resolution: Resolves a company name to a stock symbol.
 * Supports US and Indian tickers (.NS for NSE, .BO for BSE) using real search APIs.
 */
export async function resolveTicker(companyName: string): Promise<string> {
  const query = companyName.trim();
  const twelveKey = process.env.TWELVE_DATA_API_KEY;

  console.log(`Resolving ticker symbol for: "${query}"`);

  // 1. Try Twelve Data Symbol Search if API key is provided
  if (twelveKey && twelveKey.trim() !== '') {
    try {
      const response = await fetch(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${twelveKey}`);
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const match = data.data[0];
          console.log(`Twelve Data resolved: ${match.symbol} (${match.instrument_name})`);
          return match.symbol;
        }
      }
    } catch (err) {
      console.warn('Twelve Data ticker resolution failed, trying fallback...', err);
    }
  }

  // 2. Ticker Resolution via Yahoo Finance Search API (handles cookies/crumbs internally)
  try {
    const results = await yahooFinance.search(query);
    if (results && results.quotes && results.quotes.length > 0) {
      // Prioritize Indian stock exchanges (.NS or .BO suffix) if present in results
      const indianEquity = results.quotes.find((q: any) => 
        q.quoteType === 'EQUITY' && q.symbol &&
        (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO') || q.exchange === 'NSI' || q.exchange === 'BSE')
      );
      
      const equity = (indianEquity || results.quotes.find((q: any) => q.quoteType === 'EQUITY' && q.symbol) || results.quotes.find((q: any) => q.symbol)) as any;
      
      if (!equity || !equity.symbol || equity.isYahooFinance === false) {
        throw new Error(`NOT_PUBLICLY_LISTED: "${companyName}" is a private company or is not independently publicly traded.`);
      }

      console.log(`Yahoo Finance resolved ticker: ${equity.symbol} (${equity.shortname || equity.name})`);
      return equity.symbol as string;
    }
  } catch (err: any) {
    if (err.message && err.message.includes('NOT_PUBLICLY_LISTED')) {
      throw err;
    }
    console.error('Yahoo Finance ticker resolution failed:', err);
  }

  throw new Error(`Could not resolve ticker symbol for company: "${companyName}". Please try a more specific name or the direct stock ticker.`);
}

/**
 * Helper to formatting numbers/currencies nicely.
 */
function formatCurrency(val: any, currency: string = 'USD'): string {
  if (val === null || val === undefined || isNaN(Number(val))) return 'Data unavailable';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2
  });
  return formatter.format(Number(val));
}

/**
 * Fetch Structured Financials via Real APIs (Finnhub / Twelve Data / Yahoo Finance / stock-nse-india).
 * Returns real numbers or "Data unavailable". No LLM generation allowed for these numbers.
 */
export async function fetchFinancialQuote(ticker: string): Promise<FinancialData> {
  const symbol = ticker.trim().toUpperCase();
  const twelveKey = process.env.TWELVE_DATA_API_KEY;

  console.log(`Fetching structured financials for ticker: "${symbol}"`);

  // 1. Try Twelve Data Quote if API key is provided
  if (twelveKey && twelveKey.trim() !== '') {
    try {
      const response = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${twelveKey}`);
      if (response.ok) {
        const data = await response.json();
        if (data && !data.error) {
          console.log(`Successfully fetched financials from Twelve Data for ${symbol}`);
          return {
            stockPrice: data.close ? `$${data.close}` : 'Data unavailable',
            marketCap: data.market_cap ? `$${Number(data.market_cap).toLocaleString()}` : 'Data unavailable',
            peRatio: data.pe ? data.pe.toString() : 'Data unavailable',
            revenue: 'Data unavailable',
            netIncome: 'Data unavailable',
            profitMargin: 'Data unavailable',
            debtToEquity: 'Data unavailable',
            dividendYield: 'Data unavailable',
            fiftyTwoWeekHigh: data.fifty_two_week?.high ? `$${data.fifty_two_week.high}` : 'Data unavailable',
            fiftyTwoWeekLow: data.fifty_two_week?.low ? `$${data.fifty_two_week.low}` : 'Data unavailable',
            currency: data.currency || 'USD',
            sourceDescription: 'Fetched via Twelve Data API.'
          };
        }
      }
    } catch (err) {
      console.warn('Twelve Data quote fetch failed, trying fallback...', err);
    }
  }

  // 2. Try stock-nse-india if it is a pure NSE/BSE stock symbol (indicated by .NS or Indian ticker suffix)
  let nsePrice: string = 'Data unavailable';
  let nseHigh: string = 'Data unavailable';
  let nseLow: string = 'Data unavailable';
  let isNseFetched = false;

  if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
    try {
      const nseSymbol = symbol.split('.')[0];
      const nse = new NseIndia();
      console.log(`Querying stock-nse-india for symbol: "${nseSymbol}"`);
      const details = await nse.getEquityDetails(nseSymbol);
      if (details && details.priceInfo) {
        nsePrice = `₹${details.priceInfo.lastPrice}`;
        if (details.priceInfo.weekHighLow) {
          nseHigh = `₹${details.priceInfo.weekHighLow.max}`;
          nseLow = `₹${details.priceInfo.weekHighLow.min}`;
        }
        isNseFetched = true;
        console.log(`Successfully fetched live quotes from NSE India for ${nseSymbol}`);
      }
    } catch (err) {
      console.warn('stock-nse-india query failed, falling back to Yahoo Finance...', err);
    }
  }

  // 3. Fallback/Primary: Yahoo Finance via yahoo-finance2 npm package
  try {
    const [quote, summary, historical] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, {
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail']
      }).catch(err => {
        console.warn('SummaryDetail module fetch failed, returning partial summary.', err);
        return {} as any;
      }),
      // Query 52-week weekly history (approximately 52 data points)
      (async () => {
        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setFullYear(endDate.getFullYear() - 1);
          return await yahooFinance.historical(symbol, {
            period1: startDate.toISOString().split('T')[0],
            period2: endDate.toISOString().split('T')[0],
            interval: '1wk'
          });
        } catch (err) {
          console.warn('Historical prices fetch failed.', err);
          return [];
        }
      })()
    ]);

    const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BO');
    const tradingCurrency = isIndian ? 'INR' : (quote.currency || 'USD');
    const financialCurrency = quote.financialCurrency || summary.summaryDetail?.financialCurrency || tradingCurrency;

    console.log(`Successfully fetched financials from yahoo-finance2 for ${symbol}. Trading Currency: ${tradingCurrency}, Financial Currency: ${financialCurrency}`);

    const financialData = summary.financialData || {};
    const defaultKeyStats = summary.defaultKeyStatistics || {};
    const summaryDetail = summary.summaryDetail || {};

    const USD_TO_INR = 83.0;

    const convertValue = (val: number | undefined, fromCur: string, toCur: string, label: string) => {
      if (val === undefined || val === null || isNaN(Number(val))) {
        return undefined;
      }
      const rawNum = Number(val);
      let converted = rawNum;
      
      if (fromCur === 'USD' && toCur === 'INR') {
        converted = rawNum * USD_TO_INR;
      } else if (fromCur === 'INR' && toCur === 'USD') {
        converted = rawNum / USD_TO_INR;
      }
      
      console.log(`[Currency Align] ${label} conversion check for ${symbol}: before = ${rawNum} (${fromCur}), after = ${converted} (${toCur})`);
      return converted;
    };

    // Explicitly align all numeric fields individually
    const rawPrice = convertValue(quote.regularMarketPrice, quote.currency || 'USD', tradingCurrency, 'stockPrice');
    const rawMarketCap = convertValue(quote.marketCap, quote.currency || 'USD', tradingCurrency, 'marketCap');
    const rawRevenue = convertValue(financialData.totalRevenue, financialCurrency, tradingCurrency, 'revenue');
    const rawNetIncome = convertValue(defaultKeyStats.netIncomeToCommon, financialCurrency, tradingCurrency, 'netIncome');
    const rawHigh = convertValue(quote.fiftyTwoWeekHigh, quote.currency || 'USD', tradingCurrency, 'fiftyTwoWeekHigh');
    const rawLow = convertValue(quote.fiftyTwoWeekLow, quote.currency || 'USD', tradingCurrency, 'fiftyTwoWeekLow');

    // Format all values to consistent tradingCurrency
    const stockPrice = isNseFetched ? nsePrice : (rawPrice ? formatCurrency(rawPrice, tradingCurrency) : 'Data unavailable');
    const marketCap = rawMarketCap ? formatCurrency(rawMarketCap, tradingCurrency) : 'Data unavailable';
    const peRatio = quote.trailingPE ? quote.trailingPE.toFixed(2) : (summaryDetail.trailingPE ? summaryDetail.trailingPE.toFixed(2) : 'Data unavailable');
    const revenue = rawRevenue ? formatCurrency(rawRevenue, tradingCurrency) : 'Data unavailable';
    const netIncome = rawNetIncome ? formatCurrency(rawNetIncome, tradingCurrency) : 'Data unavailable';
    
    let profitMargin = 'Data unavailable';
    if (financialData.profitMargins !== undefined && financialData.profitMargins !== null) {
      profitMargin = `${(Number(financialData.profitMargins) * 100).toFixed(2)}%`;
    }

    const debtToEquity = financialData.debtToEquity !== undefined && financialData.debtToEquity !== null
      ? (Number(financialData.debtToEquity) / 100).toFixed(2)
      : 'Data unavailable';

    let dividendYield = 'Data unavailable';
    if (quote.dividendYield !== undefined && quote.dividendYield !== null) {
      dividendYield = `${Number(quote.dividendYield).toFixed(2)}%`;
    } else if (summaryDetail.dividendYield?.raw !== undefined) {
      dividendYield = `${(Number(summaryDetail.dividendYield.raw) * 100).toFixed(2)}%`;
    }

    const fiftyTwoWeekHigh = isNseFetched ? nseHigh : (rawHigh ? formatCurrency(rawHigh, tradingCurrency) : 'Data unavailable');
    const fiftyTwoWeekLow = isNseFetched ? nseLow : (rawLow ? formatCurrency(rawLow, tradingCurrency) : 'Data unavailable');

    const historicalPrices = Array.isArray(historical)
      ? historical
          .filter((h: any) => h.close !== undefined && h.close !== null)
          .map((h: any) => ({
            date: new Date(h.date).toLocaleDateString('en-US', { month: 'short' }),
            price: Number(Number(h.close).toFixed(2))
          }))
      : [];

    return {
      currency: tradingCurrency,
      stockPrice,
      marketCap,
      peRatio,
      revenue,
      netIncome,
      profitMargin,
      debtToEquity,
      dividendYield,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      historicalPrices,
      sourceDescription: `Sourced from Yahoo Finance (${tradingCurrency}) ${isNseFetched ? 'and NSE India.' : 'API.'}`
    };
  } catch (err: any) {
    console.error(`Quote summary retrieval failed for ${symbol}:`, err);

    if (isNseFetched) {
      return {
        currency: 'INR',
        stockPrice: nsePrice,
        marketCap: 'Data unavailable',
        peRatio: 'Data unavailable',
        revenue: 'Data unavailable',
        netIncome: 'Data unavailable',
        profitMargin: 'Data unavailable',
        debtToEquity: 'Data unavailable',
        dividendYield: 'Data unavailable',
        fiftyTwoWeekHigh: nseHigh,
        fiftyTwoWeekLow: nseLow,
        sourceDescription: 'NSE India Live Quote (balance sheet unavailable).'
      };
    }

    return {
      currency: symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD',
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
      sourceDescription: `Failed to fetch from real APIs. Error: ${err.message || err}`
    };
  }
}
