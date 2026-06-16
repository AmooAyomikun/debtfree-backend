import { paystackService } from './paystackService.js';
import { supabase } from '../config/supabase.js';
import { generateReference } from '../utils/generateReference.js';
import { emailService } from './emailService.js';
import { smsService } from './smsService.js';
import { log } from '../utils/logger.js';

export const autoDebitService = {

  // Initialize recurring subscription for a user
  async setupRecurringDebit(userId, { email, amount, frequency, circleId }) {
    try {
      // Create Paystack plan
      const frequencyMap = {
        weekly: 'weekly',
        biweekly: 'biweekly',
        monthly: 'monthly'
      };

      const plan = await paystackService.createPlan({
        name: `DebtFree Circle - ${circleId}`,
        amount,
        interval: frequencyMap[frequency] || 'monthly'
      });

      // Initialize subscription transaction
      const reference = generateReference('AUTODEBIT');
      const transaction = await paystackService.initializeTransaction({
        email,
        amount,
        reference,
        metadata: {
          user_id: userId,
          circle_id: circleId,
          transaction_type: 'auto_debit_setup'
        },
        plan: plan.plan_code,
        callback_url: `${process.env.APP_URL}/circles/${circleId}?setup=complete`
      });

      // Save subscription info
      await supabase.from('auto_debit_subscriptions').insert({
        user_id: userId,
        circle_id: circleId,
        plan_code: plan.plan_code,
        reference,
        frequency,
        amount,
        status: 'pending'
      });

      log.info('Auto-debit setup initiated', { userId, circleId });
      return transaction;

    } catch (error) {
      log.error('Auto-debit setup failed', error);
      throw error;
    }
  },

  // Process auto-debit when Paystack subscription charge succeeds
  async processAutoDebitSuccess(data) {
    try {
      const { customer, amount, reference, metadata, plan } = data;
      const userId = metadata?.user_id;
      const circleId = metadata?.circle_id;

      if (!userId || !circleId) {
        log.warn('Auto-debit missing user/circle metadata', { reference });
        return;
      }

      // Record contribution
      const { data: circle } = await supabase
        .from('circles')
        .select('*, groups(name)')
        .eq('id', circleId)
        .single();

      if (!circle) return;

      await supabase.from('contributions').insert({
        circle_id: circleId,
        user_id: userId,
        amount: amount / 100,
        cycle_number: circle.current_cycle,
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_reference: reference
      });

      // Credit circle wallet or pool
      await supabase.rpc('credit_wallet', {
        p_user_id: userId,
        p_amount: -(amount / 100),
        p_reference: reference
      });

      // Notify user
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', userId)
        .single();

      if (profile) {
        // Email notification
        await emailService.sendPaymentConfirmation(
          { email: profile.email, full_name: profile.full_name },
          {
            amount: amount / 100,
            type: 'debit',
            reference
          }
        );

        // SMS notification
        if (profile.phone) {
          await smsService.sendSMS(profile.phone,
            `Hi ${profile.full_name?.split(' ')[0]}! ` +
            `Your auto-debit of ₦${(amount/100).toLocaleString()} ` +
            `for "${circle.groups?.name}" was successful. ` +
            `DebtFree`
          );
        }

        // In-app notification
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'payment',
          title: 'Auto-debit Successful ✓',
          message: `₦${(amount/100).toLocaleString()} contribution to "${circle.groups?.name}" processed automatically`,
          action_url: `/groups/${circle.group_id}`
        });
      }

      log.payment(reference, 'AUTO_DEBIT_SUCCESS', {
        userId,
        circleId,
        amount: amount / 100
      });

    } catch (error) {
      log.error('Auto-debit processing failed', error);
    }
  },

  // Cancel auto-debit subscription
  async cancelSubscription(userId, circleId) {
    try {
      const { data: subscription } = await supabase
        .from('auto_debit_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('circle_id', circleId)
        .eq('status', 'active')
        .single();

      if (!subscription) throw new Error('No active subscription found');

      // Disable on Paystack
      await paystackService.disableSubscription(
        subscription.subscription_code,
        subscription.email_token
      );

      // Update local record
      await supabase
        .from('auto_debit_subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscription.id);

      log.info('Auto-debit cancelled', { userId, circleId });
      return true;

    } catch (error) {
      log.error('Cancel subscription failed', error);
      throw error;
    }
  },

  // Check and send reminders for upcoming auto-debits
  async sendUpcomingDebitReminders() {
    try {
      // Get active subscriptions due in 3 days
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const { data: subscriptions } = await supabase
        .from('auto_debit_subscriptions')
        .select('*, profiles(full_name, email, phone), circles(contribution_amount, groups(name))')
        .eq('status', 'active')
        .lte('next_charge_date', threeDaysFromNow.toISOString());

      if (!subscriptions?.length) return;

      for (const sub of subscriptions) {
        const profile = sub.profiles;
        const circle = sub.circles;

        if (profile?.phone) {
          await smsService.sendSMS(profile.phone,
            `Hi ${profile.full_name?.split(' ')[0]}! ` +
            `Reminder: Your auto-debit of ₦${circle?.contribution_amount?.toLocaleString()} ` +
            `for "${circle?.groups?.name}" will be charged in 3 days. ` +
            `DebtFree`
          );
        }
      }

      log.info('Upcoming debit reminders sent', {
        count: subscriptions.length
      });

    } catch (error) {
      log.error('Reminder sending failed', error);
    }
  }
};

// MANUAL TASK: Run in Supabase SQL Editor:
// create table if not exists auto_debit_subscriptions (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references profiles(id),
//   circle_id uuid references circles(id),
//   plan_code text,
//   subscription_code text,
//   email_token text,
//   reference text,
//   frequency text,
//   amount numeric,
//   status text default 'pending',
//   next_charge_date timestamptz,
//   created_at timestamptz default now()
// );
