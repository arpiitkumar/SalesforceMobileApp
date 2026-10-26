import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Keyboard, Platform } from 'react-native';

import HomeSvg from '../assets/images/Vector.svg';
import BeatPlan from '../assets/images/BeatPlan.svg';
import Add from '../assets/images/Add.svg';
import Profile from '../assets/images/Profile.svg';
import Rocket from '../assets/images/Rokect.svg';

import HomeSvgActive from '../assets/images/VectorActive.svg';
import BeatPlanActive from '../assets/images/BeatPlanActive.svg';
import AddActive from '../assets/images/AddActive.svg';
import ProfileActive from '../assets/images/ProfileActive.svg';
import RocketActive from '../assets/images/RokectActive.svg';
import CompetitorAnalysis from '../assets/images/competitor-analysis.svg'
import CompetitorAnalysisActive from '../assets/images/competitor-analysisActive.svg'

import { CustomTabBarStyle } from '../assets/css/CustomTabBar.js';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { useDispatch } from "react-redux";
import { setSearchParam } from '../redux/slices/searchSlice';
// Tabs for different roles
const soTabs = [
  { name: 'Home', label: 'Home', icon: HomeSvg, activeIcon: HomeSvgActive, size: 22 },
  { name: 'Activity', label: 'Activity', icon: BeatPlan, activeIcon: BeatPlanActive, size: 22 },
  // { name: 'Rocket', label: 'Retailer', icon: Rocket, activeIcon: RocketActive, size: 22 },
  { name: 'SubDBOnboarding', label: 'SubDB Onboarding', icon: Rocket, activeIcon: RocketActive, size: 22 },
  { name: 'Profile', label: 'Menu', icon: Profile, activeIcon: ProfileActive, size: 22 },

];

const asoTabs = [
  { name: 'Home', label: 'Home', icon: HomeSvg, activeIcon: HomeSvgActive, size: 22 },
  { name: 'StockCheck', label: 'Sub DB Info', icon: Rocket, activeIcon: RocketActive, size: 22 },
  { name: 'Beat Plan', label: 'Beat Plan', icon: BeatPlan, activeIcon: BeatPlanActive, size: 22 },
  { name: 'Rocket', label: 'Retailer', icon: Rocket, activeIcon: RocketActive, size: 22 },
  { name: 'Profile', label: 'Menu', icon: Profile, activeIcon: ProfileActive, size: 22 },
];

const srTabs = [
  { name: 'Home', label: 'Home', icon: HomeSvg, activeIcon: HomeSvgActive, size: 22 },
  { name: 'Beat Plan', label: 'Beat Plan', icon: BeatPlan, activeIcon: BeatPlanActive, size: 22 },
  { name: 'Rocket', label: 'Retailer', icon: Rocket, activeIcon: RocketActive, size: 22 },
  { name: 'Profile', label: 'Menu', icon: Profile, activeIcon: ProfileActive, size: 22 },
];

const MT_HoReCaTabs = [
  { name: 'Home', label: 'Home', icon: HomeSvg, activeIcon: HomeSvgActive, size: 22 },
  { name: 'Beat Plan', label: 'Beat Plan', icon: BeatPlan, activeIcon: BeatPlanActive, size: 22 },
  // { name: 'Rocket', label: 'Retailer', icon: Rocket, activeIcon: RocketActive, size: 22 },
  { name: 'Profile', label: 'Menu', icon: Profile, activeIcon: ProfileActive, size: 22 },
];

const MT_SO = [
  { name: 'Home', label: 'Home', icon: HomeSvg, activeIcon: HomeSvgActive, size: 22 },
  { name: 'Beat Plan', label: 'Beat Plan', icon: BeatPlan, activeIcon: BeatPlanActive, size: 22 },
  // { name: 'Rocket', label: 'Retailer', icon: Rocket, activeIcon: RocketActive, size: 22 },
  { name: 'Profile', label: 'Menu', icon: Profile, activeIcon: ProfileActive, size: 22 },
];

const defaultTabs = [
  { name: 'Home', label: 'Home', icon: HomeSvg, activeIcon: HomeSvgActive, size: 22 },
  { name: 'Beat Plan', label: 'Beat Plan', icon: BeatPlan, activeIcon: BeatPlanActive, size: 22 },
  // { name: 'Add', label: 'Add', icon: Add, activeIcon: AddActive, size: 22 },
  { name: 'Rocket', label: 'Retailer', icon: Rocket, activeIcon: RocketActive, size: 22 },
  { name: 'Profile', label: 'Menu', icon: Profile, activeIcon: ProfileActive, size: 22 },
];

const CustomTabBar = ({ activeTab, onTabPress, onProfilePress }) => {
  const styles = CustomTabBarStyle();
  const [users, setUsers] = useState([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const dispatch = useDispatch();

  useEffect(() => {

    dispatch(setSearchParam(''));

  }, [activeTab])

  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });
        setUsers(result);
      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      }
    };

    initialize();
  }, []);
  // keyboard listeners to track visibility
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  if (keyboardVisible) return null;


  const role = users[0]?.DeveloperName;
  // console.log("🧠 User role is:", role);

  let filteredTabs = defaultTabs;

  if (role === 'H_T_SO') {
    filteredTabs = soTabs;
  } else if (role === 'H_T_SR') {
    filteredTabs = srTabs;
  } else if (role === 'H_T_ASO') {
    filteredTabs = asoTabs;
  } else if (role === 'MT_Merchandiser') {
    filteredTabs = MT_HoReCaTabs;
  } else if (role === 'MT_SO') {
    filteredTabs = MT_SO;
  }

  return (
    <View style={styles.container}>
      {filteredTabs.length === 0 ? (
        <Text style={{ color: 'red', textAlign: 'center' }}>⚠️ No tabs available</Text>
      ) : (
        filteredTabs.map((tab) => {
          const isFocused = activeTab === tab.name;
          const IconComponent = isFocused ? tab.activeIcon : tab.icon;

          const handlePress = () => {
            if (tab.name === 'Profile') {
              onProfilePress?.();
            } else {
              onTabPress(tab.name);
            }
          };

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={handlePress}
            >
              <IconComponent width={tab.size} height={tab.size} />
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>{tab.label}</Text>
              {isFocused && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

export default CustomTabBar;
