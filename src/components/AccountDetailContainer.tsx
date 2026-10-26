import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import StoreScreen from './StoreScreen';
import TakeOrder from '../screens/TakeOrderScreen';
import CollectionScreen from '../screens/Collection';
import { useSelector } from 'react-redux';
import HeaderMain from './HeaderMain';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootState } from '../redux/store'; // Make sure your RootState is properly defined
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import AddCompetitorForm from '../screens/AddCompetitorForm'
import SelectionScreen from '../screens/SelectionScreen';
import { useNavigation } from '@react-navigation/native';
import DistributorModal from "./modal/DistributorModal";
import { isInternetAvailable } from '../utils/networkUtils';
import { syncAttendanceRecords } from '../database/dbService/AllDataSync';
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { isDistributorAccount } from '../utils/distributorHelper';

const AccountDetailContainer = ({ route }) => {
  const selectedAccount = useSelector((state: RootState) => state.selectedAccount.selectedAccount);
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const alredyCheckIn = useSelector((state: RootState) => state.checkIn);
  // console.log('selected account ', selectedAccount)
  const navigation = useNavigation();

  const isDistributor = isDistributorAccount(selectedVisit) || isDistributorAccount(selectedAccount);

  const { categorizedData, activetabfromnavigate = null } = route.params || {};
  // console.log(categorizedData, 'categorizedData from account detail container');

  // console.log(selectedVisit, 'selectedVisit from account detail container');
  // console.log('activetabfromnavigate',activetabfromnavigate)
  const [activeTab, setActiveTab] = useState(
    isDistributor ? 'Details' : (route?.params?.activetabfromnavigate || 'Details')
  );
  const [showModal, setShowModal] = useState(false);

  const status = selectedVisit?.VisitStatus__c;
  // 'Spot Sales' is enabled both online and offline even without check in
  let disabledTabs = isDistributor
    ? ['Collections', 'Spot Sales', 'Spot Sales Main', 'Stock', 'Stock Check', 'Competitor']
    : ['Collections', 'Stock'];
  if (!isDistributor && status === 'Check In') {
    // all enabled
    disabledTabs = [];
  } else if (!isDistributor && status === 'Check Out') {
    disabledTabs = ['Collections', 'Stock'];
  }

  useEffect(() => {
    if (isDistributor && activeTab !== 'Details') {
      setActiveTab('Details');
    }
  }, [isDistributor, activeTab]);



  const handleCompetitorAdded = () => {
    // This gets called when a new competitor is added
    // console.log('Competitor was added');
    setActiveTab('Details'); // or any state update logic
  };
  const handlestock = () => {
    setActiveTab('Details');
  };
  const handleCollection = () => {
    setActiveTab('Details');
  };

  // useEffect(() => {
  //   // console.log('🌀 SELECTED ACCOUNT:', selectedAccount);
  //   // console.log('🌀 SELECTED VISIT:', selectedVisit);
  //   setActiveTab('Details')
  // }, [selectedAccount, selectedVisit]);


  // useFocusEffect(
  //   useCallback(() => {
  //     setActiveTab('Details');
  //   }, [selectedAccount?.Sf_Id, selectedVisit?.Sf_Id]) // optionally narrow dependencies
  // );

  useFocusEffect(
    useCallback(() => {

      if (route?.params?.activetabfromnavigate) {
        setActiveTab(route.params.activetabfromnavigate);
      } else {
        setActiveTab('Details');
      }

    }, [route?.params?.activetabfromnavigate])
  );


  useEffect(() => {
    if (activeTab === "Spot Sales") {
      setShowModal(true);
    }
  }, [activeTab]);


  const { fetchRecords, apiFetch } = useApiFetch()
  useEffect(() => {
    const checkAndSync = async () => {
      try {
        const connected = await isInternetAvailable();
        if (connected) {
          setTimeout(() => {
            syncAttendanceRecords(apiFetch)
              .then(() => console.log("Sync done"))
              .catch(err => console.error(" Sync error:", err));
          }, 0);
        }
      } catch (err) {
        console.error(" Network check error:", err);
      }
    };
    checkAndSync();
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Details':
        return (
          <StoreScreen
            accountDetailId={selectedAccount?.Sf_Id}
            visitDetail={selectedVisit}
            categorizedData={categorizedData}
          />
        );
      case 'Collections':
        return <CollectionScreen accountDetailId={selectedVisit.AccountId__c} handleCollection={handleCollection} />;

      case 'Spot Sales':
        return (
          <StoreScreen
            accountDetailId={selectedAccount?.Sf_Id}
            visitDetail={selectedVisit}
            categorizedData={categorizedData}
          />
        );
      case 'Spot Sales Main':
        return <TakeOrder />;

      case 'Competitor':
        return <AddCompetitorForm onCompetitorAdded={handleCompetitorAdded} />;
      case 'Stock':
        return <SelectionScreen handlestock={handlestock} />;
      case 'Stock Check':
        return navigation.navigate('ASOStockCheck');
      default:
        return null;
    }
  };





  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      {/* Header with tabs */}
      <View style={styles.headerContainer}>
        <HeaderMain
          screenName="Outlets"
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          disabledTabs={disabledTabs}
        />
      </View>

      {/* Body */}
      <View style={styles.bodyContainer}>
        {renderTabContent()}
      </View>

      {showModal && (
        <DistributorModal
          visible={showModal}
          onClose={() => {
            setShowModal(false);
            setActiveTab('Details');
          }}
          onConfirm={() => {
            setShowModal(false);
            setActiveTab('Spot Sales Main');
          }}
        />
      )}


    </SafeAreaProvider>
  );
};

export default AccountDetailContainer;
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#A67C2E',
  },
  headerContainer: {
    backgroundColor: '#A67C2E',
  },
  bodyContainer: {
    borderTopRightRadius: 30,
    borderTopLeftRadius: 30,
    flex: 1,
    backgroundColor: '#fff',
  },
});