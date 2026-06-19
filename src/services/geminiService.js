import { GoogleGenAI } from '@google/genai';
import { log } from '../utils/logger.js';

let ai;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (error) {
  log.warn('Failed to initialize Gemini AI client:', error.message);
}

export const geminiService = {
  async generateFinancialInsight(summary) {
    if (!ai) {
      log.warn('Gemini API key missing, returning default insight');
      return "Tip: Keeping a close eye on your active groups can help you stay ahead of your financial goals.";
    }

    try {
      const prompt = `You are a helpful and concise financial advisor for DebtFree, a Nigerian group savings (Ajo) and bill splitting app. 
      Analyze this user's weekly summary:
      - Total Owed to them: ₦${summary.totalOwed}
      - Total They Owe: ₦${summary.totalOwing}
      - Active Groups: ${summary.groupCount}
      
      Provide a brief, encouraging 1-2 sentence actionable tip addressing their specific situation (e.g., if they owe a lot, suggest prioritizing payments; if they are owed a lot, suggest sending gentle reminders). Do not use hashtags. Keep it conversational.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      log.error('Gemini AI generation failed', error);
      return "Tip: A quick review of your wallet balance can help you plan your upcoming contributions.";
    }
  }
};
