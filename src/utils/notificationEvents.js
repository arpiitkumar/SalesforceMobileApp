const listeners = new Set();
 
const notificationEvents = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener); // unsubscribe
  },
 
  emit(count) {
    listeners.forEach(listener => listener(count));
  },
};
 
export default notificationEvents;