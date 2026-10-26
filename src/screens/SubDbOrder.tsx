import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    Alert
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "../components/AntDesign";
import FIcon from "@react-native-vector-icons/feather";
import HeaderMain from "../components/HeaderMain";
import { useFocusEffect } from "@react-navigation/native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { useSelector } from "react-redux";
import { RootState } from '../redux/store';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../utils/networkUtils';
import { showToast } from '../redux/slices/toastSlice';
import { PriceBookId_var } from '../../config'
import moment from 'moment';
import { useDispatch } from 'react-redux';
import { setSelectedBeatDay } from '../redux/slices/selectedBeatDaySlice';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoaderOverlay from '../utils/helper/LoaderOverlay'
import { KeyboardAvoidingView, Platform } from "react-native";
import { getUserAccessibleSubCategories } from '../UtilityMain/producthelpers/userLineService.js';
import { getBeatAccountPricingInfo, getVerticalsFromIncoterm, getValidPricingRecords } from '../UtilityMain/producthelpers/pricingService';
import { getCGCloudUOMData, createUOMDataMap } from '../UtilityMain/producthelpers/productUOMService';
import DistributorModal from "../components/modal/DistributorModal";
import { extractPricingValuesInline } from '../UtilityMain/producthelpers/productNormalizationService';

const SubDbOrder = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [accounts, setAccounts] = useState([]);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const initialize = async () => {
                console.log("SubDbOrder Screen focused");



                const AllPicklistData = await UniversalUpdateInsert({
                    ObjectName: 'AllDataPicklist',
                    Type: 'get',
                });
                //console.log("THIS IS PICKList data................",AllPicklistData )

                let optionsData = AllPicklistData[0]?.OptionsData;

                if (typeof optionsData === 'string') {
                    try {


                        optionsData = JSON.parse(optionsData);
                    } catch (e) {
                        console.error("Failed to parse OptionsData:", e);
                    }
                }

                console.log('OptionsData................', optionsData.subDbRecordTypeId);

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
                    ],
                });

                const uniqueDistributors = new Set(disData.map(s => s.Distributor__c))
                console.log('------------------------------', uniqueDistributors)

                const accountsData = await UniversalUpdateInsert({
                    ObjectName: "Account",
                    Type: "get",
                    filters: [
                        { field: 'Sf_Id', value: [...uniqueDistributors], operator: 'in' },
                        { field: "RecordTypeId", value: optionsData.subDbRecordTypeId },
                    ],
                });
                console.log('------------------------------', accountsData)
                setAccounts(accountsData || []);
            };

            initialize();
            return () => {
                isActive = false;
            };
        }, [])
    );


    const filteredAccounts = accounts.filter(acc => {
        const q = search?.trim().toLowerCase();
        if (!q) return true;
        return (
            (acc.Name || '').toLowerCase().includes(q) ||
            (acc.Party_Code__c || '').toLowerCase().includes(q)
        );
    });
    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Sub DB Spot Sales" />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
            >

                <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                    <View style={styles.mainContent}>
                        {/* <View style={{
                            margin: 12,
                            marginBottom: 0,
                            borderRadius: 12,
                            backgroundColor: '#ffffff',
                            padding: 14,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.12,
                            shadowRadius: 6,
                            elevation: 3,
                            alignSelf: 'stretch'
                        }}>
                            <Text style={{ fontSize: 13, color: '#666' }}>SUB DB :</Text>
                            <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 4, color: '#111' }}>
                                Name<Text style={{ fontSize: 12 }}></Text>
                            </Text>
                        </View> */}
                        <View style={styles.searchRow}>
                            <View style={styles.searchBox}>
                                <Icon name="search1" size={18} color="#888" />
                                <TextInput
                                    placeholder="Search"
                                    value={search}
                                    onChangeText={setSearch}
                                    style={styles.searchInput}
                                    placeholderTextColor="#888"
                                />
                            </View>


                        </View>
                        <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 6 }}>
                            <FlatList
                                data={filteredAccounts}
                                keyExtractor={(item) => item.Sf_Id || item.sfId || Math.random().toString()}
                                renderItem={({ item }) => {
                                    const onPressAccount = () => {
                                        console.log('Account pressed:', {
                                            Sf_Id: item.Sf_Id,
                                            Party_Code__c: item.Party_Code__c,
                                            Name: item.Name,
                                        });

                                        navigation.navigate('ASOOrderTwo', {
                                            distributorIdFromAccount: item.Sf_Id,
        
                                        });
                                        // Alert.alert(
                                        //     'Account',
                                        //     `Name: ${item.Name || '-'}\nPartyCode: ${item.Party_Code__c || '-'}\nSf_Id: ${item.Sf_Id || '-'}`,
                                        //     [{ text: 'OK' }]
                                        // );
                                    };

                                    return (
                                        <TouchableOpacity
                                            style={styles.rowContainer}
                                            onPress={onPressAccount}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.title} numberOfLines={1}>
                                                    {item.Name || 'Unnamed'}
                                                </Text>

                                                {item.Party_Code__c ? (
                                                    <View style={styles.badge}>
                                                        <Text style={styles.badgeText}>
                                                            #{item.Party_Code__c}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>

                                            <View style={styles.arrowCircle}>
                                                <FIcon name="chevron-right" size={18} color="#7A7266" />
                                            </View>


                                            {/* right arrow */}
                                           
                                        </TouchableOpacity>
                                    );
                                }}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>No accounts found</Text>
                                    </View>
                                }
                            />
                        </View>



                    </View>

                </View>
            </KeyboardAvoidingView>

            <LoaderOverlay visible={loading} />
        </SafeAreaProvider>
    );
};

export default SubDbOrder;
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#A67C2E',
    },
    headerContainer: {
        backgroundColor: '#A67C2E',
    },
    container: {
        flex: 1,
        //backgroundColor: '#fff',
    },


    mainContent: { backgroundColor: "white", flex: 1, borderRadius: 26 },

    searchRow: { flexDirection: "row", alignItems: "center", margin: 15 },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#ddd",
        paddingHorizontal: 10,
        height: 40,
    },
    searchInput: { flex: 1, fontSize: 14, marginLeft: 6, color: "#000" },

    filterBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#fff",
        marginLeft: 10,
        justifyContent: "center",
        borderWidth: 1.2,
        borderColor: "#e6e9ef",
        // subtle shadow for elevation on Android/iOS
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        elevation: 1,
    },
    sortIcon: {
        marginLeft: 8,
    },

    categoryRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 15,
        paddingBottom: 10,
        gap: 8,
    },
    categoryButton: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: "#fff",
        borderColor: "#1E3A8A",
        borderWidth: 1,
    },
    categoryButtonActive: {
        backgroundColor: "#1E3A8A",
    },
    categoryText: {
        fontSize: 13,
        color: "#1E3A8A",
        fontWeight: "500",
    },
    categoryTextActive: {
        color: "#fff",
    },

    rowContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EEF4FF",
        padding: 14,
        marginBottom: 10,
        borderRadius: 14,
        margin:1,
        // Android shadow
        elevation: 3,

        // iOS shadow
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },

    title: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1F1D1A", // dark slate
    },
    infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    infoBlock: { flexDirection: "row", alignItems: "center" },
    badge: {
        backgroundColor: "#eef2ff",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginTop: 6,
        alignSelf: "flex-start",
    },
    badgeText: {
        fontSize: 12,
        color: "#4338ca",
        fontWeight: "500",
    },
    arrowCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        // backgroundColor: "#F1EADB",
        backgroundColor: "white",
        alignItems: "center",
        justifyContent: "center",
    },



});