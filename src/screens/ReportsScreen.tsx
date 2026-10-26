import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HeaderMain from "../components/HeaderMain";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";

const { width } = Dimensions.get('window');

// Theme gradients (user provided)
const GRADIENT = ['#1E3A8A', '#153D8E'];

const srReports = [
  { id: 'sr', title: 'SR Attendance', subtitle: 'Detailed Attendance Reports Today, Yesterday and Monthly', route: 'SRAttendanceScreen', icon: 'account-clock' },
  { id: 'outletDetail', title: 'Outlet Details', subtitle: 'Outlet Detail - MBO, Non Buying outlets details', route: 'OutletDetailReport', icon: 'store' },
  { id: 'loc', title: 'Location', subtitle: 'Geolocation report', route: 'LocationReport', icon: 'map-marker-path' },
];

const merchandiserReports = [
  { id: 'attendance', title: 'Attendance Report', subtitle: 'Detailed Attendance Reports with flexible columns', route: 'SRAttendanceScreen', icon: 'account-clock' },
  { id: 'visit', title: 'Visit Report', subtitle: 'Visit details with check-in/out info', route: 'VisitReport', icon: 'map-marker-check' },
];

const ReportsListScreen = () => {
  const navigation = useNavigation();
  const [reports, setReports] = React.useState(srReports);

  React.useEffect(() => {
    (async () => {
      try {
        const users = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });
        const role = users?.[0]?.DeveloperName || '';
        if (role === 'MT_Merchandiser') {
          setReports(merchandiserReports);
        } else {
          setReports(srReports);
        }
      } catch (e) {
        setReports(srReports);
      }
    })();
  }, []);

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate(item.route)}
      style={styles.itemWrapper}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} report`}
    >
      {/* <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}> */}
      <View style={[{ backgroundColor: '#EAF3FF' }, styles.card]}>
        <View style={styles.iconWrap}>
          <LinearGradient colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.06)"]} style={styles.iconBg}>
            <MaterialCommunityIcons name={item.icon} size={28} color="#333" />
          </LinearGradient>
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>

        <View style={styles.chevWrap}>
          <MaterialCommunityIcons name="chevron-right" size={28} color="#333" />
        </View>
      </View>
      {/* </LinearGradient> */}
    </TouchableOpacity>
  );

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      <View style={styles.headerContainer}>
        <HeaderMain screenName="Reports" />
      </View>
      <View style={styles.content}>

        {/* <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
        <Text style={styles.headerSubtitle}>Tap a report to view details</Text>
      </View> */}

        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
        />
      </View>

    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FB', padding: 20 },

  container: { flex: 1 },
  content: {
    flex: 1,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#ffffff",
  },
  headerContainer: {
    backgroundColor: "transparent",
  },
  header: { marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#1F1D1A', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#6B7B8A' },
  list: { paddingVertical: 8 },
  itemWrapper: {},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  iconWrap: { marginRight: 12 },
  iconBg: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  textWrap: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: '#333' },
  subtitle: { fontSize: 12, color: '#333', marginTop: 4 },
  chevWrap: { marginLeft: 8 },
  safeArea: {
    flex: 1,
    backgroundColor: '#A67C2E',
  },
});

export default ReportsListScreen;