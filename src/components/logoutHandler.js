import AsyncStorage from "@react-native-async-storage/async-storage";
import { ToastAndroid } from "react-native";
import { persistor } from "../redux/store";
import { logout } from "../redux/slices/authSlice";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { CLEAR_TABLES } from "../../config";
// import { oauth } from 'react-native-force'; // if needed

export const handleLogoutService = async ({
  setIsLoggingOut,
  dispatch,
  handleLogout
}) => {
  setIsLoggingOut?.(true);
  await AsyncStorage.setItem("hasLoggedOut", "true");

  let loggedoutValue = await AsyncStorage.getItem("hasLoggedOut");
  console.log('has loggedout value................... in service ', loggedoutValue);

  try {
    await AsyncStorage.setItem("hasLoggedOut", "true");

    const hasLoggedOut =
      (await AsyncStorage.getItem("hasLoggedOut")) === 'true';

    if (!hasLoggedOut) {
      console.log('has logged out is true ............ set');
      return;
    }

    // 1️⃣ Logout from SDK first
    try {
      // await oauth.logout(); // uncomment if needed
      console.log("Salesforce SDK logout done");
    } catch (e) {
      console.warn("⚠️ SDK logout failed (maybe already logged out):", e);
    }

    await persistor.purge();

    await AsyncStorage.removeItem("initialDataSynced");
    await AsyncStorage.setItem("hasLoggedOut", "true");

    const objects = CLEAR_TABLES;

    for (const obj of objects) {
      // await UniversalUpdateInsert({
      //   ObjectName: obj,
      //   Type: "delete_all"
      // });
      await UniversalUpdateInsert({ ObjectName: obj, Type: 'delete_synced_only' })
    }

    dispatch(logout());

    await handleLogout();

  } catch (err) {
    console.error("Error during logout:", err);
    ToastAndroid.show("Logout failed. Try again.", ToastAndroid.SHORT);
    alert(JSON.stringify(err));
  } finally {
    setIsLoggingOut?.(false);
  }
};