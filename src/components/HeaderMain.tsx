import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Platform
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Cart from '../assets/images/Cart.svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

import { isDistributorAccount } from '../utils/distributorHelper';

const { width } = Dimensions.get('window');

const StoreHeaderTabs = ({
  screenName = 'StoreDetail',
  tabBar = true,
  activeTab,
  setActiveTab,
  disabledTabs = [],
}) => {
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const selectedAccount = useSelector((state: RootState) => state.selectedAccount?.selectedAccount);

  const isDistributor = isDistributorAccount(selectedVisit) || isDistributorAccount(selectedAccount);

  const soVisit = useSelector((state: RootState) => state.soVisit);
  // console.log('Hello', soVisit)
  const [users, setUsers] = useState([]);
  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });
        console.log(result)
        setUsers(result);
      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      }
    };
    initialize();
  }, []);

  let tabs = isDistributor
    ? ['Details']
    : users[0]?.DeveloperName === 'H_T_SO'
    ? soVisit.type === 'Individual Market Work'
      ? ['Details', 'Spot Sales']
      : ['Details', 'Stock']
    : users[0]?.DeveloperName === 'H_T_ASO'
    ? ['Details', 'Spot Sales']
    : users[0]?.DeveloperName === 'MT_Merchandiser'
    ? []
    : users[0]?.DeveloperName === 'MT_SO'
    ? []
    : ['Details', 'Collections', 'Spot Sales'];


  // const isAddNewRetailer = selectedVisit?.Add_New_Retailer_Visit__c;

  // const tabs =
  //   users[0]?.DeveloperName === 'H_T_SO'
  //     ? soVisit.type === 'Individual Market Work'
  //       ? ['Details', 'Competitor', 'Spot Sales']
  //       : ['Details', 'Competitor', 'Spot Sales']
  //     : users[0]?.DeveloperName === 'H_T_ASO'
  //       ? ['Details', 'Spot Sales']
  //       : users[0]?.DeveloperName === 'MT_Merchandiser'
  //         ? []
  //         : users[0]?.DeveloperName === 'MT_SO'
  //           ? []
  //           : isAddNewRetailer
  //             ? ['Details', 'Spot Sales'] //  no Collections
  //             : ['Details', 'Collections', 'Spot Sales'];


  const navigation = useNavigation();
  const [badgeCount, setBadgeCount] = useState(0);



  useFocusEffect(
    useCallback(() => {
      const initialize = async () => {
        try {
          if (screenName === 'Outlets' || screenName === 'Spot Sales History') {
            const cart = await UniversalUpdateInsert({
              ObjectName: 'CartItems',
              Type: 'get',
              filters: [
                { field: "VisitId", value: selectedVisit.sfId },
              ]
            });
            console.log(cart?.length)
            setBadgeCount(cart?.length || 0);
          }
        } catch (error) {
          console.error(' Error initializing header badge:', error);
        }
      };

      initialize();

      // No cleanup required
    }, [screenName])
  );

  const handleTabPress = (tab) => {
    if (disabledTabs.includes(tab)) {
      Alert.alert(
        'Action not allowed',
        'You must check in before accessing this section.'
      );
      return;
    }
    setActiveTab(tab);
  };

  const handleRightPress = () => {
    navigation.navigate('CartScreen');

  };

  return (
    <View
      style={[
        styles.container,
        screenName === 'Spot Sales History'
          ? { paddingTop: Platform.OS === 'ios' ? 60 : 40 }
          : { paddingTop: Platform.OS === 'ios' ? 60 : 40 }
      ]}
    >
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path 
                d="M19 12H5M12 19l-7-7 7-7" 
                stroke="#fff" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.title}>{screenName}</Text>
        </View>
        { }
        {/* Original check before hiding Cart for BAs:
        {(screenName === 'Outlets' || screenName === 'Spot Sales History') && (users[0]?.DeveloperName !== 'MT_SO' && users[0]?.DeveloperName !== 'MT_Merchandiser') && (
        */}
        {(screenName === 'Outlets' || screenName === 'Spot Sales History') && (users[0]?.DeveloperName !== 'MT_SO' && users[0]?.DeveloperName !== 'MT_Merchandiser') && !isDistributor && (
          <TouchableOpacity
            onPress={disabledTabs.includes('Spot Sales') ? null : users[0]?.DeveloperName === 'H_T_SO' &&
              soVisit.type === 'Market and DB Visit' ? null : handleRightPress}
          >
            <Cart width={25} height={25} />
            {badgeCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{badgeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {screenName === 'Outlets' && activeTab && setActiveTab && tabBar && (
        <View style={styles.tabsContainer}>
          {/* Original tabsRow layout before centering single tab:
          <View style={styles.tabsRow}>
          */}
          <View style={[styles.tabsRow, tabs.length === 1 && { justifyContent: 'center' }]}>
            {tabs.map((tab) => {
              const isDisabled = disabledTabs.includes(tab);
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => handleTabPress(tab)}
                  style={styles.tabButton}
                  disabled={isDisabled}
                >
                  <Text
                    style={[
                      styles.tabText,
                      (activeTab === tab || (activeTab === 'Spot Sales Main' && tab === 'Spot Sales')) && styles.activeText,
                      isDisabled && { opacity: 0.4 },
                    ]}
                  >
                    {tab}
                  </Text>
                  {(activeTab === tab || (activeTab === 'Spot Sales Main' && tab === 'Spot Sales')) && !isDisabled && (
                    <View style={styles.dot} />
                  )}
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
    paddingHorizontal: 16,
    paddingBottom: 7,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // paddingBottom: 7,
    paddingTop: 12,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    marginLeft: 8,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontWeight: 'normal',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  tabsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  tabsRow: {
    flexDirection: 'row',
    marginTop: 10,
    width: '95%',
    justifyContent: 'space-between',
  },
  tabButton: {
    alignItems: 'center',
    width: 100,
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