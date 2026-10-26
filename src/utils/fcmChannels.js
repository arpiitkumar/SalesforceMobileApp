import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

export const createNotificationChannels = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await messaging().android.createChannel({
      id: 'approval_high_priority',
      name: 'Approval Notifications',
      description: 'High priority approval requests',
      importance: messaging().AndroidImportance.HIGH,
      sound: 'default',
    });
  } catch (err) {
    console.log('Channel creation error:', err);
  }
};