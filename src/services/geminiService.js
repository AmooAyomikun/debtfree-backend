import axios from 'axios';
import { log } from '../utils/logger.js';

export async function scanReceiptWithGemini(base64Image, mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Analyze this receipt image and return ONLY a valid JSON object with no markdown, no backticks, no explanation:
  {
    "title": "merchant or expense name as string",
    "amount": total amount as number only no currency symbols,
    "category": "exactly one of: Food, Transport, Rent, Shopping, Fun, Travel, Health, Other",
    "date": "YYYY-MM-DD format or null if not visible",
    "items": ["item1", "item2"] array of max 5 line items if visible,
    "currency": "NGN or detected currency code"
  }
  If the image is not a receipt or is unreadable return exactly: {"error": "unreadable"}
  Return ONLY the JSON object. Nothing else.`;

  const response = await axios.post(url, {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Image
          }
        },
        {
          text: prompt
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500
    }
  });

  const content = response.data.candidates[0].content.parts[0].text.trim();
  log.info('Gemini raw response', { content });

  const cleaned = content.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  if (parsed.error) {
    throw new Error('Receipt could not be read clearly');
  }

  return parsed;
}
