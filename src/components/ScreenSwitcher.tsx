import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PlaceholderScreen from '../screens/PlaceHolderScreen';
import BeatPlanning from '../screens/BeatPlanning';
import DashboardSP from '../screens/dashboards/DashboardSP';
import DashboardSR from '../screens/dashboards/DashboardSR';
import DashboardSO from '../screens/dashboards/DashboardSO';
import DashboardDB from '../screens/dashboards/DashboardDB';
//import DashboardASM from '../screens/Dashboards/DashboardASM';
import ObjectList from '../screens/ObjectList';
import DashboardPlaceHolder from '../screens/Dashboards/DadhboardPlaceholder';

import DashboardPlaceholder from '../screens/Dashboards/DadhboardPlaceholder';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import SelectActivity from '../screens/SelectActivity';
import SelectionScreen from '../screens/SelectionScreen';
import SROnboardingForm from '../screens/SROnboardingComp';
import ASOStockCheck from "../screens/ASOStockCheck";
import SubDBInfo from "../screens/SubDBInfo";




const ScreenSwitcher = ({ activeTab, refreshKey }) => {

  const [users, setUsers] = useState([])
  const navigaiton = useNavigation();

  useEffect(() => {
    // console.log("🔄 Screen refreshed because refreshKey changed", refreshKey);
  }, [refreshKey]);

  useEffect(() => {
    // console.log('COMPETITOR OR NOT ', activeTab)

    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });

        setUsers(result);
        //console.log("THIS USER IS INT THE ScreenSwitcher",result)


      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      }
    };

    initialize();
  }, [refreshKey]);

  //console.log("THIS IS THE USER FROM CURRENT SWITCHER--------------",userInfo.UserRole)

  const getDashboardForRole = () => {
    const role = users[0]?.Role;
    const developerName = users[0]?.DeveloperName;
    // console.log("THIS IS FROM SCREEN SWITCHER-----", developerName)
    //console.log(role.split(" ")[1])
    //const lowerRole = role?.split(" ")[1]?.toLowerCase()
    let sr = 'sr'
    //console.log(lowerRole)

    switch (developerName) {
      case 'sales representative':
      case 'H_T_SR':
        return <DashboardSR />;
      //  return <DashboardSO />;
      case 'H_T_ASO':
        return <DashboardSR />;

      case 'MT_SO':
        return <DashboardSR />;

      case 'MT_Merchandiser':
        // return <DashboardSO />;
        return <DashboardSR />;

      case 'H_T_SO':
        return <DashboardSO />;
      case 'distributor':
      case 'db':
        return <DashboardDB />;
      case 'area sales manager':
      case 'asm':
        return <DashboardSP />;
      case 'self':
        return <DashboardSP />
      case 'sales rep':
        return <DashboardSR />
      default:
        return <DashboardSR />;
    }
  };

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return getDashboardForRole();
      case 'Profile':
        return <PlaceholderScreen name={activeTab} />;
      case 'Beat Plan':
        return <BeatPlanning />;
      case 'Rocket':
        return <ObjectList title={"Retailer Onboarding"} objectName={"Account"} subObject={'Retailer'} />;
      case 'Competitor':
        return <ObjectList title={"Competitors"} objectName={"Competitor_LineItem__c"} />
      case 'SR Onboarding':
        return <SROnboardingForm />
      case 'Notifications':
        return <PlaceholderScreen name={activeTab} />;
      case 'stock':
        return <SelectionScreen name={activeTab} />;
      case 'Activity':
        return <SelectActivity />;
      case 'SubDBOnboarding':
        return <ObjectList title={"SubDB Onboarding"} objectName={"Account"} subObject={'Sub Distributor'} />;
      case 'StockCheck':
        // return navigaiton.navigate('ASOStockCheck',{'from':'tab'});
        // return <ASOStockCheck fromset={'tab'} />;
        return <SubDBInfo />;
      default:
        return <PlaceholderScreen name={activeTab} />;
    }
  };

  return (
    <View key={`${activeTab}-${refreshKey}`} style={{
      flex: 1,
      overflow: 'hidden',
      paddingBottom: 60,
      // borderRadius: 20,
      ...(activeTab !== 'Activity' && {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
      }),
    }}>
      {renderScreen()}
    </View>
  );
};

export default ScreenSwitcher;