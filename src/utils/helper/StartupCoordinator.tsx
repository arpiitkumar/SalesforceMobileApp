import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { oauth } from 'react-native-force';
import DeviceConfirmModal from '../../components/modal/DeviceConfirmModal';
import { useApiFetch } from '../apiFetchHooks/useApiFetch';
import { setDataReady } from '../../redux/slices/appNavigationSlice.js'
import { setRoutePlans } from '../../redux/slices/routePlanSlice';
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
import { isInternetAvailable } from '../networkUtils';
import { setLoginStatus } from '../../redux/slices/deviceSlice';
import { loginSuccess } from '../../redux/slices/authSlice';
import { store } from '../../redux/store';
import { runSchemaMigrationIfNeeded, commitSchemaVersion } from '../../database/migration/SchemaMigrationManager';
import { getRemoteSchemaVersion } from '../../components/updateService';
import MigrationProgressModal from '../../components/modal/MigrationProgressModal';

const StartupCoordinator = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { fetchRecords, apiFetch, apiComposite, handleLogout } = useApiFetch()

  const fetchRoutePlanForCurrentMonth = async (credentials: any) => {
    try {
      const state = store.getState();
      const userId = state.auth.userId || credentials.userId;
      if (!userId) {
        console.log("No user ID found for fetching route plans.");
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const startOfMonth = `${year}-${month}-01`;

      const query = `SELECT Id, Name, Start_Date__c, End_Date__c, Assigned_To__c, Month__c FROM Route_Plans__c WHERE Assigned_To__c = '${userId}' AND Start_Date__c >= ${startOfMonth}`;
      console.log("Fetching Route Plan for user:", userId, "Query:", query);

      const records = await fetchRecords("Route_Plans__c", query, credentials.accessToken, credentials.instanceUrl);
      console.log("Fetched Route Plan Records:", records);

      if (records && !records.status) {
        dispatch(setRoutePlans(records));
        console.log("SUCCESSFULLY STORED ROUTE PLANS IN REDUX:", records);
      } else {
        console.log("NO ROUTE PLAN RECORDS OR ERROR FETCHING:", records);
      }
    } catch (error) {
      console.error("Error fetching route plans:", error);
    }
  };
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState('');
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceConfirmHandler, setDeviceConfirmHandler] = useState({ yes: null, no: null });
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const [isSyncing, setIsSyncing] = useState(false);
  // ----- Offline DB migration popup state -----
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationMessage, setMigrationMessage] = useState('');
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
    const timer = setTimeout(() => {
      console.log(" Starting OAuth (safe delay)");
      startAppFlow();
    }, 1500); // 🔥 1.5 sec delay

    return () => clearTimeout(timer);
  }, []);

  const startAppFlow = async () => {
    try {

      const handleCreds = async (creds) => {
        // console.log('THIS IS NEW ....ll...', creds);

        if (!creds.accessToken) {
          console.log('No access token, aborting startup flow');
          return;
        }

        let updatedCreds = creds;
        // Schema version to stamp locally AFTER a successful full sync (crash-safe commit point)
        let pendingSchemaVersion = null;
        // Closure-local migration tracking (avoids stale-closure issues in callbacks)
        let migrating = false;
        let migProgress = 0;
        const bumpMigration = (value, msg) => {
          migProgress = Math.max(0, Math.min(1, value));
          setMigrationProgress(migProgress);
          if (msg) setMigrationMessage(msg);
        };
        try {
          setSyncLoading(true);
          setIsSyncing(false);
          setSyncMessage('Initializing...');
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
            const connected = await isInternetAvailable();
            if (connected) {
              const loginResult = await loginHandler(fetchRecords, creds, handleLogout);

              if (loginResult.status !== 'success') {
                const msg = 'Login handler failed: ' + (loginResult.message || 'Unknown error');
                //showErrorAndLog(msg);
                //setSyncLoading(false);
                return;
              }
              updatedCreds = {
                ...creds,
                accessToken: loginResult.accessToken,
                instanceUrl: loginResult.instanceUrl,
                refreshToken: loginResult.refreshToken,
                userId: loginResult.userId,
              };
            }
            console.log('Login handler succeeded');
          } catch (loginErr) {
            const msg = `Login handler threw error: ${loginErr.message}`;
            showErrorAndLog(msg, loginErr);
            setSyncLoading(false);
            return;
          }

          if (hasLoggedOut) {
            console.log('⚠️ User has logged out previously...................');
            setSyncLoading(false);
            return true;
          }

          setSyncMessage('Validating device...');
          console.log('🔵 Before Device validator');
          try {
            const connected = await isInternetAvailable();
            if (connected) {
              const isValidDevice = await deviceValidator(updatedCreds, {
                setModalVisible: setShowDeviceModal,
                setModalHandler: setDeviceConfirmHandler,
              });

              if (!isValidDevice) {
                setSyncLoading(false);
                return;
              }
              console.log('Device validated');
            } else {
              store.dispatch(
                loginSuccess({
                  accessToken: creds?.accessToken,
                  instanceUrl: creds?.instanceUrl,
                  refreshToken: creds?.refreshToken,
                  userId: creds?.userId,
                  loginTime: Date.now(),
                })
              );
              store.dispatch(setLoginStatus({ loginStatus: true }));
              // console.log('----------------Device validated');
            }
          } catch (deviceErr) {
            const msg = `Device validator threw error: ${deviceErr.message}`;
            showErrorAndLog(msg, deviceErr);
            setSyncLoading(false);
            return;
          }

          //fcm token update
          // try {
          //   const requestPermissions = async () => {
          //     const token = await messaging().getToken();
          //     console.log('🔥 FCM Token in startup coordinator:', token);
          //     if (!token) return;
          //     const connected = await isInternetAvailable();
          //     if (connected) {
          //       await updateFcmToken(creds, token);
          //     }
          //   };
          //   await requestPermissions(); // IMPORTANT
          // } catch (fcmErr) {
          //   console.log('FCM update failed (non-blocking):', fcmErr);
          // }
          const FCM_TIME_KEY = 'LAST_FCM_FETCH';
          try {
            const requestPermissions = async () => {
              // ⏱️ 8 hours throttling check commented out to ensure FCM token is updated on every login/startup
              // const lastFetch = await AsyncStorage.getItem(FCM_TIME_KEY);
              // const now = Date.now();
              // if (lastFetch && now - Number(lastFetch) < 28800000) {
              //   console.log('⏳ Skipping FCM token fetch (8hr not completed)');
              //   return;
              // }
              const token = await messaging().getToken();
              console.log('🔥 FCM Token in startup coordinator:', token);
              if (!token) return;
              const connected = await isInternetAvailable();
              if (connected) {
                await updateFcmToken(updatedCreds, token);
                // save time after success
                await AsyncStorage.setItem(FCM_TIME_KEY, now.toString());
              }
            };
            await requestPermissions();
          } catch (fcmErr) {
            console.log('FCM update failed (non-blocking):', fcmErr);
          }

          // ========== OFFLINE DB SCHEMA MIGRATION GATE (Remote Config) ==========
          // Runs only when online (getRemoteSchemaVersion returns null offline).
          // If a migration fires it best-effort pushes unsynced data, resets the
          // DB, and clears 'initialDataSynced' so the full re-sync below runs.
          // The new version is committed only AFTER that sync succeeds.
          setSyncMessage('Checking for database updates...');
          try {
            const migResult = await runSchemaMigrationIfNeeded({
              apiFetch,
              apiComposite,
              onMigrationStart: () => {
                // Show the blocking popup the instant a migration is confirmed.
                migrating = true;
                setIsMigrating(true);
                bumpMigration(0.05, 'Preparing database update...');
              },
              onProgress: (m) => {
                if (m && typeof m === 'string') setSyncMessage(m);
                if (!migrating) return;
                // Phase milestones during the destructive part (~0.05 → ~0.45)
                if (/securing offline data/i.test(m)) bumpMigration(0.2, m);
                else if (/updating local database/i.test(m)) bumpMigration(0.45, m);
                else bumpMigration(Math.max(migProgress, 0.1), m);
              },
            });
            pendingSchemaVersion = migResult?.targetVersion ?? null;
            if (migResult?.migrated) {
              console.log(`🧬 Schema migration applied → target v${migResult.targetVersion}. Forcing full re-sync.`);

              // The DB reset wiped the logged-in User record (name/id/type/etc.)
              // that loginHandler inserted earlier. Restore it BEFORE the full
              // re-sync, otherwise dataSyncer fails on "Fetch logged in user".
              // (Access/refresh tokens live in Redux/AsyncStorage — unaffected.)
              bumpMigration(0.5, 'Restoring your account...');
              try {
                const restore = await loginHandler(fetchRecords, updatedCreds, handleLogout);
                if (restore?.status === 'success') {
                  updatedCreds = {
                    ...updatedCreds,
                    accessToken: restore.accessToken || updatedCreds.accessToken,
                    instanceUrl: restore.instanceUrl || updatedCreds.instanceUrl,
                    refreshToken: restore.refreshToken || updatedCreds.refreshToken,
                    userId: restore.userId || updatedCreds.userId,
                  };
                  console.log('🧬 User record restored after migration reset');
                } else {
                  console.log('🧬 User restore did not succeed:', restore?.message);
                }
              } catch (restoreErr) {
                console.log('🧬 User restore threw (non-blocking):', restoreErr?.message);
              }

              bumpMigration(0.55, 'Downloading latest data...');
            }
          } catch (migErr) {
            console.log('Schema migration check failed (non-blocking):', migErr?.message);
            // Never strand the popup on a migration error.
            migrating = false;
            setIsMigrating(false);
          }

          setSyncMessage('Checking sync status...');
          try {
            const synced = await AsyncStorage.getItem('initialDataSynced');
            if (synced === 'true') {
              setSyncMessage('Loading...');
              await fetchRoutePlanForCurrentMonth(updatedCreds);
              dispatch(setDataReady(true));
              setSyncLoading(false);
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
              updatedCreds,
              fetchRecords,
              apiFetch,
              apiComposite,
              (msg) => {
                // Progress callback - update UI with current operation
                if (msg && typeof msg === 'string') {
                  setSyncMessage(msg);
                  console.log('📍 Progress:', msg);
                  // While migrating, creep the popup bar forward (cap 0.95
                  // until the version is committed) so users see live motion.
                  if (migrating) {
                    bumpMigration(Math.min(0.95, migProgress + 0.03), msg);
                  }
                }
              }
            );
            // CHECK SYNC RESULT
            if (syncResult.status !== 'success') {
              const msg = `Data sync failed: ${syncResult.message || 'Unknown error'}`;
              showErrorAndLog(msg);
              setSyncLoading(false);
              migrating = false;
              setIsMigrating(false);
              return;
            }

            console.log('Data sync completed successfully');
          } catch (syncErr) {
            const msg = `dataSyncer threw error: ${syncErr.message}`;
            showErrorAndLog(msg, syncErr);
            setSyncLoading(false);
            migrating = false;
            setIsMigrating(false);
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

            // 🧬 COMMIT POINT: stamp schema version only after a successful full sync.
            // This is what makes the migration atomic, crash-safe & run-once.
            // Also stamps fresh installs (pendingSchemaVersion null → fetch once).
            try {
              let versionToCommit = pendingSchemaVersion;
              if (versionToCommit == null) {
                versionToCommit = await getRemoteSchemaVersion();
              }
              if (versionToCommit != null) {
                await commitSchemaVersion(versionToCommit);
              }
            } catch (verErr) {
              console.log('Schema version commit failed (non-blocking):', verErr?.message);
            }

            console.log('Startup data persisted');

            // Complete & dismiss the migration popup (if it was shown).
            if (migrating) {
              bumpMigration(1, 'Update complete');
              migrating = false;
              setTimeout(() => setIsMigrating(false), 600);
            }

            // Fetch route plans after first sync/login completes
            await fetchRoutePlanForCurrentMonth(updatedCreds);

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
          // Never strand the migration popup on an unexpected failure.
          migrating = false;
          setIsMigrating(false);
          return;
        }


      };


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


  const [showTimeoutError, setShowTimeoutError] = useState(false);
  useEffect(() => {
    let timer;
    // 👉 ONLY when "Please wait..." visible
    if (!syncLoading) {
      timer = setTimeout(() => {
        setShowTimeoutError(true);
      }, 25000); // 25 sec
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [syncLoading]);
  useEffect(() => {
    if (syncLoading) {
      setShowTimeoutError(false); // reset
    }
  }, [syncLoading]);

  return (
    <View style={styles.container}>

      {syncLoading ? (
        <>
          <Spinner
            isVisible={syncLoading}
            size={60}
            type="Wave"
            color="#C9A24D"
          />
          <Text style={styles.syncTitle}>Syncing Data...</Text>
          <Text style={styles.syncMessage}>{syncMessage}</Text>
        </>
      ) : (
        <>
          {/* <Spinner size={40} type="Wave" color="#C9A24D" />
          <Text style={styles.syncTitle}>Please wait...</Text> */}
          <Spinner size={40} type="Wave" color="#C9A24D" />
          <Text style={[styles.syncTitle, { color: showTimeoutError ? 'red' : '#000', paddingHorizontal: 50 }]}>
            {showTimeoutError
              ? 'Your sync has failed due to a network issue. Please close the app and reopen it.'
              : 'Please wait...'}
          </Text>
        </>
      )}



      {/* 🧬 Blocking offline-DB migration popup with progress bar */}
      <MigrationProgressModal
        visible={isMigrating}
        progress={migrationProgress}
        message={migrationMessage}
      />

      <DeviceConfirmModal
        isVisible={showDeviceModal}
        title="Access Denied"
        message="You are not allowed to use this app as you are not logged in with the assigned device."
        buttonText="Logout"
        onLogout={async () => {
          setShowDeviceModal(false);
          if (deviceConfirmHandler?.logout) {
            await deviceConfirmHandler.logout();
          } else if (deviceConfirmHandler?.no) {
            await deviceConfirmHandler.no();
          }
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
    color: 'black',
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
