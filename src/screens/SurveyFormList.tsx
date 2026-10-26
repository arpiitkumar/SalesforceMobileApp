import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
} from "react-native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import HeaderMain from "../components/HeaderMain";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Ionicons from "../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { useSelector, useDispatch } from "react-redux";
import { showToast } from "../redux/slices/toastSlice.js";
import Spinner from "react-native-spinkit";
import moment from "moment";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";

const SurveyFormList = ({ route }) => {
  const { formType, title } = route.params || {};
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { fetchRecords } = useApiFetch();

  const selectedVisit = useSelector((state) => state.selectedVisit);

  const [surveyForms, setSurveyForms] = useState([]);
  const [users, setUsers] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");

  const distributorId = useSelector((state) => state.distributor?.id);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🔹 Fetch User and Survey Forms (unified logic)
  useEffect(() => {
    const loadSurveyForms = async () => {
      setIsFetching(true);
      try {
        // 1) Load User
        const result = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        setUsers(result);

        if (result && result.length > 0) {
          const loggedInUser = result[0];

          // 2) Fetch Survey Templates from Salesforce
          const templatesQuery = `SELECT Id, Name, Status__c, Frequency__c, Effective_From__c, Effective_To__c FROM Survey_Template__c WHERE Status__c = 'Published'`;
          const apiTemplates = await fetchRecords("Survey_Template__c", templatesQuery);
          const templates = Array.isArray(apiTemplates) ? apiTemplates.map(item => ({
            Sf_Id: item.Id || "",
            Name: item.Name || "",
            Status__c: item.Status__c || "",
            Frequency__c: item.Frequency__c || "",
            Effective_From__c: item.Effective_From__c || "",
            Effective_To__c: item.Effective_To__c || "",
          })) : [];
          console.log("🔍 [SurveyFormList] Total Published Survey Templates from Salesforce:", templates.length);

          // Date validation: current date must be between Effective_From__c and Effective_To__c
          const todayStr = new Date().toISOString().split('T')[0];
          const validTemplates = templates.filter(t => {
            const fromDate = t.Effective_From__c || '';
            const toDate = t.Effective_To__c || '';
            return (!fromDate || todayStr >= fromDate) && (!toDate || todayStr <= toDate);
          });
          console.log("🔍 [SurveyFormList] Survey Templates after Date Filter:", validTemplates.length);

          // 3) Fetch Survey Assignments from Salesforce (Active__c = true)
          const assignmentsQuery = `SELECT Id, Name, Active__c, Survey_Template__c, Assignment_Type__c FROM Survey_Assignment__c WHERE Active__c = true`;
          const apiAssignments = await fetchRecords("Survey_Assignment__c", assignmentsQuery);
          const assignments = Array.isArray(apiAssignments) ? apiAssignments.map(item => ({
            Sf_Id: item.Id || "",
            Name: item.Name || "",
            Active__c: item.Active__c || false,
            Survey_Template__c: item.Survey_Template__c || "",
            Assignment_Type__c: item.Assignment_Type__c || "",
          })) : [];
          console.log("🔍 [SurveyFormList] Total Active Survey Assignments from Salesforce:", assignments.length);

          // 4) Fetch Survey Assignment Targets from Salesforce
          const targetsQuery = `SELECT Id, Name, Survey_Assignment__c, Distributor__c, User__c, Geography__c, Outlet__c FROM Survey_Assignment_Target__c`;
          const apiTargets = await fetchRecords("Survey_Assignment_Target__c", targetsQuery);
          const targets = Array.isArray(apiTargets) ? apiTargets.map(item => ({
            Sf_Id: item.Id || "",
            Name: item.Name || "",
            Survey_Assignment__c: item.Survey_Assignment__c || "",
            Distributor__c: item.Distributor__c || "",
            User__c: item.User__c || "",
            Geography__c: item.Geography__c || "",
            Outlet__c: item.Outlet__c || "",
          })) : [];

          // 4.5) Fetch Survey Responses for this Outlet directly from Salesforce
          const responsesQuery = `SELECT Id, Name, Survey_Template__c, Outlet__c, Status__c, Submit_Time__c, CreatedDate FROM Survey_Response__c WHERE Outlet__c = '${selectedVisit?.AccountId}'`;
          const apiResponses = await fetchRecords("Survey_Response__c", responsesQuery);
          const responses = Array.isArray(apiResponses) ? apiResponses.map(item => ({
            Sf_Id: item.Id || "",
            Name: item.Name || "",
            Survey_Template__c: item.Survey_Template__c || "",
            Outlet__c: item.Outlet__c || "",
            Status__c: item.Status__c || "",
            Submit_Time__c: item.Submit_Time__c || "",
            CreatedDate: item.CreatedDate || "",
          })) : [];

          // 5) Validate Assignment Rules
          const matchedTemplates = [];
          console.log("🔍 [SurveyFormList] Current distributorId in Redux:", distributorId);
          console.log("🔍 [SurveyFormList] Current loggedInUser Sf_Id:", loggedInUser?.Sf_Id);
          console.log("🔍 [SurveyFormList] Total targets in local DB:", targets.length);

          for (const template of validTemplates) {
            const templateAssignments = assignments.filter(a => a.Survey_Template__c === template.Sf_Id);
            console.log(`🔍 [SurveyFormList] Template: ${template.Name} (${template.Sf_Id}), found assignments count: ${templateAssignments.length}`);
            let isAssigned = false;

            for (const assignment of templateAssignments) {
              const assignmentTargets = targets.filter(t => t.Survey_Assignment__c === assignment.Sf_Id);
              console.log(`  └─ Assignment: type=${assignment.Assignment_Type__c}, Sf_Id=${assignment.Sf_Id}, targets count: ${assignmentTargets.length}`);

              for (const target of assignmentTargets) {
                console.log(`     └─ Target: Distributor__c=${target.Distributor__c}, User__c=${target.User__c}, Outlet__c=${target.Outlet__c}`);
                if (assignment.Assignment_Type__c === "Distributor") {
                  if (distributorId && target.Distributor__c === distributorId) {
                    console.log("     🎉 MATCHED by Distributor!");
                    isAssigned = true;
                    break;
                  }
                } else if (assignment.Assignment_Type__c === "Sales Hierarchy") {
                  if (loggedInUser?.Sf_Id && target.User__c === loggedInUser.Sf_Id) {
                    console.log("     🎉 MATCHED by Sales Hierarchy!");
                    isAssigned = true;
                    break;
                  }
                } else if (assignment.Assignment_Type__c === "Geography") {
                  if (loggedInUser?.Geography__c && target.Geography__c === loggedInUser.Geography__c) {
                    console.log("     🎉 MATCHED by Geography!");
                    isAssigned = true;
                    break;
                  }
                } else if (assignment.Assignment_Type__c === "Outlet") {
                  if (selectedVisit?.AccountId && target.Outlet__c === selectedVisit.AccountId) {
                    console.log("     🎉 MATCHED by Outlet!");
                    isAssigned = true;
                    break;
                  }
                }
              }
              if (isAssigned) break;
            }

            if (isAssigned) {
              const templateResponses = responses.filter(r => r.Survey_Template__c === template.Sf_Id);
              const freq = String(template.Frequency__c || '').trim().toLowerCase();
              let isSubmitted = false;

              if (freq === "daily") {
                const todayStart = moment().startOf('day');
                const todayEnd = moment().endOf('day');
                isSubmitted = templateResponses.some(res => {
                  const timeVal = res.Submit_Time__c || res.CreatedDate || res.last_modified;
                  const submitTime = timeVal ? moment(timeVal) : null;
                  return submitTime && submitTime.isBetween(todayStart, todayEnd, null, '[]');
                });
              } else if (freq === "weekly") {
                const weekStart = moment().startOf('week');
                const weekEnd = moment().endOf('week');
                isSubmitted = templateResponses.some(res => {
                  const timeVal = res.Submit_Time__c || res.CreatedDate || res.last_modified;
                  const submitTime = timeVal ? moment(timeVal) : null;
                  return submitTime && submitTime.isBetween(weekStart, weekEnd, null, '[]');
                });
              } else if (freq === "monthly") {
                const monthStart = moment().startOf('month');
                const monthEnd = moment().endOf('month');
                isSubmitted = templateResponses.some(res => {
                  const timeVal = res.Submit_Time__c || res.CreatedDate || res.last_modified;
                  const submitTime = timeVal ? moment(timeVal) : null;
                  return submitTime && submitTime.isBetween(monthStart, monthEnd, null, '[]');
                });
              } else {
                isSubmitted = templateResponses && templateResponses.length > 0;
              }

              matchedTemplates.push({
                ...template,
                isSubmitted,
              });
            }
          }

          console.log("🔍 [SurveyFormList] Survey Forms final matched list count:", matchedTemplates.length);
          setSurveyForms(matchedTemplates);
        }
      } catch (err) {
        console.error("Error loading survey forms:", err);
      } finally {
        setIsFetching(false);
      }
    };

    loadSurveyForms();
  }, [distributorId, refreshTrigger]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setActiveFilter("All");
      setRefreshTrigger((prev) => prev + 1);
    });
    return unsubscribe;
  }, [navigation]);

  const openSurvey = async (form) => {
    const responseQuery = `SELECT Id, Name, Survey_Template__c, Outlet__c, Status__c, Submit_Time__c, CreatedDate FROM Survey_Response__c WHERE Survey_Template__c = '${form.Sf_Id}' AND Outlet__c = '${selectedVisit?.AccountId}'`;
    const apiResponses = await fetchRecords("Survey_Response__c", responseQuery);
    const forms_response = Array.isArray(apiResponses) ? apiResponses.map(item => ({
      Sf_Id: item.Id || "",
      Name: item.Name || "",
      Survey_Template__c: item.Survey_Template__c || "",
      Outlet__c: item.Outlet__c || "",
      Status__c: item.Status__c || "",
      Submit_Time__c: item.Submit_Time__c || "",
      CreatedDate: item.CreatedDate || "",
    })) : [];

    const freq = String(form.Frequency__c || '').trim().toLowerCase();
    let hasSubmitted = false;
    let message = "";

    if (freq === "daily") {
      const todayStart = moment().startOf('day');
      const todayEnd = moment().endOf('day');
      hasSubmitted = forms_response.some(res => {
        const timeVal = res.Submit_Time__c || res.CreatedDate || res.last_modified;
        const submitTime = timeVal ? moment(timeVal) : null;
        return submitTime && submitTime.isBetween(todayStart, todayEnd, null, '[]');
      });
      message = "This daily survey has already been submitted for this outlet today.";
    } else if (freq === "weekly") {
      const weekStart = moment().startOf('week');
      const weekEnd = moment().endOf('week');
      hasSubmitted = forms_response.some(res => {
        const timeVal = res.Submit_Time__c || res.CreatedDate || res.last_modified;
        const submitTime = timeVal ? moment(timeVal) : null;
        return submitTime && submitTime.isBetween(weekStart, weekEnd, null, '[]');
      });
      message = "This weekly survey has already been submitted for this outlet this week.";
    } else if (freq === "monthly") {
      const monthStart = moment().startOf('month');
      const monthEnd = moment().endOf('month');
      hasSubmitted = forms_response.some(res => {
        const timeVal = res.Submit_Time__c || res.CreatedDate || res.last_modified;
        const submitTime = timeVal ? moment(timeVal) : null;
        return submitTime && submitTime.isBetween(monthStart, monthEnd, null, '[]');
      });
      message = "This monthly survey has already been submitted for this outlet this month.";
    } else {
      hasSubmitted = forms_response && forms_response.length > 0;
      message = "This survey form has already been submitted for this outlet.";
    }

    if (hasSubmitted) {
      dispatch(
        showToast({
          message: message,
          type: "warning",
        })
      );
      return;
    }

    navigation.navigate("SROnboardingForm", {
      formType,
      title,
      surveyFormId: form.Sf_Id,
    });
  };

  const filteredSurveyForms = surveyForms.filter((item) => {
    if (activeFilter === "Submitted") {
      return item.isSubmitted;
    }
    if (activeFilter === "Not Submitted") {
      return !item.isSubmitted;
    }
    return true;
  });

  const renderItem = ({ item, index }) => {
    if (item.isSubmitted) {
      return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => openSurvey(item)}>
          <View style={[styles.card, styles.submittedCard]}>
            {/* Icon Circle */}
            <View style={[styles.iconWrap, styles.submittedIconWrap]}>
              <Ionicons name="checkmark-circle" size={24} color="#2E7D5B" />
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, styles.submittedCardTitle]}>{item.Name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                <Text style={styles.submittedCardSub}>Survey • Retailer</Text>
                <View style={styles.submittedBadge}>
                  <Text style={styles.submittedBadgeText}>Submitted</Text>
                </View>
              </View>
            </View>

            {/* Arrow */}
            <Ionicons name="chevron-forward" size={22} color="#2E7D5B" />
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => openSurvey(item)}>
        <LinearGradient
          colors={["#C9A24D", "#A67C2E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Icon Circle */}
          <View style={styles.iconWrap}>
            <Ionicons name="document-text-outline" size={22} color="#A67C2E" />
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.Name}</Text>
            <Text style={styles.cardSub}>Survey • Retailer</Text>
          </View>

          {/* Arrow */}
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      <View style={styles.headerContainer}>
        <HeaderMain screenName={title} />
      </View>

      <View style={styles.body}>
        {/* Filter Row */}
        <View style={styles.filterContainer}>
          {["All", "Submitted", "Not Submitted"].map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  isActive && styles.activeFilterTab,
                ]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isActive && styles.activeFilterTabText,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredSurveyForms.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="clipboard-outline" size={60} color="#B0B0B0" />
            <Text style={styles.emptyTitle}>No Survey Available</Text>
            <Text style={styles.emptySub}>
              Currently no survey is assigned to you matching this filter
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredSurveyForms}
            keyExtractor={(item) => item.Sf_Id}
            contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {isFetching && (
        <View style={styles.loaderOverlay}>
          <Spinner
            size={50}
            type="Wave"
            color="#A67C2E"
            style={{ marginBottom: 20 }}
          />
          <Text style={styles.loaderText}>Fetching available survey, please wait...</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#A67C2E",
  },
  headerContainer: {
    backgroundColor: "#A67C2E",
  },
  body: {
    flex: 1,
    backgroundColor: "#F4F6FB",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,

    // shadow
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  cardSub: {
    fontSize: 11,
    color: "#E3E9FF",
    marginTop: 3,
  },

  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
  },
  emptySub: {
    marginTop: 6,
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(245, 245, 245, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loaderText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 15,
  },
  // Filter Tabs
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D9D2C3",
    justifyContent: "space-between",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F1EADB",
    marginHorizontal: 4,
  },
  activeFilterTab: {
    backgroundColor: "#A67C2E",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7A7266",
  },
  activeFilterTabText: {
    color: "#fff",
  },
  // Submitted card
  submittedCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D9D2C3",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  submittedIconWrap: {
    backgroundColor: "#E6F4EA",
  },
  submittedCardTitle: {
    color: "#1F1D1A",
  },
  submittedCardSub: {
    fontSize: 11,
    color: "#7A7266",
  },
  submittedBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  submittedBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2E7D5B",
  },
});

export default SurveyFormList;
