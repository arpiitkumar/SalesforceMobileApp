import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import FilterComponent from '../../components/FilterComponent';
import HeaderMain from "../../components/HeaderMain";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import moment from 'moment';

const OPTIONAL_FIELDS = [
  { key: 'reportedBy', label: 'Reported By' },
  { key: 'empCode', label: 'Employee Code' },
  { key: 'selfieImage', label: 'Selfie Image' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'leaveDuration', label: 'Leave Duration' },
  { key: 'reason', label: 'Reason' },
  { key: 'plannedOutlets', label: 'Planned Outlets' },
  { key: 'totalCalls', label: 'Total Calls' },
  { key: 'travelDistance', label: 'Travel Distance (km)' },
];

const SRAttendanceScreen = () => {
  const [filter, setFilter] = useState({ from: null, to: null });
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [selectedOptionalFields, setSelectedOptionalFields] = useState([]);
  const [columnModalVisible, setColumnModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleImagePress = (imageData, isUrl = false) => {
    if (imageData && imageData !== '—') {
      setSelectedImage(isUrl ? imageData : `data:image/jpeg;base64,${imageData}`);
      setImageModalVisible(true);
    }
  };

  const isMerchandiser = userRole === 'MT_Merchandiser';

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const loggedInUser = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get"
      });

      const currentRole = loggedInUser[0]?.DeveloperName || '';
      const currentUserName = loggedInUser[0]?.Name || '';
      const currentEmpCode = loggedInUser[0]?.EmployeeCode__c || '';

      setUserRole(currentRole);
      setUserName(currentUserName);
      setEmployeeCode(currentEmpCode);

      const isMerch = currentRole === 'MT_Merchandiser';

      const attendanceRecords = await UniversalUpdateInsert({
        ObjectName: 'Attendant__c',
        Type: 'get',
        filters: [{ field: "User__c", value: loggedInUser[0].Sf_Id }],
      });

      let records = Array.isArray(attendanceRecords) ? attendanceRecords : [];

      // Group by date and keep latest
      const uniqueByDate = {};
      records.forEach((item) => {
        const dateKey = item.AttendanceDate__c;
        if (!uniqueByDate[dateKey]) {
          uniqueByDate[dateKey] = item;
        } else {
          const existing = uniqueByDate[dateKey];
          const existingTime = moment(existing.EndTime__c || existing.StartTime__c);
          const currentTime = moment(item.EndTime__c || item.StartTime__c);
          if (currentTime.isAfter(existingTime)) {
            uniqueByDate[dateKey] = item;
          }
        }
      });
      records = Object.values(uniqueByDate);

      // Apply date filter
      if (filter.from || filter.to) {
        records = records.filter((item) => {
          const attendanceDate = moment(item.AttendanceDate__c, 'YYYY-MM-DD');
          if (filter.from && filter.to) {
            return attendanceDate.isBetween(filter.from, filter.to, 'day', '[]');
          }
          if (filter.from) return attendanceDate.isSameOrAfter(filter.from, 'day');
          if (filter.to) return attendanceDate.isSameOrBefore(filter.to, 'day');
          return true;
        });
      }

      // Get BeatDay data and Visit counts for Planned Outlets, Total Calls, Travel Distance
      let beatDayMap = {};
      let visitCountByDate = {};
      if (isMerch) {
        const beatDays = await UniversalUpdateInsert({
          ObjectName: 'BeatDay__c',
          Type: 'get',
          filters: [{ field: "OwnerId", value: loggedInUser[0].Sf_Id }],
        });
        (beatDays || []).forEach(bd => {
          beatDayMap[bd.BeatDate__c] = bd;
        });

        // Count planned outlets from Visit records (same logic as Dashboard)
        const visits = await UniversalUpdateInsert({
          ObjectName: 'Visit',
          Type: 'get',
          filters: [{ field: "SoftDelete", value: false }],
        });

        const beatDayIdByDate = {};
        (beatDays || []).forEach(bd => {
          beatDayIdByDate[bd.BeatDate__c] = bd.Sf_Id;
        });

        (visits || []).forEach(v => {
          if (!v.BeatDay__c || !v.AccountId) return;
          // Find which date this visit belongs to
          const matchedDate = Object.keys(beatDayIdByDate).find(
            date => beatDayIdByDate[date] === v.BeatDay__c
          );
          if (matchedDate) {
            if (!visitCountByDate[matchedDate]) visitCountByDate[matchedDate] = 0;
            visitCountByDate[matchedDate]++;
          }
        });
      }

      // Map to table rows
      const mapped = records.map((item) => {
        const geoLocation = item.GeoLocation__c || '';
        const [lat, lng] = geoLocation.split(',').map(s => s?.trim() || '—');
        const beatDay = beatDayMap[item.AttendanceDate__c] || {};

        return {
          id: item.id || item.Sf_Id,
          date: moment(item.AttendanceDate__c).format('DD MMM YYYY'),
          day: moment(item.AttendanceDate__c).format('dddd'),
          loginTime: item.StartTime__c ? moment(item.StartTime__c).format('hh:mm A') : '—',
          logoutTime: item.EndTime__c ? moment(item.EndTime__c).format('hh:mm A') : '—',
          status: item.AttendanceStatus__c || '—',
          reportedBy: currentUserName,
          empCode: currentEmpCode,
          selfieImage: item.base64Image || item.AttendanceBase64 || null,
          selfieUrl: item.SelfieURL__c || null,
          latitude: lat || '—',
          longitude: lng || '—',
          leaveDuration: item.LeaveDuration__c || '—',
          reason: item.Reason__c || item.Other_Leave_Reason__c || '—',
          plannedOutlets: visitCountByDate[item.AttendanceDate__c] ?? beatDay.PlannedOutlets__c ?? '—',
          totalCalls: beatDay.Total_Call__c ?? '—',
          travelDistance: beatDay.TotalDistanceTravelledKm__c != null
            ? Number(beatDay.TotalDistanceTravelledKm__c).toFixed(2)
            : '—',
        };
      });

      setAttendanceData(mapped);
    } catch (e) {
      console.log('Attendance fetch error', e);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [filter]);

  const handleApply = (payload) => {
    setFilter(payload);
  };

  const toggleOptionalField = (key) => {
    setSelectedOptionalFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Merchandiser table with dynamic columns
  const renderMerchandiserTable = () => {
    const mandatoryHeaders = ['Date', 'Day', 'Login', 'Logout', 'Status'];
    const optionalHeaders = selectedOptionalFields.map(
      key => OPTIONAL_FIELDS.find(f => f.key === key)?.label || key
    );
    const allHeaders = [...mandatoryHeaders, ...optionalHeaders];

    return (
      <>
        <TouchableOpacity
          style={styles.columnBtn}
          onPress={() => setColumnModalVisible(true)}
        >
          <Text style={styles.columnBtnText}>⚙ Select Columns ({selectedOptionalFields.length})</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            {/* Header */}
            <View style={styles.tableHeader}>
              {allHeaders.map((h, i) => (
                <Text key={i} style={[styles.th, { width: 100 }]}>{h}</Text>
              ))}
            </View>

            {/* Rows */}
            <FlatList
              data={attendanceData}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item, index }) => {
                const mandatoryValues = [
                  item.date, item.day, item.loginTime, item.logoutTime, item.status,
                ];
                const optionalValues = selectedOptionalFields.map(key => {
                  if (key === 'selfieImage') {
                    const hasBase64 = item.selfieImage;
                    const hasUrl = item.selfieUrl;
                    if (hasBase64 || hasUrl) {
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => hasBase64 ? handleImagePress(item.selfieImage) : handleImagePress(item.selfieUrl, true)}
                          style={{ backgroundColor: '#E3F2FD', padding: 4, borderRadius: 4, width: 96, alignItems: 'center' }}
                        >
                          <Text style={{ color: '#3B5BB5', fontSize: 9, fontWeight: '600' }}>View Image</Text>
                        </TouchableOpacity>
                      );
                    }
                    return '—';
                  }
                  return String(item[key] ?? '—');
                });
                const allValues = [...mandatoryValues, ...optionalValues];

                return (
                  <View style={[styles.tableRow, index % 2 !== 0 && styles.tableRowAlt]}>
                    {allValues.map((val, i) => (
                      <View key={i} style={[styles.td, { width: 100, justifyContent: 'center' }]}>
                        {typeof val === 'string' ? (
                          <Text numberOfLines={2} style={{ fontSize: 10, color: '#333', fontWeight: '600' }}>{val}</Text>
                        ) : (
                          val
                        )}
                      </View>
                    ))}
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#7B8A99' }}>
                  No attendance records found
                </Text>
              }
            />
          </View>
        </ScrollView>
      </>
    );
  };

  // Default table for other roles
  const renderDefaultTable = () => (
    <>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 0.3 }]}>Date</Text>
        <Text style={[styles.th, { flex: 0.25 }]}>Day</Text>
        <Text style={[styles.th, { flex: 0.25 }]}>Login</Text>
        <Text style={[styles.th, { flex: 0.25 }]}>Logout</Text>
        <Text style={[styles.th, { flex: 0.2 }]}>Status</Text>
      </View>

      <FlatList
        data={attendanceData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item, index }) => (
          <View style={[styles.tableRow, index % 2 !== 0 && styles.tableRowAlt]}>
            <Text style={[styles.td, { flex: 0.3 }]}>{item.date}</Text>
            <Text style={[styles.td, { flex: 0.25 }]}>{item.day}</Text>
            <Text style={[styles.tdMono, { flex: 0.25 }]}>{item.loginTime}</Text>
            <Text style={[styles.tdMono, { flex: 0.25 }]}>{item.logoutTime}</Text>
            <Text style={[styles.tdMono, { flex: 0.2 }]}>{item.status}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 20, color: '#7B8A99' }}>
            No attendance records found
          </Text>
        }
      />
    </>
  );

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      <View style={styles.headerContainer}>
        <HeaderMain screenName="Attendance Report" />
      </View>

      <FilterComponent onApply={handleApply} initial={{ from: null, to: null }} visiblePresets={['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'custom']} initialPreset='thisMonth' />

      <View style={styles.currentFilter}>
        <Text style={styles.currentFilterText}>
          Current Filter:
          {!filter.from && !filter.to ? ' All' : ` From: ${filter.from} • To: ${filter.to}`}
        </Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 24 }} />
        ) : (
          isMerchandiser ? renderMerchandiserTable() : renderDefaultTable()
        )}
      </View>

      {/* Image Viewer Modal */}
      <Modal
        transparent
        visible={imageModalVisible}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressOut={() => setImageModalVisible(false)}
          style={styles.imageModalOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={styles.imageModalContent} onPress={() => { }}>
            <TouchableOpacity
              style={styles.imageCloseBtn}
              onPress={() => setImageModalVisible(false)}
            >
              <Text style={styles.imageCloseBtnText}>✕</Text>
            </TouchableOpacity>

            {selectedImage ? (
              <View style={styles.imageContainer}>
                <Text style={styles.imageTitle}>Attendance Selfie</Text>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.selfieImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <Text style={styles.noImageText}>No image available</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Column Selector Modal */}
      <Modal
        transparent
        visible={columnModalVisible}
        animationType="fade"
        onRequestClose={() => setColumnModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressOut={() => setColumnModalVisible(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => { }}>
            <Text style={styles.modalTitle}>Select Optional Columns</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {OPTIONAL_FIELDS.map((field) => {
                const isSelected = selectedOptionalFields.includes(field.key);
                return (
                  <TouchableOpacity
                    key={field.key}
                    style={styles.optionRow}
                    onPress={() => toggleOptionalField(field.key)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.optionLabel}>{field.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setColumnModalVisible(false)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaProvider>
  );
};

export default SRAttendanceScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#A67C2E' },
  content: {
    flex: 1,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#ffffff",
  },
  headerContainer: { backgroundColor: "transparent" },
  currentFilter: { marginHorizontal: 16, marginTop: 6, marginBottom: 12, backgroundColor: 'rgba(255,255,255,1)', padding: 6, paddingHorizontal: 10, borderRadius: 10 },
  currentFilterText: { fontSize: 12, color: '#1F1D1A', fontWeight: '600' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  th: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'left',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
  },
  tableRowAlt: { backgroundColor: '#F5F8FF' },
  td: { color: '#333', fontWeight: '600', fontSize: 10 },
  tdMono: { color: '#333', fontWeight: '600', fontSize: 10 },
  columnBtn: {
    backgroundColor: '#EEF3FF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#C5D5F7',
  },
  columnBtnText: { color: '#A67C2E', fontSize: 12, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    elevation: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F1D1A', marginBottom: 16 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EADB',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#B0C4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: { backgroundColor: '#A67C2E', borderColor: '#A67C2E' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  optionLabel: { fontSize: 14, color: '#333' },
  doneBtn: {
    backgroundColor: '#A67C2E',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  imageModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  imageModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 10,
  },
  imageCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 15,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCloseBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  imageContainer: {
    alignItems: 'center',
  },
  imageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1D1A',
    marginBottom: 15,
    textAlign: 'center',
  },
  selfieImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  noImageText: {
    textAlign: 'center',
    color: '#7B8A99',
    fontSize: 16,
    marginTop: 20,
  },
});