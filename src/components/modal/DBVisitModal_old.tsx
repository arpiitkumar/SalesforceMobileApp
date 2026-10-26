import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../../assets/css/MasterCss";
import { useState } from "react";
import { RootState } from '../../redux/store';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import moment from 'moment';
import { isInternetAvailable } from '../../utils/networkUtils';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import { saveToApi } from '../../utils/dataPost/apiService';
import { saveLocally } from '../../utils/dataPost/localService';
import { PlaceId_var } from '../../../config'
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../../redux/slices/toastSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'


const DBVisitModal = ({
  visible,
  onClose,
}) => {
  const dispatch = useDispatch();

  const { apiFetch } = useApiFetch()

  const [selectedSR, setSelectedSR] = useState([]);


  const [expandedDistributors, setExpandedDistributors] = useState([]);
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const selectedBeatDay = useSelector(state => state.selectedBeatDay.selectedBeatDay);


  const resetSelection = () => {
    setSelectedSR([]);     // clear all
    setExpandedDistributors([]);
  };


  useEffect(() => {
    if (!visible) {
      resetSelection();
      setLoading(false);
    }
  }, [visible]);

  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat
  );


  const onSave = async () => {
    setLoading(true);
    try {
      for (const sr of selectedSR) {
        // const currentDate = moment().format('YYYY-MM-DD');
        const currentDate = dateStore;
        const beatDays = await UniversalUpdateInsert({
          ObjectName: 'BeatDay__c',
          Type: 'get',
          filters: [
            { field: 'BeatDate__c', value: currentDate },
            { field: 'OwnerId', value: sr.srId }
          ],

        });

        // console.log('beatDays', beatDays)

        if (!beatDays.length) {
          dispatch(showToast({ message: `No Beat Day found for the ${sr.srName} today.`, type: 'warning' }));
          setLoading(false);
          resetSelection();
          onClose();
          return;
        }

        const beatDay = beatDays[0];

        // 3) fetch existing visits
        const existingVisits = await UniversalUpdateInsert({
          ObjectName: 'Visit',
          Type: 'get',
          filters: [
            { field: 'BeatDay__c', value: beatDay.Sf_Id }
          ],
        });

        if (!existingVisits.length) {
          dispatch(showToast({ message: 'No visits to save.', type: 'warning' }));
          setLoading(false);
          resetSelection();
          onClose();
          return;
        }


        const alredyvisit = await UniversalUpdateInsert({
          ObjectName: 'Visit',
          Type: 'get',
          filters: [
            { field: 'BeatDay__c', value: selectedBeatDay?.Sf_Id },
            { field: 'VisitDate__c', value: currentDate },
            { field: 'Beat__c', value: beatDay.Beat__c },
            { field: 'DB_SUB_DB_Super_Name__c', value: sr.distributorId },
            // { field: 'RevisedDBName__c', value: sr.distributorId },
            { field: 'RevisedRepName__c', value: sr.srId },
            { field: 'VisitType__c', value: 'Market and DB Visit' },
          ]
        });
        // console.log(alredyvisit.length)
        // return;
        if (alredyvisit.length > 0) {
          dispatch(showToast({
            message: `Already Added activity for owner :${sr.srName} and distributor: ${sr.distributorName}`,
            type: 'warning'
          }))
          setLoading(false);
          resetSelection();
          onClose();
          return;
        }



        // 4) prepare common payload fields
        const commonFields = {
          Beat__c: beatDay.Beat__c,
          VisitType__c: "Market and DB Visit",
          RevisedMTPType__c: "Market and DB Visit",
          // SR_TSI_ASO_Name__c: selectedSR,
          DB_SUB_DB_Super_Name__c: sr.distributorId || '',
          RevisedDBName__c: sr.distributorId,
          RevisedRepName__c: sr.srId,
          BeatDay__c: selectedBeatDay?.Sf_Id,
          VisitDate__c: currentDate,
          VisitStatus__c: "Planned",
          AdHocVisit__c: true,
          PJPOutlet__c: false,
          NonPjpOutlet__c: true,
          PlaceId__c: PlaceId_var,
          PlannedVisitStartTime: new Date().toISOString(),
          MTP_Admin_Approval_Status__c: 'Pending',
          MTP_ApprovalSubmitedDate__c: new Date().toISOString(),
        };
        // 5) connectivity check once
        const connected = await isInternetAvailable();

        // 6) loop through each visit
        for (const visitRecord of existingVisits) {
          const payload = {
            ...commonFields,
            AccountId: visitRecord.AccountId,
          };

          let sfId, isSynced = false;
          if (connected) {
            try {
              const { sfId: newSfId } = await saveToApi(apiFetch, 'Visit', payload);
              sfId = newSfId;
              isSynced = true;
              console.log('Visit Synced ONLINE...')
            } catch (err) {
              sfId = `local-${Date.now()}`;

              console.log('Visit Submission online failed...')
            }
          } else {
            sfId = `local-${Date.now()}`;
          }

          await saveLocally('Visit', payload, sfId, isSynced);


        }
      }
      dispatch(showToast({
        message: 'Activity added successfully!.',
        type: 'success'
      }));

      setLoading(false)
      resetSelection();
      onClose();
    } catch (err) {
      console.error(' Error in DBVisitModal onSave:', err);
      setLoading(false)
      dispatch(showToast({ message: err.message || 'Save failed', type: 'error' }));

    } finally {
      setLoading(false);
    }
  };


  const [distributors, setDistributors] = useState([]);

  const toggleDistributor = (id) => {
    setExpandedDistributors((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        // 1) get logged-in user
        const users = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });
        const currentUser = users[0];
        if (!currentUser?.Sf_Id) return;

        // 2) fetch mapping from Line_SR_Distributor_Mapping__c
        const distributors = await UniversalUpdateInsert({
          ObjectName: 'Line_SR_Distributor_Mapping__c',
          Type: 'get',
          filters: [{ field: 'SR__c', value: currentUser.Sf_Id }],
        });

        if (!distributors.length) {
          setDistributors([]);
          return;
        }

        const distributorIds = [...new Set(distributors.map(d => d.Distributor__c))];
        // 4) fetch Account for distributor
        const accounts = await UniversalUpdateInsert({
          ObjectName: "Account",
          Type: "get",
          filters: [{ field: "Sf_Id", value: distributorIds, operator: "in" }],
        });

        const accountMap = accounts.reduce((map, acc) => {
          map[acc.Sf_Id] = acc;
          return map;
        }, {});

        // 5) fetch SR mapping related to those Distributors
        const allSR = await UniversalUpdateInsert({
          ObjectName: "SR_Beat_Assignment__c",
          Type: "get",
          filters: [
            { field: 'Sales_Person_ManagerId__c', value: currentUser.Sf_Id },
            { field: 'Distributor__c', value: distributorIds, operator: 'in' },
            { field: 'isActive__c', value: true },
            // { field: 'SRDeveloperRole', value: "H_T_SR" },

          ],
        });

        // 6) group by distributor and match to final UI format
        const finalDist = distributorIds.map(distId => {
          const relatedSRs = allSR.filter(s => s.Distributor__c === distId);

          return {
            id: distId,
            sfId: distId,
            name: accountMap[distId]?.Name || "Unknown",
            srs: Array.from(
              new Set(relatedSRs.map(s => s.Assigned_To__c))
            ).map(srId => {
              const srObj = relatedSRs.find(r => r.Assigned_To__c === srId);
              return {
                id: srId,
                displayName: srObj?.SalesRepresentativeName || "Unknown"
              };
            }),
          };
        });

        setDistributors(finalDist);

      } catch (err) {
        console.error("Error initializing:", err);
      }
    };

    initialize();
  }, []);


  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Market and DB Visit</Text>
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
                  <View style={styles.srTable}>
                    {item.srs.map((sr) => {
                      const isSelected = selectedSR.some(
                        s => s.distributorId === item.id && s.srId === sr.id
                      );

                      return (
                        <TouchableOpacity
                          key={sr.id}
                          style={[styles.srRow, isSelected && styles.selectedRow]}
                          onPress={() => {
                            setSelectedSR(prev => {
                              if (isSelected) {
                                // remove
                                return prev.filter(
                                  s => !(s.distributorId === item.id && s.srId === sr.id)
                                );
                              } else {
                                // add
                                return [
                                  ...prev,
                                  {
                                    distributorId: item.id,
                                    distributorName: item.name,
                                    srId: sr.id,
                                    srName: sr.displayName,
                                  },
                                ];
                              }
                            });
                          }}
                        >
                          <Ionicons
                            name={isSelected ? "radio-button-on" : "radio-button-off"}
                            size={20}
                            color={Gradients.primary[1]}
                          />
                          <Text>{sr.displayName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}


              </View>
            ))}
          </ScrollView>
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => {
              resetSelection();
              onClose();
            }} style={styles.buttonWrap} activeOpacity={0.8}>
              <LinearGradient colors={Gradients.primary} style={styles.button}>
                <Text style={styles.buttonText}>Cancel</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSave}
              disabled={selectedSR.length === 0 || loading}
              style={[
                styles.buttonWrap,
                { opacity: selectedSR.length > 0 && !loading ? 1 : 0.6 }
              ]}
              activeOpacity={0.8}
            >
              <LinearGradient colors={Gradients.primary} style={styles.button}>
                <Text style={styles.buttonText}>
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <LoaderOverlay visible={loading} />
    </Modal>
  );
};

export default DBVisitModal;

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
    color: '#0B0B0B',
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
  srTable: {
    marginTop: 5,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Gradients.primary[1] + "15",
    paddingBottom: 2,
    marginHorizontal: 2,
  },
  srRow: {
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 13,            // match your modal’s corners
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})