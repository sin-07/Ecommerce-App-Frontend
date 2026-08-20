import { Platform, Vibration } from 'react-native';

/**
 * AP Enterprises Mobile Haptic Feedback Utility
 * Provides subtle, non-blocking tactile feedback for meaningful user interactions.
 */

export const haptics = {
  /**
   * Subtle selection feedback (e.g., quantity stepper +/-)
   */
  selection: () => {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(8);
      } else if (Platform.OS === 'ios') {
        Vibration.vibrate(10);
      }
    } catch {
      // Graceful fallback on unsupported devices
    }
  },

  /**
   * Light impact (e.g., Wishlist toggle, category tap)
   */
  lightImpact: () => {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(14);
      } else if (Platform.OS === 'ios') {
        Vibration.vibrate(15);
      }
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Medium impact (e.g., Add to Cart, Buy Now tap)
   */
  mediumImpact: () => {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(24);
      } else if (Platform.OS === 'ios') {
        Vibration.vibrate(25);
      }
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Success notification (e.g., Order placed, payment confirmed)
   */
  successNotification: () => {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 20, 60, 30]);
      } else if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 20, 60, 30]);
      }
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Error notification (e.g., Form validation error, out-of-stock warning)
   */
  errorNotification: () => {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 35, 40, 35]);
      } else if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 35, 40, 35]);
      }
    } catch {
      // Graceful fallback
    }
  }
};
