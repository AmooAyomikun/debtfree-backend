import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { paystackService } from '../services/paystackService.js';
import { generateReference } from '../utils/generateReference.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { log } from '../utils/logger.js';
import { PAYSTACK_WEBHOOK_SECRET } from '../config/constants.js';

// POST /api/payments/initialize
export async function initializePayment(req, res, next) {
  try {
    const { amount } = req.body;
    const user = req.user;

    if (!amount || amount < 100) {
      return errorResponse(res, 'Minimum funding amount is ₦100', 400);
    }
    if (amount > 1000000) {
      return errorResponse(res, 'Maximum single funding is ₦1,000,000', 400);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const reference = generateReference('FUND');

    const transaction = await paystackService.initializeTransaction({
      email: user.email,
      amount,
      reference,
      metadata: {
        user_id: user.id,
        full_name: profile?.full_name,
        transaction_type: 'wallet_funding'
      },
      callback_url: `${process.env.FRONTEND_URL}/wallet?ref=${reference}`
    });

    await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      type: 'credit',
      amount,
      description: 'Wallet funding',
      reference,
      status: 'pending',
      metadata: { paystack_access_code: transaction.access_code }
    });

    log.payment(reference, 'INITIALIZED', { amount, userId: user.id });

    return successResponse(res, {
      authorization_url: transaction.authorization_url,
      access_code: transaction.access_code,
      reference
    }, 'Payment initialized successfully');

  } catch (error) {
    next(error);
  }
}

// POST /api/payments/verify
export async function verifyPayment(req, res, next) {
  try {
    const { reference } = req.body;
    const user = req.user;

    if (!reference) return errorResponse(res, 'Reference is required', 400);

    const { data: existingTx } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('reference', reference)
      .eq('user_id', user.id)
      .single();

    if (!existingTx) return errorResponse(res, 'Transaction not found', 404);

    if (existingTx.status === 'success') {
      return successResponse(res, { already_credited: true }, 'Payment already processed');
    }

    const paystackTx = await paystackService.verifyTransaction(reference);

    if (paystackTx.status !== 'success') {
      await supabase
        .from('wallet_transactions')
        .update({ status: 'failed' })
        .eq('reference', reference);
      return errorResponse(res, 'Payment was not successful', 400);
    }

    const amountPaid = paystackTx.amount / 100;

    const { error: walletError } = await supabase.rpc('credit_wallet', {
      p_user_id: user.id,
      p_amount: amountPaid,
      p_reference: reference
    });

    if (walletError) throw walletError;

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'payment',
      title: 'Wallet Funded ✓',
      message: `₦${amountPaid.toLocaleString()} has been added to your wallet`,
      action_url: '/wallet'
    });

    log.payment(reference, 'VERIFIED_SUCCESS', { amount: amountPaid });

    return successResponse(res, {
      amount_credited: amountPaid,
      reference
    }, `₦${amountPaid.toLocaleString()} added to your wallet!`);

  } catch (error) {
    next(error);
  }
}

// POST /api/payments/webhook
export async function handleWebhook(req, res, next) {
  try {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    if (!PAYSTACK_WEBHOOK_SECRET) {
      log.warn('PAYSTACK_WEBHOOK_SECRET not set — skipping signature validation in dev');
    } else if (hash !== req.headers['x-paystack-signature']) {
      log.warn('Webhook signature mismatch - possible spoofed request');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = JSON.parse(req.body);
    log.payment(event.data?.reference, 'WEBHOOK_RECEIVED', { event: event.event });

    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;
      case 'transfer.success':
        await handleTransferSuccess(event.data);
        break;
      case 'transfer.failed':
        await handleTransferFailed(event.data);
        break;
      default:
        log.info('Unhandled webhook event', { event: event.event });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    log.error('Webhook processing error', error);
    return res.status(200).json({ received: true });
  }
}

async function handleChargeSuccess(data) {
  const { reference, amount, metadata } = data;
  const userId = metadata?.user_id;
  if (!userId) return;

  const { data: tx } = await supabase
    .from('wallet_transactions')
    .select('status')
    .eq('reference', reference)
    .single();

  if (tx?.status === 'success') return;

  await supabase.rpc('credit_wallet', {
    p_user_id: userId,
    p_amount: amount / 100,
    p_reference: reference
  });

  log.payment(reference, 'CHARGE_SUCCESS_PROCESSED', { userId, amount: amount / 100 });
}

async function handleTransferSuccess(data) {
  await supabase
    .from('wallet_transactions')
    .update({ status: 'success' })
    .eq('reference', data.reference);
  log.payment(data.reference, 'TRANSFER_SUCCESS');
}

async function handleTransferFailed(data) {
  const { data: tx } = await supabase
    .from('wallet_transactions')
    .select('user_id, amount')
    .eq('reference', data.reference)
    .single();

  if (tx) {
    await supabase.rpc('credit_wallet', {
      p_user_id: tx.user_id,
      p_amount: tx.amount,
      p_reference: `REFUND_${data.reference}`
    });
    log.payment(data.reference, 'TRANSFER_FAILED_REFUNDED', { amount: tx.amount });
  }
}

// POST /api/payments/settle
export async function settleDebt(req, res, next) {
  try {
    const { to_user_id, amount, group_id, split_ids } = req.body;
    const from_user = req.user;

    if (!to_user_id || !amount) {
      return errorResponse(res, 'Missing required fields: to_user_id and amount are required', 400);
    }
    if (amount <= 0) {
      return errorResponse(res, 'Amount must be greater than zero', 400);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_balance, full_name')
      .eq('id', from_user.id)
      .single();

    if (!profile || profile.wallet_balance < amount) {
      return errorResponse(res, 'Insufficient wallet balance', 400);
    }

    const reference = generateReference('SETTLE');

    const isUUID = (str) => {
      if (!str) return false;
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
    };

    const isGroupUUID = isUUID(group_id);
    const isToUserUUID = isUUID(to_user_id);

    if (isGroupUUID && isToUserUUID) {
      // Both are database UUIDs: use the atomic postgres RPC function
      const { error } = await supabase.rpc('settle_debt', {
        p_from_user: from_user.id,
        p_to_user: to_user_id,
        p_amount: amount,
        p_group_id: group_id,
        p_split_ids: split_ids || [],
        p_reference: reference
      });

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: to_user_id,
        type: 'payment',
        title: 'Debt Settled ✓',
        message: `${profile.full_name} sent you ₦${amount.toLocaleString()}`,
        action_url: `/groups/${group_id}`
      });
    } else {
      // Fallback for local/non-UUID groups:
      // Use the atomic debit_wallet RPC to safely deduct from sender.
      const { error: deductError } = await supabase.rpc('debit_wallet', {
        p_user_id: from_user.id,
        p_amount: amount,
        p_reference: reference
      });
      if (deductError) {
        log.warn('debit_wallet RPC failed, falling back to optimistic locking update:', deductError);
        // If RPC fails, fall back to safe optimistic locking update
        const { data: latestProfile, error: getProfileErr } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', from_user.id)
          .single();

        if (getProfileErr || !latestProfile) {
          throw getProfileErr || new Error('Failed to retrieve user profile balance');
        }

        if (latestProfile.wallet_balance < amount) {
          throw new Error('Insufficient wallet balance');
        }

        const { error: fallbackDeductErr } = await supabase
          .from('profiles')
          .update({ wallet_balance: latestProfile.wallet_balance - amount })
          .eq('id', from_user.id)
          .eq('wallet_balance', latestProfile.wallet_balance); // optimistic locking guard

        if (fallbackDeductErr) throw fallbackDeductErr;
      }

      // Insert debit wallet transaction
      await supabase.from('wallet_transactions').insert({
        user_id: from_user.id,
        type: 'debit',
        amount,
        description: 'Debt settlement sent',
        reference,
        status: 'success',
        payment_method: 'wallet'
      });

      // If recipient is a real user (valid UUID), credit them atomically too
      if (isToUserUUID) {
        await supabase.rpc('credit_wallet', {
          p_user_id: to_user_id,
          p_amount: amount,
          p_reference: reference + '_recv'
        });

        // Notify recipient
        await supabase.from('notifications').insert({
          user_id: to_user_id,
          type: 'payment',
          title: 'Debt Settled ✓',
          message: `${profile.full_name} sent you ₦${amount.toLocaleString()}`,
          action_url: '/wallet'
        });
      }
    }


    log.payment(reference, 'DEBT_SETTLED', {
      from: from_user.id,
      to: to_user_id,
      amount,
      isLocal: !(isGroupUUID && isToUserUUID)
    });

    return successResponse(res, { reference }, 'Debt settled successfully');

  } catch (error) {
    next(error);
  }
}

// GET /api/payments/banks
export async function getBanks(req, res, next) {
  try {
    const banks = await paystackService.listBanks();
    return successResponse(res, banks, 'Banks retrieved successfully');
  } catch (error) {
    next(error);
  }
}

// POST /api/payments/resolve-account
export async function resolveAccount(req, res, next) {
  try {
    const { account_number, bank_code } = req.body;
    if (!account_number || !bank_code) {
      return errorResponse(res, 'Account number and bank code are required', 400);
    }
    const account = await paystackService.resolveAccount(account_number, bank_code);
    return successResponse(res, account, 'Account resolved successfully');
  } catch (error) {
    return errorResponse(res, 'Could not resolve account. Please check details.', 400);
  }
}
