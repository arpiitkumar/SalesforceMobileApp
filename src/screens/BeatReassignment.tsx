import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  StatusBar,
  TextInput,
} from "react-native";
import DatePicker from "react-native-date-picker";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Dropdown } from "react-native-element-dropdown";
import { Colors } from "../theme";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { useDispatch, useSelector } from "react-redux";
import { showToast } from "../redux/slices/toastSlice";
import { isInternetAvailable } from "../utils/networkUtils";
import moment from "moment";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BeatReassignment() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { apiFetch, fetchRecords } = useApiFetch();
  const auth = useSelector((state: any) => state.auth);

  const [loading, setLoading] = useState(false);
  const [managerId, setManagerId] = useState("");
  const [subordinates, setSubordinates] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [beats, setBeats] = useState<any[]>([]);
  const [selectedBeats, setSelectedBeats] = useState<string[]>([]);

  // Manual Reassignment Modal States
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualTargetUser, setManualTargetUser] = useState<string | null>(null);
  const [manualReason, setManualReason] = useState("");
  const [manualEffectiveDate, setManualEffectiveDate] = useState<Date>(new Date());
  const [showManualDatePicker, setShowManualDatePicker] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);



  useEffect(() => {
    const fetchRequiredData = async () => {
      setLoading(true);
      try {
        // 1. Get logged in User
        const loggedInUser = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        const currentUserId = auth?.userId || (loggedInUser && loggedInUser[0]?.Sf_Id);
        setManagerId(currentUserId || "");

        // 2. Fetch subordinate users
        let usersLoaded = false;
        const connected = await isInternetAvailable();
        if (connected && currentUserId) {
          try {
            console.log("Fetching active sub-hierarchy users from Salesforce for Beat Reassignment...");
            const query = `
              SELECT Id, Name, Email, Title, Phone, ManagerId, Manager.Name, UserRole.Name, EmployeeCode__c, Username
              FROM User 
              WHERE IsActive = true 
                AND (
                     ManagerId = '${currentUserId}' 
                  OR Manager.ManagerId = '${currentUserId}' 
                  OR Manager.Manager.ManagerId = '${currentUserId}' 
                  OR Manager.Manager.Manager.ManagerId = '${currentUserId}' 
                  OR Manager.Manager.Manager.Manager.ManagerId = '${currentUserId}'
                )
              ORDER BY Name ASC
            `;
            const records = await fetchRecords("User", query);
            if (Array.isArray(records)) {
              const allowedRoles = ["ASM", "ASE", "ASO", "SO", "ISR", "SR"];
              const mappedRecords = records.map((u: any) => ({
                ...u,
                Sf_Id: u.Id || u.Sf_Id,
                Role: u.UserRole?.Name || u.Title || "User"
              })).filter((u: any) => {
                const roleStr = String(u.Role || "").toUpperCase();
                const titleStr = String(u.Title || "").toUpperCase();
                const userRoleNameStr = String(u.UserRole?.Name || "").toUpperCase();

                const matchesAllowed = allowedRoles.some(allowed =>
                  roleStr.includes(allowed) || titleStr.includes(allowed) || userRoleNameStr.includes(allowed)
                );
                const hasDsm = roleStr.includes("DSM") || titleStr.includes("DSM") || userRoleNameStr.includes("DSM");
                const hasRsm = roleStr.includes("RSM") || titleStr.includes("RSM") || userRoleNameStr.includes("RSM");
                const isAboveRsm = roleStr.includes("NSM") || roleStr.includes("VP") || roleStr.includes("DIRECTOR") || roleStr.includes("ADMIN");

                return matchesAllowed && !hasDsm && !hasRsm && !isAboveRsm;
              });
              setSubordinates(mappedRecords);
              usersLoaded = true;
            }
          } catch (apiErr) {
            console.warn("Salesforce users query failed, falling back to local:", apiErr);
          }
        }

        if (!usersLoaded) {
          const allSubs = await UniversalUpdateInsert({
            ObjectName: "so_users",
            Type: "get",
          });
          if (Array.isArray(allSubs)) {
            const allowedRoles = ["ASM", "ASE", "ASO", "SO", "ISR", "SR"];
            const filteredLocal = allSubs.filter((u: any) => {
              const roleStr = String(u.Role || "").toUpperCase();
              const devNameStr = String(u.DeveloperName || "").toUpperCase();

              const matchesAllowed = allowedRoles.some(allowed =>
                roleStr.includes(allowed) || devNameStr.includes(allowed)
              );
              const hasDsm = roleStr.includes("DSM") || devNameStr.includes("DSM");
              const hasRsm = roleStr.includes("RSM") || devNameStr.includes("RSM");
              const isAboveRsm = roleStr.includes("NSM") || roleStr.includes("VP") || roleStr.includes("DIRECTOR") || roleStr.includes("ADMIN");

              return matchesAllowed && !hasDsm && !hasRsm && !isAboveRsm;
            });
            setSubordinates(filteredLocal);
          }
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        dispatch(
          showToast({
            message: "Failed to load subordinate users.",
            type: "error",
          })
        );
      } finally {
        setLoading(false);
      }
    };
    fetchRequiredData();
  }, []);

  const handleUserSelect = async (userId: string) => {
    setSelectedSub(userId);
    setSelectedBeats([]);
    setLoading(true);
    try {
      let userBeats: any[] = [];
      let success = false;
      let pendingRequests: any[] = [];

      try {
        const requestQuery = `
          SELECT Id, Status__c, Current_User__c, Assigned_User__r.Name, Distributor_Account__c, Distributor_Account__r.Name 
          FROM Beat_Reassignment_Request__c 
          WHERE (Status__c = 'Pending Admin Approval' OR Status__c = 'Pending RSM Approval') 
            AND Current_User__c = '${userId}'
        `;
        console.log("Fetching Pending Beat Reassignments:", requestQuery);
        const reqRecords = await fetchRecords("Beat_Reassignment_Request__c", requestQuery);
        if (Array.isArray(reqRecords)) {
          pendingRequests = reqRecords;
        }
      } catch (reqError) {
        console.warn("Failed to fetch pending beat reassignment requests:", reqError);
      }

      try {
        // 1. Fetch User_BA_Mapping__c (from Salesforce)
        const userBaQuery = `
          SELECT Id, Name, Account__c, Account__r.Name, User__c, User__r.Name
          FROM User_BA_Mapping__c 
          WHERE User__c = '${userId}' AND Is_Active__c = true AND Status__c = 'Active'
        `;
        console.log("Fetching User BA Mappings for Beat Reassignment:", userBaQuery);
        const userBaMappings = await fetchRecords("User_BA_Mapping__c", userBaQuery);

        if (Array.isArray(userBaMappings) && userBaMappings.length > 0) {
          const accountIds = [
            ...new Set(userBaMappings.map((item: any) => item.Account__c).filter(Boolean)),
          ];

          if (accountIds.length > 0) {
            // 2. Fetch Beat__c based on Account IDs
            const accountFilter = accountIds.map((id) => `'${id}'`).join(",");
            const beatQuery = `
              SELECT Id, Name, Beat_Status__c, Beat_Visit_Frequency__c, 
                     Distributor__c, Distributor__r.Name
              FROM Beat__c
              WHERE Distributor__c IN (${accountFilter})
            `;
            console.log("Fetching Beats for Beat Reassignment:", beatQuery);
            const records = await fetchRecords("Beat__c", beatQuery);
            if (Array.isArray(records)) {
              userBeats = records.map((b: any) => {
                const mapping = userBaMappings.find((m: any) => m.Account__c === b.Distributor__c);
                return {
                  ...b,
                  User_BA_Mapping__c: mapping ? mapping.Id : null
                };
              });
              success = true;
            }
          }
        }
      } catch (sfError) {
        console.warn("Salesforce beat query failed, falling back to local database:", sfError);
      }

      if (success && userBeats.length > 0) {
        // Map to standard format for our checklist
        const mappedBeats = userBeats.map((b: any) => {
          const pendingReq = pendingRequests.find(
            (req: any) => req.Distributor_Account__c === b.Distributor__c
          );
          return {
            id: b.Id || b.id,
            Sf_Id: b.Id || b.id,
            Beat__c: b.Id || b.id,
            BeatName: b.Name,
            PartyCode__c: b.Distributor__r?.Name || b.Distributor__c || "",
            Distributor__c: b.Distributor__c || "",
            User_BA_Mapping__c: b.User_BA_Mapping__c || null,
            isPendingApproval: !!pendingReq,
            pendingStatus: pendingReq ? pendingReq.Status__c : null,
            assignedUserName: pendingReq?.Assigned_User__r?.Name || null
          };
        });
        setBeats(mappedBeats);
      } else {
        // Offline fallback: load from local SR_Beat_Assignment__c table
        console.log("Loading beats from local database fallback...");
        const assignedBeats = await UniversalUpdateInsert({
          ObjectName: "SR_Beat_Assignment__c",
          Type: "get",
        });

        if (Array.isArray(assignedBeats)) {
          const filteredBeats = assignedBeats.filter(
            (b: any) => b.Assigned_To__c === userId && b.isActive__c !== false
          );
          const mappedBeats = filteredBeats.map((b: any) => ({
            id: b.id,
            Sf_Id: b.Sf_Id,
            Beat__c: b.Beat__c,
            BeatName: b.BeatName || b.Name,
            PartyCode__c: b.PartyCode__c || "",
            Distributor__c: b.Distributor__c || "",
            isPendingApproval: false,
            pendingStatus: null,
            assignedUserName: null
          }));
          setBeats(mappedBeats);
        } else {
          setBeats([]);
        }
      }
    } catch (error) {
      console.error("Error fetching beats:", error);
      dispatch(
        showToast({
          message: "Failed to load beats for selected user.",
          type: "error",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleBeatSelection = (beatId: string) => {
    const beat = beats.find((b) => b.id === beatId || b.Sf_Id === beatId);
    if (beat?.isPendingApproval) return;

    setSelectedBeats((prev) =>
      prev.includes(beatId) ? prev.filter((id) => id !== beatId) : [...prev, beatId]
    );
  };



  const handleManualReassign = async () => {
    if (selectedBeats.length === 0) {
      dispatch(
        showToast({
          message: "Please select at least one beat.",
          type: "warning",
        })
      );
      return;
    }
    setManualTargetUser(null);
    setManualReason("");
    setManualEffectiveDate(new Date());
    setShowErrors(false);
    setManualModalVisible(true);
  };

  const handleManualSubmit = async () => {
    let hasError = false;
    if (!manualTargetUser) {
      hasError = true;
    }
    if (!manualReason.trim()) {
      hasError = true;
    }

    if (hasError) {
      setShowErrors(true);
      return;
    }

    const targetUserObj = subordinates.find((s) => s.Sf_Id === manualTargetUser);
    if (!targetUserObj) return;

    const connected = await isInternetAvailable();
    if (!connected) {
      dispatch(
        showToast({
          message: "Internet connection is required to submit manual reassignment.",
          type: "error",
        })
      );
      return;
    }

    setManualSubmitting(true);
    try {
      let successCount = 0;

      for (const beatId of selectedBeats) {
        const beatObj = beats.find((b) => b.id === beatId || b.Sf_Id === beatId);
        if (!beatObj) continue;

        const payload = {
          Current_User__c: selectedSub || "",
          Distributor_Account__c: beatObj.Distributor__c || null,
          User_BA_Mapping__c: beatObj.User_BA_Mapping__c || null,
          Requested_By__c: managerId || "",
          Assignment_Type__c: "Specific User",
          Assigned_User__c: targetUserObj.Sf_Id,
          Reason__c: manualReason,
          Effective_Date__c: moment(manualEffectiveDate).format("YYYY-MM-DD"),
        };

        console.log("Submitting Manual Request:", payload);
        const response = await apiFetch(
          "POST",
          "sobjects/Beat_Reassignment_Request__c",
          payload,
          "SObjects"
        );
        if (response && response.status === "success") {
          successCount++;
        }
      }

      if (successCount > 0) {
        dispatch(
          showToast({
            message: "Beats reassigned manually successfully.",
            type: "success",
          })
        );
        setManualModalVisible(false);
        // Refresh beats list
        if (selectedSub) {
          handleUserSelect(selectedSub);
        }

        const recordsToUpdate = selectedBeats.map((beatId) => {
          const beatObj = beats.find((b) => b.id === beatId || b.Sf_Id === beatId);
          return {
            Sf_Id: beatObj?.Sf_Id || beatId,
            Assigned_To__c: targetUserObj.Sf_Id,
            SalesRepresentativeName: targetUserObj.Name,
            is_locally_changed: true,
            operation_type: "update",
          };
        });

        console.log("Updating SR_Beat_Assignment__c locally:", recordsToUpdate);
        UniversalUpdateInsert({
          ObjectName: "SR_Beat_Assignment__c",
          Type: "insert",
          data: recordsToUpdate,
        }).catch((err) => {
          console.error("Failed to update beat assignments locally:", err);
        });
      } else {
        dispatch(
          showToast({
            message: "Failed to submit reassignment request to Salesforce.",
            type: "error",
          })
        );
      }
    } catch (error) {
      console.error("Manual reassignment failed:", error);
      dispatch(
        showToast({
          message: "Failed to update assignments.",
          type: "error",
        })
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  const dropdownData = subordinates.map((item) => {
    const empCode = item.EmployeeCode__c ? ` (${item.EmployeeCode__c})` : "";
    return {
      label: `${item.Name}${empCode} (${item.Role || "User"})`,
      value: item.Sf_Id,
    };
  });

  const manualDropdownData = subordinates
    .filter((item) => item.Sf_Id !== selectedSub)
    .map((item) => {
      const empCode = item.EmployeeCode__c ? ` (${item.EmployeeCode__c})` : "";
      return {
        label: `${item.Name}${empCode} (${item.Role || "User"})`,
        value: item.Sf_Id,
      };
    });

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
        <Text style={styles.headerTitle}>Beat Reassignment</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {loading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#C9A24D" />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Dropdown Container */}
        <View style={styles.card}>
          <View style={styles.inputLabelRow}>
            <Ionicons name="people-outline" size={16} color="#7A7266" />
            <Text style={styles.inputLabel}>SELECT SUBORDINATE USER</Text>
          </View>
          <Dropdown
            data={dropdownData}
            labelField="label"
            valueField="value"
            style={styles.dropdown}
            placeholderStyle={styles.placeholder}
            selectedTextStyle={styles.selectedText}
            itemTextStyle={{ fontSize: 13, color: "#1F1D1A" }}
            placeholder="Select User"
            value={selectedSub}
            onChange={(item) => handleUserSelect(item.value)}
          />
        </View>

        {/* Beats Checklist */}
        {selectedSub && (
          <View style={styles.beatsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Assigned Beats</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{beats.length}</Text>
              </View>
            </View>
            {beats.map((item) => {
              const isSelected = selectedBeats.includes(item.id || item.Sf_Id);
              return (
                <TouchableOpacity
                  key={item.id || item.Sf_Id}
                  style={[
                    styles.beatCard,
                    isSelected && styles.beatCardSelected,
                    item.isPendingApproval && styles.beatCardDisabled,
                  ]}
                  activeOpacity={item.isPendingApproval ? 1.0 : 0.8}
                  onPress={() => toggleBeatSelection(item.id || item.Sf_Id)}
                  disabled={item.isPendingApproval}
                >
                  {isSelected && <View style={styles.cardIndicator} />}

                  <View style={[
                    styles.cardIconWrapper,
                    isSelected && styles.cardIconWrapperSelected,
                    item.isPendingApproval && styles.cardIconWrapperDisabled
                  ]}>
                    <Ionicons
                      name={item.isPendingApproval ? "lock-closed-outline" : "map-outline"}
                      size={15}
                      color={item.isPendingApproval ? "#7A7266" : (isSelected ? "#A67C2E" : "#7A7266")}
                    />
                  </View>

                  <View style={styles.beatCardContent}>
                    <Text style={[
                      styles.beatName,
                      isSelected && styles.beatNameSelected,
                      item.isPendingApproval && styles.beatNameDisabled
                    ]}>
                      {item.BeatName || item.Name}
                    </Text>
                    {item.PartyCode__c ? (
                      <View style={styles.distributorRow}>
                        <Ionicons name="business-outline" size={11} color="#7A7266" style={{ marginRight: 4 }} />
                        <Text style={styles.beatParty} numberOfLines={1}>
                          Distributor: {item.PartyCode__c}
                        </Text>
                      </View>
                    ) : null}
                    {item.isPendingApproval ? (
                      <View style={styles.pendingStatusRow}>
                        <Ionicons name="time-outline" size={11} color="#D08C1F" style={{ marginRight: 4 }} />
                        <Text style={styles.pendingText} numberOfLines={1}>
                          {item.pendingStatus || "Pending Approval"}
                          {item.assignedUserName ? ` (to ${item.assignedUserName})` : ""}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons
                    name={item.isPendingApproval ? "lock-closed-outline" : (isSelected ? "checkmark-circle" : "ellipse-outline")}
                    size={20}
                    color={item.isPendingApproval ? "#7A7266" : (isSelected ? "#A67C2E" : "#D9D2C3")}
                  />
                </TouchableOpacity>
              );
            })}

            {beats.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={44} color="#D9D2C3" />
                <Text style={styles.emptyText}>No active beats mapped to this user.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer Actions */}
      {selectedSub && beats.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.manualBtn, { marginRight: 0 }]}
            onPress={handleManualReassign}
          >
            <Ionicons name="create-outline" size={15} color="#A67C2E" style={{ marginRight: 4 }} />
            <Text style={styles.manualBtnText}>Beat Assign</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual Reassignment Modal */}
      <Modal visible={manualModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Beat Assign</Text>
            <Text style={styles.modalSubtitle}>
              Select target user, effective date, and enter reason.
            </Text>

            <Text style={styles.modalLabel}>
              TARGET USER <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Dropdown
              data={manualDropdownData}
              labelField="label"
              valueField="value"
              style={styles.modalDropdown}
              placeholderStyle={styles.placeholder}
              selectedTextStyle={styles.selectedText}
              itemTextStyle={{ fontSize: 13, color: "#1F1D1A" }}
              placeholder="Select Target User"
              value={manualTargetUser}
              onChange={(item) => setManualTargetUser(item.value)}
            />
            {!manualTargetUser && showErrors && (
              <Text style={styles.errorText}>Target User is required</Text>
            )}

            <Text style={styles.modalLabel}>EFFECTIVE DATE</Text>
            <TouchableOpacity
              style={styles.modalDateBtn}
              onPress={() => setShowManualDatePicker(true)}
            >
              <Text style={styles.modalDateText}>
                {moment(manualEffectiveDate).format("YYYY-MM-DD")}
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>
              REASON FOR REASSIGNMENT <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter Reason"
              placeholderTextColor="#7A7266"
              value={manualReason}
              onChangeText={setManualReason}
              multiline
            />
            {!manualReason.trim() && showErrors && (
              <Text style={styles.errorText}>Reason is required</Text>
            )}

            {manualSubmitting ? (
              <ActivityIndicator size="small" color="#A67C2E" style={{ marginVertical: 16 }} />
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setManualModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleManualSubmit}
                >
                  <Text style={styles.confirmBtnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <DatePicker
        modal
        open={showManualDatePicker}
        date={manualEffectiveDate}
        mode="date"
        onConfirm={(date) => {
          setShowManualDatePicker(false);
          setManualEffectiveDate(date);
        }}
        onCancel={() => {
          setShowManualDatePicker(false);
        }}
      />
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
    fontSize: 14,
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
  beatsSection: {
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
  beatCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    shadowColor: "rgba(15, 23, 42, 0.04)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  beatCardSelected: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  beatCardDisabled: {
    backgroundColor: "#FBF8F1",
    borderColor: "#D9D2C3",
    opacity: 0.8,
  },
  cardIconWrapperDisabled: {
    backgroundColor: "#D9D2C3",
  },
  beatNameDisabled: {
    color: "#7A7266",
    textDecorationLine: "none",
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
  cardIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#A67C2E",
  },
  cardIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1EADB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  cardIconWrapperSelected: {
    backgroundColor: "#FEE2E2",
  },
  beatCardContent: {
    flex: 1,
    marginRight: 8,
  },
  beatName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  beatNameSelected: {
    color: "#A67C2E",
  },
  distributorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  beatParty: {
    fontSize: 11,
    color: "#7A7266",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1EADB",
    shadowColor: "rgba(15, 23, 42, 0.03)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
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
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#F1EADB",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    overflow: "hidden",
  },
  manualBtn: {
    borderWidth: 1,
    borderColor: "#A67C2E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginRight: 8,
    backgroundColor: "#FFF",
  },
  manualBtnText: {
    color: "#A67C2E",
    fontSize: 13,
    fontWeight: "700",
  },
  adminBtn: {
    marginLeft: 8,
  },
  adminBtnInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  adminBtnText: {
    color: "#fff",
    fontSize: 13,
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
  modalDropdown: {
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: "#FBF8F1",
    marginBottom: 20,
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
  confirmBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
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
    marginBottom: 16,
    textAlignVertical: "top",
  },
  modalDateBtn: {
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: "#FBF8F1",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalDateText: {
    fontSize: 13,
    color: "#1F1D1A",
    fontWeight: "600",
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A7266",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  requiredStar: {
    color: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: -12,
    marginBottom: 12,
    fontWeight: "600",
  },
});
