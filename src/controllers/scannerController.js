import { scanReceiptWithGemini } from '../services/geminiService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { log } from '../utils/logger.js';

export async function scanReceipt(req, res, next) {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return errorResponse(res, 'Image data is required', 400);
    }

    // Rough size check: 5MB limit
    if (image.length > 7000000) {
      return errorResponse(res, 'Image too large. Please use an image under 5MB.', 400);
    }

    // Validate mimeType
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const type = mimeType || 'image/jpeg';
    if (!allowedTypes.includes(type)) {
      return errorResponse(res, 'Invalid image type. Use JPEG, PNG or WebP.', 400);
    }

    const result = await scanReceiptWithGemini(image, type);

    log.info('Receipt scanned successfully', {
      userId: req.user.id,
      merchant: result.title,
      amount: result.amount
    });

    return successResponse(res, result, 'Receipt scanned successfully');

  } catch (error) {
    if (error.message === 'Receipt could not be read clearly') {
      return errorResponse(res, 'Could not read receipt clearly. Please fill in manually.', 422);
    }
    next(error);
  }
}
