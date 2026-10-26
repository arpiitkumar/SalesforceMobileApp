// utils/apiFetchHooks/handleLogoutFun.js
import { logout } from '../../redux/slices/authSlice';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { oauth } from 'react-native-force';
import { persistor } from '../../redux/store';
import { CLEAR_TABLES } from '../../../config'

export const handleLogoutFun = async (dispatch) => {
  try {
    await AsyncStorage.setItem("hasLoggedOut", "true");
    let loggedoutValue = await AsyncStorage.getItem("hasLoggedOut")
    await AsyncStorage.setItem("hasLoggedOut", "true");
    const hasLoggedOut = (await AsyncStorage.getItem("hasLoggedOut")) === 'true';
    if (!hasLoggedOut) {
      return
      console.log('has logged out is true ............ set')
    }
    try {
      console.log("Salesforce SDK logout done");
    } catch (e) {
      console.warn("⚠️ SDK logout failed (maybe already logged out):", e);
    }
    await persistor.purge(); // Redux-persist storage
    await AsyncStorage.removeItem("initialDataSynced");
    await AsyncStorage.setItem("hasLoggedOut", "true");
    const objects = CLEAR_TABLES;
    for (const obj of objects) {
      await UniversalUpdateInsert({ ObjectName: obj, Type: "delete_all" });
    }
    await AsyncStorage.setItem("hasLoggedOut", "true");
    dispatch(logout());
    oauth.logout();
    console.log("Local data cleared, user logged out");
  } catch (e) {
    console.error("Logout failed:", e);
    throw e;
  }
};