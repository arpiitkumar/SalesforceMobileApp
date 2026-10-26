import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar, Animated, Modal
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "./Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import LoaderOverlay from '../utils/helper/LoaderOverlay'
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import HeaderMain from "./HeaderMain";
import { isInternetAvailable } from '../utils/networkUtils';

/* ================= CONSTANTS ================= */

const TABS = {
  REWARD: "REWARD",
  CREDIT: "CREDIT",
  DEBIT: "DEBIT",
};

/* ================= MAIN COMPONENT ================= */

const RedeemReward = () => {
  const [activeTab, setActiveTab] = useState(TABS.REWARD);

  const { apiFetch } = useApiFetch();
  const [loading, setLoading] = useState(false)

  const [gameName, setGameName] = useState("");
  const [MasterId, setMasterId] = useState("");
  const [TransactionMasterId, setTransactionMasterId] = useState("");
  const [creditList, setCreditList] = useState([]);
  const [debitList, setDebitList] = useState([]);
  const [rewardList, setRewardList] = useState([]);



  const [totalCredit, setTotalCredit] = useState(0);
  const [UserId, setUserId] = useState('');
  const [totalDebit, setTotalDebit] = useState(0);

  const remainingPoints = Number(totalCredit) - Number(totalDebit);

  /* ================= LOAD DATA ================= */

  const loadData = async () => {
    try {
      const users = await UniversalUpdateInsert({
        ObjectName: 'User',
        Type: 'get',
      });
      setUserId(users[0]?.Sf_Id)
      /* -------- MASTER -------- */
      const masters = await UniversalUpdateInsert({
        ObjectName: "Gamification_Master__c",
        Type: "get",
      });

      setGameName(masters?.[0]?.Gamification_Label__c || "");
      setMasterId(masters?.[0]?.Master_Id || "");
      setTransactionMasterId(masters?.[0]?.Transaction_Master_Id || "");

      /* -------- CREDIT -------- */
      const creditRes = await UniversalUpdateInsert({
        ObjectName: "Gamification_Transaction__c",
        Type: "get",
        filters: [{ field: "Transaction_Type__c", value: "Credit" }],
      });

      const creditData = Array.isArray(creditRes) ? creditRes : [];
      setCreditList(creditData);

      setTotalCredit(
        creditData.reduce(
          (sum, i) => sum + Number(i?.Points_Earned__c || 0),
          0
        )
      );

      /* -------- DEBIT -------- */
      const debitRes = await UniversalUpdateInsert({
        ObjectName: "Gamification_Transaction__c",
        Type: "get",
        filters: [{ field: "Transaction_Type__c", value: "Debit" }],
      });

      const debitData = Array.isArray(debitRes) ? debitRes : [];
      setDebitList(debitData);

      setTotalDebit(
        debitData.reduce(
          (sum, i) => sum + Number(i?.Points_Redeem__c || 0),
          0
        )
      );

      /* -------- REWARDS -------- */
      const rewardRes = await UniversalUpdateInsert({
        ObjectName: "Gamification_Reward_Master__c",
        Type: "get",
        filters: [{ field: "Active__c", value: true }],
      });

      setRewardList(Array.isArray(rewardRes) ? rewardRes : []);
    } catch (error) {
      console.log("Load error:", error);
    }
  };

  /* 🔄 REFRESH ON SCREEN FOCUS */
  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      if (mounted) loadData();

      return () => {
        mounted = false;
      };
    }, [])
  );


  /* ================= UI HELPERS ================= */

  const EmptyState = ({ icon, text }) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={42} color="#B0B4C0" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  /* ---------- REWARD CARD ---------- */
  const RewardCard = ({ item = {} }) => {
    const required = Number(item?.Required_Point__c || 0);
    const canRedeem = remainingPoints >= required;

    return (
      <LinearGradient
        colors={["#FFFFFF", "#F5F7FF"]}
        style={styles.rewardCard}
      >
        <View style={styles.rewardTop}>
          <View style={styles.rewardIcon}>
            <Ionicons name="gift" size={20} color="#A67C2E" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.rewardTitle}>
              {item?.Reward_Type__c || "Reward"}
            </Text>
            <Text style={styles.rewardSub}>
              Needs {required} pts
            </Text>
          </View>

          <View
            style={[
              styles.statusDot,
              { backgroundColor: canRedeem ? "#2FBF71" : "#CBD1E1" },
            ]}
          />
        </View>

        <TouchableOpacity
          disabled={!canRedeem}
          // onPress={() =>
          //   console.log("Redeem:", item?.Sf_Id, required)
          // }
          onPress={() => handleRedeemReward(item?.Sf_Id, required)}
          style={[
            styles.redeemBtn,
            { backgroundColor: canRedeem ? "#A67C2E" : "#D1D5DB" },
          ]}
        >
          <Text style={styles.redeemText}>
            {canRedeem ? "Redeem Reward" : "Locked"}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  };

  /* ---------- TRANSACTION CARD ---------- */
  const TransactionCard = ({ item = {}, type }) => {
    const isCredit = type === "CREDIT";
    const points = Number(
      isCredit ? item?.Points_Earned__c : item?.Points_Redeem__c
    );

    return (
      <View style={styles.txnCard}>
        <View
          style={[
            styles.txnAccent,
            { backgroundColor: isCredit ? "#2FBF71" : "#E63946" },
          ]}
        />

        <Ionicons
          name={isCredit ? "arrow-down-circle" : "arrow-up-circle"}
          size={22}
          color={isCredit ? "#2FBF71" : "#E63946"}
          style={{ marginRight: 10 }}
        />

        <View style={{ flex: 1 }}>
          <Text style={styles.txnTitle}>
            {item?.Category__c || "Transaction"}
          </Text>
        </View>

        <Text
          style={[
            styles.txnPointRight,
            { color: isCredit ? "#2FBF71" : "#E63946" },
          ]}
        >
          {isCredit ? "+" : "-"} {points} pts
        </Text>
      </View>
    );
  };


  const generateRandomOrderNumber = () => {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${timestamp}-${randomSuffix}`;
  };


  // inside RedeemReward component
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalEmoji, setModalEmoji] = useState("");
  const bounceAnim = useState(new Animated.Value(0))[0]; // animation value

  const triggerModal = (success = true) => {
    setModalEmoji(success ? "🎉" : "");
    setModalMessage(success ? "Congratulation Reward Redeemed Successfully!" : "Failed to Redeem!");
    setShowModal(true);

    bounceAnim.setValue(0);
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // hide after 2 sec
    setTimeout(() => setShowModal(false), 3000);
  };

  // updated handleRedeemReward
  const handleRedeemReward = async (rewardId, points) => {
    try {
      setLoading(true);
      const connected = await isInternetAvailable();
      let finalSfId = generateRandomOrderNumber(); // Default local ID
      const payloadLocal = {
        Sf_Id: finalSfId,
        User__c: UserId,
        Gamification_Master__c: MasterId,
        Gamification_Reward_Master__c: rewardId,
        Points_Redeem__c: points,
        Transaction_Type__c: "Debit",
        Gamification_Transaction_Master__c: TransactionMasterId,
        is_locally_changed: true,
        is_synced: false,
        sync_status: 'unsynced',
        operation_type: "insert",
        last_modified: Date.now(),
      };
      let success = true; // assume success unless error
      if (connected) {
        try {
          const apiPayload = {
            apiName: 'Gamification_Transaction__c',
            fields: {
              User__c: UserId,
              Gamification_Master__c: MasterId,
              Gamification_Reward_Master__c: rewardId,
              Points_Redeem__c: points,
              Transaction_Type__c: "Debit",
              Gamification_Transaction_Master__c: TransactionMasterId,
            }
          };
          // console.log('apiResp', JSON.stringify(apiResp))
          if (apiResp?.status === "success") {
            finalSfId =
              apiResp?.data?.id ||
              apiResp?.data?.sfId ||
              apiResp?.data?.Sf_Id ||
              apiResp?.body?.id ||
              apiResp?.body?.sfId ||
              finalSfId;

            payloadLocal.Sf_Id = finalSfId;
            payloadLocal.is_locally_changed = false;
            payloadLocal.is_synced = true;
          } else {
            success = false;
          }
        } catch (e) {
          success = false;
        }
      }

      console.log('payloadLocal', payloadLocal)
      await UniversalUpdateInsert({
        ObjectName: "Gamification_Transaction__c",
        Type: "insert",
        data: payloadLocal,
      });

      triggerModal(true);
      // triggerModal(success);

      loadData(); // refresh UI
    } catch (error) {
      console.log("Redeem Reward Error:", error);
      triggerModal(false);
    } finally {
      setLoading(false);
    }
  };



  /* ================= RENDER ================= */

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      <View style={{ backgroundColor: "#A67C2E" }}>
        <HeaderMain screenName="Rewards" />
      </View>

      {/* SUMMARY */}
      <LinearGradient colors={["#A67C2E", "#3B5BB5"]} style={styles.topCard}>
        <Text style={styles.gameName}>{gameName || "Gamification"}</Text>

        <View style={styles.pointRow}>
          <Summary label="Credit" value={totalCredit} />
          <Summary label="Debit" value={totalDebit} />
          <Summary label="Balance" value={remainingPoints} />
        </View>
      </LinearGradient>

      {/* TABS */}
      <View style={styles.tabRow}>
        {Object.values(TABS).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, activeTab === tab && styles.activeTab]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        {activeTab === TABS.REWARD &&
          (rewardList.length ? (
            <FlatList
              data={rewardList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <RewardCard item={item} />}
              keyExtractor={(i, idx) => i?.id || String(idx)}
            />
          ) : (
            <EmptyState icon="gift-outline" text="No rewards yet" />
          ))}

        {activeTab === TABS.CREDIT &&
          (creditList.length ? (
            <FlatList
              data={creditList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TransactionCard item={item} type="CREDIT" />
              )}
              keyExtractor={(i, idx) => i?.id || String(idx)}
            />
          ) : (
            <EmptyState icon="add-circle-outline" text="No credit history" />
          ))}

        {activeTab === TABS.DEBIT &&
          (debitList.length ? (
            <FlatList
              data={debitList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TransactionCard item={item} type="DEBIT" />
              )}
              keyExtractor={(i, idx) => i?.id || String(idx)}
            />
          ) : (
            <EmptyState icon="remove-circle-outline" text="No debit history" />
          ))}
      </View>
      <LoaderOverlay visible={loading} />
      {/* ======= MODAL ======= */}
      <Modal transparent visible={showModal} animationType="fade">
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>
          <Animated.View style={{
            backgroundColor: '#fff',
            padding: 30,
            borderRadius: 20,
            alignItems: 'center',
            transform: [{ scale: bounceAnim }],
            elevation: 5,
          }}>
            <Text style={{ fontSize: 50 }}>{modalEmoji}</Text>
            <Text style={{ marginTop: 10, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
              {modalMessage}
            </Text>
          </Animated.View>
        </View>
      </Modal>

    </SafeAreaProvider>
  );
};

/* ================= SUMMARY ================= */

const Summary = ({ label = "", value = 0 }) => (
  <View style={{ alignItems: "center" }}>
    <Text style={{ color: "#DCE3FF", fontSize: 12 }}>{label}</Text>
    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>
      {Number(value)}
    </Text>
  </View>
);

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F6FB" },

  topCard: {
    padding: 18,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },

  gameName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },

  pointRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    margin: 14,
    borderRadius: 14,
    overflow: "hidden",
  },

  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },

  activeTab: {
    backgroundColor: "#A67C2E",
  },

  tabText: {
    color: "#A67C2E",
    fontWeight: "600",
    fontSize: 13,
  },

  activeTabText: {
    color: "#fff",
  },

  content: {
    flex: 1,
    paddingHorizontal: 14,
  },

  rewardCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    marginHorizontal: 10,
    elevation: 5,
  },

  rewardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  rewardIcon: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: "#E8EEFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  rewardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1D1A",
  },

  rewardSub: {
    fontSize: 12,
    color: "#7A7266",
  },

  statusDot: {
    height: 10,
    width: 10,
    borderRadius: 5,
  },

  redeemBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },

  redeemText: {
    color: "#fff",
    fontWeight: "700",
  },

  txnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    elevation: 3,
    marginHorizontal: 10,
  },

  txnAccent: {
    width: 5,
    height: "100%",
    borderRadius: 5,
    marginRight: 10,
  },

  txnTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  txnPointRight: {
    fontSize: 14,
    fontWeight: "700",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyText: {
    marginTop: 12,
    color: "#7A7266",
    fontSize: 15,
  },
});

export default RedeemReward;
