// auth/syncUtils.js

import { showToast } from '../redux/slices/toastSlice';
import { store } from '../redux/store';

/**
 * Safely show error toast notifications
 */
export const showErrorToast = (message, error = null) => {
  try {
    console.error(`🔴 ${message}`, error);
    store.dispatch(
      showToast({
        type: 'error',
        message: message,
      })
    );
  } catch (e) {
    console.warn('Failed to dispatch toast:', e);
  }
};

/**
 * Safely handle progress callbacks
 */
export const safeProgress = (msg, onProgress) => {
  try {
    if (typeof onProgress === 'function') onProgress(msg);
  } catch (e) {
    console.warn('Progress callback failed', e);
  }
};

/**
 * Wrapper for database operations with error handling
 */
export const safeDatabaseOperation = async (operation, operationName) => {
  try {
    const result = await operation();
    console.log(`${operationName} completed`);
    return { success: true, data: result };
  } catch (err) {
    const errorMsg = ` ${operationName} failed: ${err.message}`;
    showErrorToast(errorMsg, err);
    return { success: false, error: err };
  }
};
