import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../../assets/css/MasterCss";
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { useSelector } from "react-redux";
import { RootState } from '../../redux/store';
import { PlaceId_var } from '../../../config'
import { saveToApi } from '../../utils/dataPost/apiService';
import { saveLocally } from '../../utils/dataPost/localService';
import { isInternetAvailable } from '../../utils/networkUtils';
import { showToast } from '../../redux/slices/toastSlice';
import { useDispatch } from 'react-redux';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'




const MarketWorkModal = ({
  visible,
  onClose,


}) => {

  const dispatch = useDispatch();
  const { apiFetch } = useApiFetch()
  const [users, setUsers] = useState([])
  const [distributors, setDistributors] = useState([]);
  const [expandedDistributors, setExpandedDistributors] = useState([]);
  const selectedBeatDay = useSelector(state => state.selectedBeatDay.selectedBeatDay);
  const [selectedBeat, setSelectedBeat] = useState('')
  const [selectedBeatId, setSelectedBeatId] = useState('')
  const [selectedDistibuterAccount, setSelectedDistibuterAccount] = useState('')
  const [selectedSelection, setSelectedSelection] = useState([]);
  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat
  );
  const [loading, setLoading] = useState(false);


  const resetSelection = () => {
    setSelectedSelection([]);
    setExpandedDistributors([]);
  };



  //console.log("THIS IS SELCECTED BEAT day DAYAYAYAYAYAYA::::", selectedBeatDay)
  const handleSave = async () => {
    console.log('selectedSelection', selectedSelection)

    console.log('reached outside async!!')

    // return;

    try {
      setLoading(true);
      for (const selection of selectedSelection) {


        const { beatId, distributorId, beatName, distributorName } = selection;
        const alredyvisit = await UniversalUpdateInsert({
          ObjectName: 'Visit',
          Type: 'get',
          filters: [
            { field: 'BeatDay__c', value: selectedBeatDay?.Sf_Id },
            { field: 'VisitDate__c', value: dateStore },
            { field: 'Beat__c', value: beatId },
            { field: 'DB_SUB_DB_Super_Name__c', value: distributorId },
            // { field: 'RevisedDBName__c', value: distributorId },
            { field: 'VisitType__c', value: 'Individual Market Work' },
          ]
        });
        // console.log(alredyvisit.length)
        // return;
        if (alredyvisit.length > 0) {
          dispatch(showToast({
            message: `Already Added activity for beat :${beatName} and distributor: ${distributorName}`,
            type: 'warning'
          }))
          setLoading(false);
          onClose();
          return;
        }


        const visitsInBeat = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
          filters: [{ field: "Beat__c", value: beatId }],
        });
        const accountIds = [...new Set(visitsInBeat.map(v => v.AccountId__c || v.AccountId).filter(Boolean))];

        let accounts = [];
        if (accountIds.length > 0) {
          accounts = await UniversalUpdateInsert({
            ObjectName: 'Account',
            Type: 'get',
            filters: [
              { field: 'Sf_Id', operator: 'in', value: accountIds },
              { field: 'Active__c', value: true }
            ],
          });
        }

        if (!accounts || accounts.length === 0) {
          console.log('No accounts found for the selected beat:', beatId);
          dispatch(showToast({
            message: `No accounts found for the selected beat:${beatName}`,
            type: 'warning'
          }))
          setLoading(false);
          onClose();
          return;
        }

        const usersList = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });
        const userIdVal = usersList[0]?.Sf_Id || usersList[0]?.Id || '';

        const connected = await isInternetAvailable();

        for (const account of accounts) {
          const uniqueId = `${userIdVal}-${dateStore}-Individual Market Work-${distributorId}-${beatId}-${account.Sf_Id}`;

          // Check if this combination already exists in local DB using unique ID
          const visit_check_unique = await UniversalUpdateInsert({
            ObjectName: 'Visit',
            Type: 'get',
            filters: [
              { field: "Mobile_Unique_Id__c", value: uniqueId },
              { field: "SoftDelete", value: false }
            ],
          });

          if (visit_check_unique && visit_check_unique.length > 0) {
            console.log(`⛔ Visit with Mobile_Unique_Id__c ${uniqueId} already exists, skipping...`);
            continue; // 🚀 skip this iteration
          }

          const existingVisit = await UniversalUpdateInsert({
            ObjectName: 'Visit',
            Type: 'get',
            filters: [
              { field: 'BeatDay__c', value: selectedBeatDay?.Sf_Id },
              { field: 'VisitDate__c', value: dateStore },
              { field: 'Beat__c', value: beatId },
              { field: 'DB_SUB_DB_Super_Name__c', value: distributorId },
              { field: 'VisitType__c', value: 'Individual Market Work' },
              { field: 'AccountId__c', value: account.Sf_Id },
            ]
          });

          if (existingVisit?.length > 0) {
            console.log(
              `Visit already exists for account ${account.Sf_Id}. Skipping...`
            );
            continue;
          }


          const visitPayload = {
            Beat__c: beatId,
            VisitType__c: 'Individual Market Work',
            RevisedMTPType__c: 'Individual Market Work',
            DB_SUB_DB_Super_Name__c: distributorId || '',
            RevisedDBName__c: distributorId || '',
            BeatDay__c: selectedBeatDay?.Sf_Id,
            VisitDate__c: dateStore,
            AccountId: account.Sf_Id,
            VisitStatus__c: 'Planned',
            AdHocVisit__c: true,
            PJPOutlet__c: false,
            NonPjpOutlet__c: true,
            PlaceId__c: PlaceId_var,
            PlannedVisitStartTime: new Date().toISOString(),
            MTP_Admin_Approval_Status__c: 'Pending',
            MTP_ApprovalSubmitedDate__c: new Date().toISOString(),
            Mobile_Unique_Id__c: uniqueId,
          };

          let sfId;
          let isSynced = false;

          if (connected) {
            try {
              const { sfId: generatedId } = await saveToApi(apiFetch, 'Visit', visitPayload); // `apiFetch` optional or pass it
              sfId = generatedId;
              isSynced = true;
              console.log("Synced to API:", sfId);
            } catch (err) {
              const errMsg = err?.message || '';
              if (errMsg.includes('DUPLICATE_VALUE') || errMsg.includes('duplicate value found')) {
                console.log(`⚠️ Skip local save for MarketWorkModal because it is duplicate on server:`, errMsg);
                continue; // 🚀 skip this iteration entirely
              }
              //dispatch(showToast({ message: 'Spot Sales Submission Failed (ONLINE)', type: 'error' }));
              console.warn('API failed, saving locally:', err.message);
              sfId = `local-${Date.now()}`;
              isSynced = false;
            }
          } else {
            sfId = `local-${Date.now()}`;
            isSynced = false;
            console.log("Offline mode, saving locally.");
          }

          await saveLocally('Visit', visitPayload, sfId, isSynced);

          console.log('saved locally!!')

          // dispatch(showToast({
          //   message: 'Activity added successfully.',
          //   type: 'success'
          // }))
          // {
          //   !isSynced && dispatch(showToast({
          //     message: isSynced ? 'Order saved from API' : 'Order saved.',
          //     type: 'success'
          //   }))
          // }

        }
        dispatch(showToast({
          message: `Activity added successfully for beat ${beatName}.`,
          type: 'success'
        }))

      }


      // dispatch(showToast({
      //   message: 'Activity added successfully.',
      //   type: 'success'
      // }))
      setLoading(false);

      onClose();
    } catch (error) {
      setLoading(false)
      dispatch(showToast({
        message: 'Could not save the spot sales',
        type: 'error'
      }))

      console.error(' Error while saving visit records:', error);
    }
  };

  useEffect(() => {
    if (!visible) {
      resetSelection();
    }
  }, [visible]);


  useEffect(() => {
    const initialize = async () => {
      try {
        // 1) Get logged-in user
        const users = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        const currentUser = users[0];
        if (!currentUser?.Sf_Id) return;

        // 2) Fetch Distributor mapping based on SR
        const distributors = await UniversalUpdateInsert({
          ObjectName: "Line_SR_Distributor_Mapping__c",
          Type: "get",
          filters: [{ field: "SR__c", value: currentUser.Sf_Id }],
        });

        if (!distributors.length) {
          setDistributors([]);
          return;
        }

        // Extract Distributor Ids
        // const distributorIds = distributors.map(d => d.Distributor__c);
        const distributorIds = [...new Set(distributors.map(d => d.Distributor__c))];

        const accounts = await UniversalUpdateInsert({
          ObjectName: "Account",
          Type: "get",
          filters: [{ field: "Sf_Id", value: distributorIds, operator: "in" }],
        });

        const accountMap = accounts.reduce((map, acc) => {
          map[acc.Sf_Id] = acc;
          return map;
        }, {});

        const allBeats = await UniversalUpdateInsert({
          ObjectName: "SR_Beat_Assignment__c",
          Type: "get",
          filters: [
            // { field: "Sales_Person_ManagerId__c", value: currentUser.Sf_Id },
            { field: "Distributor__c", value: distributorIds, operator: "in" },
            { field: 'isActive__c', value: true },
            // { field: 'SRDeveloperRole', value: "H_T_SR" },
          ],
        });
        // const finalDist = distributorIds.map(distId => {
        //   const relatedBeats = allBeats.filter(
        //     b =>
        //       b.Distributor__c === distId &&
        //       b.Beat__c !== null &&
        //       b.Beat__c !== undefined &&
        //       b.Beat__c !== ''
        //   );

        //   return {
        //     id: distId,
        //     sfId: distId,
        //     name: accountMap[distId]?.Name || "Unknown",

        //     // BEATS list format as UI expects (instead of srs)
        //     beats: relatedBeats.map(b => ({
        //       id: b.Beat__c,
        //       name: b.BeatName,
        //       retailers: 0,   // beat.Retailers__c || 0
        //     }))
        //   };
        // });

        const finalDist = distributorIds.map(distId => {
          const relatedBeats = allBeats.filter(
            b =>
              b.Distributor__c === distId &&
              b.Beat__c
          );

          // Remove duplicate beats (per distributor)
          const uniqueBeatMap = {};

          relatedBeats.forEach(b => {
            if (!uniqueBeatMap[b.Beat__c]) {
              uniqueBeatMap[b.Beat__c] = {
                id: b.Beat__c,
                name: b.BeatName,
                retailers: 0,
              };
            }
          });

          return {
            id: distId,
            sfId: distId,
            name: accountMap[distId]?.Name || "Unknown",

            beats: Object.values(uniqueBeatMap) // unique beats only
          };
        });
        // console.log("FINAL STRUCTURE ===>", finalDist);
        setDistributors(finalDist);

      } catch (err) {
        console.error("Error initializing:", err);
      }
    };

    initialize();
  }, []);

  const toggleDistributor = (id) => {
    setExpandedDistributors((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };
  let arrayofid = distributors.map(item => item.id);
  // console.log(arrayofid, "distributor ids")
  const toggleSelection = (beatId, distributorId, beatName, distributorName) => {
    setSelectedSelection(prev => {
      const exists = prev.find(
        item =>
          item.beatId === beatId &&
          item.distributorId === distributorId
      );

      if (exists) {
        //  remove (unselect)
        return prev.filter(
          item =>
            !(item.beatId === beatId && item.distributorId === distributorId)
        );
      }

      // add (select)
      return [...prev, { beatId, distributorId, beatName, distributorName }];
    });
  };

  const isSelected = (beatId, distributorId) =>
    selectedSelection.some(
      item =>
        item.beatId === beatId &&
        item.distributorId === distributorId
    );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Individual Market Work</Text>
          <ScrollView showsVerticalScrollIndicator={false}>


            {distributors.map((item) => (
              <View key={item.id} style={{ marginBottom: 8 }}>
                <TouchableOpacity
                  style={styles.distributorCard}
                  onPress={() => toggleDistributor(item.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={expandedDistributors.includes(item.id) ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color={'gray'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.distributorName}>{item.name}</Text>
                </TouchableOpacity>
                {expandedDistributors.includes(item.id) && (
                  <View style={styles.beatTable}>
                    {item.beats.map((beat, index) => (
                      <TouchableOpacity
                        style={[
                          styles.beatRow,
                          isSelected(beat.id, item.id) && styles.selectedRow
                        ]}
                        onPress={() => toggleSelection(beat.id, item.id, beat.name, item.name)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isSelected(beat.id, item.id) ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={Gradients.primary[1]}
                          style={{ marginRight: 5 }}
                        />
                        <Text style={{ flex: 1 }}>{beat.name}</Text>
                      </TouchableOpacity>

                    ))}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onClose} style={styles.buttonWrap} activeOpacity={0.8}>
              <LinearGradient colors={Gradients.primary} style={styles.button}>
                <Text style={styles.buttonText}>Cancel</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={selectedSelection.length === 0}
              style={[
                styles.buttonWrap,
                { opacity: selectedSelection.length ? 1 : 0.6 }
              ]}


              activeOpacity={selectedBeat ? 0.8 : 1}
            >
              <LinearGradient colors={Gradients.primary} style={styles.button}>
                <Text style={styles.buttonText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Loading overlay */}
      <LoaderOverlay visible={loading} message="Saving market work..." />
    </Modal>
  );
};

export default MarketWorkModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(33, 91, 204, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "92%",
    height: "60%",
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 17,
    color: '#0B0B0B'
  },
  distributorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f7fc",
    padding: 11,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Gradients.primary[1] + "24",
  },
  distributorName: {
    fontSize: 15,
    fontWeight: "600",
    color: '#0B0B0B',
  },
  beatTable: {
    marginTop: 5,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Gradients.primary[1] + "15",
    paddingBottom: 2,
    marginHorizontal: 2,
  },
  beatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Gradients.primary[0] + "13",
  },
  selectedRow: {
    backgroundColor: Gradients.primary[0] + "12",
    borderRadius: 4,
  },
  retailerBadge: {
    backgroundColor: "#e8edfa",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  retailerText: {
    color: Gradients.primary[2],
    fontWeight: "700",
    fontSize: 11,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    paddingHorizontal: 8,
  },
  buttonWrap: {
    flex: 1,
    marginHorizontal: 5,
  },
  button: {
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 13,           // match modalContainer corners
    //marginHorizontal: "4%",     // center over the modal
  },
  loadingText: {
    marginTop: 12,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});