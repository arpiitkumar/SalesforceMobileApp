import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    Linking,
    Modal,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import Icon from "../components/Ionicons";
import { moderateScale } from 'react-native-size-matters';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../utils/networkUtils';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { showToast } from '../redux/slices/toastSlice';
import NetInfo from '@react-native-community/netinfo';
import { dataSyncer } from '../UtilityMain/dataSyncer';


const AccountList = () => {
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const { fetchRecords, apiFetch, apiComposite } = useApiFetch();
    const { accessToken, instanceUrl } = useSelector((state: RootState) => state.auth);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const onRefresh = useCallback(async () => {
        const netState = await NetInfo.fetch();
        const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
        if (!isOnline) {
            dispatch(
                showToast({
                    type: 'warning',
                    message: 'You are offline. Connect to internet to sync',
                })
            );
            return;
        }
        setRefreshing(true);
        try {
            if (accessToken && instanceUrl) {
                await dataSyncer({ accessToken, instanceUrl }, fetchRecords, apiFetch, apiComposite);
            }
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error("Refresh failed:", error);
        } finally {
            setRefreshing(false);
        }
    }, [accessToken, instanceUrl, fetchRecords, apiFetch, apiComposite, dispatch]);
    const [search, setSearch] = useState('');
    const [sortAsc, setSortAsc] = useState(true);
    const [accounts, setAccounts] = useState([]);

    // Details Modal States
    const [selectedItem, setSelectedItem] = useState(null);
    const [detailVisible, setDetailVisible] = useState(false);

    const handleCallPress = (number) => {
        if (!number) {
            return;
        }
        Linking.openURL("tel:" + number);
    };

    useFocusEffect(
        React.useCallback(() => {
            const initialize = async () => {
                setLoading(true);
                try {
                    // 1. Fetch logged-in user to query Leads
                    const users = await UniversalUpdateInsert({
                        ObjectName: 'User',
                        Type: 'get',
                    });
                    const userId = users && users[0]?.Sf_Id;
                    console.log('Current logged-in user Sf_Id:', userId);

                    // 2. Get Leads from server if online
                    const connected = await isInternetAvailable();
                    console.log('Internet status connected:', connected);
                    if (connected && userId) {
                        try {
                            const queryStr = `SELECT Id, Name, MobileNumber__c, Email__c, Outlet_Address__c, Billing_Street__c, Billing_City__c, Billing_State__c, Billing_Postal_Code__c, Billing_Country__c, Approval_Status__c, RegisteredDate__c, FSSAINumber__c, GSTIN_Number__c, PANNumber__c FROM Lead__c WHERE CreatedById = '${userId}'`;
                            console.log('Executing Lead__c query:', queryStr);
                            const serverLeads = await fetchRecords('Lead__c', queryStr);
                            console.log('Fetched Lead__c records from Salesforce:', JSON.stringify(serverLeads));
                            
                            if (Array.isArray(serverLeads)) {
                                const mappedLeads = serverLeads.map(lead => ({
                                    Sf_Id: lead.Id,
                                    Name: lead.Name,
                                    Phone: lead.MobileNumber__c || '',
                                    Email__c: lead.Email__c || '',
                                    BillingAddress: lead.Outlet_Address__c || [
                                        lead.Billing_Street__c,
                                        lead.Billing_City__c,
                                        lead.Billing_State__c,
                                        lead.Billing_Postal_Code__c,
                                        lead.Billing_Country__c
                                    ].filter(Boolean).join(', '),
                                    isLead: true,
                                    Approval_Status__c: lead.Approval_Status__c || 'Pending',
                                    RegisteredDate__c: lead.RegisteredDate__c || '',
                                    FSSAINumber__c: lead.FSSAINumber__c || '',
                                    GSTIN_Number__c: lead.GSTIN_Number__c || '',
                                    PANNumber__c: lead.PANNumber__c || ''
                                }));

                                setAccounts(mappedLeads);
                            } else {
                                console.log('serverLeads is not an array:', serverLeads);
                                setAccounts([]);
                            }
                        } catch (serverErr) {
                            console.warn('Failed to fetch online Lead__c records:', serverErr);
                            setAccounts([]);
                        }
                    } else {
                        console.log('Cannot query: internet is disconnected or userId is missing');
                        setAccounts([]);
                    }
                } catch (error) {
                    console.error("Get Lead Data Failed:", error);
                    setAccounts([]);
                } finally {
                    setLoading(false);
                }
            };

            initialize();
        }, [refreshTrigger])
    );

    const filteredList = accounts
        .filter((item) =>
            item.Name.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) =>
            sortAsc
                ? a.Name.localeCompare(b.Name)
                : b.Name.localeCompare(a.Name)
        );
    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#C9A24D" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Onboarded Retailers</Text>
                <TouchableOpacity onPress={() => { navigation.navigate('NearbyRetailerSearch') }}>
                    <Icon name="add" size={26} color="gray" />
                </TouchableOpacity>
            </View>

            {/* Search & Sort */}
            {/* <View style={styles.searchSortRow}>
                <View style={styles.searchWrapper}>
                    <Icon name="search" size={18} color="#999" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search customer..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#888"
                    />
                </View>
                <TouchableOpacity style={styles.sortBtn} onPress={() => setSortAsc(!sortAsc)}>
                    <MaterialCommunityIcons
                        name={sortAsc ? 'sort-ascending' : 'sort-descending'}
                        size={22}
                        color="#000"
                    />
                </TouchableOpacity>
            </View> */}

            {/* Card List */}
            <ScrollView
                contentContainerStyle={styles.cardContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {filteredList.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.card}
                        onPress={() => {
                            setSelectedItem(item);
                            setDetailVisible(true);
                        }}
                    >
                        {/* Name Row */}
                        <View style={styles.cardHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                                <Text style={styles.nameText}>{item.Name}</Text>
                                {item.isLead && (
                                    <View style={[
                                        styles.badgeContainer,
                                        {
                                            backgroundColor: item.Approval_Status__c === 'Approved' ? '#E3F1EA' :
                                                             item.Approval_Status__c === 'Rejected' ? '#F9E5E3' : '#FBEFD8',
                                            marginLeft: 8
                                        }
                                    ]}>
                                        <Text style={[
                                            styles.badgeText,
                                            {
                                                color: item.Approval_Status__c === 'Approved' ? '#2E7D5B' :
                                                       item.Approval_Status__c === 'Rejected' ? '#B3261E' : '#EF6C00'
                                            }
                                        ]}>
                                            Approval Status: {item.Approval_Status__c || 'Pending'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity style={styles.callCircle} onPress={() => { handleCallPress(item?.Phone) }}>
                                <Icon name="call-outline" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Info */}
                        <View style={styles.infoRow}>
                            <Text style={styles.inlineLabel}>
                                Mobile: <Text style={styles.inlineValue}>{item.Phone || '-'}</Text>
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.inlineLabel}>
                                Email: <Text style={styles.inlineValue}>{item.Email__c || '-'}</Text>
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.inlineLabel}>
                                Address: <Text style={styles.inlineValue}>{item.BillingAddress || '-'}</Text>
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={detailVisible}
                onRequestClose={() => setDetailVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Retailer Details</Text>
                            <TouchableOpacity onPress={() => setDetailVisible(false)}>
                                <Icon name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Retailer Name</Text>
                                <Text style={styles.detailValue}>{selectedItem?.Name || '-'}</Text>
                            </View>

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Mobile Number</Text>
                                <Text style={styles.detailValue}>{selectedItem?.Phone || '-'}</Text>
                            </View>

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Email</Text>
                                <Text style={styles.detailValue}>{selectedItem?.Email__c || '-'}</Text>
                            </View>

                            {selectedItem?.isLead && (
                                <>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Registered Date</Text>
                                        <Text style={styles.detailValue}>{selectedItem?.RegisteredDate__c || '-'}</Text>
                                    </View>
                                    
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>PAN Number</Text>
                                        <Text style={styles.detailValue}>{selectedItem?.PANNumber__c || '-'}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>GST Number</Text>
                                        <Text style={styles.detailValue}>{selectedItem?.GSTIN_Number__c || '-'}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>FSSAI Number</Text>
                                        <Text style={styles.detailValue}>{selectedItem?.FSSAINumber__c || '-'}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Approval Status</Text>
                                        <View style={[
                                            styles.badgeContainer,
                                            {
                                                backgroundColor: selectedItem?.Approval_Status__c === 'Approved' ? '#E3F1EA' :
                                                                 selectedItem?.Approval_Status__c === 'Rejected' ? '#F9E5E3' : '#FBEFD8',
                                                alignSelf: 'flex-start',
                                                marginTop: 4
                                            }
                                        ]}>
                                            <Text style={[
                                                styles.badgeText,
                                                {
                                                    color: selectedItem?.Approval_Status__c === 'Approved' ? '#2E7D5B' :
                                                           selectedItem?.Approval_Status__c === 'Rejected' ? '#B3261E' : '#EF6C00'
                                                }
                                            ]}>
                                                {selectedItem?.Approval_Status__c || 'Pending'}
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            )}

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Address</Text>
                                <Text style={styles.detailValue}>{selectedItem?.BillingAddress || '-'}</Text>
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setDetailVisible(false)}
                        >
                            <LinearGradient
                                colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.closeButtonInner}
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default AccountList;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FBF8F1',
    },
    header: {
        //backgroundColor: '#C9A24D',
        paddingTop: 26,
        paddingBottom: 10,
        // backgroundColor: 'red',
        paddingHorizontal: moderateScale(16),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        color: 'black',
        fontSize: 18,
        marginLeft: 10,
        fontWeight: '600',
    },
    searchSortRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    searchWrapper: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#F1EADB',
        borderRadius: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#000',
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    sortBtn: {
        backgroundColor: '#F1EADB',
        padding: 8,
        marginLeft: 12,
        borderRadius: 8,
    },
    cardContainer: {
        paddingTop: 6,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    nameText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#000',
    },
    callCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#C9A24D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoRow: {
        marginBottom: 6,
    },
    inlineLabel: {
        fontSize: 12,
        color: '#444',
        fontWeight: '400',
    },
    inlineValue: {
        fontWeight: '300',
        color: '#222',
    },
    loaderContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        flex: 1
    },
    badgeContainer: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        maxHeight: '80%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F1EADB',
        paddingBottom: 12,
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    modalBody: {
        marginBottom: 20,
    },
    detailRow: {
        marginBottom: 14,
    },
    detailLabel: {
        fontSize: 11,
        color: '#777',
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    detailValue: {
        fontSize: 14,
        color: '#111',
        marginTop: 2,
    },
    closeButton: {
        height: 44,
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 10,
    },
    closeButtonInner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    }
});
