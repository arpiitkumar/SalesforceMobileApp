import React, { useState, useEffect, act } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Platform,
  Image
} from 'react-native';
import Ionicons from "./Ionicons";
import Feather from '@react-native-vector-icons/feather';
import { Dropdown } from 'react-native-element-dropdown';
import Svg, { Path } from 'react-native-svg';
import CustomModal from './modal/CustomModal';
import ScrollableCalendar from './ScrollableCalendar';
import { getHeaderStyle } from '../assets/css/Header';
import SearchIcon from '../assets/images/search.svg';
import Arrow from '../assets/images/arrow.svg';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert'
import NetStatusDot from './atoms/NetStatusDot';
import { useDispatch, useSelector } from 'react-redux';
import { setSearchParam } from '../redux/slices/searchSlice';
import notificationEvents from '../utils/notificationEvents';
import { recalculateNotificationCount } from '../utils/notificationCounter';
import { useNavigation } from '@react-navigation/native';

export default function Header({ activeTab }) {
  const styles = getHeaderStyle();
  const searchParam = useSelector((state: RootState) => state.search.searchParam);
  // console.log(activeTab, 'activeTabactiveTabactiveTabactiveTabactiveTabactiveTab')
  const [notificationCount, setNotificationCount] = useState(null);

  useEffect(() => {
    // initial load
    recalculateNotificationCount().then(setNotificationCount);

    // realtime updates
    const unsubscribe = notificationEvents.subscribe(count => {
      setNotificationCount(count);
    });

    return unsubscribe;
  }, []);

  const navigation = useNavigation()
  const [users, setUsers] = useState([])
  const dispatch = useDispatch();

  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });

        setUsers(result);
        // console.log("THIS USER IS INT THE HEADER=-=-=-=-====-=-=-=-==-=-=-=-=-=-=-=-=-=-==-==-=-====-", result)

      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      }
    };

    initialize();
  }, []);

  // const [NotificationList, setNotificationList] = useState(null)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const count = await recalculateNotificationCount();
        setNotificationCount(count);
      } catch (error) {
        console.error(' Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
  }, []);

  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [dashboardView, setDashboardView] = useState('sp');
  const [representative, setRepresentative] = useState(null);

  const dashboardOptions = [
    { label: 'Self Performance', value: 'sp' },
    { label: 'Distributor', value: 'db' },
    { label: 'SR (Sales Representative)', value: 'sr' },
    { label: 'ASM (Area Sales Manager)', value: 'asm' },
  ];
  const representativeOptions = [
    { label: 'Ram Kumar (SR)', value: 'ram' },
    { label: 'Sita Devi (SR)', value: 'sita' },
  ];
  const distributorOptions = [
    { label: 'Ram Kumar (Distributor)', value: 'ram' },
    { label: 'Sita Devi (Distributor)', value: 'sita' },
  ];

  const getDashboardLabel = (val) => {
    const opt = dashboardOptions.find((o) => o.value === val);
    return opt ? opt.label : val;
  };

  const handleNotificationPress = () => {
    console.log('🔔 Bell tapped');
    navigation.navigate('NotificationsScreen')
  };

  return (
    <>
      {/* Globus Spirits: navy header bar with gold accents */}
      <View style={[styles.container, { backgroundColor: '#1E3A8A', borderBottomWidth: 1, borderBottomColor: '#C9A24D' }]}>
        {
          Platform.OS === 'ios' && <SafeAreaView style={styles.safeArea} />
        }
        <StatusBar
          backgroundColor="transparent"
          barStyle="light-content"
          translucent={Platform.OS === 'android'}
        />

        {/* — Top Row: Search + Bell */}
        <View style={styles.topRow}>
          {
            activeTab === 'Home' || activeTab === 'StockCheck' ?
              <View style={[styles.searchBox, { backgroundColor: 'transparent', height: 'auto' }]}>
                {/* Globus Spirits logo (white artwork) on a white rounded card */}
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Image
                    source={require('../assets/images/globus-logo.png')}
                    style={{
                      resizeMode: 'contain',
                      height: 64,
                      width: 75,
                    }}
                  />
                </View>
              </View>
              :
              <View style={styles.searchBox}>
                <TextInput
                  style={styles.input}
                  placeholder="Search"
                  placeholderTextColor="#888"
                  value={searchParam}
                  // onChangeText={setSearchText}
                  onChangeText={(text) => {
                    // setSearchText(text);
                    dispatch(setSearchParam(text)); // update global state
                  }}
                />
                <SearchIcon width={20} height={20} fill="#888" style={styles.searchIcon} />
              </View>
          }
          {/* <View style={styles.searchBox}>
            <TextInput
              style={styles.input}
              placeholder="Search"
              placeholderTextColor="#888"
              value={searchText}
              // onChangeText={setSearchText}
              onChangeText={(text) => {
                setSearchText(text);
                dispatch(setSearchParam(text)); // update global state
              }}
            />
            <SearchIcon width={20} height={20} fill="#888" style={styles.searchIcon} />
          </View> */}
          <TouchableOpacity style={styles.iconButton} onPress={handleNotificationPress}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path 
                d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" 
                fill="#C9A24D" 
              />
            </Svg>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 99 ? '99+' : (notificationCount || 0)}
              </Text>
            </View>
          </TouchableOpacity>

        </View>

        {/* — Greeting or Calendar */}
        {activeTab === 'Beat Plan' || activeTab === 'Activity' ? (
          <ScrollableCalendar />
        ) : (
          <>
            {activeTab !== 'StockCheck' && (
              <>
                <View style={{ flexDirection: 'row', marginTop: 16, alignItems: 'center' }}>
                  <NetStatusDot />
                  <Text style={styles.greeting}>
                    Hey!<Text style={styles.name}> {users[0]?.Name}</Text> 👋
                  </Text>
                </View>
                {
                  // console.log('active TABBEEEEEEE.............', activeTab)
                }

                <TouchableOpacity
                  onPress={() => setModalVisible(true)}
                  style={styles.dropdownTrigger}
                  // disabled={!!(users[0]?.DeveloperName === 'H_T_SR')}
                  disabled={true}
                >
                  {/* <Text style={styles.title}>{getDashboardLabel(dashboardView)}</Text> */}
                  {/* <Text style={styles.title}>Outlet Metric</Text> */}
                  {/* {users[0]?.DeveloperName !== 'H_T_SR' && <Arrow width={16} height={16} fill="#fff" style={styles.arrowIcon} />} */}

                </TouchableOpacity>

                {/* <Text style={styles.subtitle}>Current Dashboard View</Text> */}
              </>
            )}

          </>
        )}
      </View>

      {/* — Dashboard Selection Modal */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={() => {
          console.log('Selected view:', dashboardView, 'rep:', representative);
          setModalVisible(false);
        }}
      >
        <Text style={{ marginBottom: 8, color: '#555' }}>Dashboard View</Text>
        <Dropdown
          data={dashboardOptions}
          labelField="label"
          valueField="value"
          placeholder="Select View"
          value={dashboardView}
          onChange={(item) => {
            setDashboardView(item.value);
            setRepresentative(null);
          }}
          style={styles.dropdown}
        />

        {/* — Rep or Distributor Dropdown */}
        {dashboardView === 'sr' && (
          <>
            <Text style={styles.modalLabel}>Sales Representative</Text>
            <Dropdown
              data={representativeOptions}
              labelField="label"
              valueField="value"
              placeholder="Select Rep"
              value={representative}
              onChange={(item) => setRepresentative(item.value)}
              style={styles.dropdown}
            />
          </>
        )}

        {dashboardView === 'db' && (
          <>
            <Text style={styles.modalLabel}>Distributor</Text>
            <Dropdown
              data={distributorOptions}
              labelField="label"
              valueField="value"
              placeholder="Select Distributor"
              value={representative}
              onChange={(item) => setRepresentative(item.value)}
              style={styles.dropdown}
            />
          </>
        )}
      </CustomModal>
    </>
  );
}
