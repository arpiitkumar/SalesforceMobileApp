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
    TextInput,
} from 'react-native';
import FilterComponent from '../../components/FilterComponent';
import HeaderMain from "../../components/HeaderMain";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import moment from 'moment';
import { useSelector } from 'react-redux';
import axios from 'axios';

const OPTIONAL_FIELDS = [
    { key: 'visitorName', label: 'Visitor Name' },
    { key: 'empCode', label: 'Employee Code' },
    { key: 'beatName', label: 'Beat Name' },
    { key: 'checkInImageUrl', label: 'Check-in Image' },
    { key: 'checkInLat', label: 'Check-in Latitude' },
    { key: 'checkInLng', label: 'Check-in Longitude' },
    { key: 'checkOutLat', label: 'Check-out Latitude' },
    { key: 'checkOutLng', label: 'Check-out Longitude' },
    { key: 'checkOutRemarks', label: 'Check-out Remarks' },
];

const VisitReport = () => {
    const [filter, setFilter] = useState({ from: null, to: null });
    const [loading, setLoading] = useState(false);
    const [visitData, setVisitData] = useState([]);
    const [selectedOptionalFields, setSelectedOptionalFields] = useState([]);
    const [columnModalVisible, setColumnModalVisible] = useState(false);
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const accessToken = useSelector(state => state.auth.accessToken);
    const instanceUrl = useSelector(state => state.auth.instanceUrl);

    const fetchImageFromSF = async (visitSfId) => {
        try {
            setImageLoading(true);
            // Query ContentDocumentLink for this Visit
            const cdlQuery = `SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${visitSfId}' ORDER BY SystemModstamp DESC LIMIT 1`;
            const cdlResponse = await axios.get(
                `${instanceUrl}/services/data/v61.0/query/?q=${encodeURIComponent(cdlQuery)}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const contentDocId = cdlResponse.data?.records?.[0]?.ContentDocumentId;
            if (!contentDocId) {
                setImageLoading(false);
                return null;
            }

            // Get latest ContentVersion
            const cvQuery = `SELECT Id, VersionData FROM ContentVersion WHERE ContentDocumentId = '${contentDocId}' AND IsLatest = true LIMIT 1`;
            const cvResponse = await axios.get(
                `${instanceUrl}/services/data/v61.0/query/?q=${encodeURIComponent(cvQuery)}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const versionId = cvResponse.data?.records?.[0]?.Id;
            if (!versionId) {
                setImageLoading(false);
                return null;
            }

            // Fetch actual image blob as base64
            const imageResponse = await axios.get(
                `${instanceUrl}/services/data/v61.0/sobjects/ContentVersion/${versionId}/VersionData`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    responseType: 'arraybuffer',
                }
            );

            const bytes = new Uint8Array(imageResponse.data);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = global.btoa(binary);
            setImageLoading(false);
            return base64;
        } catch (err) {
            console.log('Failed to fetch image from SF:', err.message);
            setImageLoading(false);
            return null;
        }
    };

    const handleImagePress = async (item) => {
        // If local base64 exists, use it directly
        if (item.checkInImageData) {
            setSelectedImage(`data:image/jpeg;base64,${item.checkInImageData}`);
            setImageModalVisible(true);
            return;
        }

        // Otherwise fetch from Salesforce
        if (item.hasPhotoOnSF && item.sfId) {
            setImageModalVisible(true);
            setSelectedImage(null);
            const base64 = await fetchImageFromSF(item.sfId);
            if (base64) {
                setSelectedImage(`data:image/jpeg;base64,${base64}`);
            }
        }
    };

    const formatTime = (date) => {
        if (!date) return '—';
        try {
            let cleanDate = typeof date === 'string' ? date.replace(/^"|"$/g, '').trim() : date;
            cleanDate = cleanDate.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
            const m = moment.parseZone(cleanDate);
            if (!m.isValid()) return '—';
            return m.local().format('hh:mm A');
        } catch (e) {
            return '—';
        }
    };

    const fetchVisitData = async () => {
        setLoading(true);
        try {
            const loggedInUser = await UniversalUpdateInsert({ ObjectName: "User", Type: "get" });
            const userName = loggedInUser[0]?.Name || '';
            const empCode = loggedInUser[0]?.EmployeeCode__c || '';
            const userId = loggedInUser[0]?.Sf_Id;

            // 🔒 Beat assignment validation - Only user's assigned beats
            const beatAssignments = await UniversalUpdateInsert({
                ObjectName: "SR_Beat_Assignment__c",
                Type: "get",
                filters: [{ field: "Assigned_To__c", value: userId }],
            });

            const assignedBeatIds = beatAssignments.map(a => a.Beat__c).filter(Boolean);

            let visitFilters = [{ field: "SoftDelete", value: false }];

            if (assignedBeatIds.length > 0) {
                visitFilters.push({ field: "Beat__c", operator: "in", value: assignedBeatIds });
                console.log(`🔒 Filtering by ${assignedBeatIds.length} assigned beats`);
            } else {
                console.warn('⚠️ No assigned beats found - showing no data');
                setVisitData([]);
                setLoading(false);
                return;
            }

            const visits = await UniversalUpdateInsert({
                ObjectName: 'Visit',
                Type: 'get',
                filters: visitFilters,
            });

            const accounts = await UniversalUpdateInsert({ ObjectName: 'Account', Type: 'get' });
            const beats = await UniversalUpdateInsert({ ObjectName: 'Beat__c', Type: 'get' });

            // 🔒 MT account filtering - Only MT/HoReCa accounts
            let accountMap = {};

            // Get MT record type for filtering
            const allPicklistData = await UniversalUpdateInsert({
                ObjectName: 'AllDataPicklist',
                Type: 'get',
            });

            const recordTypeId = allPicklistData?.[0]?.OptionsData
                ? JSON.parse(allPicklistData[0].OptionsData)?.mtHorecaRecordTypeId
                : null;

            if (recordTypeId) {
                // Only include MT accounts
                (accounts || []).forEach(a => {
                    if (a.RecordTypeId === recordTypeId) {
                        accountMap[a.Sf_Id] = a;
                    }
                });
                console.log(`🔒 MT_Merchandiser - Filtered to ${Object.keys(accountMap).length} MT accounts`);
            } else {
                // Fallback: all accounts
                (accounts || []).forEach(a => { accountMap[a.Sf_Id] = a; });
            }

            // Account map already built above with role-based filtering
            const beatMap = {};
            (beats || []).forEach(b => { beatMap[b.Sf_Id] = b; });

            let records = Array.isArray(visits) ? visits : [];

            // Filter only visits with check-in (visited)
            records = records.filter(v => v.CheckInTime__c);

            // Apply date filter
            if (filter.from || filter.to) {
                records = records.filter((item) => {
                    const visitDate = moment(item.VisitDate__c, 'YYYY-MM-DD');
                    if (filter.from && filter.to) {
                        return visitDate.isBetween(filter.from, filter.to, 'day', '[]');
                    }
                    if (filter.from) return visitDate.isSameOrAfter(filter.from, 'day');
                    if (filter.to) return visitDate.isSameOrBefore(filter.to, 'day');
                    return true;
                });
            }

            // Sort by date desc, then check-in time
            records.sort((a, b) => {
                const dateCompare = moment(b.VisitDate__c).diff(moment(a.VisitDate__c));
                if (dateCompare !== 0) return dateCompare;
                const aTime = a.CheckInTime__c ? moment.parseZone(a.CheckInTime__c) : null;
                const bTime = b.CheckInTime__c ? moment.parseZone(b.CheckInTime__c) : null;
                if (!aTime && !bTime) return 0;
                if (!aTime) return 1;
                if (!bTime) return -1;
                return aTime - bTime;
            });

            const mapped = records.map((v) => {
                const account = accountMap[v.AccountId] || {};
                const beat = beatMap[v.Beat__c] || {};

                return {
                    id: v.Sf_Id || v.id,
                    sfId: v.Sf_Id,
                    visitDate: v.VisitDate__c ? moment(v.VisitDate__c).format('DD MMM YYYY') : '—',
                    accountName: account.Name || '—',
                    visitStatus: v.VisitStatus__c || '—',
                    checkInTime: formatTime(v.CheckInTime__c),
                    checkOutTime: formatTime(v.CheckOutTime__c),
                    visitorName: userName,
                    empCode: empCode,
                    beatName: beat.Name || '—',
                    checkInImageUrl: v.CheckInBase64 || v.visitBase64 || null,
                    checkInImageData: v.CheckInBase64 || v.visitBase64 || null,
                    hasPhotoOnSF: !!v.CheckInTime__c,
                    checkInLat: v.CheckInLocation__Latitude__s != null ? String(v.CheckInLocation__Latitude__s) : '—',
                    checkInLng: v.CheckInLocation__Longitude__s != null ? String(v.CheckInLocation__Longitude__s) : '—',
                    checkOutLat: v.CheckOutLocation__Latitude__s != null ? String(v.CheckOutLocation__Latitude__s) : '—',
                    checkOutLng: v.CheckOutLocation__Longitude__s != null ? String(v.CheckOutLocation__Longitude__s) : '—',
                    checkOutRemarks: v.VisitNotes__c || v.CheckInComment__c || '—',
                };
            });

            // 🔍 Final data count logging
            console.log(`✅ Visit Report loaded: ${mapped.length} visits after filtering`);

            setVisitData(mapped);
        } catch (e) {
            console.log('Visit Report fetch error', e);
            setVisitData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVisitData();
    }, [filter]);

    const handleApply = (payload) => {
        setFilter(payload);
    };

    const toggleOptionalField = (key) => {
        setSelectedOptionalFields(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const mandatoryHeaders = ['Visit Date', 'Account', 'Status', 'Check-in', 'Check-out'];
    const optionalHeaders = selectedOptionalFields.map(
        key => OPTIONAL_FIELDS.find(f => f.key === key)?.label || key
    );
    const allHeaders = [...mandatoryHeaders, ...optionalHeaders];

    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

            <View style={styles.headerContainer}>
                <HeaderMain screenName="Visit Report" />
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
                    <>
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by Account Name..."
                                placeholderTextColor="#9BA8B7"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                                    <Text style={styles.clearBtnText}>✕</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.columnBtn}
                            onPress={() => setColumnModalVisible(true)}
                        >
                            <Text style={styles.columnBtnText}>⚙ Select Columns ({selectedOptionalFields.length})</Text>
                        </TouchableOpacity>

                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                            <View>
                                <View style={styles.tableHeader}>
                                    {allHeaders.map((h, i) => (
                                        <Text key={i} style={[styles.th, { width: 100 }]}>{h}</Text>
                                    ))}
                                </View>

                                <FlatList
                                    data={visitData.filter(item =>
                                        item.accountName?.toLowerCase().includes(searchQuery.toLowerCase())
                                    )}
                                    keyExtractor={(item) => item.id}
                                    contentContainerStyle={{ paddingBottom: 30 }}
                                    renderItem={({ item, index }) => {
                                        const mandatoryValues = [
                                            item.visitDate, item.accountName, item.visitStatus,
                                            item.checkInTime, item.checkOutTime,
                                        ];
                                        const optionalValues = selectedOptionalFields.map(key => {
                                            if (key === 'checkInImageUrl') {
                                                if (item.checkInImageData || item.hasPhotoOnSF) {
                                                    return (
                                                        <TouchableOpacity
                                                            key={key}
                                                            onPress={() => handleImagePress(item)}
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
                                            No visit records found
                                        </Text>
                                    }
                                />
                            </View>
                        </ScrollView>
                    </>
                )}
            </View>

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
                                <Text style={styles.imageTitle}>Check-in Image</Text>
                                <Image
                                    source={{ uri: selectedImage }}
                                    style={styles.checkInImage}
                                    resizeMode="contain"
                                />
                            </View>
                        ) : imageLoading ? (
                            <View style={styles.imageContainer}>
                                <Text style={styles.imageTitle}>Check-in Image</Text>
                                <ActivityIndicator size="large" style={{ marginTop: 40 }} />
                                <Text style={{ color: '#7B8A99', marginTop: 10 }}>Loading from Salesforce...</Text>
                            </View>
                        ) : (
                            <Text style={styles.noImageText}>No image available</Text>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaProvider>
    );
};

export default VisitReport;

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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F8FF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#C5D5F7',
        paddingHorizontal: 12,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        height: 40,
        fontSize: 14,
        color: '#1F1D1A',
    },
    clearBtn: {
        padding: 6,
    },
    clearBtnText: {
        fontSize: 14,
        color: '#7B8A99',
        fontWeight: '600',
    },
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

    // Image Modal Styles
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
    checkInImage: {
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