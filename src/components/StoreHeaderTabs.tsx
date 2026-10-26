import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from "./Ionicons"; // Back arrow
import Feather from '@react-native-vector-icons/feather';   // Cart icon
import Cart from '../assets/images/Cart.svg'
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';


import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';


import { isDistributorAccount } from '../utils/distributorHelper';

const { width } = Dimensions.get('window');
const StoreHeaderTabs = ({ screenName = 'StoreDetail', tabBar = true, activeTab, setActiveTab, disabledTabs = [] }) => {
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const selectedAccount = useSelector((state: RootState) => state.selectedAccount?.selectedAccount);
  const isDistributor = isDistributorAccount(selectedVisit) || isDistributorAccount(selectedAccount);

  let tabs = isDistributor ? ['Details'] : ['Details', 'Collections', 'Spot Sales'];

  const navigation = useNavigation();
  const [cartItemLenghth, setCartItemLength] = useState(0)

  const handleTabPress = (tab) => {
    if (disabledTabs.includes(tab)) {
      // Show feedback (optional)
      Alert.alert('Action not allowed', 'You must check in before accessing this section.');
      return;
    }
    setActiveTab(tab);
  };
  useFocusEffect(
    useCallback(() => {
      if (screenName === 'StoreDetail') {
        const initialize = async () => {
          try {
            const result = await UniversalUpdateInsert({
              ObjectName: 'CartItems',
              Type: 'get',
            });

            setCartItemLength(result.length);
          } catch (error) {
            console.error(" Get User Failed For the Header:", error);
          }
        };

        initialize();
      }

      // Optional cleanup function
      return () => {
        // Any cleanup logic here if needed
      };
    }, [screenName])
  );
  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Outlets</Text>
        </View>

        {screenName === 'StoreDetail' && !isDistributor && (
          <TouchableOpacity onPress={() => navigation.navigate('CartScreen')}>
            <Cart width={25} height={25} />
            <View style={{ marginLeft: 12, marginTop: -26, marginRight: 0, width: 14, height: 14, borderRadius: 30, backgroundColor: 'red', }}>
              <Text style={{ fontSize: 10, textAlign: 'center', color: 'white' }}>{cartItemLenghth}</Text>
            </View>

          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      {screenName === 'StoreDetail' && activeTab && setActiveTab && tabBar && (
        <View style={{ justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          {/* Original tabsRow layout before centering single tab:
          <View style={styles.tabsRow}>
          */}
          <View style={[styles.tabsRow, tabs.length === 1 && { justifyContent: 'center' }]}>
            {tabs.map(tab => {
              const isDisabled = disabledTabs.includes(tab);
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => handleTabPress(tab)}
                  style={styles.tabButton}
                  disabled={isDisabled}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === tab && styles.activeText,
                    isDisabled && { opacity: 0.4 }
                  ]}>
                    {tab}
                  </Text>
                  {activeTab === tab && !isDisabled && <View style={styles.dot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

    </View>
  );

};

const styles = StyleSheet.create({
  container: {
    paddingTop: 70,
    paddingHorizontal: 16,
    paddingBottom: 10,

  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 15,
    marginLeft: 2,
    fontWeight: '400',
  },
  tabsRow: {
    flexDirection: 'row',
    marginTop: 18,
    width: '90%',

    //backgroundColor:'',
    justifyContent: 'space-between'
  },
  tabButton: {
    //backgroundColor:'yellow',
    //marginRight: 24,
    alignItems: 'center',
    width: 100
  },
  tabText: {
    color: '#c0c9de',
    fontSize: 14,
  },
  activeText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginTop: 4,
  },
});

export default StoreHeaderTabs;
