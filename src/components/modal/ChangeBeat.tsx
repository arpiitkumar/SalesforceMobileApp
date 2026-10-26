import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../../assets/css/MasterCss.js";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert.js";
import { useSelector, useDispatch } from "react-redux";
import { showToast } from '../../redux/slices/toastSlice.js'
import { retrieve } from "react-native-force/dist/react.force.net.js";
const { width } = Dimensions.get("window");
import { isInternetAvailable } from '../../utils/networkUtils.js';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch.js';
import { PlaceId_var } from '../../../config.js'
import { saveLocally } from '../../utils/dataPost/localService.js';
import { ActivityIndicator } from 'react-native';
import LoaderOverlay from '../../utils/helper/LoaderOverlay.js'
import { Dropdown } from 'react-native-element-dropdown';

const isIsActiveTrue = (val) => {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    return lower === 'true' || lower === '1';
  }
  return false;
};

const checkAssignmentActive = (assignment) => {
  if (!assignment || assignment.SoftDelete === true) return false;
  const activeVal =
    assignment.isActive__c ??
    assignment.Is_Active__c ??
    assignment.IsActive__c ??
    assignment.isActive ??
    assignment.IsActive;

  if (activeVal !== undefined && activeVal !== null && activeVal !== '') {
    return isIsActiveTrue(activeVal);
  }
  if (assignment.Beat_Status__c) {
    return assignment.Beat_Status__c.toLowerCase() === 'active';
  }
  return true;
};

const checkBeatActive = (beat) => {
  if (!beat || beat.SoftDelete === true) return false;
  const activeVal =
    beat.Is_Active__c ??
    beat.isActive__c ??
    beat.IsActive__c ??
    beat.isActive ??
    beat.IsActive ??
    beat.Active__c;

  if (activeVal !== undefined && activeVal !== null && activeVal !== '') {
    if (!isIsActiveTrue(activeVal)) return false;
  }

  if (beat.Beat_Status__c && beat.Beat_Status__c.toLowerCase() === 'inactive') {
    return false;
  }
  if (beat.status && String(beat.status).toLowerCase() === 'inactive') {
    return false;
  }
  return true;
};

const AdHocCandidateRow = ({ item, isChecked, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.adHocCandidateRow}>
    <View style={[styles.adHocCheckbox, isChecked && styles.adHocCheckboxSelected]}>
      {isChecked && <Text style={styles.adHocCheckmark}>✓</Text>}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.adHocCandidateName}>{item.Name}</Text>
      {item.code ? <Text style={styles.adHocCandidateMeta}>Party Code: {item.code}</Text> : null}
    </View>
  </TouchableOpacity>
);

const BeatChange = ({ selectedBeatId, beatDaysId, onRefresh, adHocVisits, isToday, selectedBeatIdNew, setSelectedBeatIdNew, handleSavePress, categorizedData, updateSelectedBeatId, stockCheck = true, userState, currentBeatDaysId, selectedDate }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { apiFetch, apiComposite, fetchRecords } = useApiFetch();
  const [loading, setLoading] = useState(false)
  const [bottomModalVisible, setBottomModalVisible] = useState(false);
  const [beatsDropdownVisible, setBeatsDropdownVisible] = useState(false);
  const [selectedBeat, setSelectedBeat] = useState("Select Beat");
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState("");
  const [beatRecords, setBeatRecords] = useState([]);
  const [selectedReasonForChangeBeat, setSelectedReasonForChangeBeat] = useState('')
  const [selectedReasonForADHOC, setSelectedReasonForADHOC] = useState('')
  const [adhocReasonError, setAdhocReasonError] = useState('')
  //const [selectedBeatIdNew, setSelectedBeatIdNew] = useState(null);
  const toast = useSelector(state => state.toast);
  const [adHocModalVisible, setAdHocModalVisible] = useState(false);
  const [selectedAdHocItems, setSelectedAdHocItems] = useState([]);
  const [adHocCandidates, setAdHocCandidates] = useState([]);
  const [adhocSearchText, setAdhocSearchText] = useState("");
  const [selectedAdHocBeatId, setSelectedAdHocBeatId] = useState(null);
  const isAdHocSavingRef = useRef(false);
  const [options, setOptions] = useState([
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
  ]);
  const [optionsADHOC, setOptionsADHOC] = useState([
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
  ]);
  const beatId = useSelector((state) => state.beatSelection.id);
  const currentAdHocBeatDayId = currentBeatDaysId || beatDaysId;
  // Beat Planning can show a date other than the device's current date.  Do
  // not derive VisitDate__c from UTC time: before 05:30 IST that produces the
  // previous Salesforce day and makes the visit absent from a `TODAY` query.
  const getVisitDate = () => selectedDate
    ? String(selectedDate).slice(0, 10)
    : new Date().toLocaleDateString('en-CA');
  const dummyList = Array.from({ length: 100 }, (_, i) => ({
    key: `item-${i + 1}`,
    label: `Ad-Hoc Option ${i + 1}`,
  }));

  const isDisabled =
    !selectedBeatIdNew ||
    !selectedReasonForChangeBeat ||
    loading;


  //  console.log('ad hoc visits::::::', adHocVisits)
  const toggleAdHocSelection = (sfId) => {
    setSelectedAdHocItems((prevSelected) => {
      if (prevSelected.includes(sfId)) {
        return prevSelected.filter((id) => id !== sfId);
      } else {
        return [...prevSelected, sfId];
      }
    });
  };

  const loadAdHocCandidates = async () => {
    const candidatesById = new Map();
    const userIdVal = userState?.[0]?.Sf_Id;
    const isManager = ['H_T_SO', 'MT_SO', 'MT_Merchandiser'].includes(userState?.[0]?.DeveloperName);

    const hasValidAdHocBeatDayId = currentAdHocBeatDayId &&
      !["null", "undefined", ""].includes(String(currentAdHocBeatDayId).trim().toLowerCase());
    if (!hasValidAdHocBeatDayId) {
      showToastvisible('error', 'Current Beat Day is not available. Please refresh and try again.');
      return;
    }

    try {
      // 1. Fetch assigned beat records locally for the logged-in user
      const localAssignments = await UniversalUpdateInsert({
        ObjectName: "SR_Beat_Assignment__c",
        Type: "get",
      });

      // 2. Load active Beat master records locally
      const allLocalBeats = await UniversalUpdateInsert({
        ObjectName: "Beat__c",
        Type: "get",
      });

      // 3. Load local Beat mappings
      const localBeatMappings = await UniversalUpdateInsert({
        ObjectName: "Beat_Mapping__c",
        Type: "get",
      });

      const assignedBeatIdsSet = new Set();
      const beatsMap = new Map();

      // Build a set of beat IDs that have Beat_Mapping__c records (same filter as RoutePlanScreen)
      const beatIdsWithMappings = new Set();
      const localMappingsList = Array.isArray(localBeatMappings) ? localBeatMappings : [];
      localMappingsList.forEach((m) => {
        if (m?.Beat__c) {
          beatIdsWithMappings.add(String(m.Beat__c).slice(0, 15));
        }
      });

      // Filter local assignments for current user where isActive__c is true
      const assignmentList = Array.isArray(localAssignments) ? localAssignments : [];
      const userAssignments = assignmentList.filter((assignment) => {
        if (!assignment || assignment.SoftDelete === true) return false;
        if (userIdVal) {
          const isAssigned =
            String(assignment.Assigned_To__c || "").slice(0, 15) === String(userIdVal).slice(0, 15) ||
            String(assignment.Sales_Person_ManagerId__c || "").slice(0, 15) === String(userIdVal).slice(0, 15);
          if (!isAssigned) return false;
        }
        return checkAssignmentActive(assignment);
      });

      const userDistributorIds = new Set(
        userAssignments.map((a) => String(a.Distributor__c || "").slice(0, 15)).filter(Boolean)
      );
      const userBeatIds = new Set(
        userAssignments.map((a) => String(a.Beat__c || "").slice(0, 15)).filter(Boolean)
      );

      // Add local beats: must be assigned to user AND have Beat_Mapping__c records AND be active
      (Array.isArray(allLocalBeats) ? allLocalBeats : []).forEach((b) => {
        const bId15 = String(b.Sf_Id || b.Id || "").slice(0, 15);
        const distId15 = String(b.Distributor__c || b.DirectDBSubDB__c || "").slice(0, 15);
        const isAssignedToUser = userBeatIds.size > 0 || userDistributorIds.size > 0
          ? (userBeatIds.has(bId15) || userDistributorIds.has(distId15))
          : true;

        if (bId15 && isAssignedToUser && beatIdsWithMappings.has(bId15) && checkBeatActive(b)) {
          assignedBeatIdsSet.add(bId15);
          beatsMap.set(bId15, {
            Sf_Id: b.Sf_Id || b.Id,
            Name: b.Name || "Beat",
            Beat_Status__c: b.Beat_Status__c,
            Distributor__c: b.Distributor__c || b.DirectDBSubDB__c,
          });
        }
      });

      // Online: exact same query chain as RoutePlanScreen
      // 1. User_BA_Mapping__c → distributors
      // 2. Beat__c WHERE Distributor__c IN (...) → beats
      // 3. Beat_Mapping__c WHERE Beat__c IN (...) → only beats with mappings are kept
      if (userIdVal && await isInternetAvailable()) {
        try {
          const userBaQuery = `SELECT Id, Name, Account__c, Account__r.Name, User__c, User__r.Name FROM User_BA_Mapping__c WHERE User__c = '${userIdVal}' AND Is_Active__c = true AND Status__c = 'Active'
 `;
          const userBaMappings = await fetchRecords("User_BA_Mapping__c", userBaQuery);
          const mappedDistributors = Array.isArray(userBaMappings)
            ? userBaMappings.filter(mapping => mapping?.Account__c)
            : [];
          const accountIds = [...new Set(mappedDistributors.map(mapping => mapping.Account__c).filter(Boolean))];

          if (accountIds.length > 0) {
            const accountFilter = accountIds.map(id => `'${id}'`).join(",");
            const beatQuery = `SELECT Id, Name, Beat_Status__c, Beat_Visit_Frequency__c, Distributor__c, Distributor__r.Name FROM Beat__c WHERE Distributor__c IN (${accountFilter})`;
            const remoteBeats = await fetchRecords("Beat__c", beatQuery);

            if (Array.isArray(remoteBeats) && remoteBeats.length > 0) {
              // Get beat IDs and query Beat_Mapping__c (same as RoutePlanScreen step 3)
              const remoteBeatIds = [...new Set(remoteBeats.map(b => b.Id).filter(Boolean))];
              const beatFilterStr = remoteBeatIds.map(id => `'${id}'`).join(",");
              const mappingQuery = `SELECT Id, Beat__c, Beat__r.Name FROM Beat_Mapping__c WHERE Beat__c IN (${beatFilterStr}) AND Is_Active__c = true AND Status__c = 'Active'
 `;
              const remoteMappings = await fetchRecords("Beat_Mapping__c", mappingQuery);

              // Only keep beats that have Beat_Mapping__c records (exactly like RoutePlanScreen)
              const remoteBeatIdsWithMappings = new Set();
              if (Array.isArray(remoteMappings)) {
                remoteMappings.forEach(m => {
                  if (m?.Beat__c) remoteBeatIdsWithMappings.add(String(m.Beat__c).slice(0, 15));
                });
              }

              assignedBeatIdsSet.clear();
              beatsMap.clear();

              remoteBeats.forEach(b => {
                const bId15 = String(b.Id).slice(0, 15);
                if (checkBeatActive(b) && remoteBeatIdsWithMappings.has(bId15)) {
                  assignedBeatIdsSet.add(bId15);
                  beatsMap.set(bId15, {
                    Sf_Id: b.Id,
                    Name: b.Name,
                    Beat_Status__c: b.Beat_Status__c,
                    Distributor__c: b.Distributor__c,
                    DistributorName: b.Distributor__r?.Name,
                  });
                }
              });
            }
          }
        } catch (error) {
          console.log("Unable to load remote beats for adhoc:", error);
        }
      }

      const assignedBeatIds = Array.from(assignedBeatIdsSet);

      // 3. Load Retailers for ALL assigned beats (local Account.Beat__c, Beat_Mapping__c & online Account/Beat_Mapping__c)

      const localAccounts = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
      });
      const localAccountMap = new Map(
        (Array.isArray(localAccounts) ? localAccounts : []).map((acc) => [String(acc.Sf_Id || acc.Id).slice(0, 15), acc])
      );

      // Load retailers directly linked via Account.Beat__c
      (Array.isArray(localAccounts) ? localAccounts : []).forEach((acc) => {
        if (acc?.Beat__c && acc?.Active__c !== false && acc?.IsActive__c !== false && acc?.SoftDelete !== true) {
          const accBeat15 = String(acc.Beat__c).slice(0, 15);
          if (assignedBeatIdsSet.has(accBeat15)) {
            const accId = acc.Sf_Id || acc.Id;
            if (accId) {
              const accId15 = String(accId).slice(0, 15);
              const key = `${accId15}_${accBeat15}`;
              candidatesById.set(key, {
                Sf_Id: accId,
                AccountId: accId,
                Name: acc.Name || "Unnamed Retailer",
                code: acc.Party_Code__c,
                BeatDay__c: currentAdHocBeatDayId,
                Beat: acc.Beat__c,
                accountType: "Retailer",
              });
            }
          }
        }
      });

      // Filter Beat_Mapping__c belonging to assigned beats
      const mappingList = (Array.isArray(localBeatMappings) ? localBeatMappings : []).filter(
        (m) => m?.SoftDelete !== true && assignedBeatIdsSet.has(String(m.Beat__c || "").slice(0, 15))
      );

      mappingList.forEach((m) => {
        const accId = m.Account__c || m.AccountId;
        if (!accId) return;
        const accId15 = String(accId).slice(0, 15);
        const beatId15 = String(m.Beat__c).slice(0, 15);
        const accObj = localAccountMap.get(accId15);

        const key = `${accId15}_${beatId15}`;
        const existing = candidatesById.get(key);
        candidatesById.set(key, {
          ...(existing || {}),
          Sf_Id: accId,
          AccountId: accId,
          Name: accObj?.Name || m?.Name || existing?.Name || "Unnamed Retailer",
          code: accObj?.Party_Code__c || m?.PartyCode__c || existing?.code,
          BeatDay__c: currentAdHocBeatDayId,
          Beat: m.Beat__c,
          accountType: "Retailer",
        });
      });

      // Include retailers from adHocVisits prop if passed
      (adHocVisits || []).forEach((item) => {
        if (item?.Sf_Id || item?.AccountId) {
          const accId15 = String(item.AccountId || item.Sf_Id).slice(0, 15);
          const beatId15 = String(item.Beat || selectedBeatId || "").slice(0, 15);
          const key = `${accId15}_${beatId15}`;
          if (!candidatesById.has(key)) {
            candidatesById.set(key, {
              ...item,
              Sf_Id: item.Sf_Id || item.AccountId,
              AccountId: item.AccountId || item.Sf_Id,
              Beat: item.Beat || selectedBeatId,
              BeatDay__c: currentAdHocBeatDayId,
              accountType: item.accountType || "Retailer",
            });
          }
        }
      });

      // Online enrichment for Beat_Mapping__c and Account if connected
      if (assignedBeatIds.length > 0 && await isInternetAvailable()) {
        try {
          const beatFilterStr = assignedBeatIds.map((id) => `'${id}'`).join(",");

          // Remote Beat_Mapping__c
          const remoteMappings = await fetchRecords(
            "Beat_Mapping__c",
            `SELECT Id, Beat__c, Account__c, Account__r.Name, Account__r.Party_Code__c, Account__r.Active__c FROM Beat_Mapping__c WHERE Beat__c IN (${beatFilterStr}) AND Is_Active__c = true AND Status__c = 'Active'
 `
          );
          if (Array.isArray(remoteMappings) && remoteMappings.length > 0) {
            const mappingsToInsert = [];
            const accountsToInsert = [];

            remoteMappings.forEach((m) => {
              if (m.Account__c) {
                mappingsToInsert.push({
                  Sf_Id: m.Id,
                  Beat__c: m.Beat__c,
                  Account__c: m.Account__c,
                  is_synced: true,
                  last_modified: Date.now(),
                  SoftDelete: false,
                });
                accountsToInsert.push({
                  Sf_Id: m.Account__c,
                  Name: m.Account__r?.Name || "Unnamed Retailer",
                  Party_Code__c: m.Account__r?.Party_Code__c,
                  Beat__c: m.Beat__c,
                  Active__c: m.Account__r?.Active__c !== false,
                  is_synced: true,
                  last_modified: Date.now(),
                });

                const accId15 = String(m.Account__c).slice(0, 15);
                const beatId15 = String(m.Beat__c).slice(0, 15);
                const key = `${accId15}_${beatId15}`;
                const existing = candidatesById.get(key);
                candidatesById.set(key, {
                  ...(existing || {}),
                  Sf_Id: m.Account__c,
                  AccountId: m.Account__c,
                  Name: m.Account__r?.Name || existing?.Name || "Unnamed Retailer",
                  code: m.Account__r?.Party_Code__c || existing?.code,
                  BeatDay__c: currentAdHocBeatDayId,
                  Beat: m.Beat__c,
                  accountType: "Retailer",
                });
              }
            });

            if (mappingsToInsert.length > 0) {
              await UniversalUpdateInsert({
                ObjectName: "Beat_Mapping__c",
                Type: "insert",
                data: mappingsToInsert,
              });
            }
            if (accountsToInsert.length > 0) {
              await UniversalUpdateInsert({
                ObjectName: "Account",
                Type: "insert",
                data: accountsToInsert,
              });
            }
          }

          // Remote Account by Beat__c
          const remoteAccounts = await fetchRecords(
            "Account",
            `SELECT Id, Name, Party_Code__c, Beat__c, Active__c FROM Account WHERE Beat__c IN (${beatFilterStr}) AND Active__c != false`
          );
          if (Array.isArray(remoteAccounts) && remoteAccounts.length > 0) {
            const accountsToInsert2 = [];

            remoteAccounts.forEach((acc) => {
              if (acc.Beat__c && acc.Id) {
                accountsToInsert2.push({
                  Sf_Id: acc.Id,
                  Name: acc.Name,
                  Party_Code__c: acc.Party_Code__c,
                  Beat__c: acc.Beat__c,
                  Active__c: acc.Active__c !== false,
                  is_synced: true,
                  last_modified: Date.now(),
                });

                const accId15 = String(acc.Id).slice(0, 15);
                const beatId15 = String(acc.Beat__c).slice(0, 15);
                const key = `${accId15}_${beatId15}`;
                const existing = candidatesById.get(key);
                candidatesById.set(key, {
                  ...(existing || {}),
                  Sf_Id: acc.Id,
                  AccountId: acc.Id,
                  Name: acc.Name || existing?.Name || "Unnamed Retailer",
                  code: acc.Party_Code__c || existing?.code,
                  BeatDay__c: currentAdHocBeatDayId,
                  Beat: acc.Beat__c,
                  accountType: existing?.accountType || "Retailer",
                });
              }
            });

            if (accountsToInsert2.length > 0) {
              await UniversalUpdateInsert({
                ObjectName: "Account",
                Type: "insert",
                data: accountsToInsert2,
              });
            }
          }
        } catch (err) {
          console.log("Unable to load remote Beat_Mapping__c / Account:", err);
        }
      }

      // 4. Load Distributors for assigned beats
      assignedBeatIds.forEach((bId15) => {
        const beatObj = beatsMap.get(bId15);
        const distId = beatObj?.Distributor__c || beatObj?.DirectDBSubDB__c;
        if (distId) {
          const distId15 = String(distId).slice(0, 15);
          const accObj = localAccountMap.get(distId15);
          const key = `${distId15}_${bId15}`;
          candidatesById.set(key, {
            Sf_Id: distId,
            AccountId: distId,
            Name: accObj?.Name || beatObj?.DistributorName || "Unnamed Distributor",
            code: accObj?.Party_Code__c,
            BeatDay__c: currentAdHocBeatDayId,
            Beat: beatObj?.Sf_Id || bId15,
            accountType: "Distributor",
          });
        }
      });

      // Distributors from SR_Beat_Assignment__c
      assignmentList.forEach((assignment) => {
        if (assignment?.Distributor__c && assignment?.SoftDelete !== true && checkAssignmentActive(assignment)) {
          const beatId15 = String(assignment.Beat__c || selectedBeatId || "").slice(0, 15);
          if (assignedBeatIdsSet.has(beatId15)) {
            const distId15 = String(assignment.Distributor__c).slice(0, 15);
            const accObj = localAccountMap.get(distId15);
            const key = `${distId15}_${beatId15}`;
            const existing = candidatesById.get(key);
            candidatesById.set(key, {
              ...(existing || {}),
              Sf_Id: assignment.Distributor__c,
              AccountId: assignment.Distributor__c,
              Name: existing?.Name || accObj?.Name || assignment?.Name || "Unnamed Distributor",
              code: existing?.code || accObj?.PartyCode__c || assignment?.PartyCode__c,
              BeatDay__c: currentAdHocBeatDayId,
              Beat: assignment.Beat__c || selectedBeatId,
              accountType: "Distributor",
            });
          }
        }
      });

      // 5. Check planned / taken account IDs for currentBeatDay / today
      const plannedAccountIds = new Set();
      try {
        const localVisits = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
          filters: [{ field: "BeatDay__c", value: currentAdHocBeatDayId }],
        });
        (Array.isArray(localVisits) ? localVisits : []).forEach((visit) => {
          if (visit?.SoftDelete !== true && (visit?.AccountId__c || visit?.AccountId)) {
            plannedAccountIds.add(String(visit.AccountId__c || visit.AccountId).slice(0, 15));
          }
        });

        if (await isInternetAvailable() && hasValidAdHocBeatDayId) {
          const existingVisitQuery = `SELECT Id, AccountId__c FROM Visit__c WHERE BeatDay__c = '${currentAdHocBeatDayId}'`;
          const serverVisits = await fetchRecords("Visit__c", existingVisitQuery);
          (Array.isArray(serverVisits) ? serverVisits : []).forEach((visit) => {
            if (visit?.AccountId__c) {
              plannedAccountIds.add(String(visit.AccountId__c).slice(0, 15));
            }
          });
        }
      } catch (error) {
        console.log("Unable to load planned Ad-Hoc visits:", error);
      }

      // Filter eligible candidates
      const eligibleCandidates = Array.from(candidatesById.values()).filter((item) =>
        !plannedAccountIds.has(String(item.AccountId || item.Sf_Id || "").slice(0, 15))
      );

      setAdHocCandidates(eligibleCandidates);

      // 6. Build beat cards list for modal (`beatDataforadhoc`)
      const beatCards = Array.from(beatsMap.values())
        .filter((beat) => checkBeatActive(beat))
        .map((beat) => {
          const bId15 = String(beat.Sf_Id || beat.Id || "").slice(0, 15);
          const isCurrent = bId15 === String(selectedBeatId || "").slice(0, 15);
          return {
            Sf_Id: beat.Sf_Id || beat.Id || bId15,
            Beat__c: beat.Sf_Id || beat.Id || bId15,
            BeatName: (beat.Name || "Beat") + (isCurrent ? " (Current Beat)" : ""),
            isCurrentBeat: isCurrent,
          };
        });

      // Sort cards: current beat first, then alphabetically
      beatCards.sort((a, b) => {
        if (a.isCurrentBeat) return -1;
        if (b.isCurrentBeat) return 1;
        return (a.BeatName || "").localeCompare(b.BeatName || "");
      });

      setBeatDataforadhoc(beatCards);
    } catch (err) {
      console.error("Error loading cross-beat adhoc candidates:", err);
    }
  };


  const fetchBeatsFromDb = async () => {
    try {
      const isManager = ['H_T_SO', 'MT_SO', 'MT_Merchandiser'].includes(userState?.[0]?.DeveloperName);
      const recordsSR_Beat_Assignment__c = await UniversalUpdateInsert({
        ObjectName: "SR_Beat_Assignment__c",
        Type: "get",
        filters: [
          {
            field: isManager ? "Sales_Person_ManagerId__c" : "Assigned_To__c",
            value: userState[0]?.Sf_Id,
          },
        ],
      });
      const activeAssignments = (Array.isArray(recordsSR_Beat_Assignment__c) ? recordsSR_Beat_Assignment__c : [])
        .filter((assignment) => checkAssignmentActive(assignment));
      const uniqueBeatArray = [
        ...new Set(activeAssignments.map(item => item.Beat__c).filter(Boolean))
      ];
      if (uniqueBeatArray.length === 0) {
        setBeatRecords([]);
        return;
      }
      const records = await UniversalUpdateInsert({
        ObjectName: "Beat__c",
        Type: "get",
        filters: [
          { field: "Sf_Id", operator: 'in', value: uniqueBeatArray },
        ],
      });
      const activeBeats = (Array.isArray(records) ? records : []).filter(
        (item) => checkBeatActive(item) && item.Beat_Status__c?.toLowerCase() === "active"
      );
      setBeatRecords(activeBeats);
    } catch (err) {
      console.error("Error fetching beat records:", err);
    }
  };

  const fetchReasonForBeatChange = async () => {
    const picklistResult = await UniversalUpdateInsert({
      ObjectName: 'AllDataPicklist',
      Type: 'get',
    });

    if (picklistResult?.length) {
      const parsedOptions = JSON.parse(picklistResult[0].OptionsData);
      setOptions(parsedOptions?.ChangeBeatReason || []);
      setOptionsADHOC(parsedOptions?.AdHocReason || [])
    }
  }

  const [expandedBeats, setExpandedBeats] = useState({});
  const [beatDataforadhoc, setBeatDataforadhoc] = useState([])
  const selectedAdHocBeatCandidates = adHocCandidates.filter((item) =>
    String(item.Beat || selectedBeatId || "").slice(0, 15) ===
    String(selectedAdHocBeatId || "").slice(0, 15)
  );
  const selectedAdHocDistributors = selectedAdHocBeatCandidates.filter(
    (item) => item.accountType === "Distributor",
  );
  const selectedAdHocRetailers = selectedAdHocBeatCandidates.filter(
    (item) => item.accountType !== "Distributor",
  );
  const toggleBeat = (beatId) => {
    setExpandedBeats(prev => ({
      ...prev,
      [beatId]: !prev[beatId],
    }));
  };

  const getSRBEAT = async () => {
    await fetchBeatsFromDb();
  }

  useEffect(() => {
    getSRBEAT()
    fetchReasonForBeatChange()
  }, [selectedBeatId, userState]);


  useEffect(() => {
    if (bottomModalVisible) {
      setSearchText("");
      // re-fetch to make sure the latest beats (and any DB changes) are present
      fetchBeatsFromDb();
      // reset the selected label only when modal opens (optional UX)
      setSelectedBeat("Select Beat");
    }
  }, [bottomModalVisible]);

  const toggleBeatsDropdown = () => {
    setBeatsDropdownVisible(!beatsDropdownVisible);
    setSearchText("");
  };

  const handleSelectBeat = (beat) => {
    console.log("THIS IS SELECTED BEWAT::", beat)
    setSelectedBeat(beat.Name);
    setSelectedBeatIdNew(beat.Sf_Id);
    setBeatsDropdownVisible(false);
    setSearchText("");
    setError("");
  };

  const isSavingRef = useRef(false);
  const onSave = async () => {
    if (isSavingRef.current || loading) return;
    if (!selectedBeatIdNew) {
      setError('Please select a beat before saving.');
      showToastvisible('warning', 'Please select a beat before saving.');
      return;
    }

    isSavingRef.current = true;
    setLoading(true)
    // setBottomModalVisible(false);
    // if (!selectedBeatId) {
    //   setError(`Today's beat not found`);
    //   showToastvisible('warning', `Today's beat not found`);
    //   return;
    // }


    const getPlannedIdData = await UniversalUpdateInsert({
      ObjectName: "BeatDay__c",
      Type: "get",
    });
    // console.log('getPlannedIdData....', getPlannedIdData)
    // console.log('selectedBeatIdNew....', selectedBeatId)
    const matchedRecord = getPlannedIdData.find(item => item.Beat__c === selectedBeatId);
    console.log('matched recoed....', matchedRecord)

    // console.log("matchedRecord maha ",matchedRecord?.Changed_Beat__c)
    // console.log("selectedBeatId ", selectedBeatId);
    // console.log("selectedBeatIdNew ", selectedBeatIdNew);
    const AllVisitByAccget = await UniversalUpdateInsert({
      ObjectName: "Account",
      Type: "get",
    });

    const allMatchingRecordsget = AllVisitByAccget.filter(item => item.Beat__c === selectedBeatIdNew);
    console.log('length of all  amttch.................', allMatchingRecordsget.length)
    //return


    await handleSavePress()

    const beatdayPayload = {
      allowSaveOnDuplicate: false,
      fields: {
        Beat__c: selectedBeatIdNew,
        Planned_Beat__c: matchedRecord?.Planned_Beat__c || matchedRecord?.Beat__Name || "",
        PlannedOutlets__c: matchedRecord?.PlannedOutlets__c + allMatchingRecordsget.length,
        // Pjp_BeatOutlets__c: matchedRecord.PlannedOutlets__c + allMatchingRecordsget.length,
        Changed_Beat__c: selectedBeatIdNew,
      },
    };

    console.log("COMPOSITE PAYLOAD ========", JSON.stringify(beatdayPayload));
    // const responseComposite = await apiFetch("PATCH", `records/${matchedRecord.Sf_Id}`, beatdayPayload);

    console.log('current beat days id ...................', currentBeatDaysId)
    const responseSObject = await apiFetch(
      "PATCH",
      `sobjects/BeatDay__c/${currentBeatDaysId}`,
      {
        Beat__c: selectedBeatIdNew,
        Planned_Beat__c: matchedRecord?.Planned_Beat__c || matchedRecord?.Beat__Name || "",
        PlannedOutlets__c: matchedRecord?.PlannedOutlets__c + allMatchingRecordsget.length,
        // Pjp_BeatOutlets__c: matchedRecord.PlannedOutlets__c + allMatchingRecordsget.length,
        Changed_Beat__c: selectedBeatIdNew,
        Change_Beat_Reason__c: selectedReasonForChangeBeat
      },
      "SObjects"
    );

    console.log("COMPOSITE RESPONSE ========", JSON.stringify(responseSObject));
    let compositeSuccess = false;
    if (responseSObject.status === 'success') {
      compositeSuccess = true
    }



    let payload
    if (matchedRecord?.Changed_Beat__c == '') {
      payload = {
        Sf_Id: currentBeatDaysId,
        Beat__Name: selectedBeat,
        Beat__c: selectedBeatIdNew,
        Planned_Beat__c: matchedRecord?.Planned_Beat__c || matchedRecord?.Beat__Name || "",
        PlannedOutlets__c: matchedRecord?.PlannedOutlets__c + allMatchingRecordsget.length,
        // Pjp_BeatOutlets__c: matchedRecord.PlannedOutlets__c + allMatchingRecordsget.length,
        Changed_Beat__c: selectedBeatIdNew,
        Change_Beat_Reason__c: selectedReasonForChangeBeat,
        is_locally_changed: compositeSuccess ? false : true,
        operation_type: "insert",
        last_modified: Date.now(),
        is_synced: compositeSuccess ? true : false,
      };
    } else {
      payload = {
        Sf_Id: currentBeatDaysId,
        Beat__Name: selectedBeat,
        Beat__c: selectedBeatIdNew,
        Planned_Beat__c: matchedRecord?.Planned_Beat__c || matchedRecord?.Beat__Name || "",
        PlannedOutlets__c: matchedRecord.PlannedOutlets__c + allMatchingRecordsget.length,
        // Pjp_BeatOutlets__c: matchedRecord.PlannedOutlets__c + allMatchingRecordsget.length,
        Changed_Beat__c: selectedBeatIdNew,
        Change_Beat_Reason__c: selectedReasonForChangeBeat,
        is_locally_changed: compositeSuccess ? false : true,
        operation_type: "insert",
        last_modified: Date.now(),
        is_synced: compositeSuccess ? true : false,
      };
    }

    //return
    console.log("payload ", payload);
    const response = await UniversalUpdateInsert({
      ObjectName: "BeatDay__c",
      Type: "insert",
      data: payload,
    });

    // console.log("response beatday", response);
    if (response) {
      const AllVisitByAcc = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
        filters: [{ field: "Active__c", value: true }],
      });



      // for change beat payload
      const currentDate = new Date().toISOString().slice(0, 10);
      const allMatchingRecords = AllVisitByAcc.filter(item => item.Beat__c === selectedBeatIdNew);
      const transformedData = allMatchingRecords.map(item => ({
        Sf_Id: '',
        BeatDay__c: beatDaysId,
        VisitDate__c: currentDate,
        AccountId: item.Sf_Id,
        VisitStatus__c: 'Planned',
        ChangedBeatOutlet__c: true,
        PJPOutlet__c: false,
        NonPjpOutlet__c: true,
        AdHocVisit__c: false,
        is_locally_changed: true,
        is_synced: false,
        last_modified: Date.now(),
        operation_type: 'insert'
      }));

      try {
        for (const account of transformedData) {
          const userIdVal = userState[0]?.Sf_Id || userState[0]?.Id || '';
          const uniqueId = `${userIdVal}-${account.AccountId}-${currentDate}-${selectedBeatIdNew}`;

          const visit_check_unique = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [
              { field: "Mobile_Unique_Id__c", value: uniqueId },
              { field: "SoftDelete", value: false }
            ],
          });

          if (visit_check_unique && visit_check_unique.length > 0) {
            console.log(`⛔ Visit with Mobile_Unique_Id__c ${uniqueId} already exists, skipping...`);
            continue; // 🚀 skip this iteration
          }

          const visitPayload = {
            Beat__c: selectedBeatIdNew,
            BeatDay__c: account.BeatDay__c,
            VisitDate__c: currentDate,
            AccountId: account.AccountId,
            VisitStatus__c: 'Planned',
            ChangedBeatOutlet__c: true,
            PJPOutlet__c: false,
            NonPjpOutlet__c: true,
            AdHocVisit__c: false,
            PlaceId__c: PlaceId_var,
            PlannedVisitStartTime: new Date().toISOString(),
            Mobile_Unique_Id__c: uniqueId,
          };

          let sfId;
          let isSynced = false;
          const connected = await isInternetAvailable();
          if (connected) {
            try {
              const { sfId: generatedId } = await saveToApi(apiFetch, 'Visit', visitPayload); // `apiFetch` optional or pass it
              sfId = generatedId;
              isSynced = true;
              console.log("✅ Synced to API: Beat Changed ONLINE SUCCESSFUL", sfId);
              //dispatch(showToast({ message: `Beat Change Successfully (ONLINE) ${sfId}`, type: 'success' }));

            } catch (err) {
              const errMsg = err.message || '';
              if (errMsg.includes('DUPLICATE_VALUE') || errMsg.includes('duplicate value found')) {
                console.log(`⚠️ Skip local save for account ${account.AccountId} because it is duplicate on server:`, errMsg);
                continue; // 🚀 skip this iteration entirely
              }
              //dispatch(showToast({ message: 'Beat Change Failed (ONLINE)', type: 'error' }));
              console.warn('❗️API failed, saving locally...', err.message);
              sfId = `local-${Date.now()}`;
              isSynced = false;
            }
          } else {
            sfId = `local-${Date.now()}`;
            isSynced = false;
            console.log("📴 Offline mode, saving locally.");
          }

          await saveLocally('Visit', visitPayload, sfId, isSynced);

          console.log('saved locally!!')
          {
            !isSynced && dispatch(showToast({
              message: isSynced ? 'Beat saved from API' : 'Beat saved locally',
              type: 'success'
            }))
          }

        }

        setLoading(false);
        isSavingRef.current = false;
        //onClose();
      } catch (error) {
        console.error(' Error while saving visit records:', error);
      } finally {
        setLoading(false)
        isSavingRef.current = false;
      }

      dispatch(showToast({
        message: 'Beat Change Successfully !',
        type: 'success', // 'success' | 'error' | 'warning'
      }));
      setBottomModalVisible(false);

      //setSelectedBeat("Select Beat");



      // ✅ Update the parent's selectedBeatId BEFORE resetting selectedBeatIdNew
      if (updateSelectedBeatId) {

        console.log("calling updateSelectedBeatId with:", selectedBeatIdNew);
        updateSelectedBeatId(selectedBeatIdNew);
      }

      // Reset local state
      setSelectedBeatIdNew(null);
      setSelectedBeat("Select Beat");
      if (typeof onRefresh === "function") {
        onRefresh();
      }
    }
  };

  // const filteredBeats = beatRecords.filter((beat) => {
  //   const match = beat.Sf_Id?.toString() === selectedBeatId?.toString();
  //   return (
  //     !match && beat.Name?.toLowerCase().includes(searchText.toLowerCase())
  //   );
  // });
  const filteredBeats = beatRecords.filter((beat) => {
    const excludeId = selectedBeatId; // important: use parent's active beat id
    const isSameAsActive = beat.Sf_Id?.toString() === excludeId?.toString();
    return (
      !isSameAsActive &&
      beat.Name?.toLowerCase().includes(searchText.toLowerCase())
    );
  });


  const buildAdHocVisitPayload = (item, currentDate) => {
    const beatIdVal = item?.Beat || selectedBeatId || beatId || '';

    return {
      BeatDay__c: currentAdHocBeatDayId,
      Beat__c: beatIdVal,
      VisitDate__c: currentDate,
      AccountId__c: item.AccountId,
      VisitStatus__c: 'Planned',
      ChangedBeatOutlet__c: false,
      PJPOutlet__c: false,
      NonPjpOutlet__c: true,
      AdHocVisit__c: true,
      PlaceId__c: PlaceId_var,
      PlannedVisitStartTime__c: new Date().toISOString(),
      AdHocReason__c: selectedReasonForADHOC,
    };
  };

  // These values are useful only in the local queue.  Salesforce should
  // receive the same lean payload whether the Ad-Hoc visit is saved now or
  // uploaded later after an offline save.
  const buildAdHocSalesforcePayload = (item, currentDate) => {
    const { PlannedVisitStartTime__c, ...payload } = buildAdHocVisitPayload(item, currentDate);
    return payload;
  };

  // for ad-hoc visit submit
  const submitToApi = async (selectedItems) => {
    const currentDate = getVisitDate();

    const records = selectedItems.map((item) => buildAdHocSalesforcePayload(item, currentDate));

    // Use Salesforce's standard SObject REST API. The former Apex REST
    // `upload-records` route is not available in this org (404).
    const results = await Promise.all(records.map(async (record, index) => {
      const response = await apiFetch('POST', 'sobjects/Visit__c', record, 'SObjects');
      if (response?.status === 'success' && response?.data?.id) {
        return { index, status: 'success', id: response.data.id };
      }

      return {
        index,
        status: 'fail',
        errorMessage: response?.message
          || response?.data?.[0]?.message
          || response?.data?.message
          || 'Salesforce did not return a Visit ID.',
      };
    }));

    const success = results.every((result) => result.status === 'success');
    return {
      success,
      response: { data: { responseBody: [{ results }] } },
    };
  };



  // for ad-hoc visit submit
  const saveLocallyB = async (apiResponse, selectedItems, saveOnlySalesforceSuccess = false) => {
    const currentDate = getVisitDate();
    const userIdVal = userState[0]?.Sf_Id || userState[0]?.Id || '';

    let apiIds = {};
    let apiErrors = {};
    const failedIndicesToSkip = new Set();
    if (apiResponse?.data?.responseBody?.[0]?.results?.length) {
      apiResponse.data.responseBody[0].results.forEach((result) => {
        if (result.status === 'success') {
          apiIds[result.index] = result.id;
        } else if (result.status === 'fail') {
          const errMsg = result.errorMessage || '';
          apiErrors[result.index] = errMsg;
          if (errMsg.includes('DUPLICATE_VALUE') || errMsg.toLowerCase().includes('duplicate value found')) {
            failedIndicesToSkip.add(result.index);
          }
        }
      });
    }

    // ✅ Replace or generate ID for each selected item
    const transformedData = [];
    selectedItems.forEach((item, index) => {
      // While online, a rejected record must not appear as a local/offline
      // visit. Salesforce is the source of truth in that case.
      if (saveOnlySalesforceSuccess && !apiIds[index]) {
        return;
      }

      if (failedIndicesToSkip.has(index)) {
        console.log(`Skipping local save for item at index ${index} due to Salesforce DUPLICATE_VALUE error.`);
        return;
      }

      const visitPayload = buildAdHocVisitPayload(item, currentDate);
      const beatIdVal = visitPayload.Beat__c;
      const uniqueId = `${userIdVal}-${item.AccountId}-${currentDate}-${beatIdVal}-ADHOC`;
      transformedData.push({
        ...visitPayload,
        // local-* IDs mark a queued create. syncVisitRecord uploads them with
        // the same standard SObject API used by submitToApi above.
        Sf_Id: apiIds[index] || `local-${Date.now()}-${index}`,
        is_locally_changed: !apiIds[index],
        is_synced: !!apiIds[index], // true if synced
        ErrorMsg: apiErrors[index] || '',
        last_modified: Date.now(),
        operation_type: 'insert',
        Mobile_Unique_Id__c: uniqueId
      });
    });

    console.log(JSON.stringify(transformedData));

    if (transformedData.length === 0) {
      console.log('No visits saved locally because all were duplicates on Salesforce.');
      return true;
    }

    const inserted = await UniversalUpdateInsert({
      ObjectName: "Visit",
      Type: "insert",
      data: transformedData,
    });

    if (inserted) {
      console.log('visit saved locally')
      //showToastvisible("success", "Visit saved.");
      return true;
    } else {
      console.log('Failed to save Visit locally...')
      //showToastvisible("error", "Failed to save Visit.");
      return false;
    }
  };

  const showToastvisible = (type, message) => {
    dispatch(showToast({
      message: message,
      type: type, // 'success' | 'error' | 'warning'
    }));
  };

  const handleCheckInSubmit = async () => {
    // State updates are asynchronous, so use a ref to stop double taps from
    // sending two POST requests before the Submit button re-renders disabled.
    if (isAdHocSavingRef.current) return;

    // A distributor can arrive from both the Beat and BA-mapping sources.
    // Always submit at most one Visit per account.
    const selectedItems = Array.from(new Map(
      adHocCandidates
        .filter((item) => selectedAdHocItems.includes(item.Sf_Id))
        .map((item) => [String(item.AccountId || item.Sf_Id).slice(0, 15), item])
    ).values());
    if (!selectedItems || selectedItems.length === 0) {
      showToastvisible('warning', 'Please select at least one visit');
      return;
    }
    const trimmedReason = selectedReasonForADHOC?.trim() || '';
    if (!trimmedReason) {
      showToastvisible('warning', 'Please enter a reason for Ad-Hoc visit');
      return;
    }
    const reasonValidRegex = /^[a-zA-Z0-9 ]+$/;
    if (!reasonValidRegex.test(trimmedReason)) {
      showToastvisible('warning', 'Reason contains invalid characters. Only letters, numbers and spaces are allowed.');
      return;
    }
    const hasValidAdHocBeatDayId = currentAdHocBeatDayId &&
      !["null", "undefined", ""].includes(String(currentAdHocBeatDayId).trim().toLowerCase());
    if (!hasValidAdHocBeatDayId) {
      showToastvisible('error', 'Current Beat Day is not available. Please refresh and try again.');
      return;
    }

    try {
      isAdHocSavingRef.current = true;
      setLoading(true)
      const connected = await isInternetAvailable();

      const currentDate = getVisitDate();

      // Check the full local Beat Day list in JavaScript so older records
      // using AccountId (instead of AccountId__c) are also detected. This
      // protects offline creation as well as online creation.
      const localVisits = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "get",
        filters: [{ field: "BeatDay__c", value: currentAdHocBeatDayId }],
      });
      const existingAccountIds = new Set(
        (Array.isArray(localVisits) ? localVisits : [])
          .filter((visit) => visit?.SoftDelete !== true)
          .map((visit) => String(visit?.AccountId__c || visit?.AccountId || "").slice(0, 15))
          .filter(Boolean)
      );

      // Salesforce is checked before any POST. This prevents a duplicate if
      // the same distributor was created by another device or before the
      // local database had a chance to sync.
      if (connected) {
        const accountIds = selectedItems
          .map((item) => item.AccountId || item.Sf_Id)
          .filter(Boolean);
        if (accountIds.length) {
          const accountFilter = accountIds.map((id) => `'${id}'`).join(",");
          const existingVisitQuery = `SELECT Id, AccountId__c FROM Visit__c WHERE BeatDay__c = '${currentAdHocBeatDayId}' AND AccountId__c IN (${accountFilter}) AND VisitDate__c = ${currentDate}`;
          const serverVisits = await fetchRecords("Visit__c", existingVisitQuery);
          if (Array.isArray(serverVisits)) {
            serverVisits.forEach((visit) => {
              if (visit?.AccountId__c) {
                existingAccountIds.add(String(visit.AccountId__c).slice(0, 15));
              }
            });
          }
        }
      }

      const nonDuplicateItems = selectedItems.filter((item) => {
        const accountId = String(item.AccountId || item.Sf_Id || "").slice(0, 15);
        const duplicate = existingAccountIds.has(accountId);
        if (duplicate) {
          console.log(`Visit already exists for account ${item.AccountId || item.Sf_Id} on Beat Day ${currentAdHocBeatDayId}. Skipping.`);
        }
        return !duplicate;
      });

      if (nonDuplicateItems.length === 0) {
        setLoading(false);
        showToastvisible('warning', 'All selected visits are already registered.');
        return;
      }

      let apiSuccess = false;
      let apiResponse = null;
      let salesforceFailureMessage = '';
      if (connected) {
        const result = await submitToApi(nonDuplicateItems);
        apiSuccess = result.success;
        apiResponse = result.response;
        const failedResults = result.response?.data?.responseBody?.[0]?.results
          ?.filter((item) => item.status !== 'success') || [];
        salesforceFailureMessage = failedResults
          .map((item) => item.errorMessage)
          .filter(Boolean)
          .join('\n');
        if (!apiSuccess) {
          console.log('Salesforce rejected one or more Ad-Hoc visits:', salesforceFailureMessage);
        }
      }
      const localSuccess = await saveLocallyB(
        apiResponse,
        nonDuplicateItems,
        connected,
      );
      if (localSuccess) {
        setLoading(false)
        if (connected && !apiSuccess) {
          // Do not queue rejected online records locally. The message below
          // comes directly from the Salesforce/UI API response.
          showToastvisible('error', salesforceFailureMessage || 'Salesforce rejected the Ad-Hoc visit.');
          const hasSavedRecords = apiResponse?.data?.responseBody?.[0]?.results
            ?.some((item) => item.status === 'success');
          if (hasSavedRecords) {
            onRefresh();
          }
          return;
        }

        showToastvisible('success', 'Visit added successfully.')
        setAdHocModalVisible(false);
        setSelectedAdHocItems([]);
        onRefresh()
      }
    } catch (error) {
      setLoading(false)
      console.error(' Visit error:', error);
      showToastvisible('error', 'An error occurred.');
    } finally {
      setLoading(false)
      isAdHocSavingRef.current = false;
    }
  };






  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        {/* {userState[0]?.DeveloperName === "MT_Merchandiser" ? null :
          // {userState[0]?.DeveloperName === "MT_SO" || userState[0]?.DeveloperName === "MT_Merchandiser" ? null :
          <TouchableOpacity
            onPress={() => {
              const isASO = userState[0]?.DeveloperName === "H_T_ASO";
              const noWorkToday =
                isToday &&
                categorizedData?.Completed?.length === 0 &&
                categorizedData?.["In Progress"]?.length === 0;

              if (isASO) {
                if (stockCheck) {
                  return null;
                } else {
                  if (noWorkToday) {
                    setBottomModalVisible(true);
                  }
                }
              } else {
                if (noWorkToday) {
                  setBottomModalVisible(true);
                }
              }
            }}
          >
            <LinearGradient
              colors={
                (() => {
                  const isASO = userState[0]?.DeveloperName === "H_T_ASO";
                  const noWorkToday =
                    isToday &&
                    categorizedData?.Completed?.length === 0 &&
                    categorizedData?.["In Progress"]?.length === 0;

                  if (isASO) {
                    if (stockCheck) {
                      return Gradients.disabled; // ASO + stockCheck true → disabled
                    } else {
                      return noWorkToday ? Gradients.primary : Gradients.disabled;
                    }
                  } else {
                    return noWorkToday ? Gradients.primary : Gradients.disabled;
                  }
                })()
              }
              style={styles.button}
            >
              <Text style={styles.buttonText}>Change Beat</Text>
            </LinearGradient>
          </TouchableOpacity>



        } */}
        {/*
        <TouchableOpacity
          onPress={isToday ? () => setBottomModalVisible(true) : null}
        >
          <LinearGradient
            colors={isToday ? Gradients.primary : Gradients.disabled}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Change Beat</Text>
          </LinearGradient>
        </TouchableOpacity> */}
        {/* {userState[0]?.DeveloperName === "MT_Merchandiser" ? null : */}

        <TouchableOpacity
          onPress={isToday ? async () => {
            setSelectedAdHocBeatId(null);
            setSelectedAdHocItems([]);
            setAdhocSearchText("");
            await loadAdHocCandidates();
            setAdHocModalVisible(true);
          } : null}
        >
          <LinearGradient colors={isToday ? Gradients.primary : Gradients.disabled} style={styles.button}>
            <Text style={styles.buttonText}>Ad-Hoc Visit</Text>
          </LinearGradient>
        </TouchableOpacity>
        {/* } */}

      </View>

      <Modal
        transparent
        statusBarTranslucent
        visible={bottomModalVisible}
        animationType="fade"
        onRequestClose={() => setBottomModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressOut={() => setBottomModalVisible(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={() => { }}
          >
            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setBottomModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.label}>
                Beats <Text style={{ color: "red" }}>*</Text>
              </Text>

              <TouchableOpacity
                style={styles.beatSelector}
                onPress={toggleBeatsDropdown}
              >
                <Text style={styles.beatText}>{selectedBeat}</Text>
              </TouchableOpacity>

              {beatsDropdownVisible && (
                <View style={styles.beatDropdown}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search beat..."
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                  <ScrollView style={styles.dropdownScroll}>
                    {filteredBeats.length > 0 ? (
                      filteredBeats.map((beat, index) => (
                        <TouchableOpacity
                          key={beat.Sf_Id || index}
                          onPress={() => handleSelectBeat(beat)}
                          style={styles.beatItem}
                        >
                          <Text>{beat.Name}<Text style={{ fontSize: 12 }}>{beat.BeatCode__c ? ' (#' + beat.BeatCode__c + ')' : ''}</Text></Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.noDataText}>No beats found</Text>
                    )}
                  </ScrollView>
                </View>
              )}
              <Text style={{ fontSize: 14, marginTop: 10 }}>Reason <Text style={{ color: "red" }}>*</Text></Text>
              <Dropdown
                data={options}
                labelField="label"
                valueField="value"
                value={selectedReasonForChangeBeat}
                // onChange={item => statusSetter(item.value)}
                onChange={item => {
                  setSelectedReasonForChangeBeat(item.value)
                }}
                maxHeight={200}
                dropdownPosition="auto"
                style={styles.dropdown}
                containerStyle={[styles.dropdownContainer, { maxHeight: 200 }]}
                inputSearchStyle={styles.searchbox}
                placeholderStyle={styles.placeholderDropdown}
                selectedTextStyle={styles.valueDropdown}
                itemTextStyle={{ fontSize: 14, color: '#222' }}
                search
                searchPlaceholder="Search"
                itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}


            <TouchableOpacity
              onPress={!isDisabled ? onSave : null}
              disabled={isDisabled}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isDisabled ? Gradients.disabled : Gradients.primary}
                style={[
                  styles.saveButton,
                  isDisabled && styles.saveButtonDisabled,
                ]}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>

          </TouchableOpacity>
        </TouchableOpacity>

        <LoaderOverlay visible={loading} message="Saving change beat..." />
      </Modal>
      <Modal
        transparent
        visible={adHocModalVisible}
        animationType="fade"
        statusBarTranslucent={false}
        onRequestClose={() => setAdHocModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressOut={() => setAdHocModalVisible(false)}
          style={[styles.modalOverlay, { justifyContent: "flex-end" }]}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.modalContent,
              {
                maxHeight: "85%",
                borderTopRightRadius: 20,
                borderTopLeftRadius: 20,
                width: "100%",
                paddingBottom: Platform.OS === "android" ? Math.max(insets.bottom, 28) : Math.max(insets.bottom, 20),
              },
            ]}
            onPress={() => { }}
          >
            <TouchableOpacity
              onPress={() => setAdHocModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Ad-Hoc Visit Options</Text>
            <Text style={{ fontSize: 14, marginTop: 12, marginBottom: 6 }}>
              Choose Beat <Text style={{ color: "red" }}>*</Text>
            </Text>
            <Dropdown
              data={beatDataforadhoc
                .filter((beat) => beat.Beat__c)
                .map((beat) => ({
                  label: beat.BeatName,
                  value: beat.Beat__c,
                }))}
              labelField="label"
              valueField="value"
              value={selectedAdHocBeatId}
              placeholder="Select beat"
              search
              searchPlaceholder="Search beat..."
              maxHeight={200}
              dropdownPosition="auto"
              style={styles.dropdown}
              containerStyle={[styles.dropdownContainer, { maxHeight: 200 }]}
              placeholderStyle={styles.placeholderDropdown}
              selectedTextStyle={styles.valueDropdown}
              itemTextStyle={{ fontSize: 14, color: '#222' }}
              onChange={(item) => {
                setSelectedAdHocBeatId(item.value);
                setSelectedAdHocItems([]);
                setAdhocSearchText("");
              }}
            />
            {selectedAdHocBeatId ? (
              <View style={{ marginTop: 12, maxHeight: 270 }}>
                <Text style={styles.adHocSectionTitle}>Distributor</Text>
                {selectedAdHocDistributors.length ? (
                  selectedAdHocDistributors.map((item) => (
                    <AdHocCandidateRow
                      key={`${item.Beat}-${item.Sf_Id}`}
                      item={item}
                      isChecked={selectedAdHocItems.includes(item.Sf_Id)}
                      onPress={() => toggleAdHocSelection(item.Sf_Id)}
                    />
                  ))
                ) : (
                  <Text style={styles.adHocEmptyText}>No distributor for this beat</Text>
                )}

                <Text style={styles.adHocSectionTitle}>Retailers</Text>
                <FlatList
                  data={selectedAdHocRetailers}
                  keyExtractor={(item) => `${item.Beat}-${item.Sf_Id}`}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <AdHocCandidateRow
                      item={item}
                      isChecked={selectedAdHocItems.includes(item.Sf_Id)}
                      onPress={() => toggleAdHocSelection(item.Sf_Id)}
                    />
                  )}
                  ListEmptyComponent={
                    <Text style={styles.adHocEmptyText}>No retailers for this beat</Text>
                  }
                />
              </View>
            ) : (
              <Text style={styles.adHocEmptyText}>
                Select a beat to view its distributor and retailers.
              </Text>
            )}
            {false && <>
              <FlatList
                data={beatDataforadhoc.length > 0 ? beatDataforadhoc : [{
                  Sf_Id: selectedBeatId || "current-beat",
                  Beat__c: selectedBeatId,
                  BeatName: "Current Beat",
                }]}
                keyExtractor={(item) => String(item.Sf_Id)}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item: beat }) => {
                  const isSearching = adhocSearchText.trim() !== "";
                  const isExpanded = isSearching || expandedBeats[beat.Beat__c];

                  const beatAccounts = adHocCandidates.filter((item) => {
                    const itemBeat15 = String(item.Beat || selectedBeatId || "").slice(0, 15);
                    const cardBeat15 = String(beat.Beat__c || "").slice(0, 15);
                    const matchesBeat = itemBeat15 === cardBeat15;
                    if (!matchesBeat) return false;

                    if (isSearching) {
                      const q = adhocSearchText.toLowerCase();
                      const matchName = item.Name && item.Name.toLowerCase().includes(q);
                      const matchCode = item.code && String(item.code).toLowerCase().includes(q);
                      const matchBeatName = beat.BeatName && beat.BeatName.toLowerCase().includes(q);
                      return matchName || matchCode || matchBeatName;
                    }
                    return true;
                  });

                  if (isSearching && beatAccounts.length === 0) {
                    return null;
                  }

                  return (
                    <View style={{ marginBottom: 16 }}>

                      {/* 🌈 BEAT CARD */}
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => toggleBeat(beat.Beat__c)}
                        style={{
                          backgroundColor: "#eaf3ffff",
                          borderRadius: 14,
                          padding: 10,
                          shadowColor: "#000",
                          shadowOpacity: 0.15,
                          shadowRadius: 6,
                          shadowOffset: { width: 0, height: 4 },
                          elevation: 2,
                          marginHorizontal: 4
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <View>
                            <Text
                              style={{
                                color: "#2B2E34",
                                fontSize: 16,
                                fontWeight: "700",
                                letterSpacing: 0.3,
                              }}
                            >
                              {beat.BeatName}
                            </Text>

                            <Text
                              style={{
                                color: "#7A7266",
                                fontSize: 12,
                                marginTop: 2,
                              }}
                            >
                              {beatAccounts.length} outlets
                            </Text>
                          </View>

                          <View
                            style={{
                              height: 28,
                              width: 28,
                              borderRadius: 14,
                              backgroundColor: "rgba(23, 22, 22, 0.25)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 14 }}>
                              {isExpanded ? "−" : "+"}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* 🔽 ACCOUNTS */}
                      {isExpanded && (
                        <View style={{ marginTop: 10, paddingLeft: 6 }}>
                          {beatAccounts.length ? (
                            beatAccounts.map((item) => {
                              const isChecked = selectedAdHocItems.includes(item.Sf_Id);

                              return (
                                <TouchableOpacity
                                  key={item.Sf_Id}
                                  activeOpacity={0.85}
                                  onPress={() => toggleAdHocSelection(item.Sf_Id)}
                                  style={{
                                    backgroundColor: "#F2F4F7",
                                    borderRadius: 12,
                                    padding: 7,
                                    marginBottom: 10,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    shadowColor: "#000",
                                    shadowOpacity: 0.06,
                                    shadowRadius: 4,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 3,
                                    marginHorizontal: 10,
                                  }}
                                >
                                  {/* ✅ MODERN CHECKBOX */}
                                  <View
                                    style={{
                                      height: 22,
                                      width: 22,
                                      borderRadius: 6,
                                      borderWidth: 1.5,
                                      borderColor: isChecked ? "#A67C2E" : "#B0C4FF",
                                      backgroundColor: isChecked ? "#A67C2E" : "#fff",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      marginRight: 12,
                                    }}
                                  >
                                    {isChecked && (
                                      <Text style={{ color: "#fff", fontSize: 13 }}>
                                        ✓
                                      </Text>
                                    )}
                                  </View>

                                  {/* 🏪 ACCOUNT INFO */}
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={{
                                        fontSize: 14.5,
                                        fontWeight: "600",
                                        color: "#222",
                                      }}
                                    >
                                      {item.Name}
                                    </Text>

                                    <Text
                                      style={{
                                        fontSize: 12,
                                        color: item.accountType === "Distributor" ? "#A67C2E" : "#666",
                                        marginTop: 2,
                                      }}
                                    >
                                      {item.accountType || "Retailer"}
                                    </Text>

                                    {item.code && (
                                      <Text
                                        style={{
                                          fontSize: 12,
                                          color: "#666",
                                          marginTop: 2,
                                        }}
                                      >
                                        Party Code: {item.code}
                                      </Text>
                                    )}
                                  </View>
                                </TouchableOpacity>
                              );
                            })
                          ) : (
                            <Text
                              style={{
                                padding: 12,
                                color: "#999",
                                fontStyle: "italic",
                              }}
                            >
                              No outlets under this beat
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            </>}

            <Text style={{ fontSize: 14, marginTop: 10 }}>Reason <Text style={{ color: "red" }}>*</Text></Text>
            <TextInput
              style={[
                styles.reasonTextInput,
                adhocReasonError ? { borderColor: 'red' } : {},
              ]}
              placeholder="Enter reason for Ad-Hoc visit"
              placeholderTextColor="#7A7266"
              value={selectedReasonForADHOC}
              onChangeText={(text) => {
                // Strip emojis and special characters, allow only letters, numbers, spaces
                const sanitized = text.replace(/[^a-zA-Z0-9 ]/g, '');
                // Collapse multiple consecutive spaces into one
                const noExtraSpaces = sanitized.replace(/  +/g, ' ');
                setSelectedReasonForADHOC(noExtraSpaces);
                // Validate
                if (!noExtraSpaces.trim()) {
                  setAdhocReasonError('Reason is required');
                } else if (noExtraSpaces.trim().length < 3) {
                  setAdhocReasonError('Reason must be at least 3 characters');
                } else {
                  setAdhocReasonError('');
                }
              }}
              maxLength={100}
              autoCapitalize="sentences"
              autoCorrect={false}
            />
            {adhocReasonError ? (
              <Text style={{ color: 'red', fontSize: 12, marginBottom: 4, marginTop: -6 }}>{adhocReasonError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={loading ? undefined : handleCheckInSubmit}
              disabled={loading || !selectedReasonForADHOC?.trim() || !!adhocReasonError || selectedAdHocItems.length === 0}
            >
              <LinearGradient
                colors={(!selectedReasonForADHOC?.trim() || !!adhocReasonError || selectedAdHocItems.length === 0) ? ['#ccc', '#aaa'] : Gradients.primary}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Submit</Text>
              </LinearGradient>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>

        <LoaderOverlay visible={loading} message="Submitting ad-hoc..." />
      </Modal>

      {/* <LoaderOverlay visible={loading} /> */}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "white",
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: 'center',
    width: "90%",
  },
  button: {
    padding: 7,
    borderRadius: 20,
    marginHorizontal: 5,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "400",
    fontSize: 12,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(49, 50, 51, 0.56)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    width: "90%",
    // height: 400,
    elevation: 10,
    justifyContent: "space-between", // ⬅️ Space between top & bottom
  },
  label: {
    fontWeight: "700",
    marginBottom: 10,
    fontSize: 18,
    color: "black",
    marginLeft: 4,
  },
  beatSelector: {
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 6,
    padding: 10,
    marginBottom: -2,
  },
  beatText: {
    fontWeight: "400",
    color: "black",
  },
  beatDropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    marginBottom: 10,
    maxHeight: 260,
  },
  searchInput: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    backgroundColor: "#FBF8F1",
  },
  dropdownScroll: {
    maxHeight: 150,
  },
  beatItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  noDataText: {
    padding: 10,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
  },
  errorText: {
    color: "red",
    fontSize: 13,
    marginTop: 5,
    marginBottom: 5,
    textAlign: "left",
  },
  saveButton: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    fontWeight: "bold",
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 4,
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: "#333",
  },



  adHocItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#aaa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  checkboxChecked: {
    backgroundColor: '#C9A24D',
    borderColor: '#C9A24D',
  },

  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  adHocItemLabel: {
    fontSize: 14,
    color: '#000',
  },

  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 999,
  },

  loadingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },

  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  dropdown: {
    height: 42,
    paddingHorizontal: 12,
    // backgroundColor: '#FBF8F1',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 4,
    color: '#000',
  },
  searchbox: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 14,
    paddingLeft: 4,
    borderBottomWidth: 0.2,
    borderColor: 'gray',
    height: 42,
  },
  dropdownContainer: {
    borderRadius: 8,
    marginTop: -42,
    paddingVertical: 5,
    backgroundColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  placeholderDropdown: { color: '#7A7266', fontSize: 14 },
  valueDropdown: { color: '#1F1D1A', fontSize: 14 },
  adHocSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
    marginTop: 8,
  },
  adHocCandidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  adHocCheckbox: {
    height: 22,
    width: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#B0C4FF',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  adHocCheckboxSelected: {
    backgroundColor: '#A67C2E',
    borderColor: '#A67C2E',
  },
  adHocCheckmark: { color: '#fff', fontSize: 13 },
  adHocCandidateName: { fontSize: 14, fontWeight: '600', color: '#222' },
  adHocCandidateMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  adHocEmptyText: { color: '#888', fontSize: 13, paddingVertical: 8 },
  reasonTextInput: {
    height: 42,
    paddingHorizontal: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 4,
    color: '#000',
    fontSize: 14,
  },
});

export default BeatChange;
