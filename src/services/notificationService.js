import { messaging } from '../config/firebase.js';
import { supabase } from '../config/supabase.js';
import { log } from '../utils/logger.js';

// Send push notification to a single user
export async function sendPushNotification(userId, { title, body, data = {} }) {
  try {
    // Get user's FCM token from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('id', userId)
      .single();

    if (!profile?.fcm_token) {
      log.warn('No FCM token for user', { userId });
      return null;
    }

    const message = {
      token: profile.fcm_token,
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#16a34a',
          sound: 'default'
        }
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200]
        },
        fcmOptions: {
          link: data.action_url || '/'
        }
      }
    };

    const response = await messaging.send(message);
    log.info('Push notification sent', { userId, title, messageId: response });
    return response;

  } catch (error) {
    // Token might be expired/invalid — clean it up
    if (error.code === 'messaging/registration-token-not-registered') {
      await supabase
        .from('profiles')
        .update({ fcm_token: null })
        .eq('id', userId);
      log.warn('Invalid FCM token removed', { userId });
    }
    log.error('Push notification failed', error);
    return null;
  }
}

// Send notification to multiple users
export async function sendBulkNotifications(userIds, notification) {
  const promises = userIds.map(userId => 
    sendPushNotification(userId, notification)
  );
  return Promise.allSettled(promises);
}

// Save notification to database + send push
export async function createNotification(userId, {
  type, title, message, action_url, sendPush = true
}) {
  // Save to database
  const { data: notification } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      action_url
    })
    .select()
    .single();

  // Send push notification
  if (sendPush) {
    await sendPushNotification(userId, { title, body: message, data: { action_url } });
  }

  return notification;
}
