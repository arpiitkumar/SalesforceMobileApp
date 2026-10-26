import { store } from "../redux/store";
import { showSessionExpired, hideSessionExpired } from "../redux/slices/toastSlice";

let isSessionExpiredTriggered = false;

export const triggerSessionExpired = () => {
  if (isSessionExpiredTriggered) return;
  isSessionExpiredTriggered = true;
  store.dispatch(showSessionExpired());
};

export const resetSessionExpiredFlag = () => {
  isSessionExpiredTriggered = false;
};
