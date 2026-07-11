import * as dotenv from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

dotenv.config();

async function testModels() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3.5-flash'];

  for (const modelName of models) {
    console.log(`\nTesting model: "${modelName}"...`);
    try {
      const model = new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: geminiKey,
        temperature: 0.1,
      });
      const response = await model.invoke('Respond with "online".');
      console.log(`SUCCESS for "${modelName}":`, response.content);
      return; // Stop on first successful model!
    } catch (err: any) {
      console.error(`FAILED for "${modelName}":`, err.message || err);
    }
  }
}

testModels();
