import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import { showToast, showModalToast, hideModalToast } from '../redux/slices/toastSlice.js'
import ToastModal from '../components/modal/ToastModal.js';
import { useSelector, useDispatch } from "react-redux";
import Feather from '@react-native-vector-icons/feather';
import LinearGradient from 'react-native-linear-gradient';
import { dataSyncer } from '../UtilityMain/dataSyncer.js'
import { dataSyncer_getData } from '../UtilityMain/dataSyncer_getData.js'
import { useNavigation } from '@react-navigation/native';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch.js';
import Spinner from 'react-native-spinkit';
import { isInternetAvailable } from '../utils/networkUtils.js';
import { resetLocalDatabase } from '../database/dbResetService.js';
import { setDistributorId, clearDistributorId } from '../redux/slices/distributorSlice.js';
import { triggerAppReload } from '../redux/slices/appReloadSlice.js';
import { setCheckInStatus } from '../redux/slices/checkInSlice.js'
import { syncAttendanceRecords, syncMTExceptionRecord, syncGrowthMappingEntryRecord, syncBeatDayRecord, syncVisitRecord, syncOrderRecord, syncOrderItemRecord, syncCollectionRecord, syncCollectionAllocationRecord, syncInvoiceRecord, syncInvoiceItemRecord, syncAccountRecord, syncFormJsonecord, syncCompetitorRecord, syncStockCheckRecord, syncSalaryAcknowledgementRecord, syncHNTCompetitorPriceRecord, syncGamificationTransactionRecord } from '../database/dbService/AllDataSync.js';
import MIcon from '@react-native-vector-icons/material-icons'
import IIcon from "../components/Ionicons.js";
import DeviceInfo from 'react-native-device-info';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
 
const screenWidth = Dimensions.get('window').width;
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert.js';
 
const RightDrawerModal = ({ visible, onClose, handleLogoutFromParent, isLeaveAttendance = false, isEndDayCompleted = false, onSyncComplete }) => {
  const isRestricted = isLeaveAttendance || isEndDayCompleted;
  const insets = useSafeAreaInsets();
  const { fetchRecords, apiFetch, apiComposite } = useApiFetch()
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const { accessToken, instanceUrl } = useSelector(state => state.auth);
  const toast = useSelector(state => state.toast);
  const [users, setUsers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncText, setSyncText] = useState('Sync Data');
  const [syncTextGet, setSyncTextGet] = useState('Get Data');
  const dotInterval = useRef(null);
  const [isSyncingGet, setIsSyncingGet] = useState(false);
  const navigation = useNavigation()
  const dispatch = useDispatch();
 
  const currentVersion = DeviceInfo.getVersion();
 
  const handleReset = async () => {
    Alert.alert(
      'Confirm DB Reset',
      'This will delete ALL local data. Make sure no critical unsynced changes exist. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
 
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // IMPORTANT: make sure no DB observers/screens are mounted when calling this.
              await resetLocalDatabase();
              Alert.alert('Success', 'Database reset successfully. Please restart the app or re-login.');
            } catch (e) {
              Alert.alert('Error', String(e.message || e));
            }
          }
        }
      ]
    );
  };
 
 
  const showToastvisible = (type, message) => {
    dispatch(showModalToast({
      message: message,
      type: type,
    }));
  };

  const handleItemPress = (action) => {
    if (isRestricted) {
      showToastvisible('warning', isLeaveAttendance ? 'You are on leave and cannot access this feature.' : 'End Day has been completed. You cannot access this feature.');
      return;
    }
    action();
  };

  const handleAllowancePress = async (allowanceType) => {
    if (isRestricted) {
      showToastvisible('warning', isLeaveAttendance ? 'You are on leave and cannot access this feature.' : 'End Day has been completed. You cannot access this feature.');
      return;
    }

    const connected = await isInternetAvailable();
    if (!connected) {
      showToastvisible('error', 'Internet is required to access this feature.');
      return;
    }

    onClose();
    navigation.navigate('ClaimTravelAllowance', { allowanceType });
  };
 
  const handleClick = () => {
    onClose()
    navigation.navigate('SROnboardingForm')
  }
 
  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });
        setUsers(result);
      } catch (error) {
        console.error("❌ Get User Failed For the Header:", error);
      }
    };
 
    initialize();
 
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);
 
  const startDotAnimation = () => {
    let dots = '';
    dotInterval.current = setInterval(() => {
      dots = dots.length < 3 ? dots + '.' : '';
      setSyncText(`Syncing${dots}`);
    }, 500);
  };
 
  const stopDotAnimation = () => {
    clearInterval(dotInterval.current);
    setSyncText('Sync Data');
  };
 
  const handleGetData = async () => {
    const connected = await isInternetAvailable();
    if (!connected) {
      Alert.alert("No Internet Connection", "Internet connection is required to get data.");
      return;
    }
 
    if (!accessToken || !instanceUrl) {
      Alert.alert("Missing Credentials", "Access token or instance URL is not provided.");
      return;
    }
 
    try {
      setIsSyncingGet(true);
      setSyncTextGet(`Syncing offline data in salesforce.`);
      // const sync = await handleSyncData();
      let userId = users[0]?.Sf_Id
 
      const creds = { accessToken, instanceUrl, userId };
      // const result = await dataSyncer(creds, fetchRecords, apiFetch,
      //   (msg) => {
      //     if (msg && typeof msg === 'string') {
      //       setSyncTextGet(msg);
      //     }
      //   }
      // );
      const result = await dataSyncer_getData(creds, fetchRecords, apiFetch,
        (msg) => {
          if (msg && typeof msg === 'string') {
            setSyncTextGet(msg);
          }
        }
      )
 
      if (result.status === 'success') {
        setSyncTextGet(`Get Data`);
        showToastvisible('success', 'Sync Completed');
        dispatch(triggerAppReload());
        onSyncComplete?.();
        dispatch(setCheckInStatus({
          VisitId: null,
          status: null,
          date: null
        }));
 
 
      } else {
        setSyncTextGet(`Get Data`);
        console.log("❌ Sync Failed", result.message || "An error occurred during sync.");
        // alert(result.message )
        showToastvisible('error', 'Sync Failed');
      }
    } catch (err) {
      setSyncTextGet(`Get Data`);
      console.error('Sync error:', err);
      showToastvisible('error', 'Sync Failed');
    } finally {
      onClose();
      setSyncTextGet(`Get Data`);
      setIsSyncingGet(false);
    }
  }
 
  const handleSyncData = async () => {
 
    await syncCompetitorRecord(apiFetch);
    await syncAttendanceRecords(apiFetch);
    await syncBeatDayRecord(apiFetch, apiComposite);
    await syncVisitRecord(apiFetch, apiComposite);
    await syncOrderRecord(apiFetch);
    await syncOrderItemRecord(apiFetch);
    await syncCollectionRecord(apiFetch);
    await syncCollectionAllocationRecord(apiFetch);
    await syncInvoiceRecord(apiFetch)
    await syncInvoiceItemRecord(apiFetch)
    await syncAccountRecord(apiFetch);
    await syncFormJsonecord(apiFetch);
    await syncCompetitorRecord(apiFetch);
    await syncStockCheckRecord(apiFetch);
    await syncSalaryAcknowledgementRecord(apiFetch);
    await syncGamificationTransactionRecord(apiFetch);
    await syncMTExceptionRecord(apiFetch);
    await syncGrowthMappingEntryRecord(apiFetch);
    await syncHNTCompetitorPriceRecord(apiFetch);
 
  };
  const confirmLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await handleLogoutFromParent();
          },
        },
      ],
      { cancelable: true }
    );
  };
 
  const { id: beatId } = useSelector((state) => state.beatSelection);
  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, {  paddingBottom: insets.bottom }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
 
              {/* Header with Gradient */}
              <LinearGradient
                colors={['#A67C2E', '#C9A24D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 24) }]}
              >
 
                <View style={styles.headerContent}>
                  {/* <Image
                    source={require('../assets/images/emamiLogo.png')}
                    style={styles.logo}
                  /> */}
                  {/* <Image
                    source={require('../assets/images/Emami1.png')}
                    style={styles.logo}
                  /> */}
                  {/* <Text style={styles.name}>{users[0]?.Name}</Text> */}
                </View>
 
                <View style={styles.profileContainer}>
                  <View style={styles.profileHeader}>
                    <View style={styles.avatarCircle}>
                      <Feather name="user" size={22} color="#C9A24D" />
                    </View>
                    <View style={styles.profileMeta}>
                      <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
                        {users[0]?.Name || 'Mobile User'}
                      </Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          Emp Code: {users[0]?.EmployeeCode__c || '-'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.profileDivider} />

                  <View style={styles.infoList}>
                    {users[0]?.Email ? (
                      <View style={styles.infoRow}>
                        <Feather name="mail" size={13} color="#FFF" style={styles.infoIcon} />
                        <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                          {users[0].Email}
                        </Text>
                      </View>
                    ) : null}

                    {users[0]?.Phone ? (
                      <View style={styles.infoRow}>
                        <Feather name="phone" size={13} color="#FFF" style={styles.infoIcon} />
                        <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                          {users[0].Phone}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
 
              </LinearGradient>
 
              {/* Menu Section */}
              <View
                style={styles.menu}
              >
 
                {users[0]?.DeveloperName === "H_T_SO" && (
                  <>
                    <TouchableOpacity
                      style={[styles.button, isRestricted && styles.buttonDisabled]}
                      onPress={() => handleItemPress(() => {
                        onClose()
                        navigation.navigate('ObjectList', { title: 'Competitor Pricing', objectName: 'HNT_Competitor_Price__c' })
                      })}
                    >
                      <Feather name="shopping-bag" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                      <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Competitor Pricing</Text>
                    </TouchableOpacity>
 
 
                    <TouchableOpacity
                      style={[styles.button, isRestricted && styles.buttonDisabled]}
                      onPress={() => handleItemPress(() => {
                        onClose()
                        navigation.navigate('SRAttendanceScreen')
                      })}
                    >
                      <Feather name="shopping-cart" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                      <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Attendance Report</Text>
                    </TouchableOpacity>
                  </>
                )}
 
 
 
                {users[0]?.DeveloperName === "H_T_ASO" && (
 
                  <>
                    <TouchableOpacity
                      style={[styles.button, isRestricted && styles.buttonDisabled]}
                      onPress={() => handleItemPress(async () => {
                        const disData = await UniversalUpdateInsert({
                          ObjectName: "SR_Beat_Assignment__c",
                          Type: "get",
                          filters: [
                            { field: "Sales_Representative__c", value: users[0]?.Sf_Id },
                            { field: "Beat__c", value: beatId },
                          ],
                        });
                        console.log('------------------------------', disData[0]?.Distributor__c)
                        console.log('------------------------------', disData)
                        dispatch(setDistributorId(disData[0]?.Distributor__c));
                        onClose()
                        navigation.navigate('ASOOrder')
                      })}
                    >
                      <Feather name="shopping-bag" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                      <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Suggested Spot Sales</Text>
                    </TouchableOpacity>
 
                    <TouchableOpacity
                      style={[styles.button, isRestricted && styles.buttonDisabled]}
                      onPress={() => handleItemPress(() => {
 
                        onClose()
                        navigation.navigate('SubDBOrder')
                      })}
                    >
                      <Feather name="shopping-cart" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                      <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Sub DB Spot Sales</Text>
                    </TouchableOpacity>
 
                    <TouchableOpacity
                      style={[styles.button, isRestricted && styles.buttonDisabled]}
                      onPress={() => handleItemPress(() => {
 
                        onClose()
                        navigation.navigate('SubDBOrderReport')
                      })}
                    >
                      <Feather name="truck" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                      <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Sub DB Spot Sales Report</Text>
                    </TouchableOpacity>
                  </>
                )}
 
                {(users[0]?.DeveloperName === "H_T_SR" || users[0]?.DeveloperName === "H_T_ASO") && (
                  <TouchableOpacity
                    style={[styles.button, isRestricted && styles.buttonDisabled]}
                    onPress={() => handleItemPress(() => {
                      onClose()
                      navigation.navigate('ObjectList', { title: 'Salary Acknowledgement', objectName: 'Salary_Acknowledgement__c' })
                    })}
                  >
                    <Feather name="user-plus" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                    <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Salary Acknowledgement</Text>
                  </TouchableOpacity>
                )}
 
                {(users[0]?.DeveloperName === "H_T_SR" || users[0]?.DeveloperName === "H_T_ASO") && (
                  <TouchableOpacity
                    style={[styles.button, isRestricted && styles.buttonDisabled]}
                    onPress={() => handleItemPress(() => {
                      onClose()
                      navigation.navigate('ReportsScreen')
                    })}
                  >
                    <Feather name="monitor" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                    <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Reports</Text>
                  </TouchableOpacity>
                )}
 
                {
                  users[0]?.DeveloperName === "MT_SO" && (
                    <TouchableOpacity
                      style={[styles.button, isRestricted && styles.buttonDisabled]}
                      onPress={() => handleItemPress(() => {
                        onClose()
                        navigation.navigate('ExceptionForTab')
                      })}
                    >
                      <Feather name="monitor" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                      <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>All Exception</Text>
                    </TouchableOpacity>
                  )
                }
 
                {users[0]?.DeveloperName === "MT_Merchandiser" && (
                  <TouchableOpacity
                    style={[styles.button, isRestricted && styles.buttonDisabled]}
                    onPress={() => handleItemPress(() => {
                      onClose()
                      navigation.navigate('ReportsScreen')
                    })}
                  >
                    <Feather name="file-text" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                    <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Reports</Text>
                  </TouchableOpacity>
                )}
 
 
 
 
 
                <TouchableOpacity
                  style={[styles.button, isRestricted && styles.buttonDisabled]}
                  onPress={() => handleItemPress(() => {
                    onClose();
                    navigation.navigate('RoutePlanScreen');
                  })}
                >
                  <Feather name="map" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Create Route Plan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, isRestricted && styles.buttonDisabled]}
                  onPress={() => handleItemPress(() => {
                    onClose();
                    navigation.navigate('MissedOutletsScreen');
                  })}
                >
                  <Feather name="map-pin" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Missed Outlet</Text>
                </TouchableOpacity>

                {users[0] && ["RSM", "ASM", "ASE", "SO"].includes(users[0].Role) && (
                  <TouchableOpacity
                    style={[styles.button, isRestricted && styles.buttonDisabled]}
                    onPress={() => handleItemPress(() => {
                      onClose();
                      navigation.navigate('BeatReassignment');
                    })}
                  >
                    <Feather name="repeat" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                    <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Beat Reassignment</Text>
                  </TouchableOpacity>
                )}

                {users[0] && ["RSM", "ASM"].includes(users[0].Role) && (
                  <TouchableOpacity
                    style={[styles.button, isRestricted && styles.buttonDisabled]}
                    onPress={() => handleItemPress(() => {
                      onClose();
                      navigation.navigate('OutletReassignment');
                    })}
                  >
                    <Feather name="refresh-cw" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                    <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Outlet Reassignment</Text>
                  </TouchableOpacity>
                )}
 
 
 
               
 
 
                  {/* TA new updated  */}
                 <TouchableOpacity
                  style={[styles.button, isRestricted && styles.buttonDisabled]}
                  onPress={() => handleAllowancePress('Travel Allowance')}
                >
                  <Feather name="briefcase" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Travel Allowance</Text>
                </TouchableOpacity>
                  {/* DA */}
                <TouchableOpacity
                  style={[styles.button, isRestricted && styles.buttonDisabled]}
                  onPress={() => handleAllowancePress('Daily Allowance')}
                >
                  <Feather name="dollar-sign" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>Daily Allowance</Text>
                </TouchableOpacity>
                 <TouchableOpacity
                  style={[styles.button, isRestricted && styles.buttonDisabled]}
                  onPress={() => handleItemPress(() => {
                    onClose()
 
                    if (users[0]?.DeveloperName === "MT_Merchandiser" || users[0]?.DeveloperName === "MT_SO") { navigation.navigate('EndDayScreenMT') } else {
                      navigation.navigate('EndDayScreen')
                    };
 
                  })}
                >
                  <Feather name="sunset" size={20} color={isRestricted ? '#7A7266' : '#C9A24D'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuText, isRestricted && { color: '#7A7266' }]}>End Day</Text>
                </TouchableOpacity>
 
 
                
               
                {/* {
                  !(users[0]?.DeveloperName === "MT_Merchandiser" || users[0]?.DeveloperName === "MT_SO") && (
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => {
                        onClose();
                        navigation.navigate('TrainingMaterials');
                      }}
                    >
                      <Feather name="book-open" size={20} color="#C9A24D" style={{ marginRight: 12 }} />
                      <Text style={styles.menuText}>Training Materials</Text>
                    </TouchableOpacity>
                  )
                } */}
 
 
 
                {/* Reset Database Button */}
                {/* <View style={{ padding: 20 }}>
                  <Text style={{ marginBottom: 20, fontSize: 12 }}>Debug Actions</Text>
 
                  <TouchableOpacity
                    onPress={handleReset}
                    style={{
                      backgroundColor: '#F42B35',
                      padding: 15,
                      borderRadius: 10
                    }}
                  >
                    <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
                      Reset Local Database
                    </Text>
                  </TouchableOpacity>
                </View> */}
 
 
              </View>
 
              {/* Sync & Logout Footer Section */}
              <View style={styles.footer}>
                <View>
                  <TouchableOpacity
                    style={styles.syncButton}
                    onPress={() => {
                      onClose();
                      navigation.navigate('UnsyncedData');
                    }}
                  >
                    <Feather name="alert-circle" size={20} color="#B91C1C" style={styles.menuIcon} />
                    <Text style={[styles.syncText, { color: '#B91C1C' }]}>
                      Check Not Sync Data
                    </Text>
                  </TouchableOpacity>
 
                  <TouchableOpacity style={styles.syncButton} onPress={handleGetData} disabled={isSyncingGet}>
                    <Feather name="refresh-ccw" size={20} color={isSyncingGet ? '#C9A24D' : '#444'} style={styles.menuIcon} />
                    <Text style={[styles.syncText, isSyncingGet && { color: '#A67C2E' }]}>
                      Get Data
                    </Text>
                  </TouchableOpacity>
                </View>
 
                {/* <TouchableOpacity style={styles.syncButton} onPress={handleSyncData} disabled={isSyncing}>
                  <Feather name="refresh-ccw" size={20} color={isSyncing ? '#C9A24D' : '#444'} style={styles.menuIcon} />
                  <Text style={[styles.syncText, isSyncing && { color: '#A67C2E' }]}>
                    {syncText}
                  </Text>
                </TouchableOpacity>  */}
 
                <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
                  <Feather name="log-out" size={20} color="#d32f2f" style={styles.menuIcon} />
                  <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
              </View>
 
              <View
                style={{
                  position: 'absolute',
                  bottom: 30,
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: '#A67C2E',
                  }}
                >
                  App Version: {currentVersion}
                </Text>
              </View>
 
 
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
 
      {isSyncingGet && (
        <View style={styles.loadingOverlay}>
          <Spinner size={40} type="Wave" color="#C9A24D" />
          <Text style={styles.loadingText}>{syncTextGet}</Text>
        </View>
      )}
 
      <ToastModal
        visible={toast.modalVisible}
        message={toast.modalMessage}
        type={toast.modalType}
        onClose={() => dispatch(hideModalToast())}
      />
    </Modal>
  );
};
 
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  drawer: {
    width: screenWidth * 0.7,
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    elevation: 10,
    justifyContent: 'flex-start',
    borderTopLeftRadius: 40,
    borderBottomLeftRadius: 20,
  },
  headerGradient: {
    // paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 40,
    borderBottomLeftRadius: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  logo: {
    height: 55,
    resizeMode: 'contain',
    marginBottom: 5,
    marginTop: 5,
    marginHorizontal: 10,
    
  },
 
  name: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
 
  menu: {
    marginTop: 17,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 18,
    marginVertical: 4,
    marginHorizontal: 14,
    elevation: 4,
    shadowColor: '#C9A24D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  buttonDisabled: {
    backgroundColor: '#F1EADB',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    borderWidth: 1,
    borderColor: '#D9D2C3',
  },
 
  menuText: {
    fontSize: 13,
    color: '#0B0B0B',
    fontWeight: '600',
  },
  syncText: {
    fontSize: 16,
    color: '#444',
  },
  logoutText: {
    fontSize: 16,
    color: '#d32f2f',
    fontWeight: '600',
  },
  menuIcon: {
    marginRight: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
    color: '#A67C2E',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    paddingVertical: 14,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    paddingVertical: 14,
  },
  profileContainer: {
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileMeta: {
    marginLeft: 10,
    flex: 1,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  profileDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 10,
  },
  infoList: {
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  infoIcon: {
    marginRight: 8,
    opacity: 0.9,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
 
});
 
export default RightDrawerModal;
