import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, LayoutAnimation, Platform, UIManager, ScrollView, Modal, Dimensions, Pressable, Animated } from 'react-native';
import Ionicons from "./Ionicons";
import LinearGradient from 'react-native-linear-gradient';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { getGamificationMasterFromAPI } from '../UtilityMain/GetAndStoreData/getGamificationMaster.js';
import { getGamificationTransactionHNT } from '../UtilityMain/GetAndStoreData/getGamificationTransaction.js'
import { getGamificationRewardHNT } from '../UtilityMain/GetAndStoreData/getGamificationReward.js'
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { syncGamificationTransactionRecord } from '../database/dbService/AllDataSync';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from '../redux/store';
import { getGamificationRankFromAPI } from '../UtilityMain/GetAndStoreData/getGamificationRank.js'
import { isInternetAvailable } from '../utils/networkUtils';
import { showToast } from '../redux/slices/toastSlice';
import { useNavigation } from '@react-navigation/native';
const SCREEN = Dimensions.get('window');
import ConfettiModal from './ConfettiModal';
import AsyncStorage from '@react-native-async-storage/async-storage';


/* Enable animation on Android */
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* 🥇 Medal Images */
const badgesImg = {
  1: require('../assets/images/badges/goldbadge.png'),
  2: require('../assets/images/badges/silverbadge.png'),
  3: require('../assets/images/badges/bronzebadge.png'),
};

const primaryColor = '#C9A24D';
const getFirstName = (name = '') => name.split(' ')[0];

export default function Leaderboard() {
  const [userRewardPoints, setUserRewardPoints] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentGameName, setCurrentGameName] = useState('');
  const [openBadges, setOpenBadges] = useState({});
  const [currentUserOverAllData, setCurrentUserOverAllData] = useState([]);
  // Modal state for expanded card
  const [modalVisible, setModalVisible] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation()

  const initialBadgeRef = useRef({
    badge: null,
    confetti: null,
  });
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const [badgeModalData, setBadgeModalData] = useState({
    badge: '',
    confetti: '',
  });
  const BADGE_STORAGE_KEY = 'LAST_SHOWN_BADGE';



  const badgeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(badgeAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const badgeAnimatedStyle = {
    transform: [
      { translateY: badgeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
      { scale: badgeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
    ],
  };

  const openModal = item => {
    LayoutAnimation.easeInEaseOut();
    setModalItem(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    LayoutAnimation.easeInEaseOut();
    setModalVisible(false);
    setModalItem(null);
  };

  useEffect(() => {
    (async () => {
      await loadLeaderboard();
      await handleManualRefresh();
    })();
  }, []);

  useEffect(() => {
    const s = currentUserOverAllData?.[0];
    if (!s)
      return Animated.timing(progressAnim, { toValue: 0, duration: 400, useNativeDriver: false }).start();

    const p = +s.totalPoints || 0;
    const t = +s.nextRankPoints || Math.max(Math.ceil((p + 1) / 100) * 100, p + 100);

    Animated.timing(progressAnim, {
      toValue: t ? Math.min(1, p / t) : 0,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [currentUserOverAllData]);


  const loadLeaderboard = async () => {
    try {
      const users = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });
      const userId = users?.[0]?.Sf_Id;
      if (!userId) return;

      const tx = await UniversalUpdateInsert({
        ObjectName: 'Gamification_Transaction__c',
        Type: 'get',
        filters: [{ field: 'Transaction_Type__c', value: 'Credit' }],
      });

      const total = Array.isArray(tx)
        ? tx.reduce((s, t) => t?.User__c === userId ? s + (+t?.Points_Earned__c || 0) : s, 0)
        : 0;

      setUserRewardPoints(total);

      const [masters, ranking] = await Promise.all([
        UniversalUpdateInsert({ ObjectName: 'Gamification_Master__c', Type: 'get' }),
        UniversalUpdateInsert({ ObjectName: 'GamificationRank', Type: 'get' }),
      ]);

      setCurrentGameName(masters?.[0]?.Gamification_Label__c || '');

      const raw = ranking?.[0]?.RankData;
      const rank = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};

      setLeaderboard(Array.isArray(rank.masterLeaderboard) ? rank.masterLeaderboard : []);
      setCurrentUserOverAllData(rank.currentUserSummary ? [rank.currentUserSummary] : []);

      const summary = rank.currentUserSummary;
      return summary; // IMPORTANT


    } catch (e) {
      console.error('Leaderboard error', e);
      setLeaderboard([]);
      return null;
    }
  };


  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      // 1️⃣ Fresh data fetch
      await getDataRefresh();
      // 2️⃣ Leaderboard se DIRECT fresh summary lo
      const summary = await loadLeaderboard();
      if (!summary?.badgeConfity) return;
      const latestBadge = Object.keys(summary.badgeConfity)[0];
      const latestConfetti = summary.badgeConfity[latestBadge];
      if (!latestBadge) return;
      // 3️⃣ Last shown badge (persistent)
      const stored = await AsyncStorage.getItem(BADGE_STORAGE_KEY);
      const lastShown = stored ? JSON.parse(stored) : null;
      const isNewBadge =
        !lastShown ||
        lastShown.badge !== latestBadge ||
        lastShown.confetti !== latestConfetti;
      // 4️⃣ Show modal only if truly new
      if (isNewBadge) {
        setBadgeModalData({
          badge: latestBadge,
          confetti: latestConfetti,
        });
        setBadgeModalVisible(true);
        // 5️⃣ Save as last shown
        await AsyncStorage.setItem(
          BADGE_STORAGE_KEY,
          JSON.stringify({
            badge: latestBadge,
            confetti: latestConfetti,
          })
        );
      }

    } catch (e) {
      console.log('Manual refresh error', e);
    } finally {
      setIsRefreshing(false);
    }
  };




  const dispatch = useDispatch();
  const { accessToken, instanceUrl } = useSelector(state => state.auth);
  const { fetchRecords, apiFetch } = useApiFetch()
  const getDataRefresh = async () => {
    if (!accessToken || !instanceUrl) {
      // alert("Missing Credentials", "Access token or instance URL is not provided.");
      dispatch(showToast({
        message: 'Access token or instance URL is not provided.',
        type: 'warning'
      }));
      return;
    }
    const connected = await isInternetAvailable();

    if (connected) {
      const loggedInUser = await UniversalUpdateInsert({
        ObjectName: 'User',
        Type: 'get',
      });
      const userId = loggedInUser[0]?.Sf_Id
      const creds = { accessToken, instanceUrl, userId };
      await syncGamificationTransactionRecord(apiFetch)
      await UniversalUpdateInsert({ ObjectName: 'Gamification_Master__c', Type: "delete_all" });
      await UniversalUpdateInsert({ ObjectName: 'Gamification_Transaction__c', Type: "delete_all" });
      await UniversalUpdateInsert({ ObjectName: 'Gamification_Reward_Master__c', Type: "delete_all" });
      await UniversalUpdateInsert({ ObjectName: 'GamificationRank', Type: "delete_all" });
      const getGamificationMasterResult = await getGamificationMasterFromAPI({
        creds,
        apiFetch,
        loggedInUser: loggedInUser[0],
      });
      const GamificationTransactionResult = await getGamificationTransactionHNT({
        fetchRecords,
        accessToken,
        instanceUrl,
        loggedInUser: loggedInUser[0],
      });
      const GamificationRewardResult = await getGamificationRewardHNT({
        fetchRecords,
        accessToken,
        instanceUrl,
        loggedInUser: loggedInUser[0],
      });
      const GamificationRankResult = await getGamificationRankFromAPI({
        creds,
        apiFetch,
        loggedInUser: loggedInUser[0],
      });
    } else {
      dispatch(showToast({
        message: 'No internet connection to get latest data for gamification...',
        type: 'warning'
      }));
    }
  }



  /* ================= Render Leaderboard Item ================= */
  const renderItem = ({ item }) => {
    if (!item) return null;

    const isTop3 = item.rank <= 3,
      badges = Array.isArray(item.badges) ? item.badges : [],
      isOpen = openBadges[item.rank],
      avatarColors =
        item.rank === 1 ? ['#FFD700', '#FFE87C']
          : item.rank === 2 ? ['#C0C0C0', '#D9D2C3']
            : item.rank === 3 ? ['#CD7F32', '#E2A678']
              : ['#3B5BB5', '#60A5FA'];

    return (
      <LinearGradient colors={['#dde4faff', '#EEF4FF']} style={styles.futureCard}>
        <LinearGradient colors={avatarColors} style={styles.avatarRing}>
          <View style={styles.avatarWrapper}>
            {isTop3
              ? <Image source={badgesImg[item.rank]} style={styles.avatar} resizeMode="cover" />
              : <Ionicons name="person" size={34} color="#fff" />
            }
          </View>

          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{item.rank}</Text>
          </View>
        </LinearGradient>

        <Text style={styles.name}>{getFirstName(item.userName || 'User')}</Text>

        <LinearGradient colors={['#C9A24D', '#C9A24D']} style={styles.pointsPill}>
          <Text style={styles.pointsText}>{item.points ?? 0}</Text>
        </LinearGradient>

        <TouchableOpacity onPress={() => openModal(item)} style={styles.badgeToggle}>
          <Text style={styles.badgeToggleText}>
            {badges.length === 0 ? 'No badges' : isOpen ? 'Hide Badges' : 'View Badges'}
          </Text>
          {badges.length > 0 && (
            <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={primaryColor} />
          )}
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.badgeWrap}>
            {badges.length > 0 ? badges.map((b, i) => (
              <LinearGradient key={i} colors={['#DBEAFE', '#BFDBFE']} style={styles.badgeChip}>
                <Text style={styles.badgeText}>{b}</Text>
              </LinearGradient>
            )) : <Text style={styles.noBadgeText}>No badges earned yet</Text>}
          </View>
        )}
      </LinearGradient>
    );
  };



  const renderOverallSummary = () => {
    if (!currentUserOverAllData || currentUserOverAllData.length === 0) return null;

    const summary = currentUserOverAllData[0],
      totalPoints = Number(summary.totalPoints || 0),
      userRank = summary.rank ?? '-',
      badges = Array.isArray(summary.badges) ? summary.badges : [],
      topBadges = badges.slice(0, 6),
      challenges = summary.challengesCompleted ?? summary.challengeCount ?? '-',
      nextThreshold = Number(summary.nextRankPoints || Math.max(Math.ceil((totalPoints + 1) / 100) * 100, totalPoints + 100)),
      progressFraction = nextThreshold > 0 ? Math.min(1, totalPoints / nextThreshold) : 0,
      animatedWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      badgeConfityObj = summary?.badgeConfity || {},
      firstBadge = Object.keys(badgeConfityObj)[0],
      firstBadgeConfetti = badgeConfityObj[firstBadge];

    return (
      <View style={styles.attractiveCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardHeading}>Your Overall Game Summary</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <LinearGradient colors={['#FCD34D', '#F59E0B']} style={styles.summaryAvatar}>
                  <Ionicons name="trophy" size={28} color="#fff" />
                </LinearGradient>

                <View style={{ marginLeft: 15 }}>
                  <Text style={styles.smallLabel}>Total Points</Text>
                  <Text style={styles.totalPointsTextBig}>{totalPoints}</Text>
                </View>

                <View style={{ marginLeft: 30 }}>
                  <Text style={styles.smallLabel}>Badges</Text>
                  <Text style={styles.totalPointsTextBig}>{badges.length}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {firstBadge && firstBadgeConfetti && (
          <Animated.View style={badgeAnimatedStyle}>
            <LinearGradient
              colors={['#FFF8E1', '#FFE9A8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ padding: 14, borderRadius: 16, marginTop: 6, marginBottom: 12 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#8A4B0F' }}>🎖 {firstBadge}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B3A0A', marginTop: 6, lineHeight: 18 }}>
                {firstBadgeConfetti}
              </Text>
            </LinearGradient>
          </Animated.View>
        )}

        <Text style={[styles.badgesTitle, { marginTop: 0 }]}>Top Badges</Text>

        {badges.length > 0 ? (
          <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' }}>
            {badges.map((b, i) => (
              <LinearGradient key={i} colors={['#DBEAFE', '#BFDBFE']} style={styles.badgeChipAttractiveSmall}>
                <Text style={styles.badgeTextAttractiveSmall}>{b}</Text>
              </LinearGradient>
            ))}
          </View>
        ) : (
          <Text style={styles.noBadgeTextAttractive}>No badges yet — keep going!</Text>
        )}
      </View>
    );
  };



  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: '#f2f3f4ff', paddingBottom: 10, borderRadius: 20, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>Gamification Section</Text>
          <TouchableOpacity onPress={handleManualRefresh} disabled={isRefreshing} style={styles.refreshBtn}>
            <Ionicons name={isRefreshing ? 'sync' : 'refresh'} size={20} color="#C9A24D" />
          </TouchableOpacity>
        </View>

        {/* Award Points Card */}
        <LinearGradient colors={['#eaeffdff', '#F8F9FB']} style={styles.headerCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient colors={['#FCD34D', '#F59E0B']} style={styles.trophyWrap}>
              <Ionicons name="trophy" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerText}>Your Award Points</Text>
              {currentGameName ? <Text style={styles.gameNameText}>{currentGameName}</Text> : null}
            </View>
          </View>
          <LinearGradient colors={['#C9A24D', '#C9A24D']} style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeText}>{userRewardPoints}</Text>
          </LinearGradient>
        </LinearGradient>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>Top Ranking in {currentGameName}</Text>
              <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('RedeemReward')}>
                <Text style={styles.primaryActionText}>Redeem</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={leaderboard}
              horizontal
              renderItem={renderItem}
              keyExtractor={(item, i) => `${item.rank}-${i}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        )}

        {renderOverallSummary()}
      </ScrollView>

      {/* ========= Expanded Card Modal ========= */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <View style={styles.modalCenter}>
            <View style={styles.modalCard}>
              <TouchableOpacity style={styles.modalClose} onPress={closeModal}>
                <Ionicons name="close" size={20} color="#7A7266" />
              </TouchableOpacity>

              {modalItem && (
                <>
                  <View style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                    <LinearGradient
                      colors={
                        modalItem.rank === 1 ? ['#FFD700', '#FFE87C'] :
                          modalItem.rank === 2 ? ['#C0C0C0', '#D9D2C3'] :
                            modalItem.rank === 3 ? ['#CD7F32', '#E2A678'] :
                              ['#3B5BB5', '#60A5FA']
                      }
                      style={[styles.avatarRing, { padding: 10 }]}
                    >
                      <View style={[styles.avatarWrapper, { width: 80, height: 80, borderRadius: 40 }]}>
                        {modalItem.rank <= 3
                          ? <Image source={badgesImg[modalItem.rank]} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
                          : <Ionicons name="person" size={44} color="#fff" />
                        }
                      </View>
                    </LinearGradient>

                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={[styles.name, { fontSize: 20 }]}>{getFirstName(modalItem.userName || 'User')}</Text>
                      <Text style={{ color: '#7A7266', marginTop: 6 }}>Rank #{modalItem.rank}</Text>
                      <LinearGradient colors={['#C9A24D', '#C9A24D']} style={[styles.pointsPill, { alignSelf: 'flex-start', marginTop: 8 }]}>
                        <Text style={[styles.pointsText, { fontSize: 18 }]}>{modalItem.points ?? 0}</Text>
                      </LinearGradient>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: '#E6EEF9', marginVertical: 14 }} />

                  <Text style={[styles.badgesTitle, { marginBottom: 8 }]}>Badges</Text>
                  <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
                    {Array.isArray(modalItem.badges) && modalItem.badges.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {modalItem.badges.map((b, i) => (
                          <LinearGradient key={i} colors={['#DBEAFE', '#BFDBFE']} style={[styles.badgeChip, { marginRight: 8, marginBottom: 8 }]}>
                            <Text style={styles.badgeText}>{b}</Text>
                          </LinearGradient>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noBadgeText}>No badges earned yet</Text>
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      <ConfettiModal
        visible={badgeModalVisible}
        onClose={() => setBadgeModalVisible(false)}
        badge={badgeModalData.badge}
        confetti={badgeModalData.confetti}
        styles={styles}
      />

    </>
  );

}

/* ================= Styles ================= */
const styles = StyleSheet.create({
  futureCard: { width: 160, borderRadius: 22, padding: 16, marginRight: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, backgroundColor: '#fff', elevation: 2, margin: 1 },
  avatarRing: { padding: 6, borderRadius: 999 },
  avatarWrapper: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' },
  avatar: { width: '100%', height: '100%', borderRadius: 32 },
  rankBadge: { position: 'absolute', bottom: -6, right: -6, backgroundColor: primaryColor, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: '#fff', fontWeight: '800' },
  name: { marginTop: 6, fontSize: 15, fontWeight: '800', color: '#A67C2E' },
  pointsPill: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  pointsText: { color: '#fff', fontWeight: '800' },
  badgeToggle: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeToggleText: { fontSize: 12, fontWeight: '700', color: primaryColor },
  badgeWrap: { marginTop: 6, alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  badgeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#1E3A8A' },
  noBadgeText: { fontSize: 11, color: '#7A7266', fontWeight: '600' },

  attractiveCard: { backgroundColor: '#eaeffdff', borderRadius: 20, padding: 20, paddingVertical: 15, marginHorizontal: 10, marginTop: 10, shadowColor: '#000', shadowOffset: { width: 1, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3, marginBottom: 10 },
  topBadgesContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 12 },
  medalCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  medalText: { fontSize: 10, fontWeight: '700', color: '#A67C2E', textAlign: 'center' },
  userInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 8 },
  userLabel: { fontSize: 14, fontWeight: '600', color: '#7A7266' },
  userValue: { fontSize: 14, fontWeight: '800', color: '#1E3A8A' },
  totalPointsPill: { paddingHorizontal: 20, paddingVertical: 5, borderRadius: 999, alignSelf: 'center', marginBottom: 0 },
  totalPointsText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  badgesTitle: { fontSize: 15, fontWeight: '700', color: '#A67C2E', marginBottom: 6 },
  badgeChipAttractive: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, marginRight: 10 },
  badgeTextAttractive: { fontSize: 12, fontWeight: '700', color: '#1E3A8A' },
  noBadgeTextAttractive: { fontSize: 12, fontWeight: '600', color: '#7A7266' },

  headerCard: { padding: 16, width: '95%', flexDirection: 'row', justifyContent: 'space-between', borderRadius: 16, margin: 12, marginVertical: 6, backgroundColor: '#fff', elevation: 4 },
  trophyWrap: { padding: 8, borderRadius: 999, marginRight: 10 },
  headerText: { fontSize: 17, fontWeight: '700', color: '#A67C2E' },
  pointsBadge: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  pointsBadgeText: { fontSize: 19, fontWeight: '800', color: '#fff' },
  gameNameText: { fontSize: 13, fontWeight: '600', color: '#7A7266', marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginLeft: 1, marginBottom: 0, color: '#000' },
  refreshBtn: { padding: 6, marginBottom: 6, borderRadius: 20, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCenter: { width: '100%', alignItems: 'center' },
  modalCard: { width: Math.min(SCREEN.width - 120, 480), maxHeight: SCREEN.height * 0.85, backgroundColor: '#fff', borderRadius: 18, padding: 18, elevation: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  modalClose: { position: 'absolute', top: 10, right: 10, zIndex: 10, padding: 6, borderRadius: 20, backgroundColor: '#F1EADB' },
  summaryAvatar: { width: 64, height: 64, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginRight: 10, elevation: 3 },
  cardHeading: { fontSize: 18, fontWeight: '600', color: '#1F1D1A', marginBottom: 0 },
  totalPointsTextBig: { fontSize: 20, fontWeight: '900', color: '#0b3b91' },
  subText: { color: '#7A7266', marginTop: 4, fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  statChip: { backgroundColor: '#fff', borderRadius: 12, width: 100, paddingVertical: 8, paddingHorizontal: 10, marginRight: 8, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 },
  statLabel: { fontSize: 11, color: '#7A7266', fontWeight: '700' },
  statValue: { fontSize: 16, fontWeight: '900', color: '#A67C2E', marginTop: 6 },
  primaryAction: { backgroundColor: '#C9A24D', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#13265C', fontSize: 12, fontWeight: '800' },
  badgeChipAttractiveSmall: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, marginTop: 6 },
  badgeTextAttractiveSmall: { fontSize: 12, fontWeight: '800', color: '#0f3b91' },
  smallLabel: { color: '#333', fontWeight: '700' }
});

