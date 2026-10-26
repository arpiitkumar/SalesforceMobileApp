import React, { useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { syncAttendanceRecords, syncMTExceptionRecord, syncGrowthMappingEntryRecord, syncBeatDayRecord, syncVisitRecord, syncOrderRecord, syncOrderItemRecord, syncCollectionRecord, syncCollectionAllocationRecord, syncInvoiceRecord, syncInvoiceItemRecord, syncAccountRecord, syncFormJsonecord, syncCompetitorRecord, syncStockCheckRecord, syncSalaryAcknowledgementRecord, syncHNTCompetitorPriceRecord, syncGamificationTransactionRecord } from '../database/dbService/AllDataSync';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../utils/networkUtils';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { triggerAppReload } from '../redux/slices/appReloadSlice';
import { setCheckInStatus } from '../redux/slices/checkInSlice'
import { dataSyncer } from '../UtilityMain/dataSyncer'
import { showToast } from '../redux/slices/toastSlice.js'
import { useSelector, useDispatch } from "react-redux";
import Spinner from 'react-native-spinkit';
import moment from 'moment';
import { usePreviousEndDayProcessor } from './usePreviousEndDayProcessor';

const StartDayModal = ({ visible, onStartDay, handleLogoutFromParent }) => {

    const { fetchRecords, apiFetch, apiComposite } = useApiFetch()
    const { processPreviousEndDay } = usePreviousEndDayProcessor();

    const { accessToken, instanceUrl } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const [isSyncingGet, setIsSyncingGet] = useState(false);
    const [syncTextGet, setSyncTextGet] = useState('Get Data');
    const showToastvisible = (type, message) => {
        dispatch(showToast({
            message: message,
            type: type,
        }));
    };


    const PreviousEndDay = async () => {
        try {
            console.log('awaitawaitawaitawaitawaitawaitawaitawaitawait')
            const userId = (await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' }))?.[0]?.Sf_Id;
            if (!userId) return console.log("User not found");

            const planId = (await UniversalUpdateInsert({
                ObjectName: "Route_Plans__c",
                Type: "get",
                filters: [{ field: 'Assigned_To__c', value: userId }],
            }))?.[0]?.Sf_Id;

            if (!planId) return console.log("Route Plan not found");

            const beatDays = await UniversalUpdateInsert({
                ObjectName: "BeatDay__c",
                Type: "get",
                filters: [{ field: 'Tour_Plan__c', value: planId }],
            });

            const startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
            const endDate = moment().subtract(1, 'days').format('YYYY-MM-DD');

            const result = beatDays?.filter(i =>
                i?.BeatDate__c >= startDate &&
                i?.BeatDate__c <= endDate &&
                !i?.EndOfDayTime__c
            );
            if (!result?.length) {
                console.log("No matching BeatDays");
                return;
            }
            for (const item of result) {
                console.log('Processing previous end day:', item.Sf_Id, item.BeatDate__c);
                const response = await processPreviousEndDay({
                    date: item.BeatDate__c,
                    beatDayId: item.Sf_Id,
                });
                console.log('Previous end day response:', JSON.stringify(response));
            }

        } catch (e) {
            console.log("Error:", e);
        }
    };

    const [uniqueBeatIDForBatch, setUniqueBeatIDForBatch] = useState([])
    const getPreviousBeatDayID = async () => {
        let beatdayIDForAPI = [];
        const offlineOrder = await UniversalUpdateInsert({
            ObjectName: "Order",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        const uniqueVisitIds = [...new Set(
            offlineOrder
                .map(item => item.Visit__c)
                .filter(Boolean)
        )];
        const ordertovisit = await UniversalUpdateInsert({
            ObjectName: 'Visit',
            Type: 'get',
            filters: [
                {
                    field: 'Sf_Id',
                    operator: 'in',
                    value: uniqueVisitIds
                }
            ]
        });
        const uniqueBeatdayIdsForOrder = [...new Set(
            ordertovisit
                .map(item => item.BeatDay__c)
                .filter(Boolean)
        )];



        const offlineVisit = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        const uniqueBeatdayIdsForVisit = [...new Set(
            offlineVisit
                .map(item => item.BeatDay__c)
                .filter(Boolean)
        )];


        const offlineBeatDay = await UniversalUpdateInsert({
            ObjectName: "BeatDay__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        const uniqueBeatdayIdsForBeatDay = [
            ...new Set(
                offlineBeatDay
                    .map(item => item.Sf_Id)
                    .filter(Boolean)
            )
        ];

        beatdayIDForAPI = [
            ...new Set([
                ...uniqueBeatdayIdsForOrder,
                ...uniqueBeatdayIdsForVisit,
                ...uniqueBeatdayIdsForBeatDay,
            ]),
        ];


        if (!beatdayIDForAPI.length) {
            setUniqueBeatIDForBatch([]);
            return [];
        }

        const getbeatdayrecordforid = await UniversalUpdateInsert({
            ObjectName: 'BeatDay__c',
            Type: 'get',
            filters: [
                {
                    field: 'Sf_Id',
                    operator: 'in',
                    value: beatdayIDForAPI
                }
            ]
        });

        const today = moment().startOf("day");
        const validBeatDayIds = getbeatdayrecordforid
            .filter(record =>
                moment(record.BeatDate__c, "YYYY-MM-DD").isBefore(today, "day")
            )
            .map(record => record.Sf_Id);
        console.log('Filtered BeatDay Records', validBeatDayIds);
        setUniqueBeatIDForBatch(validBeatDayIds);
        return validBeatDayIds;

        // setUniqueBeatIDForBatch(beatdayIDForAPI)
        // return beatdayIDForAPI;
    }

    const onStartDayModal = async () => {

        try {
            const connected = await isInternetAvailable();
            if (!connected) {
                Alert.alert("No Internet Connection", "Internet connection is required to start your day.");
                return;
            }
            setSyncTextGet(`Doing previous day end day`);
            //    await PreviousEndDay()
            const beatDayIds = await getPreviousBeatDayID();
            // console.log('uniqueBeatIDForBatch', uniqueBeatIDForBatch)
            console.log('beatDayIds', beatDayIds)
            // return;

            setIsSyncingGet(true);
            // setSyncTextGet(`Syncing offline data in salesforce.`);
            // const sync = await handleSyncData();
            const resultUser = await UniversalUpdateInsert({
                ObjectName: 'User',
                Type: 'get',
            });
            let userId = resultUser[0]?.Sf_Id

            const creds = { accessToken, instanceUrl, userId };
            const result = await dataSyncer(creds, fetchRecords, apiFetch, apiComposite,
                (msg) => {
                    if (msg && typeof msg === 'string') {
                        setSyncTextGet(msg);
                    }
                }
            );
            if (beatDayIds?.length > 0) {
                for (const beatDayId of beatDayIds) {
                    try {
                        const apibatchResponse = await apiFetch(
                            'POST',
                            'beatdayendofday',
                            { beatDayId },
                            'Custom'
                        );

                        console.log(
                            `Response for ${beatDayId}:`,
                            JSON.stringify(apibatchResponse)
                        );
                    } catch (error) {
                        console.error(`Error for ${beatDayId}:`, error);
                    }
                }
            }


            if (result.status === 'success') {
                setSyncTextGet(`Getting Data...`);
                showToastvisible('success', 'Sync Completed');
                dispatch(triggerAppReload());
                dispatch(setCheckInStatus({
                    VisitId: null,
                    status: null,
                    date: null,
                }));
                onStartDay();
            } else {
                setSyncTextGet(`Get Data`);
                console.log(" Sync Failed", result.message || "An error occurred during sync.");
                showToastvisible('error', 'Sync Failed');
            }
        } catch (err) {
            setSyncTextGet(`Get Data`);
            console.error('Sync error:', err);
            showToastvisible('error', 'Sync Failed');
        } finally {
            setSyncTextGet(`Get Data`);
            setIsSyncingGet(false);
        }
    }

    const handleSyncData = async () => {
        await syncAttendanceRecords(apiFetch);
        await syncBeatDayRecord(apiFetch);
        await syncVisitRecord(apiFetch, apiComposite);
        await syncOrderRecord(apiFetch);
        await syncOrderItemRecord(apiFetch);
        await syncCollectionRecord(apiFetch);
        await syncCollectionAllocationRecord(apiFetch);
        await syncInvoiceRecord(apiFetch)
        await syncInvoiceItemRecord(apiFetch)
        await syncAccountRecord(apiFetch);
        await syncFormJsonecord(apiFetch);
        await syncCompetitorRecord(apiFetch);
        await syncStockCheckRecord(apiFetch);
        await syncSalaryAcknowledgementRecord(apiFetch);
        await syncGamificationTransactionRecord(apiFetch);
        await syncMTExceptionRecord(apiFetch);
        await syncGrowthMappingEntryRecord(apiFetch);
        await syncHNTCompetitorPriceRecord(apiFetch);
    };

    const confirmLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await handleLogoutFromParent();
                    },
                },
            ],
            { cancelable: true }
        );
    };
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>

                <View style={styles.bottomContainer}>

                    {/* Drag Indicator */}
                    <View style={styles.dragIndicator} />
                    <View style={styles.header}>
                        <TouchableOpacity activeOpacity={0.85} onPress={confirmLogout}>
                            <LinearGradient
                                colors={['#a9341dff', '#f22715ff']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.button}
                            >
                                <Text style={styles.logoutText}>Logout</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Icon Circle */}
                    <View style={styles.iconWrapper}>
                        <Text style={styles.icon}></Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Start Your Day</Text>

                    {/* Subtitle */}
                    <Text style={styles.subtitle}>Sync Required</Text>

                    {/* Message */}
                    <Text style={styles.message}>
                        Your data is not synced for today. Please sync now to continue using the app without interruption.
                    </Text>

                    {/* CTA Button */}
                    <TouchableOpacity activeOpacity={0.85} onPress={onStartDayModal}>
                        <LinearGradient
                            colors={['#A67C2E', '#C9A24D']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.button}
                        >
                            <Text style={styles.buttonText}>Sync Data</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                </View>
            </View>
            {isSyncingGet && (
                <View style={styles.loadingOverlay}>
                    <Spinner size={40} type="Wave" color="#C9A24D" />
                    <Text style={styles.loadingText}>{syncTextGet}</Text>
                </View>
            )}
        </Modal>
    );
};

export default StartDayModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    bottomContainer: {
        width: "100%",
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 50,
        alignItems: "center",

        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
    },
    dragIndicator: {
        width: 45,
        height: 5,
        backgroundColor: "#ddd",
        borderRadius: 10,
        marginBottom: 18,
    },

    iconWrapper: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "#EEF4FF",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 15,
    },
    icon: {
        fontSize: 32,
    },

    title: {
        fontSize: 22,
        fontWeight: "700",
        color: "#111",
    },

    subtitle: {
        fontSize: 16,
        color: "#A67C2E",
        marginTop: 0,
        marginBottom: 8,
        fontWeight: "600",
    },

    message: {
        fontSize: 16,
        textAlign: "center",
        color: "#000",
        marginBottom: 25,
        paddingHorizontal: 0,
    },

    button: {
        width: "100%",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: "center",

        // button shadow
        shadowColor: "#C9A24D",
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 5,
    },

    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        zIndex: 999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: '500',
        color: '#A67C2E',
    },
    header: {
        width: "100%",
        alignItems: "flex-end",
        marginBottom: 5,
    },
    logoutText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
    },
});
