const fs = require('fs');
const path = require('path');

async function formatTranscript() {
  const conversationId = '8d5e9fe6-ced4-4f16-a79a-42880fe69f14';
  const logDir = `C:\\Users\\HP\\.gemini\\antigravity\\brain\\${conversationId}\\.system_generated\\logs`;
  const transcriptPath = path.join(logDir, 'transcript.jsonl');
  const outputPath = path.join(__dirname, '..', 'transcript.md');

  console.log(`Reading transcript from: ${transcriptPath}`);
  
  if (!fs.existsSync(transcriptPath)) {
    console.error(`Error: Transcript log file does not exist at ${transcriptPath}`);
    return;
  }

  const rawData = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = rawData.split('\n').filter(line => line.trim() !== '');
  
  let mdContent = `# AI Chat Session Transcript\n\n`;
  mdContent += `This transcript compiles the development log of AURA (AI Investment Research Agent) built in cooperation with Google Gemini (via Antigravity).\n\n`;

  let stepCount = 1;

  for (const line of lines) {
    try {
      const step = JSON.parse(line);
      const type = step.type;
      const source = step.source;

      if (type === 'USER_INPUT') {
        const text = step.content || '';
        mdContent += `## Step ${stepCount}: User Prompt\n\n`;
        mdContent += `${text}\n\n`;
        mdContent += `---\n\n`;
        stepCount++;
      } else if (type === 'PLANNER_RESPONSE') {
        const text = step.content || '';
        // Extract thinking if any or just add responses
        mdContent += `## Step ${stepCount}: AI Agent Action & Response\n\n`;
        if (text) {
          mdContent += `${text}\n\n`;
        }
        
        // List tool calls in the response for transparency
        if (step.tool_calls && step.tool_calls.length > 0) {
          mdContent += `### Tool Calls Executed:\n`;
          step.tool_calls.forEach(tool => {
            mdContent += `- **Tool**: \`${tool.name || 'unknown'}\`\n`;
            if (tool.args) {
              const argStr = JSON.stringify(tool.args, null, 2);
              mdContent += `  \`\`\`json\n${argStr}\n  \`\`\`\n`;
            }
          });
          mdContent += `\n`;
        }
        
        mdContent += `---\n\n`;
        stepCount++;
      }
    } catch (err) {
      // Ignore JSON parse errors for trailing empty lines
    }
  }

  fs.writeFileSync(outputPath, mdContent, 'utf-8');
  console.log(`Formatted transcript successfully saved to: ${outputPath}`);
}

formatTranscript();
