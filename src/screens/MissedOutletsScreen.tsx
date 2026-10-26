import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  TouchableWithoutFeedback,
  FlatList,
  SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";
import moment from "moment";
import Ionicons from "react-native-vector-icons/Ionicons";
import HeaderMain from "../components/HeaderMain";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { isInternetAvailable } from "../utils/networkUtils";
import { showToast } from "../redux/slices/toastSlice";
import { RootState } from "../redux/store";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";

const { width } = Dimensions.get("window");

interface VisitItem {
  Id: string;
  Name: string;
  AccountId__c: string;
  AccountId__r: {
    Name: string;
  };
  BeatDay__c: string;
  BeatDay__r: {
    Beat_Date__c: string;
  };
  VisitStatus__c: string;
  Cancel_Reason__c?: string;
}

interface VisitSection {
  title: string;
  data: VisitItem[];
}

export default function MissedOutletsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { fetchRecords, apiComposite } = useApiFetch();
  const authState = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [sections, setSections] = useState<VisitSection[]>([]);
  const [selectedVisitIds, setSelectedVisitIds] = useState<Set<string>>(new Set());
  const [allVisits, setAllVisits] = useState<VisitItem[]>([]);
  const [todayBeatDay, setTodayBeatDay] = useState<any>(null);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  // Initialize and check online status
  useEffect(() => {
    const initialize = async () => {
      const isOnline = await isInternetAvailable();
      setOnline(isOnline);

      if (!isOnline) {
        setLoading(false);
        return;
      }

      // Determine Auth User ID
      let userId = authState?.userId;
      if (!userId) {
        try {
          const users = await UniversalUpdateInsert({ ObjectName: "User", Type: "get" });
          if (users && users.length > 0) {
            userId = users[0].Sf_Id;
          }
        } catch (e) {
          console.error("Failed to load user ID:", e);
        }
      }
      setAuthUserId(userId || null);
    };

    initialize();
  }, [authState]);

  // Fetch Missed Visits and Today's Beat Day once User ID is ready
  useEffect(() => {
    if (!authUserId || !online) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Fetch missed visits query
        const query = `
          SELECT Id, Name, AccountId__c, AccountId__r.Name, BeatDay__c, BeatDay__r.Beat_Date__c, VisitStatus__c, Cancel_Reason__c
          FROM Visit__c
          WHERE BeatDay__c IN (
              SELECT Id
              FROM Beat_Day__c
              WHERE OwnerId = '${authUserId}'
          )
          AND BeatDay__r.Beat_Date__c = LAST_N_DAYS:30
          AND BeatDay__r.Beat_Date__c < TODAY
          AND VisitStatus__c != 'Check In'
          AND (VisitStatus__c != 'Check Out' OR CheckInTime__c = null)
          AND Ad_Hoc_Missed_Outlet__c != true
          ORDER BY BeatDay__r.Beat_Date__c DESC
        `;
        const records = await fetchRecords("Visit__c", query);

        // Fetch today's visits to prevent showing already planned outlets
        const todayVisitsQuery = `
          SELECT AccountId__c
          FROM Visit__c
          WHERE BeatDay__r.Beat_Date__c = TODAY
          AND BeatDay__c IN (
              SELECT Id
              FROM Beat_Day__c
              WHERE OwnerId = '${authUserId}'
          )
        `;
        const todayVisitsRecords = await fetchRecords("Visit__c", todayVisitsQuery);
        const todayAccountIds = new Set(
          Array.isArray(todayVisitsRecords)
            ? todayVisitsRecords.map((r: any) => r.AccountId__c).filter(Boolean)
            : []
        );

        if (Array.isArray(records)) {
          const filteredRecords = records.filter(
            (rec: VisitItem) => !rec.AccountId__c || !todayAccountIds.has(rec.AccountId__c)
          );

          setAllVisits(filteredRecords);

          // Group by Date
          const groupedMap = new Map<string, VisitItem[]>();
          filteredRecords.forEach((rec: VisitItem) => {
            const dateStr = rec.BeatDay__r?.Beat_Date__c || "No Date";
            if (!groupedMap.has(dateStr)) {
              groupedMap.set(dateStr, []);
            }
            groupedMap.get(dateStr)!.push(rec);
          });

          const sortedSections: VisitSection[] = Array.from(groupedMap.entries())
            .map(([date, data]) => ({ title: date, data }))
            .sort((a, b) => moment(b.title).diff(moment(a.title))); // descending date order

          setSections(sortedSections);
        }

        // 2. Fetch today's Beat Day to check if we can create today's visits
        const todayStr = moment().format("YYYY-MM-DD");
        const beatDayQuery = `
          SELECT Id, Beat__c, Beat__r.Name
          FROM Beat_Day__c
          WHERE OwnerId = '${authUserId}'
          AND Beat_Date__c = ${todayStr}
          LIMIT 1
        `;
        const beatDayRecords = await fetchRecords("Beat_Day__c", beatDayQuery);
        if (Array.isArray(beatDayRecords) && beatDayRecords.length > 0) {
          setTodayBeatDay(beatDayRecords[0]);
        } else {
          setTodayBeatDay(null);
        }
      } catch (error) {
        console.error("Failed to load missed visits:", error);
        dispatch(
          showToast({
            message: "Failed to fetch missed visits from Salesforce.",
            type: "error",
          })
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authUserId, online]);

  // Handle visit selection toggle
  const toggleSelection = (id: string) => {
    setSelectedVisitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Get list of selected visits
  const selectedVisits = allVisits.filter((v) => selectedVisitIds.has(v.Id));

  // Get list of unique selected visits for display in modal
  const uniqueSelectedVisits = (() => {
    const seen = new Set<string>();
    return selectedVisits.filter(v => {
      if (seen.has(v.AccountId__c)) {
        return false;
      }
      seen.add(v.AccountId__c);
      return true;
    });
  })();

  // Find duplicate outlet names
  const duplicateOutlets = (() => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    selectedVisits.forEach((v) => {
      if (seen.has(v.AccountId__c)) {
        const name = v.AccountId__r?.Name || "Unknown Outlet";
        if (!duplicates.includes(name)) {
          duplicates.push(name);
        }
      } else {
        seen.add(v.AccountId__c);
      }
    });
    return duplicates;
  })();

  // Perform Visit Creation online
  const handleCreateOutlets = async () => {
    if (!todayBeatDay) {
      Alert.alert(
        "No Beat Day Today",
        "No Beat Day found for today. Please schedule/create a route plan for today first to enable visit creation."
      );
      return;
    }

    try {
      setCreating(true);

      const todayStr = moment().format("YYYY-MM-DD");
      const visitRequests: any[] = [];
      const createdAccountIds = new Set<string>();

      selectedVisits.forEach((v, index) => {
        // 1. Create new visit for today ONLY if we haven't created one for this AccountId__c yet
        if (!createdAccountIds.has(v.AccountId__c)) {
          createdAccountIds.add(v.AccountId__c);
          visitRequests.push({
            method: "POST",
            url: "/services/data/v61.0/sobjects/Visit__c",
            referenceId: `ref_create_missed_Visit_${index}`,
            body: {
              AccountId__c: v.AccountId__c,
              BeatDay__c: todayBeatDay.Id,
              Beat__c: todayBeatDay.Beat__c || null,
              VisitDate__c: todayStr,
              VisitStatus__c: "Planned",
              AdHocVisit__c: true,
              NonPjpOutlet__c: true,
              PJPOutlet__c: false,
              AdHocReason__c: "Missed Visit Carry Forward",
              VisitNotes__c: "Outlet was missed on previous date, carried forward to today.",
            },
          });
        }

        // 2. Update previous/original visit
        visitRequests.push({
          method: "PATCH",
          url: `/services/data/v61.0/sobjects/Visit__c/${v.Id}`,
          referenceId: `ref_update_previous_Visit_${index}`,
          body: {
            Ad_Hoc_Missed_Outlet__c: true,
          },
        });
      });

      const payload = {
        allOrNone: true,
        compositeRequest: visitRequests,
      };

      const response = await apiComposite("POST", "composite", payload);
      const hasError = response?.compositeResponse?.some(
        (sub: any) => sub.httpStatusCode >= 400
      );

      if (hasError) {
        const errorMsg =
          response?.compositeResponse?.find((sub: any) => sub.httpStatusCode >= 400)
            ?.body?.[0]?.message || "Failed to create visits.";
        throw new Error(errorMsg);
      }

      dispatch(
        showToast({
          message: `${selectedVisits.length} visits created successfully for today!`,
          type: "success",
        })
      );

      // Reset selection and close modal
      setSelectedVisitIds(new Set());
      setModalVisible(false);

      // Refresh list to exclude newly created? No, but go back
      navigation.goBack();
    } catch (e: any) {
      console.error("Failed to create visits:", e);
      Alert.alert("Error", e.message || "Failed to create today's visits.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      {/* Screen Header */}
      <View style={styles.headerContainer}>
        <HeaderMain screenName="Missed Outlets" />
      </View>

      {/* Main Body */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#C9A24D" />
            <Text style={styles.loadingText}>Fetching missed visits...</Text>
          </View>
        ) : !online ? (
          <View style={styles.centerContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color="#7A7266" />
            <Text style={styles.errorTitle}>Internet Connection Required</Text>
            <Text style={styles.errorSubtitle}>
              Please connect to the internet to load your missed visits.
            </Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color="#2E7D5B" />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySubtitle}>
              No missed visits found in the last 30 days.
            </Text>
          </View>
        ) : (
          <>
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.Id}
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>
                    {moment(title).format("DD MMM YYYY")}
                  </Text>
                </View>
              )}
              renderItem={({ item }) => {
                const isSelected = selectedVisitIds.has(item.Id);
                return (
                  <TouchableOpacity
                    style={[styles.card, isSelected && styles.cardSelected]}
                    onPress={() => toggleSelection(item.Id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardLeft}>
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={22}
                        color={isSelected ? "#C9A24D" : "#7A7266"}
                      />
                    </View>
                    <View style={styles.cardCenter}>
                      <Text style={styles.outletName} numberOfLines={1}>
                        {item.AccountId__r?.Name || "Unknown Account"}
                      </Text>
                      <Text style={styles.visitName}>{item.Name}</Text>
                      {item.Cancel_Reason__c ? (
                        <View style={styles.reasonBadge}>
                          <Text style={styles.reasonText} numberOfLines={1}>
                            Cancel Reason: {item.Cancel_Reason__c}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.cardRight}>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{item.VisitStatus__c}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />

            {/* Bottom Sticky Button */}
            <View style={styles.footerContainer}>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  selectedVisitIds.size === 0 && styles.nextButtonDisabled,
                ]}
                disabled={selectedVisitIds.size === 0}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.nextButtonText}>
                  Next ({selectedVisitIds.size} Selected)
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Confirmation bottom sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Today's Visits</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1F1D1A" />
              </TouchableOpacity>
            </View>

            {/* Selected Outlets list */}
            <Text style={styles.modalSubtitle}>
              Selected Outlets ({uniqueSelectedVisits.length}):
            </Text>
            <FlatList
              data={uniqueSelectedVisits}
              keyExtractor={(item) => item.Id}
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.selectedOutletRow}>
                  <Ionicons
                    name="storefront-outline"
                    size={16}
                    color="#C9A24D"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.selectedOutletText} numberOfLines={1}>
                    {item.AccountId__r?.Name || "Unknown Account"}
                  </Text>
                </View>
              )}
            />

            {/* Date Field (Locked / ReadOnly) */}
            <Text style={styles.inputLabel}>Visit Date</Text>
            <View style={styles.dateInputContainer}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color="#7A7266"
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.dateInput}
                value={moment().format("DD-MMM-YYYY")}
                editable={false}
              />
              <Ionicons name="lock-closed" size={16} color="#7A7266" />
            </View>

            {/* Today Beat Day Verification Warnings */}
            {!todayBeatDay && (
              <View style={styles.warningContainer}>
                <Ionicons name="warning" size={16} color="#D08C1F" style={{ marginRight: 8 }} />
                <Text style={styles.warningText}>
                  No Beat Day exists for today. Please schedule/create a route plan for today first.
                </Text>
              </View>
            )}

            {/* Duplicate selection inline warning */}
            {duplicateOutlets.length > 0 && (
              <View style={[styles.warningContainer, { marginTop: 10, backgroundColor: "#FBEFD8", borderColor: "#F59E0B" }]}>
                <Ionicons name="information-circle" size={16} color="#D08C1F" style={{ marginRight: 8 }} />
                <Text style={[styles.warningText, { color: "#B45309" }]}>
                  Duplicates selected for: {duplicateOutlets.join(", ")}. Only one visit will be scheduled for each today.
                </Text>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                (!todayBeatDay || creating) && styles.createButtonDisabled,
              ]}
              onPress={handleCreateOutlets}
              disabled={creating || !todayBeatDay}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Outlet</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#A67C2E",
  },
  headerContainer: {
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    backgroundColor: "#F1EADB",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#7A7266",
    fontSize: 14,
    fontWeight: "600",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F1D1A",
    marginTop: 16,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    color: "#7A7266",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F1D1A",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#7A7266",
    marginTop: 6,
    textAlign: "center",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: "#F1EADB",
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSelected: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  cardLeft: {
    marginRight: 10,
  },
  cardCenter: {
    flex: 1,
  },
  outletName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F1D1A",
    marginBottom: 1,
  },
  visitName: {
    fontSize: 11,
    color: "#7A7266",
    marginBottom: 2,
  },
  reasonBadge: {
    backgroundColor: "#FBEFD8",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  reasonText: {
    fontSize: 10,
    color: "#D08C1F",
    fontWeight: "600",
  },
  cardRight: {
    marginLeft: 8,
  },
  statusBadge: {
    backgroundColor: "#EEF2F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    color: "#7A7266",
    fontWeight: "600",
  },
  footerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: "#D9D2C3",
  },
  nextButton: {
    backgroundColor: "#C9A24D",
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  nextButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  nextButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F1D1A",
    marginBottom: 8,
  },
  modalList: {
    maxHeight: 120,
    marginBottom: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 8,
  },
  selectedOutletRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  selectedOutletText: {
    fontSize: 12,
    color: "#7A7266",
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F1D1A",
    marginBottom: 4,
  },
  dateInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EADB",
    borderColor: "#D9D2C3",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 34,
    marginBottom: 12,
  },
  dateInput: {
    flex: 1,
    fontSize: 13,
    color: "#1F1D1A",
    fontWeight: "600",
    paddingVertical: 0,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBEFD8",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warningText: {
    fontSize: 11,
    color: "#D08C1F",
    flex: 1,
    lineHeight: 15,
    fontWeight: "500",
  },
  createButton: {
    backgroundColor: "#C9A24D",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  createButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
