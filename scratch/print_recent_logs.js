import fs from 'fs';
import readline from 'readline';

async function printLogs() {
  const fileStream = fs.createReadStream('C:/Users/user/.gemini/antigravity-ide/brain/3ac8d760-8952-4609-908b-77649a980bf9/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const steps = [];
  for await (const line of rl) {
    if (line.trim()) {
      const obj = JSON.parse(line);
      if (obj.step_index >= 4326 && obj.step_index <= 4380) {
        steps.push(obj);
      }
    }
  }

  for (const step of steps) {
    console.log(`\n=================== STEP ${step.step_index} (${step.source} - ${step.type}) ===================`);
    if (step.content) {
      console.log("CONTENT:", step.content.substring(0, 1000) + (step.content.length > 1000 ? "..." : ""));
    }
    if (step.tool_calls) {
      console.log("TOOL CALLS:");
      for (const tc of step.tool_calls) {
        console.log(`  - ${tc.name}: ${JSON.stringify(tc.args)}`);
      }
    }
  }
}

printLogs().catch(console.error);
