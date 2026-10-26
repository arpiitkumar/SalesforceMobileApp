import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ASOStockCheck from "./ASOStockCheck";
import SalesReturnMain from "./SalesReturn/SalesReturnMain";
import SubDBDetial from '../components/SubDBDetail'
import DistributorModal from "../components/modal/DistributorModal";
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { useSelector, useDispatch } from 'react-redux';
import { setDistributorId, clearDistributorId } from '../redux/slices/distributorSlice';
 
// Dummy Components
const Details = () => <SubDBDetial />;
const StockCheck = () => <ASOStockCheck fromset={"tab"} />;
 
const SubDBInfo = () => {
  const [activeTab, setActiveTab] = useState("Details Before");
  const [showModal, setShowModal] = useState(false);
  const [salesReturnVisible, setSalesReturnVisible] = useState(false);
 
  const renderComponent = () => {
    switch (activeTab) {
      case "Details":
        return <Details />;
      case "Stock":
        return <StockCheck />;
      case "Stock Before":
        return <Details />;
        case "Details Before":
        return <Text style={{ fontSize: 16 }}>Details</Text>;
      case "Return":
        return <Text style={{ fontSize: 16 }}>Return Component</Text>;
      default:
        return <Details />;
    }
  };
 
  const dispatch = useDispatch();
  const { id: beatId } = useSelector((state) => state.beatSelection);
  const selectedVisit = useSelector((state) => state.selectedVisit);
  console.log('selectedVisit in SubDBInfo', selectedVisit);
  console.log('selectedVisit in SubDBInfo', beatId);
  useEffect(() => {
    const setDistibuter = async () => {
      const loggedInUser = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get"
      });
      console.log(' loggedInUser[0]?.Sf_Id', loggedInUser[0]?.Sf_Id)
      const disData = await UniversalUpdateInsert({
        ObjectName: "SR_Beat_Assignment__c",
        Type: "get",
        filters: [
          { field: "Assigned_To__c", value: loggedInUser[0]?.Sf_Id },
          { field: "Beat__c", value: beatId || selectedVisit?.Beat__c  },
        ],
      });
      console.log('------------------------------',disData[0]?.Distributor__c)
      console.log('------------------------------',disData[0])
      dispatch(setDistributorId(disData[0]?.Distributor__c));
      if (activeTab === "Stock Before") {
        setShowModal(false);
        setActiveTab('Stock');
      } else {
        setActiveTab('Details');
      }
 
      // setShowModal(true);
    }
 
    if (activeTab === "Stock Before" || activeTab === "Details Before") {
      setDistibuter()
    }
  }, [activeTab]);
 
 
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: "#A67C2E" }}>
      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
      >
        <View style={{ flex: 1 }}>
          {/* Tabs */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              padding: 16,
              paddingBottom: 0,
            }}
          >
            {/* Tab: Details */}
            <TouchableOpacity onPress={() => setActiveTab("Details")}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: activeTab === "Details" ? "bold" : "normal",
                  color: activeTab === "Details" ? "#A67C2E" : "#555",
                  borderBottomWidth: activeTab === "Details" ? 2 : 0,
                  borderBottomColor: "#A67C2E",
                  paddingBottom: 4,
                }}
              >
                Details
              </Text>
            </TouchableOpacity>
 
            {/* Tab: Stock Check */}
            <TouchableOpacity onPress={() => setActiveTab("Stock Before")}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: activeTab === "Stock" ? "bold" : "normal",
                  color: activeTab === "Stock" ? "#3B5BB5" : "#555",
                  borderBottomWidth: activeTab === "Stock" ? 2 : 0,
                  borderBottomColor: "#3B5BB5",
                  paddingBottom: 4,
                }}
              >
                Stock Check
              </Text>
            </TouchableOpacity>
 
            {/* Tab: Return */}
            <TouchableOpacity
              onPress={() => {
                // setActiveTab("Return");
                setSalesReturnVisible(true);
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: activeTab === "Return" ? "bold" : "normal",
                  color: activeTab === "Return" ? "#3B5BB5" : "#555",
                  borderBottomWidth: activeTab === "Return" ? 2 : 0,
                  borderBottomColor: "#3B5BB5",
                  paddingBottom: 4,
                }}
              >
                Return
              </Text>
            </TouchableOpacity>
          </View>
 
          {/* Separator line below tabs */}
          <View
            style={{
              height: 1,
              backgroundColor: "#ddd",
              marginHorizontal: 12,
              marginTop: 8,
              marginBottom: 12,
            }}
          />
 
          {/* Tab Content */}
          <View style={{ flex: 1, paddingHorizontal: 0 }}>
            {renderComponent()}
          </View>
        </View>
      </View>
 
      {/* Sales Return Modal / Component */}
      <SalesReturnMain
        visible={salesReturnVisible}
        onClose={() => setSalesReturnVisible(false)}
        fromset={"SubDB"}
 
      />
 
 
      {showModal && (
        <DistributorModal
          visible={showModal}
          onClose={() => {
            setShowModal(false);
            setActiveTab('Details');
          }}
          onConfirm={() => {
            setShowModal(false);
            setActiveTab('Stock');
          }}
        />
      )}
    </SafeAreaProvider>
  );
};
 
export default SubDBInfo;