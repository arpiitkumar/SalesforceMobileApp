import NetInfo from '@react-native-community/netinfo';
 
/**
* Checks if the device is connected to the internet.
* @returns {Promise<boolean>} true if online, false otherwise
*/
export const isInternetAvailable = async () => {
  try {
    const state = await NetInfo.fetch();
    //console.log('Network state:', state);
 
    // Handle when isInternetReachable is null
    if (state.isInternetReachable === null) {
      return state.isConnected;
    }
 
    return state.isConnected && state.isInternetReachable;
  } catch (error) {
    console.warn('Failed to check internet connection:', error);
    return false;
  }
};
 