import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Modal,
    TextInput,
    StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Dropdown } from "react-native-element-dropdown";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { showToast } from "../redux/slices/toastSlice";

export default function OutletReassignment() {
    const navigation = useNavigation<any>();
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const { apiFetch, fetchRecords } = useApiFetch();
    const auth = useSelector((state: any) => state.auth);

    const [loading, setLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState("");
    const [beats, setBeats] = useState<any[]>([]);
    const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);

    const [retailers, setRetailers] = useState<any[]>([]);
    const [selectedRetailers, setSelectedRetailers] = useState<string[]>([]); // stores Account__c IDs

    // Modal States
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [targetBeatId, setTargetBeatId] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);

    const idMatches = (id1?: string, id2?: string): boolean => {
        if (!id1 || !id2) return false;
        return id1.substring(0, 15) === id2.substring(0, 15);
    };

    const fetchPendingRequests = async () => {
        try {
            const queryPending = `
            SELECT Id, Status__c, Current_Beat__c, New_Beat__c, Outlet__c, Request_Type__c
            FROM Beat_Reassignment_Request__c
            WHERE Status__c = 'Pending Admin Approval' OR Status__c = 'Pending RSM Approval' OR Status__c = 'Submitted'
          `;
            const reqRecords = await fetchRecords("Beat_Reassignment_Request__c", queryPending);
            if (Array.isArray(reqRecords)) {
                setPendingRequests(reqRecords);
            }
        } catch (pendingErr) {
            console.warn("Failed to fetch pending reassignment requests:", pendingErr);
        }
    };

    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            try {
                // Fetch pending requests first
                await fetchPendingRequests();

                // 1. Get current logged in user ID
                const loggedInUser = await UniversalUpdateInsert({
                    ObjectName: "User",
                    Type: "get",
                });
                const userId = auth?.userId || (loggedInUser && loggedInUser[0]?.Sf_Id);
                setCurrentUserId(userId || "");

                if (userId) {
                    // 2. Fetch User BA Mappings to find active distributors
                    const query1 = `
            SELECT Id, Name, Account__c, Account__r.Name, User__c, User__r.Name
            FROM User_BA_Mapping__c
            WHERE Is_Active__c = true AND Status__c = 'Active'
          `;
                    const baMappings = await fetchRecords("User_BA_Mapping__c", query1);

                    if (Array.isArray(baMappings) && baMappings.length > 0) {
                        const distributorIds = baMappings
                            .map((item: any) => item.Account__c)
                            .filter((id: any) => id);

                        if (distributorIds.length > 0) {
                            // 3. Fetch Beats under these distributors
                            const distributorFilter = distributorIds.map((id: string) => `'${id}'`).join(", ");
                            const query2 = `
                SELECT Id, Name, Beat_Status__c, Beat_Visit_Frequency__c, Distributor__c, Distributor__r.Name
                FROM Beat__c
                WHERE Distributor__c IN (${distributorFilter})
              `;
                            const beatsList = await fetchRecords("Beat__c", query2);
                            if (Array.isArray(beatsList)) {
                                setBeats(beatsList);
                            } else {
                                setBeats([]);
                            }
                        } else {
                            setBeats([]);
                        }
                    } else {
                        setBeats([]);
                    }
                } else {
                    setBeats([]);
                }
            } catch (error) {
                console.error("Error fetching initial data for OutletReassignment:", error);
                setBeats([]);
            } finally {
                setLoading(false);
            }
        };

        initData();
    }, []);

    // Fetch Retailers when a Beat is selected
    const handleBeatSelect = async (beatId: string) => {
        setSelectedBeatId(beatId);
        setSelectedRetailers([]);
        setRetailers([]);
        setLoading(true);
        try {
            const query3 = `
        SELECT Id, Name, Beat__c, Beat__r.Name, Beat__r.Distributor__c, Beat__r.Distributor__r.Name, Account__c, Account__r.Name, Account__r.RecordType.Name
        FROM Beat_Mapping__c
        WHERE Beat__c = '${beatId}' AND Account__r.RecordType.Name = 'Retailer' AND Status__c = 'Active' AND Is_Active__c = true
      `;
            const beatMappings = await fetchRecords("Beat_Mapping__c", query3);
            if (Array.isArray(beatMappings)) {
                setRetailers(beatMappings);
            }
        } catch (error) {
            console.error("Error fetching retailers for beat:", error);
        } finally {
            setLoading(false);
        }
    };

    // Toggle Retailer Selection
    const toggleRetailer = (accountId: string) => {
        if (selectedRetailers.includes(accountId)) {
            setSelectedRetailers(selectedRetailers.filter((id) => id !== accountId));
        } else {
            setSelectedRetailers([...selectedRetailers, accountId]);
        }
    };

    // Handle Submit request to Salesforce
    const handleSubmit = async () => {
        if (!selectedBeatId || selectedRetailers.length === 0 || !targetBeatId || !reason.trim()) {
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                allOrNone: true,
                records: selectedRetailers.map((outletId) => ({
                    attributes: { type: "Beat_Reassignment_Request__c" },
                    Request_Type__c: "Outlet Reassignment",
                    Current_Beat__c: selectedBeatId,
                    New_Beat__c: targetBeatId,
                    Outlet__c: outletId,
                    Reason__c: reason.trim(),
                })),
            };

            console.log("Submitting Outlet Reassignment (Composite):", payload);
            const response = await apiFetch(
                "POST",
                "composite/sobjects",
                payload,
                "SObjects"
            );

            if (response && response.status === "success") {
                dispatch(
                    showToast({
                        message: "Outlet reassignment request submitted successfully!",
                        type: "success",
                    })
                );
                setIsModalVisible(false);
                // Refresh pending requests to update UI immediately
                await fetchPendingRequests();
                // Reset states
                setSelectedBeatId(null);
                setRetailers([]);
                setSelectedRetailers([]);
                setTargetBeatId(null);
                setReason("");
            } else {
                dispatch(
                    showToast({
                        message: "Failed to submit outlet reassignment request.",
                        type: "error",
                    })
                );
            }
        } catch (error) {
            console.error("Submission failed:", error);
            dispatch(
                showToast({
                    message: "An error occurred during submission.",
                    type: "error",
                })
            );
        } finally {
            setSubmitting(false);
        }
    };

    // Prepare source beat list items
    const beatDropdownData = beats.map((b) => ({
        label: `${b.Name} (${b.Distributor__r?.Name || "No Distributor"})`,
        value: b.Id || b.Sf_Id,
    }));

    // Prepare destination beat list items (excluding current selected beat)
    const destinationDropdownData = beats
        .filter((b) => (b.Id || b.Sf_Id) !== selectedBeatId)
        .map((b) => ({
            label: `${b.Name} (${b.Distributor__r?.Name || "No Distributor"})`,
            value: b.Id || b.Sf_Id,
        }));

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

            {/* Header */}
            <LinearGradient
                colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.header, { paddingTop: insets.top || 16 }]}
            >
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Outlet Reassignment</Text>
                <View style={{ width: 36 }} />
            </LinearGradient>

            {loading && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color="#C9A24D" />
                </View>
            )}

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Source Beat Selector Card */}
                <View style={styles.card}>
                    <View style={styles.inputLabelRow}>
                        <Ionicons name="map-outline" size={16} color="#7A7266" />
                        <Text style={styles.inputLabel}>SELECT SOURCE BEAT</Text>
                    </View>
                    <Dropdown
                        data={beatDropdownData}
                        labelField="label"
                        valueField="value"
                        style={styles.dropdown}
                        placeholderStyle={styles.placeholder}
                        selectedTextStyle={styles.selectedText}
                        itemTextStyle={{ fontSize: 13, color: "#1F1D1A" }}
                        placeholder="Select Beat"
                        value={selectedBeatId}
                        onChange={(item) => handleBeatSelect(item.value)}
                        containerStyle={{
                            elevation: 0,
                            shadowColor: "transparent",
                            shadowOpacity: 0,
                            borderWidth: 1,
                            borderColor: "#D9D2C3",
                        }}
                        renderNoItems={() => (
                            <View style={{ padding: 12, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ color: "#7A7266", fontSize: 13, fontWeight: "500" }}>No data found</Text>
                            </View>
                        )}
                    />
                </View>

                {/* Retailers List Section */}
                {selectedBeatId && (
                    <View style={styles.retailersSection}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionHeader}>Outlets in Beat</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{retailers.length}</Text>
                            </View>
                        </View>

                        {retailers.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="storefront-outline" size={32} color="#7A7266" />
                                <Text style={styles.emptyText}>No outlets found in this beat</Text>
                            </View>
                        ) : (
                            retailers.map((item) => {
                                const accountId = item.Account__c;
                                const isSelected = selectedRetailers.includes(accountId);
                                const isPending = pendingRequests.some(
                                    (req: any) =>
                                        req.Request_Type__c === "Outlet Reassignment" && idMatches(req.Outlet__c, accountId)
                                );

                                return (
                                    <TouchableOpacity
                                        key={item.Id || item.Sf_Id}
                                        style={[
                                            styles.retailerCard,
                                            isSelected && styles.retailerCardSelected,
                                            isPending && styles.retailerCardDisabled
                                        ]}
                                        disabled={isPending}
                                        onPress={() => toggleRetailer(accountId)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.retailerContent}>
                                            <Text style={[
                                                styles.retailerName,
                                                isSelected && styles.retailerNameSelected,
                                                isPending && styles.retailerNameDisabled
                                            ]}>
                                                {item.Account__r?.Name || item.Name}
                                            </Text>
                                            <Text style={styles.retailerType}>
                                                Distributor: {item.Beat__r?.Distributor__r?.Name || "No Distributor"}
                                            </Text>
                                            <Text style={styles.retailerType}>
                                                Type: {item.Account__r?.RecordType?.Name || "Standard"}
                                            </Text>
                                            {isPending && (
                                                <View style={styles.pendingStatusRow}>
                                                    <Ionicons name="time-outline" size={12} color="#D08C1F" style={{ marginRight: 4 }} />
                                                    <Text style={styles.pendingText}>Pending Reassignment</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Ionicons
                                            name={isPending ? "ban-outline" : isSelected ? "checkbox" : "square-outline"}
                                            size={22}
                                            color={isPending ? "#D9D2C3" : isSelected ? "#A67C2E" : "#7A7266"}
                                        />
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Next Button Footer */}
            {selectedBeatId && retailers.length > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.nextBtn,
                            selectedRetailers.length === 0 && styles.nextBtnDisabled,
                        ]}
                        disabled={selectedRetailers.length === 0}
                        onPress={() => setIsModalVisible(true)}
                    >
                        <Text style={styles.nextBtnText}>Next ({selectedRetailers.length})</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Target Beat Selection & Reason Modal */}
            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Reassign Outlets</Text>
                        <Text style={styles.modalSubtitle}>
                            Select a target beat to move the {selectedRetailers.length} selected outlets to.
                        </Text>

                        {/* Target Beat Dropdown */}
                        <Text style={styles.modalLabel}>TARGET BEAT</Text>
                        <Dropdown
                            data={destinationDropdownData}
                            labelField="label"
                            valueField="value"
                            style={styles.modalDropdown}
                            placeholderStyle={styles.placeholder}
                            selectedTextStyle={styles.selectedText}
                            itemTextStyle={{ fontSize: 13, color: "#1F1D1A" }}
                            placeholder="Select Target Beat"
                            value={targetBeatId}
                            onChange={(item) => setTargetBeatId(item.value)}
                            renderNoItems={() => (
                                <View style={{ padding: 12, alignItems: "center", justifyContent: "center" }}>
                                    <Text style={{ color: "#7A7266", fontSize: 13, fontWeight: "500" }}>No data found</Text>
                                </View>
                            )}
                        />

                        {/* Reason Text Input - Shows once target beat is selected */}
                        {targetBeatId !== null && (
                            <>
                                <Text style={styles.modalLabel}>REASON FOR REASSIGNMENT <Text style={{ color: "#E11D48" }}>*</Text></Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Enter reason for reassignment (Required)"
                                    placeholderTextColor="#7A7266"
                                    value={reason}
                                    onChangeText={setReason}
                                    multiline={true}
                                    numberOfLines={3}
                                />
                            </>
                        )}

                        {/* Modal Action Buttons */}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => {
                                    setIsModalVisible(false);
                                    setTargetBeatId(null);
                                    setReason("");
                                }}
                                disabled={submitting}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.confirmBtn,
                                    (!targetBeatId || !reason.trim() || submitting) && styles.confirmBtnDisabled,
                                ]}
                                onPress={handleSubmit}
                                disabled={!targetBeatId || !reason.trim() || submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.confirmBtnText}>Submit</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 4,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: "rgba(255, 255, 255, 0.15)",
    },
    headerTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
        letterSpacing: 0.5,
    },
    content: {
        padding: 16,
        paddingBottom: 120,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        shadowColor: "rgba(15, 23, 42, 0.06)",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: "#F1EADB",
        marginBottom: 20,
    },
    inputLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
        gap: 6,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#7A7266",
        letterSpacing: 0.5,
    },
    dropdown: {
        borderWidth: 1,
        borderColor: "#D9D2C3",
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 46,
        backgroundColor: "#FBF8F1",
    },
    placeholder: {
        color: "#7A7266",
        fontSize: 13,
    },
    selectedText: {
        color: "#1F1D1A",
        fontSize: 13,
        fontWeight: "600",
    },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255, 255, 255, 0.75)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
    },
    retailersSection: {
        marginTop: 10,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
        gap: 8,
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: "800",
        color: "#1F1D1A",
    },
    badge: {
        backgroundColor: "#F1EADB",
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: "#D9D2C3",
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#7A7266",
    },
    retailerCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#D9D2C3",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "rgba(15, 23, 42, 0.04)",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
        elevation: 2,
    },
    retailerCardSelected: {
        borderColor: "#FCA5A5",
        backgroundColor: "#FEF2F2",
    },
    retailerCardDisabled: {
        backgroundColor: "#FBF8F1",
        borderColor: "#D9D2C3",
        opacity: 0.7,
    },
    retailerContent: {
        flex: 1,
        marginRight: 8,
    },
    retailerName: {
        fontSize: 13.5,
        fontWeight: "700",
        color: "#1F1D1A",
    },
    retailerNameSelected: {
        color: "#A67C2E",
    },
    retailerNameDisabled: {
        color: "#7A7266",
        textDecorationLine: "none",
    },
    retailerType: {
        fontSize: 11,
        color: "#7A7266",
        marginTop: 3,
    },
    pendingStatusRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    pendingText: {
        fontSize: 10.5,
        color: "#D08C1F",
        fontWeight: "700",
    },
    dropdownItem: {
        padding: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    dropdownItemDisabled: {
        backgroundColor: "#FBF8F1",
        opacity: 0.6,
    },
    dropdownItemText: {
        fontSize: 13,
        color: "#1F1D1A",
        flex: 1,
    },
    dropdownItemTextDisabled: {
        color: "#7A7266",
    },
    dropdownPendingBadge: {
        backgroundColor: "#FBEFD8",
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 8,
        borderWidth: 0.5,
        borderColor: "#F59E0B",
    },
    dropdownPendingBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#D08C1F",
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#F1EADB",
    },
    emptyText: {
        color: "#7A7266",
        fontSize: 14,
        fontWeight: "600",
        marginTop: 8,
        textAlign: "center",
    },
    footer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        paddingTop: 8,
        paddingBottom: 8,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderColor: "#F1EADB",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 8,
    },
    nextBtn: {
        height: 36,
        borderRadius: 8,
        backgroundColor: "#A67C2E",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
    },
    nextBtnDisabled: {
        backgroundColor: "#D9D2C3",
        opacity: 0.6,
    },
    nextBtnText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContainer: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        width: "100%",
        maxWidth: 340,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: "#F1EADB",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1F1D1A",
        marginBottom: 6,
        textAlign: "center",
    },
    modalSubtitle: {
        fontSize: 13,
        color: "#7A7266",
        marginBottom: 18,
        textAlign: "center",
        lineHeight: 18,
    },
    modalLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#7A7266",
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    modalDropdown: {
        borderWidth: 1,
        borderColor: "#D9D2C3",
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 46,
        backgroundColor: "#FBF8F1",
        marginBottom: 20,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: "#D9D2C3",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 60,
        backgroundColor: "#FBF8F1",
        color: "#1F1D1A",
        fontSize: 13,
        marginBottom: 20,
        textAlignVertical: "top",
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        height: 40,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#D9D2C3",
        backgroundColor: "#FBF8F1",
    },
    cancelBtnText: {
        color: "#7A7266",
        fontSize: 13,
        fontWeight: "700",
    },
    confirmBtn: {
        flex: 1,
        height: 40,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#A67C2E",
    },
    confirmBtnDisabled: {
        backgroundColor: "#D9D2C3",
        opacity: 0.6,
    },
    confirmBtnText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
});
