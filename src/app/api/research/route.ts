import { resolveTicker } from '../../../lib/agent/tools';
import { compileAgent } from '../../../lib/agent/graph';
import { AgentState } from '../../../lib/agent/types';

export const maxDuration = 60; // Allow execution up to 60 seconds

// Server-side cache store with TTL (1 hour)
interface CacheEntry {
  data: AgentState;
  expiry: number;
}
const serverCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  
  try {
    const body = await request.json();
    const { companyName } = body;

    if (!companyName || typeof companyName !== 'string' || companyName.trim() === '') {
      return new Response(JSON.stringify({ error: 'Company name is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!nvidiaKey && !geminiKey && !openaiKey) {
      return new Response(JSON.stringify({
        error: 'Missing LLM API keys. Please configure NVIDIA_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.',
        code: 'MISSING_API_KEYS'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Resolve the ticker before checking the cache (or starting the graph)
    let resolvedTicker: string;
    let isPrivate = false;
    try {
      resolvedTicker = await resolveTicker(companyName);
    } catch (resolveErr: any) {
      if (resolveErr.message && resolveErr.message.includes('NOT_PUBLICLY_LISTED')) {
        resolvedTicker = companyName;
        isPrivate = true;
      } else {
        return new Response(JSON.stringify({ error: resolveErr.message || 'Ticker resolution failed.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Step 2: Check server-side cache
    const cached = serverCache.get(resolvedTicker.toUpperCase());
    if (cached && cached.expiry > Date.now()) {
      console.log(`Cache HIT for ticker: "${resolvedTicker}". Returning cached results instantly.`);
      
      // Stream cached state instantly via Server-Sent Events
      const cachedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`event: state\ndata: ${JSON.stringify(cached.data)}\n\n`));
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
        }
      });
      return new Response(cachedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        }
      });
    }

    console.log(`Cache MISS for ticker: "${resolvedTicker}". Running LangGraph agent...`);

    // Step 3: Stream LangGraph execution via Server-Sent Events
    const activeStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const agent = compileAgent();
          
          let runningState: AgentState = {
            companyName: resolvedTicker, // Start with resolved ticker name
            news: [],
            financials: {
              currency: resolvedTicker.toUpperCase().endsWith('.NS') || resolvedTicker.toUpperCase().endsWith('.BO') ? 'INR' : 'USD',
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
              sourceDescription: 'Fetching...'
            },
            analysis: null,
            decision: null,
            reasoning: '',
            riskRating: null,
            targetPrice: '',
            steps: [],
          };

          // Stream the LangGraph execution chunks
          const stream = await agent.stream({
            companyName: resolvedTicker,
            news: [],
            financials: {},
            analysis: null,
            decision: null,
            reasoning: '',
            riskRating: null,
            targetPrice: '',
            steps: [],
          });

          for await (const chunk of stream) {
            // Log real JSON returned from nodes for debugging/verification
            console.log('\n--- LangGraph Node Completed Chunk ---');
            console.log(JSON.stringify(chunk, null, 2));

            // Merge node updates into runningState
            for (const nodeName of Object.keys(chunk)) {
              const nodeUpdate = chunk[nodeName];
              
              runningState = {
                ...runningState,
                ...nodeUpdate,
                // Handle deep merge of financials if present
                financials: nodeUpdate.financials 
                  ? { ...runningState.financials, ...nodeUpdate.financials } 
                  : runningState.financials,
                // Keep the latest steps array
                steps: nodeUpdate.steps || runningState.steps
              };
            }

            // Stream current updated state to frontend
            sendEvent('state', runningState);
          }

          // Cache final completed state before closing
          serverCache.set(resolvedTicker.toUpperCase(), {
            data: runningState,
            expiry: Date.now() + CACHE_TTL
          });

          sendEvent('done', {});
          controller.close();
        } catch (streamErr: any) {
          console.error('Error during SSE stream execution:', streamErr);
          sendEvent('error', { message: streamErr.message || 'Stream error occurred.' });
          controller.close();
        }
      }
    });

    return new Response(activeStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });

  } catch (err: any) {
    console.error('API Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unexpected server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
