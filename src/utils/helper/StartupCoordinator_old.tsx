import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { oauth } from 'react-native-force';
import DeviceConfirmModal from '../../components/modal/DeviceConfirmModal';
import { useApiFetch } from '../apiFetchHooks/useApiFetch';
import { setDataReady } from '../../redux/slices/appNavigationSlice.js'
import { loginHandler } from '../../UtilityMain/loginHandler'; // path as per your structure
import { deviceValidator } from '../../UtilityMain/deviceValidator'
import { dataSyncer } from '../../UtilityMain/dataSyncer'
import AsyncStorage from '@react-native-async-storage/async-storage';
import Spinner from 'react-native-spinkit';
import { showToast } from '../../redux/slices/toastSlice';
import { RootState } from "../../redux/store";
import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { updateFcmToken } from '../../UtilityMain/updateFcmToken';

const StartupCoordinator = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { fetchRecords, apiFetch } = useApiFetch()
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState('');
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceConfirmHandler, setDeviceConfirmHandler] = useState({ yes: null, no: null });
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const [isSyncing, setIsSyncing] = useState(false);
  /**
  * Show error toast and log error
  */
  const showErrorAndLog = (title, error = null) => {
    console.error(` ${title}:`, error);
    dispatch(showToast({
      type: 'error',
      message: title,
    }));
  };



  useEffect(() => {

    const startAppFlow = async () => {
      try {

        const handleCreds = async (creds) => {
          // console.log('THIS IS NEW ....ll...', creds);

          if (!creds.accessToken) {
            console.log('No access token, aborting startup flow');
            return;
          }

          try {

            setSyncLoading(true);
            setIsSyncing(false);

            setSyncMessage('Initializing...');

            // console.log('🔵 handleCreds started');
            // console.log('CREDS AFTER LOGIN:', creds);

            // ========== STEP 1: LOGIN HANDLER ==========
            setSyncMessage('Authenticating user...');
            console.log('🔵 Before Login handler');

            const hasLoggedOut = (await AsyncStorage.getItem("hasLoggedOut")) === 'true';
            console.log('has logged out in ASYNC ...................', hasLoggedOut)
            if (hasLoggedOut) {
              console.log('⚠️ User has logged out previously...................');
              setSyncLoading(false);
              return true;
            }


            try {
              const loginResult = await loginHandler(fetchRecords, creds);

              if (loginResult.status !== 'success') {
                const msg = 'Login handler failed: ' + (loginResult.message || 'Unknown error');
                //showErrorAndLog(msg);
                //setSyncLoading(false);
                return;
              }
              console.log('Login handler succeeded');
            } catch (loginErr) {
              const msg = `Login handler threw error: ${loginErr.message}`;
              showErrorAndLog(msg, loginErr);
              setSyncLoading(false);
              return;
            }




            // ========== STEP 3: CHECK LOGOUT STATUS ==========
            // const hasLoggedOut = (await AsyncStorage.getItem("hasLoggedOut")) === 'true';
            // console.log('has logged out in ASYNC ...................', hasLoggedOut)
            if (hasLoggedOut) {
              console.log('⚠️ User has logged out previously...................');
              setSyncLoading(false);
              return true;
            }



            // ========== STEP 2: DEVICE VALIDATION ==========
            setSyncMessage('Validating device...');
            console.log('🔵 Before Device validator');
            // console.log('has logged out in ASYNC ...................', hasLoggedOut)

            try {
              const isValidDevice = await deviceValidator(creds, {
                setModalVisible: setShowDeviceModal,
                setModalHandler: setDeviceConfirmHandler,
              });

              if (!isValidDevice) {
                const msg = 'Device validation failed or was cancelled';
                showErrorAndLog(msg);
                setSyncLoading(false);
                console.log(msg)
                return;
              }
              console.log('Device validated');
            } catch (deviceErr) {
              const msg = `Device validator threw error: ${deviceErr.message}`;
              showErrorAndLog(msg, deviceErr);
              setSyncLoading(false);
              return;
            }

            console.log('before fcm token .......')
            //fcm token update
            try {
              const requestPermissions = async () => {
                if (Platform.OS === 'android') {
                  await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                  );
                }

                await messaging().requestPermission();
                const token = await messaging().getToken();

                console.log('🔥 FCM Token in startup coordinator:', token);
                if (!token) return;

                await updateFcmToken(creds, token);
              };

              await requestPermissions(); // IMPORTANT
            } catch (fcmErr) {
              console.log('FCM update failed (non-blocking):', fcmErr);
            }

            // return

            // ========== STEP 4: CHECK IF ALREADY SYNCED ==========
            setSyncMessage('Checking sync status...');
            // console.log('🔵 Checking if already synced');

            try {
              const synced = await AsyncStorage.getItem('initialDataSynced');
              if (synced === 'true') {
                // console.log('Data already synced, navigating to main app');
                setSyncMessage('Loading...');
                dispatch(setDataReady(true));
                setSyncLoading(false);
                // Small delay to ensure state is updated before navigation
                setTimeout(() => {
                  navigation.navigate('TabbedScreen');
                }, 500);
                return;
              }
              console.log('🔵 First sync needed');
            } catch (syncCheckErr) {
              const msg = `Failed to check sync status: ${syncCheckErr.message}`;
              showErrorAndLog(msg, syncCheckErr);
              setSyncLoading(false);
              return;
            }


            // ========== STEP 5: PERFORM DATA SYNC ==========
            setSyncMessage('Syncing data...');
            console.log('🔵 Starting dataSyncer');

            try {
              const syncResult = await dataSyncer(
                creds,
                fetchRecords,
                apiFetch,
                (msg) => {
                  // Progress callback - update UI with current operation
                  if (msg && typeof msg === 'string') {
                    setSyncMessage(msg);
                    console.log('📍 Progress:', msg);
                  }
                }
              );

              // CHECK SYNC RESULT
              if (syncResult.status !== 'success') {
                const msg = `Data sync failed: ${syncResult.message || 'Unknown error'}`;
                showErrorAndLog(msg);
                setSyncLoading(false);
                return;
              }

              console.log('Data sync completed successfully');
            } catch (syncErr) {
              const msg = `dataSyncer threw error: ${syncErr.message}`;
              showErrorAndLog(msg, syncErr);
              setSyncLoading(false);
              return;
            }


            // ========== STEP 6: FINALIZE AND NAVIGATE ==========
            setSyncMessage('Finalizing...');
            console.log('🔵 Finalizing startup');

            try {
              // Mark initial sync as done
              await AsyncStorage.setItem('initialDataSynced', 'true');

              // Clear logout flag
              await AsyncStorage.removeItem("hasLoggedOut");

              console.log('Startup data persisted');

              // Dispatch state and navigate
              dispatch(setDataReady(true));
              setSyncLoading(false);
              setSyncMessage('');

              // Navigate after a brief delay
              setTimeout(() => {
                navigation.navigate('TabbedScreen');
              }, 500);

              console.log('Navigated to TabbedScreen');

            } catch (finalizeErr) {
              const msg = `Failed to finalize startup: ${finalizeErr.message}`;
              showErrorAndLog(msg, finalizeErr);
              setSyncLoading(false);
              return;
            }

          } catch (outerErr) {
            const msg = `Unexpected error in handleCreds: ${outerErr.message}`;
            showErrorAndLog(msg, outerErr);
            setSyncLoading(false);
            return;
          }


        };


        // ========== OAUTH FLOW ==========
        console.log('🔵 Starting OAuth flow');

        try {
          oauth.getAuthCredentials(
            (creds) => {
              console.log('Got existing credentials');
              handleCreds(creds);
            },
            () => {
              // No existing credentials, authenticate
              console.log('🔵 No existing credentials, authenticating');
              oauth.authenticate(
                (creds) => {
                  console.log('Authentication successful');
                  handleCreds(creds);
                },
                (err) => {
                  const msg = `OAuth Authentication Failed: ${err?.message || 'Unknown error'}`;
                  showErrorAndLog(msg, err);
                  setSyncLoading(false);
                }
              );
            }
          );
        } catch (oauthErr) {
          const msg = `OAuth error: ${oauthErr.message}`;
          showErrorAndLog(msg, oauthErr);
          setSyncLoading(false);
        }

      } catch (mainErr) {

        const msg = `Critical error in startAppFlow: ${mainErr.message}`;
        showErrorAndLog(msg, mainErr);
        setSyncLoading(false);
      }


    };

    startAppFlow();
  }, []);

  return (
    <View style={styles.container}>
      {/* <ActivityIndicator size="large" color="#000" />
       */}

      {/* {syncLoading ? (<><Spinner size={40} type="Wave" color="#C9A24D" />
        <Text>Syncing Data...</Text></>) :

        (<>
          <Spinner size={40} type="Wave" color="#C9A24D" />
          <Text>Please wait...</Text>

        </>)


      } */}

      {syncLoading ? (
        <>
          <Spinner
            isVisible={syncLoading}
            size={60}
            type="Wave"
            color="#3B5BB5"
          />
          <Text style={styles.syncTitle}>Syncing Data...</Text>
          <Text style={styles.syncMessage}>{syncMessage}</Text>
        </>
      ) : (
        <>
          <Spinner size={40} type="Wave" color="#C9A24D" />
          <Text style={styles.syncTitle}>Please wait...</Text>
        </>
      )}







      <DeviceConfirmModal
        isVisible={showDeviceModal}
        message="This device does not match the registered one. Do you want to register it?"
        onYes={async () => {
          setShowDeviceModal(false);
          if (deviceConfirmHandler.yes) await deviceConfirmHandler.yes();
        }}
        onNo={async () => {
          setShowDeviceModal(false);
          if (deviceConfirmHandler.no) await deviceConfirmHandler.no();
        }}
      />
    </View>
  );
};

export default StartupCoordinator;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncTitle: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  syncMessage: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    maxWidth: '90%',
  },
});
