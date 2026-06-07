import { GoogleGenerativeAI } from '@google/generative-ai';
import { log } from '../utils/logger.js';

export async function scanReceiptWithGemini(base64Image, mimeType = 'image/jpeg') {
  console.log('Starting Gemini scan with official SDK...');
  console.log('Image size (chars):', base64Image.length);
  console.log('Mime type:', mimeType);
  console.log('API Key prefix:', process.env.GEMINI_API_KEY?.substring(0, 15));

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Try models in order
  const modelNames = [
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
  ];

  for (const modelName of modelNames) {
    try {
      console.log(`Trying model: ${modelName}`);

      const model = genAI.getGenerativeModel({ model: modelName });

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      };

      const prompt = `You are a receipt parser. Analyze this receipt image.
Return ONLY a valid JSON object with no markdown formatting, no backticks, no extra text.

Format:
{
  "title": "merchant name or expense description",
  "amount": total amount as number only no symbols,
  "category": "one of: Food, Transport, Rent, Shopping, Fun, Travel, Health, Other",
  "date": "YYYY-MM-DD or null",
  "items": ["item1", "item2"],
  "currency": "NGN"
}

If not a receipt or unreadable, return: {"error": "unreadable"}
Return ONLY the JSON, nothing else.`;

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const rawText = response.text().trim();

      console.log('Raw Gemini response:', rawText);

      // Clean any accidental markdown
      const cleaned = rawText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      console.log('Cleaned response:', cleaned);

      const parsed = JSON.parse(cleaned);

      if (parsed.error) {
        throw new Error('Receipt could not be read clearly');
      }

      if (!parsed.amount && !parsed.title) {
        throw new Error('Receipt could not be read clearly');
      }

      console.log('Successfully parsed:', parsed);
      log.info('Receipt scanned successfully via SDK', { 
        model: modelName, 
        title: parsed.title 
      });

      return parsed;

    } catch (error) {
      if (error.message === 'Receipt could not be read clearly') {
        throw error;
      }

      console.error(`Model ${modelName} failed:`, error.message);

      // If last model also failed, throw
      if (modelName === modelNames[modelNames.length - 1]) {
        console.error('All models failed. Last error:', error);
        throw error;
      }

      // Otherwise try next model
      console.log('Trying next model...');
    }
  }
}
