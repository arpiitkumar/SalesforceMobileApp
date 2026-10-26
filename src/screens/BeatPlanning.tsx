import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Image,
  Linking,
  Platform,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { dataSyncer } from "../UtilityMain/dataSyncer";
import Ionicons from "react-native-vector-icons/Ionicons";
import Entypo from "@react-native-vector-icons/entypo";
import Svg, { Path } from "react-native-svg";
import LinearGradient from "react-native-linear-gradient";
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps";
import NetInfo from "@react-native-community/netinfo";
import moment from "moment";
import { useSelector } from "react-redux";
import { getBeatPlanningStyle } from "../assets/css/BeatPlanning";
import { Gradients } from "../assets/css/MasterCss";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { useNavigation } from "@react-navigation/native";
import SelfieCheckIn from "../components/modal/SelfieCheckIn";
import CheckOut from "../components/modal/CheckOut";
import VisitFilterModal, { FilterState } from "../components/modal/VisitFilterModal";
import { useFocusEffect } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { setSelectedAccount } from "../redux/slices/selectedAccountSlice";
import { setSelectedVisit } from "../redux/slices/selectedVisitSlice";
import Tooltip from "react-native-walkthrough-tooltip";
import ChangeBeat from "../components/modal/ChangeBeat";
import { setSelectedBeatDay } from "../redux/slices/selectedBeatDaySlice";
import { RootState } from "../redux/store";
import { setCheckInStatus } from "../redux/slices/checkInSlice";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import {
  setBeatSelection,
  clearBeatSelection,
} from "../redux/slices/beatSelectionSlice";
import { showToast } from "../redux/slices/toastSlice";
import { isInternetAvailable } from "../utils/networkUtils";
import { refreshPerfectStoreFlags } from "../utils/helper/refreshPerfectStoreFlags";
import {
  syncVisitRecord,
  syncBeatDayRecord,
} from "../database/dbService/AllDataSync";
import { getCurrentLocation } from "../utils/getCurrentLocation";
import getDistanceInKm from "../utils/helper/GetDistance";
import { isDistributorAccount } from "../utils/distributorHelper";

const { width: screenWidth } = Dimensions.get("window");
const TABS = ["All", "Upcoming", "Check In", "Check Out"];
const hasVisitTime = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized !== "" && normalized !== "null" && normalized !== "undefined";
};

const BeatPlanning = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [silentRefresh, setSilentRefresh] = useState(false);
  const searchParam = useSelector(
    (state: RootState) => state.search.searchParam
  );
  //  console.log("THIS IS NEW SEARCH:::::", searchParam)
  const [userState, setUserState] = useState([]);
  const { accessToken, instanceUrl, userId: authUserId } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Visit Filter state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [visitFilters, setVisitFilters] = useState<FilterState>({
    outletName: "",
    distanceSort: null,
    selectedClasses: [],
    selectedChannels: [],
    perfectStoreOnly: false,
  });
  const [classOptions, setClassOptions] = useState<any[]>([]);
  const [channelOptions, setChannelOptions] = useState<any[]>([]);

  const { apiFetch, apiComposite, fetchRecords } = useApiFetch();
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchLoc = async () => {
        try {
          const loc = await getCurrentLocation();
          if (isMounted && loc) {
            setCurrentLocation(loc);
          }
        } catch (error) {
          console.log("Error fetching location in BeatPlanning:", error);
        }
      };
      fetchLoc();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  // Refresh the Perfect Store flag from Salesforce when the Beat Plan opens,
  // then reload the visit list if any account's flag changed.
  useEffect(() => {
    let cancelled = false;
    const syncPerfectFlags = async () => {
      if (!accessToken || !instanceUrl) return;
      if (!(await isInternetAvailable())) return;
      const res = await refreshPerfectStoreFlags({
        fetchRecords,
        accessToken,
        instanceUrl,
      });
      if (!cancelled && res.success && res.changed > 0) {
        setRefreshTrigger((prev) => prev + 1);
      }
    };
    syncPerfectFlags();
    return () => {
      cancelled = true;
    };
  }, [accessToken, instanceUrl]);

  const onRefresh = useCallback(async () => {
    const netState = await NetInfo.fetch();
    const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
    if (!isOnline) {
      dispatch(
        showToast({
          type: "warning",
          message: "You are offline. Connect to internet to sync",
        })
      );
      return;
    }
    setRefreshing(true);
    try {
      if (accessToken && instanceUrl) {
        await dataSyncer({ accessToken, instanceUrl }, fetchRecords, apiFetch, apiComposite);
      }
      try {
        const loc = await getCurrentLocation();
        if (loc) {
          setCurrentLocation(loc);
        }
      } catch (locErr) {
        console.log("Error updating location on refresh:", locErr);
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, instanceUrl, fetchRecords, apiFetch, apiComposite, dispatch]);
  const handleCallPress = (number) => {
    if (!number) {
      return;
    }
    Linking.openURL("tel:" + number);
  };
  const [selectedBeatIdNew, setSelectedBeatIdNew] = useState(null);
  const navigation = useNavigation();
  const [filteredVisits, setFilteredVisits] = useState([]);
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [checkInDistanceError, setCheckInDistanceError] = useState<string | null>(null);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [selectedBeatName, setSelectedBeatName] = useState(null);
  const [selectedBeatCode, setSelectedBeatCode] = useState(null);
  const [visitData, setVisitData] = useState(null);
  const [beatDaysId, setBeatDaysId] = useState(null);
  const [EndOfDayTime, setEndOfDayTime] = useState(null);
  const [beatDayApprovalStatus, setBeatDayApprovalStatus] = useState(null);
  const [jointWorkingInfo, setJointWorkingInfo] = useState<{
    user: string | null;
    userName: string | null;
    reason: string | null;
  } | null>(null);
  const [activeJointWorkingList, setActiveJointWorkingList] = useState<any[]>([]);

  const [tooltipVisible, setTooltipVisible] = useState(null);

  const [selecteBeatId, setSelecteBeatId] = useState(null);
  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat
  );
  const alredyCheckIn = useSelector((state: RootState) => state.checkIn);
  const isToday = useMemo(() => {
    if (!dateStore) return true;
    const cleanDate = String(dateStore).replace(/^"+|"+$/g, "").trim();
    return moment(cleanDate).isSame(moment(), "day");
  }, [dateStore]);
  const [refreshBeatData, setRefreshBeatData] = useState(null);
  const styles = getBeatPlanningStyle();
  const [activeTab, setActiveTab] = useState("All");
  const [mapType, setMapType] = useState("standard");

  const [currentMonthRoutePlanState, setCurrentMonthRoutePlanState] = useState(
    []
  );

  // const [region, setRegion] = useState({
  //   latitude: 37.78825,
  //   longitude: -122.4324,
  //   latitudeDelta: 0.015,
  //   longitudeDelta: 0.0121,
  // });
  // const [region, setRegion] = useState({
  //   latitude: 26.9124,       // Latitude of Jaipur
  //   longitude: 75.7873,      // Longitude of Jaipur
  //   latitudeDelta: 2.0,      // Zoom level (vertical span)
  //   longitudeDelta: 2.0,     // Zoom level (horizontal span)
  // });

  const [region, setRegion] = useState({
    latitude: 22.5726, // Centered at Kolkata, West Bengal
    longitude: 88.3639,
    latitudeDelta: 2.0,
    longitudeDelta: 2.0,
  });
  const mapRef = useRef(null);
  const [isConnected, setIsConnected] = useState(true);
  const [categorizedData, setCategorizedData] = useState({
    All: [],
    Upcoming: [],
    "Check Out": [],
    "Check In": [],
  });

  const [accountDataList, setAccountDataList] = useState([]);
  const [adHocVisits, setAdHocVisits] = useState([]);

  const [todaysDate, setTodaysDate] = useState("");

  const [zoomInCount, setZoomInCount] = useState(0);
  const [zoomOutCount, setZoomOutCount] = useState(0);
  const MAX_ZOOM_TIMES = 5;

  const zoomIn = () => {
    if (zoomInCount < MAX_ZOOM_TIMES) {
      setRegion((prev) => ({
        ...prev,
        latitudeDelta: prev.latitudeDelta / 2,
        longitudeDelta: prev.longitudeDelta / 2,
      }));
      setZoomInCount(zoomInCount + 1);
      setZoomOutCount(Math.max(zoomOutCount - 1, 0)); // Reset opposite counter if you want "oscillation" behavior
    }
  };

  const zoomOut = () => {
    if (zoomOutCount < MAX_ZOOM_TIMES) {
      setRegion((prev) => ({
        ...prev,
        latitudeDelta: prev.latitudeDelta * 2,
        longitudeDelta: prev.longitudeDelta * 2,
      }));
      setZoomOutCount(zoomOutCount + 1);
      setZoomInCount(Math.max(zoomInCount - 1, 0)); // Reset opposite counter if you want
    }
  };

  // Add a new state updater function
  const updateSelectedBeatId = (newBeatId) => {
    setSelecteBeatId(newBeatId);
  };

  const handleNavigateToDetails = (item) => {
    const detailsData = findRecordBySfId(item.AccountId);

    // console.log("THIS IS ACCCOUNT DATA PAERTICULAR +++++", detailsData)

    dispatch(setSelectedAccount(detailsData));

    // Dispatch the selected visit data
    dispatch(setSelectedVisit(item));
    //console.log("DEtaild id", detailsData);
    navigation.navigate("AccountDetailContainer", {
      accountDetailId: detailsData?.Sf_Id,
      visitDetail: item,
      categorizedData: categorizedData,
    });
  };

  const openCheckinModal = async (item) => {
    // Temporarily disabled as requested. Set to true to restore the 100 m
    // check-in validation without changing the implementation below.
    const enforceCheckInDistanceValidation = false;

    if (enforceCheckInDistanceValidation) {
      const outletLatitude = Number(item?.BillingLatitude);
      const outletLongitude = Number(item?.BillingLongitude);

      if (!outletLatitude || !outletLongitude || !Number.isFinite(outletLatitude) || !Number.isFinite(outletLongitude)) {
        setCheckInDistanceError("The outlet location is unavailable. Check-in cannot be verified.");
        return;
      }

      try {
        // Read GPS at tap time instead of using the map's cached location. GPS
        // works without internet, so this restriction is enforced offline too.
        const location = await getCurrentLocation();
        const distanceInMetres = getDistanceInKm(
          location.latitude,
          location.longitude,
          outletLatitude,
          outletLongitude,
        ) * 1000;

        if (distanceInMetres > 100) {
          setCheckInDistanceError(
            `You are ${Math.round(distanceInMetres).toLocaleString()} m away from this outlet. You must be within 100 m to check in.`
          );
          return;
        }

        setCurrentLocation(location);
      } catch (error) {
        console.log("Unable to verify Check In distance:", error);
        setCheckInDistanceError("Unable to get your current location. Enable location access and try again.");
        return;
      }
    }

    const detailsData = findRecordBySfId(item.AccountId);
    dispatch(setSelectedAccount(detailsData));
    dispatch(setSelectedVisit(item));

    setSelectedOutlet(item);
    setSelfieModalVisible(true);
  };

  const handleValidateJointWork = async (item) => {
    const outletLatitude = Number(item?.BillingLatitude);
    const outletLongitude = Number(item?.BillingLongitude);

    if (!outletLatitude || !outletLongitude || !Number.isFinite(outletLatitude) || !Number.isFinite(outletLongitude)) {
      dispatch(
        showToast({
          message: "The outlet location is unavailable. Validation cannot be verified.",
          type: "error",
        })
      );
      return;
    }

    try {
      setSilentRefresh(true);
      let location = currentLocation;
      if (!location) {
        location = await getCurrentLocation();
      }

      if (!location) {
        throw new Error("Unable to fetch location coordinates.");
      }

      const distanceInMetres = getDistanceInKm(
        location.latitude,
        location.longitude,
        outletLatitude,
        outletLongitude
      ) * 1000;

      if (distanceInMetres > 100) {
        dispatch(
          showToast({
            message: `You must be within 100 meters of the outlet to validate. Currently you are ${Math.round(distanceInMetres)} meters away.`,
            type: "error",
          })
        );
        return;
      }

      const updatedVisitData = {
        Sf_Id: item.sfId || item.Sf_Id,
        Joint_Visit_User_Validated__c: true,
        is_locally_changed: true,
        operation_type: "update",
        last_modified: Date.now(),
        is_synced: false,
      };

      const success = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "insert",
        data: updatedVisitData,
      });

      if (success) {
        if (isConnected) {
          try {
            const synced = await syncVisitRecord(apiFetch, apiComposite);
            if (synced) {
              dispatch(
                showToast({
                  message: "Visit validated and synced with Salesforce successfully!",
                  type: "success",
                })
              );
            } else {
              dispatch(
                showToast({
                  message: "Visit validated successfully!",
                  type: "success",
                })
              );
            }
          } catch (syncErr) {
            console.log("Error syncing joint work validation online:", syncErr);
            dispatch(
              showToast({
                message: "Visit validated locally.",
                type: "success",
              })
            );
          }
        } else {
          dispatch(
            showToast({
              message: "Visit validated successfully offline!",
              type: "success",
            })
          );
        }

        setTimeout(() => {
          setRefreshTrigger((prev) => prev + 1);
        }, 200);
      } else {
        dispatch(
          showToast({
            message: "Failed to save validation locally.",
            type: "error",
          })
        );
      }
    } catch (error) {
      console.log("Error during joint work validation:", error);
      dispatch(
        showToast({
          message: "Unable to verify location. Please enable location access and try again.",
          type: "error",
        })
      );
    } finally {
      setTimeout(() => {
        setSilentRefresh(false);
      }, 1000);
    }
  };

  const [stockChecked, setStockChecked] = useState(false);

  const stockCheck = async () => {
    try {
      const stockData = await UniversalUpdateInsert({
        ObjectName: "Stock_Check__c",
        Type: "get",
        filters: [{ field: "Beat_Day__c", value: beatDaysId }],
      });

      // console.log("STOCK DATA :::", JSON.stringify(stockData));

      if (stockData && stockData.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const hasTodayDate = stockData.some((item) => {
          return item.Stock_Check_Date__c.startsWith(today);
        });

        return hasTodayDate;
      } else {
        return false;
      }
    } catch (e) {
      console.error("Error in stockCheck:", e);
      return false;
    }
  };
  const stockCheckedResult = async () => {
    const rescheck = await stockCheck();
    setStockChecked(rescheck);
  };
  stockCheckedResult();

  const getAccountDetails = (item) => {
    const detailsData = findRecordBySfId(item.AccountId);
    return detailsData;
  };

  const handleSavePress = async () => {
    try {
      console.log("handleSavePress >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");

      if (!filteredVisits || filteredVisits.length === 0) {
        console.log("No visits to delete");
        return;
      }

      const BATCH_SIZE = 25;

      // Split into chunks of 25
      const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const visitChunks = chunkArray(filteredVisits, BATCH_SIZE);

      for (const [chunkIndex, chunk] of visitChunks.entries()) {
        // Build composite request and map referenceId => visit
        const refToVisit = {};
        const compositeRequest = chunk.map((visit, index) => {
          const refId = `DeleteVisit_${chunkIndex}_${index}`;
          refToVisit[refId] = visit;
          return {
            method: "DELETE",
            url: `/services/data/v61.0/sobjects/Visit/${visit.Sf_Id}`,
            referenceId: refId,
          };
        });

        const payload = {
          allOrNone: true,
          compositeRequest,
        };

        // console.log('payload', payload)
        // return
        let response = null;
        try {
          response = await apiComposite("POST", "", payload, "composite");
          console.log(
            `Composite Delete Response (batch ${chunkIndex + 1}):`,
            JSON.stringify(response)
          );
        } catch (apiErr) {
          console.error(
            `Composite API call failed for batch ${chunkIndex + 1}:`,
            apiErr
          );
          // If the composite call itself fails, mark entire chunk as soft-delete locally
          const toSoftDelete = chunk.map((v) => v.Sf_Id);
          console.log(
            `Marking entire chunk ${chunkIndex + 1
            } SoftDelete locally because composite failed. IDs:`,
            toSoftDelete
          );
          // Mark locally as SoftDelete
          for (const visit of chunk) {
            try {
              await UniversalUpdateInsert({
                ObjectName: "Visit",
                Type: "insert",
                data: { Sf_Id: visit.Sf_Id, SoftDelete: true },
              });
            } catch (localErr) {
              console.error(
                `Failed to SoftDelete Visit ${visit.Sf_Id} locally after composite failure:`,
                localErr
              );
            }
          }
          // continue to next chunk
          continue;
        }

        // If we get here, the API call returned something. Inspect compositeResponse if present.
        const compositeResponses =
          response && (response.compositeResponse || response.data?.compositeResponse)
            ? (response.compositeResponse || response.data?.compositeResponse)
            : null;

        if (!compositeResponses) {
          // No structured response — conservative approach: mark all in chunk as soft-delete
          console.warn(
            `No compositeResponse for batch ${chunkIndex + 1
            }, marking chunk as SoftDelete locally.`
          );
          for (const visit of chunk) {
            try {
              await UniversalUpdateInsert({
                ObjectName: "Visit",
                Type: "insert",
                data: { Sf_Id: visit.Sf_Id, SoftDelete: true },
              });
            } catch (localErr) {
              console.error(
                `Failed to SoftDelete Visit ${visit.Sf_Id} locally when compositeResponse missing:`,
                localErr
              );
            }
          }
          continue;
        }

        // Collect ids that were deleted successfully vs those that failed
        const successSfIds = [];
        const failedVisits = [];

        // compositeResponses array items correspond to subrequests; each item should have referenceId and httpStatusCode/body
        for (const subResp of compositeResponses) {
          const refId = subResp.referenceId;
          const visit = refToVisit[refId];
          if (!visit) {
            console.warn(
              `No matching visit found for referenceId ${refId} in batch ${chunkIndex + 1
              }`
            );
            continue;
          }

          const status = subResp.httpStatusCode || 0;

          // For delete, Salesforce returns 204 (No Content) on success; some APIs might return 200.
          if (status >= 200 && status < 300) {
            // treat as success
            successSfIds.push(visit.Sf_Id);
          } else {
            // treat as failed
            failedVisits.push({ visit, subResp });
          }
        }

        // 1) Delete locally those that were deleted online
        if (successSfIds.length > 0) {
          console.log(
            `Batch ${chunkIndex + 1}: Deleting locally ${successSfIds.length
            } visits that were deleted online.`,
            successSfIds
          );
          try {
            await UniversalUpdateInsert({
              ObjectName: "Visit",
              Type: "delete_bulk",
              data: successSfIds,
            });
          } catch (localDeleteErr) {
            console.error(
              `Failed to delete_bulk locally for successSfIds in batch ${chunkIndex + 1
              }:`,
              localDeleteErr
            );
            // If bulk delete fails, attempt per-item delete as fallback
            for (const sfId of successSfIds) {
              try {
                await UniversalUpdateInsert({
                  ObjectName: "Visit",
                  Type: "delete_bulk",
                  data: [sfId],
                });
              } catch (perErr) {
                console.error(
                  `Fallback failed to delete locally Visit ${sfId}:`,
                  perErr
                );
              }
            }
          }
        }

        // 2) For failed ones, mark SoftDelete = true locally
        if (failedVisits.length > 0) {
          console.log(
            `Batch ${chunkIndex + 1}: Marking ${failedVisits.length
            } visits SoftDelete locally because online delete failed.`
          );
          // Do updates in parallel but limit concurrency if needed; here we do Promise.all
          await Promise.all(
            failedVisits.map(async ({ visit, subResp }) => {
              try {
                await UniversalUpdateInsert({
                  ObjectName: "Visit",
                  Type: "insert",
                  data: { Sf_Id: visit.Sf_Id, SoftDelete: true },
                });
                console.log(
                  `Marked SoftDelete=true locally for Visit ${visit.Sf_Id}`
                );
              } catch (localErr) {
                console.error(
                  `Failed to SoftDelete Visit ${visit.Sf_Id} locally:`,
                  localErr,
                  "API subResp:",
                  subResp
                );
              }
            })
          );
        }

        console.log(
          `Finished processing composite batch ${chunkIndex + 1}: ${successSfIds.length
          } succeeded, ${failedVisits.length} failed.`
        );
      } // end for chunks

      // After all batches, re-fetch visits and show changed ones
      console.log("Fetching all visits to verify local state...");
      const allVisits = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "get",
      });

      const sfIds = filteredVisits.map((v) => v.sfId || v.Sf_Id);
      const updatedVisits = allVisits.filter((v) =>
        sfIds.includes(v.Sf_Id || v.sfId)
      );

      // console.log("Updated visits (post processing):", JSON.stringify(updatedVisits, null, 2));
      console.log("Finished delete/soft-delete sync process.");
    } catch (err) {
      console.error(" Error deleting visits:", err);
    }
  };



  const blinkAnimRef = useRef(new Animated.Value(0)); // 0..1
  const animLoopRef = useRef(null);

  // interpolated colors (change outputRange to colors you want)
  const animatedBg = blinkAnimRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: ["#FDBDBDE7", "#FFF1F1"], // bg color 1 and bg color 2
  });
  const animatedTextColor = blinkAnimRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: ["#B3393F", "#8B1F1F"], // text color 1 and text color 2
  });

  useEffect(() => {
    const createLoop = () =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnimRef.current, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false, // color interpolation requires false
          }),
          Animated.timing(blinkAnimRef.current, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      );

    // start only when both conditions true
    if (isToday && isConnected) {
      // stop any previous loop
      if (animLoopRef.current) {
        try {
          animLoopRef.current.stop();
        } catch (e) { }
        animLoopRef.current = null;
      }
      animLoopRef.current = createLoop();
      animLoopRef.current.start();
    } else {
      // not allowed to animate -> stop and reset to base color (value 0)
      if (animLoopRef.current) {
        try {
          animLoopRef.current.stop();
        } catch (e) { }
        animLoopRef.current = null;
      }
      // reset value so badge shows first color when offline / not-today
      blinkAnimRef.current.setValue(0);
    }

    return () => {
      // cleanup
      if (animLoopRef.current) {
        try {
          animLoopRef.current.stop();
        } catch (e) { }
        animLoopRef.current = null;
      }
    };
  }, [isToday, isConnected]); // depend on connection + day

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // `isConnected` only updates the UI.  Offline Ad-Hoc visits remain in
      // the local Visit queue until syncVisitRecord is explicitly run.
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      setIsConnected(connected);

      if (connected) {
        syncVisitRecord(apiFetch, apiComposite)
          .then(async (synced) => {
            const pendingVisits = await UniversalUpdateInsert({
              ObjectName: "Visit",
              Type: "get",
              filters: [{ field: "is_synced", value: false }],
            });
            const failedVisit = (Array.isArray(pendingVisits) ? pendingVisits : [])
              .find((visit) => visit?.ErrorMsg);

            if (failedVisit?.ErrorMsg) {
              dispatch(showToast({
                message: `Check-in sync failed: ${failedVisit.ErrorMsg}`,
                type: "error",
              }));
              return;
            }
            if (synced) {
              // Reload the local Visit data after local-* IDs are replaced
              // with Salesforce IDs by the standard SObject API sync.
              setRefreshTrigger((previous) => previous + 1);
            }
          })
          .catch((error) => {
            console.error("Unable to sync queued visits after reconnect:", error);
          });
      }
    });
    return () => unsubscribe();
  }, []);

  function findRecordBySfId(sfId) {
    return accountDataList.find((record) => record.Sf_Id === sfId) || null;
  }

  useFocusEffect(
    useCallback(() => {
      //console.log("THIS EFFECT IS CALLED AGAIN THIS IS ID SELECTED BIEAT NEW :::", selectedBeatIdNew)
      const dateNow = moment().format("YYYY-MM-DD");
      setTodaysDate(dateNow);
      setFilteredVisits([]);
      setAdHocVisits([]);
      setCategorizedData({ Upcoming: [], "Check In": [], "Check Out": [] });

      // Reset all date-specific state variables to prevent state pollution
      setBeatDayApprovalStatus(null);
      setBeatDaysId(null);
      setEndOfDayTime(null);
      setJointWorkingInfo(null);
      setActiveJointWorkingList([]);
      setSelectedBeatName(null);
      setSelecteBeatId(null);
      setSelectedBeatCode(null);

      const fetchVisits = async () => {
        if (!silentRefresh) {
          setLoading(true);
        }
        try {

          const Orders1 = await UniversalUpdateInsert({
            ObjectName: "Order",
            Type: "get",
          });

          const Orders = Orders1.filter((ord) => {
            const value = ord.TypeOfReturn__c;
            return value === "" || value == null; // handles null & undefined
          });
          const accountData = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
          });
          setAccountDataList(accountData);

          // Load Picklist Options for Class and Channel (offline & online)
          try {
            const classMap = new Map<string, { label: string; value: string }>();
            const channelMap = new Map<string, { label: string; value: string }>();

            // Salesforce stores the customer-facing text in `label` and the
            // value saved on Account in `value` (for example Class A / CLS01).
            // The modal displays `label`; `value` is kept for filtering.
            const addDescribePicklistOptions = (describe: any) => {
              const fields = Array.isArray(describe?.fields) ? describe.fields : [];
              const addFieldOptions = (
                fieldName: string,
                optionMap: Map<string, { label: string; value: string }>
              ) => {
                const field = fields.find((item: any) => item?.name === fieldName);
                if (!Array.isArray(field?.picklistValues)) return;

                field.picklistValues.forEach((item: any) => {
                  const label = (item?.label || "").toString().trim();
                  const value = (item?.value || "").toString().trim();
                  if (label && value && item?.active !== false) {
                    optionMap.set(value.toLowerCase(), { label, value });
                  }
                });
              };

              addFieldOptions("Class__c", classMap);
              addFieldOptions("Channel__c", channelMap);
            };

            // 1. Fetch from AllDataPicklist (same approach as AddAccountForm)
            const allPicklistData = await UniversalUpdateInsert({
              ObjectName: "AllDataPicklist",
              Type: "get",
            });

            console.log("[VisitFilter] AllDataPicklist count:", Array.isArray(allPicklistData) ? allPicklistData.length : 0);

            if (Array.isArray(allPicklistData) && allPicklistData.length > 0) {
              const raw = allPicklistData[0]?.OptionsData;
              console.log("[VisitFilter] OptionsData type:", typeof raw);
              if (raw) {
                try {
                  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                  addDescribePicklistOptions(parsed);
                  console.log("[VisitFilter] OptionsData keys:", Object.keys(parsed || {}));
                  console.log("[VisitFilter] ClassValues type:", typeof parsed?.ClassValues, "isArray:", Array.isArray(parsed?.ClassValues), "length:", parsed?.ClassValues?.length);
                  console.log("[VisitFilter] ChannelValues type:", typeof parsed?.ChannelValues, "isArray:", Array.isArray(parsed?.ChannelValues), "length:", parsed?.ChannelValues?.length);

                  if (parsed?.ClassValues && parsed.ClassValues.length > 0) {
                    console.log("[VisitFilter] ClassValues sample[0]:", JSON.stringify(parsed.ClassValues[0]));
                  }
                  if (parsed?.ChannelValues && parsed.ChannelValues.length > 0) {
                    console.log("[VisitFilter] ChannelValues sample[0]:", JSON.stringify(parsed.ChannelValues[0]));
                  }

                  // Extract ClassValues - handle both array of {label,value} objects and array of strings
                  if (Array.isArray(parsed?.ClassValues)) {
                    parsed.ClassValues.forEach((item: any) => {
                      let label = "";
                      let value = "";
                      if (typeof item === "object" && item !== null) {
                        label = (item.label || item.value || "").toString().trim();
                        value = (item.value || item.label || "").toString().trim();
                      } else if (item) {
                        label = item.toString().trim();
                        value = item.toString().trim();
                      }
                      if (label && value && !classMap.has(value.toLowerCase())) {
                        classMap.set(value.toLowerCase(), { label, value });
                      }
                    });
                  }

                  // Extract ChannelValues - handle both array of {label,value} objects and array of strings
                  if (Array.isArray(parsed?.ChannelValues)) {
                    parsed.ChannelValues.forEach((item: any) => {
                      let label = "";
                      let value = "";
                      if (typeof item === "object" && item !== null) {
                        label = (item.label || item.value || "").toString().trim();
                        value = (item.value || item.label || "").toString().trim();
                      } else if (item) {
                        label = item.toString().trim();
                        value = item.toString().trim();
                      }
                      if (label && value && !channelMap.has(value.toLowerCase())) {
                        channelMap.set(value.toLowerCase(), { label, value });
                      }
                    });
                  }

                  console.log("[VisitFilter] After AllDataPicklist - classMap size:", classMap.size, "channelMap size:", channelMap.size);
                } catch (parseErr) {
                  console.warn("[VisitFilter] Failed to parse AllDataPicklist OptionsData:", parseErr);
                }
              }
            }

            // When connected, use Account describe metadata as the source of
            // truth. It contains the label/value pairs configured in Salesforce.
            const accountDescribeResponse = await apiFetch(
              "GET",
              "sobjects/Account/describe",
              {},
              "SObjects"
            );
            if (accountDescribeResponse?.status === "success") {
              addDescribePicklistOptions(accountDescribeResponse.data);
            } else {
              console.warn("[VisitFilter] Unable to load Account picklist labels:", accountDescribeResponse?.message);
            }

            // 2. Extract distinct Class__c and Channel__c from synced Account records (fallback)
            if (Array.isArray(accountData)) {
              accountData.forEach((acc: any) => {
                if (acc?.Class__c && typeof acc.Class__c === "string" && acc.Class__c.trim()) {
                  const val = acc.Class__c.trim();
                  if (!classMap.has(val.toLowerCase())) {
                    classMap.set(val.toLowerCase(), { label: val, value: val });
                  }
                }
                if (acc?.Channel__c && typeof acc.Channel__c === "string" && acc.Channel__c.trim()) {
                  const val = acc.Channel__c.trim();
                  if (!channelMap.has(val.toLowerCase())) {
                    channelMap.set(val.toLowerCase(), { label: val, value: val });
                  }
                }
              });
            }

            console.log("[VisitFilter] Final classMap size:", classMap.size, "channelMap size:", channelMap.size);
            console.log("[VisitFilter] Final classMap entries:", JSON.stringify(Array.from(classMap.values()).slice(0, 3)));

            const uniqueClasses = Array.from(classMap.values()).sort((a, b) =>
              a.label.localeCompare(b.label)
            );
            const uniqueChannels = Array.from(channelMap.values()).sort((a, b) =>
              a.label.localeCompare(b.label)
            );

            setClassOptions(uniqueClasses);
            setChannelOptions(uniqueChannels);
          } catch (picklistErr) {
            console.error("[VisitFilter] Error loading Class and Channel picklist options:", picklistErr);
          }

          const users = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });

          setUserState(users);

          const RoutePlans = await UniversalUpdateInsert({
            ObjectName: "Route_Plans__c",
            Type: "get",
            filters: [
              { field: "Assigned_To__c", value: users[0].Sf_Id },
            ],
          });

          const todayForRoutePlans = dateStore ? new Date(dateStore) : new Date();
          const firstDayOfMonth = new Date(
            todayForRoutePlans.getFullYear(),
            todayForRoutePlans.getMonth(),

          );
          const lastDayOfMonth = new Date(
            todayForRoutePlans.getFullYear(),
            todayForRoutePlans.getMonth() + 1,
            0
          );

          // Filter the route plans that are active during the current month
          const currentMonthRoutePlans = RoutePlans.filter((plan) => {
            const startDate = new Date(plan.Start_Date__c);
            const endDate = new Date(plan.End_Date__c);
            return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
          });

          //console.log("currren month route plans.........................", currentMonthRoutePlans);
          setCurrentMonthRoutePlanState(currentMonthRoutePlans);

          if (currentMonthRoutePlans.length === 0) {
            dispatch(
              showToast({
                message: "There is no Route Plan for the selected month",
                type: "error",
              })
            );
            dispatch(setSelectedBeatDay(null));
            setSelectedBeatName(null);
            setSelecteBeatId(null);
            setBeatDaysId(null);
            setSelectedBeatCode(null);
            setOutlets([]);
            return;
          }

          const activePlanId = currentMonthRoutePlans[0].Sf_Id;
          const cleanDateStore = String(dateStore || moment().format("YYYY-MM-DD")).replace(/^"+|"+$/g, "").trim();

          // Beat Day for that exact calendar day:
          const BeatDays = await UniversalUpdateInsert({
            ObjectName: "BeatDay__c",
            Type: "get",
          });

          const beatDayForDate = BeatDays.find(
            (b) =>
              b.Tour_Plan__c === activePlanId && // belongs to the route plan
              (b.Beat_Date__c === cleanDateStore ||
                b.BeatDate__c === cleanDateStore ||
                String(b.Beat_Date__c || b.BeatDate__c || "").slice(0, 10) === cleanDateStore.slice(0, 10))
          );

          // Find subordinate beat days for joint working if the user is a manager
          const rawRole = users[0]?.Role || "";
          const devName = users[0]?.DeveloperName || "";
          const checkString = (rawRole + " " + devName).toUpperCase();
          const isManagerUser = checkString.includes("RSM") || checkString.includes("ASM") || checkString.includes("ASE") || checkString.includes("SO");

          let jointWorkingBeatDays = [];
          if (isManagerUser) {
            const rawJointWorking = BeatDays.filter(
              (b) =>
                (b.Beat_Date__c === cleanDateStore ||
                  b.BeatDate__c === cleanDateStore ||
                  String(b.Beat_Date__c || b.BeatDate__c || "").slice(0, 10) === cleanDateStore.slice(0, 10)) &&
                b.Joint_Working_User__c === users[0].Sf_Id
            );
            const uniqueMap = new Map();
            rawJointWorking.forEach((b) => {
              const key = b.Sf_Id || b.id || Math.random().toString();
              uniqueMap.set(key, b);
            });
            jointWorkingBeatDays = Array.from(uniqueMap.values());
          }

          if (!beatDayForDate && jointWorkingBeatDays.length === 0) {
            console.log("No Beat Day or Joint Working found for date", dateStore);
            dispatch(setSelectedBeatDay(null));
            setSelectedBeatName(null);
            setSelecteBeatId(null);
            setBeatDaysId(null);
            setSelectedBeatCode(null);
            setActiveJointWorkingList([]);

            // Clear visits / categorized data so UI shows "no items"
            setFilteredVisits([]);
            setAdHocVisits([]);
            setCategorizedData({
              Upcoming: [],
              "Check Out": [],
              "Check In": [],
            });
            return; // nothing more to do for this date
          }

          setActiveJointWorkingList(jointWorkingBeatDays);

          const currentBeatDay = beatDayForDate || jointWorkingBeatDays[0];
          console.log("CURRENT BEAT DAY FOR THE DATE |||||||||", currentBeatDay);
          dispatch(setSelectedBeatDay(currentBeatDay));

          setSelectedBeatName(currentBeatDay?.Beat__Name);
          setSelecteBeatId(currentBeatDay?.Beat__c); // Save selected Beat
          setBeatDaysId(currentBeatDay?.Sf_Id);
          setEndOfDayTime(currentBeatDay?.EndOfDayTime__c);

          // Set local Beat Day approval status and joint working info
          const localStatus = currentBeatDay?.Approval_Status__c || null;
          setBeatDayApprovalStatus(localStatus);
          if (currentBeatDay?.Joint_Working_User__c) {
            setJointWorkingInfo({
              user: currentBeatDay.Joint_Working_User__c,
              userName: currentBeatDay.Joint_Working_User_Name__c || "Manager",
              reason: currentBeatDay.Joint_Working_Reason__c || "",
            });
          } else {
            setJointWorkingInfo(null);
          }

          // Fetch online approval status of the Beat Day
          if (currentBeatDay?.Sf_Id && accessToken && instanceUrl) {
            try {
              const query = `SELECT Approval_Status__c, Joint_Working_User__c, Joint_Working_Reason__c, Joint_Working_User__r.Name FROM Beat_Day__c WHERE Id = '${currentBeatDay.Sf_Id}'`;
              const res = await fetchRecords("Beat_Day__c", query);
              if (Array.isArray(res) && res.length > 0) {
                const status = res[0].Approval_Status__c || null;
                const jwUser = res[0].Joint_Working_User__c || null;
                const jwReason = res[0].Joint_Working_Reason__c || null;
                const jwUserName = res[0].Joint_Working_User__r?.Name || null;

                setBeatDayApprovalStatus(status);
                if (jwUser) {
                  setJointWorkingInfo({
                    user: jwUser,
                    userName: jwUserName || "Manager",
                    reason: jwReason || "",
                  });
                } else {
                  setJointWorkingInfo(null);
                }

                // Persist the status in local database so it is available offline next time
                await UniversalUpdateInsert({
                  ObjectName: "BeatDay__c",
                  Type: "insert",
                  data: {
                    Sf_Id: currentBeatDay.Sf_Id,
                    Approval_Status__c: status,
                    Joint_Working_User__c: jwUser,
                    Joint_Working_Reason__c: jwReason,
                    Joint_Working_User_Name__c: jwUserName,
                  },
                });
                console.log("Fetched online Beat Day Approval Status and Joint Working info and persisted locally:", status);
              }
            } catch (err) {
              console.warn("Failed to fetch online Beat Day approval status:", err);
            }
          }

          const getBeatCode = await UniversalUpdateInsert({
            ObjectName: "Beat__c",
            Type: "get",
            filters: [
              {
                field: "Sf_Id",
                value: currentBeatDay?.Beat__c,
              },
            ],
          });

          setSelectedBeatCode(getBeatCode[0]?.BeatCode__c);
          const beatId = currentBeatDay?.Beat__c ?? null;
          const beatName = currentBeatDay?.Beat__Name ?? null;

          dispatch(setBeatSelection({ id: beatId, name: beatName }));

          const Visit = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [
              {
                field: "SoftDelete",
                value: false,
              },
            ],
          });

          console.log("VISIT DATA FOR THE DATE |||||||||", Visit);
          console.log("currentBeatDay.Sf_Id", currentBeatDay.Sf_Id);

          const beatDayIds = [];
          if (beatDayForDate) {
            beatDayIds.push(beatDayForDate.Sf_Id);
          }
          jointWorkingBeatDays.forEach((jbd) => {
            if (jbd.Sf_Id) {
              beatDayIds.push(jbd.Sf_Id);
            }
          });

          const filtered = Visit.filter(
            (v) => beatDayIds.includes(v.BeatDay__c)
          );
          console.log("Filtered Visits for Beat Day", filtered);

          setFilteredVisits(filtered);

          // console.log('AdHocfiltered',JSON.stringify(sortedAdHocVisits[0]))
          // console.log('AdHocfiltered',JSON.stringify(sortedAdHocVisits[1]))


          const categorized = {
            All: [],
            Upcoming: [],
            "Check Out": [],
            "Check In": [],
          };
          const today2 = moment().startOf("day");

          const accountsWithOrderToday = new Set(
            Orders.filter((ord) => {
              const dateStr =
                ord.OrderSubmissionTime__c ||
                ord.CreatedDate ||
                ord.EffectiveDate;

              if (!ord.AccountId || !dateStr) return false;

              // 🔑 Normalize Salesforce + ISO + Z dates
              const orderDate = moment(dateStr).local().startOf("day");

              return orderDate.isSame(today2, "day");
            }).map((ord) => ord.AccountId)
          );

          const getTodayOrderColor = (accountId) => {
            return accountsWithOrderToday.has(accountId) ? "green" : "red";
          };

          const uniqueVisitIds = new Set();
          filtered.forEach((v) => {
            if (!v.AccountId__c) return;

            if (uniqueVisitIds.has(v.Sf_Id)) return;
            console.log("Processing Visit:", v.Sf_Id, "AccountId:", v.AccountId__c);
            uniqueVisitIds.add(v.Sf_Id);

            const accountDetails = accountData.find(
              (a) => a.Sf_Id === v.AccountId__c
            );

            // if (
            //   !accountDetails ||
            //   (accountDetails.IsActive__c === false &&
            //     !v?.Add_New_Retailer_Visit__c)
            // ) {
            //   return;
            // }
            console.log("Account Details for Visit:", v.Sf_Id, accountDetails);
            const isAdHoc =
              v.AdHocVisit__c === true ||
              v.AdHocVisit__c === "true" ||
              v.AdHocVisit__c === 1 ||
              v.NonPjpOutlet__c === true ||
              v.NonPjpOutlet__c === "true" ||
              v.NonPjpOutlet__c === 1 ||
              v.Add_New_Retailer_Visit__c === true ||
              v.Add_New_Retailer_Visit__c === "true" ||
              v.Add_New_Retailer_Visit__c === 1 ||
              Boolean(v.AdHocReason__c) ||
              (typeof v.Mobile_Unique_Id__c === "string" && v.Mobile_Unique_Id__c.includes("ADHOC"));

            const isJointWork = !isAdHoc && jointWorkingBeatDays.some(jbd => jbd.Sf_Id === v.BeatDay__c);
            const base = {
              name: accountDetails?.Name || "",
              tier: accountDetails?.Class__c,
              target: accountDetails?.Channel__c,
              Class__c: accountDetails?.Class__c || "",
              Channel__c: accountDetails?.Channel__c || "",
              // Account.isPerfect__c => Perfect Store outlet
              isPerfectStore:
                accountDetails?.isPerfect__c === true ||
                accountDetails?.isPerfect__c === 1 ||
                String(accountDetails?.isPerfect__c).toLowerCase() === "true" ||
                String(accountDetails?.isPerfect__c) === "1",
              lastOrder: "5 days",
              ProductiveCall__c: v.ProductiveCall__c,
              propensity: "70%",
              AccountId: v.AccountId__c || v.AccountId,
              AccountId__c: v.AccountId__c || v.AccountId,
              sfId: v.Sf_Id,
              CheckInTime__c: v.CheckInTime__c,
              CheckOutTime__c: v.CheckOutTime__c,
              Phone: accountDetails?.Phone,
              BillingAddress: accountDetails?.BillingAddress,
              OTPVerified__c: accountDetails?.OTPVerified__c,
              CreditLimit__c: accountDetails?.CreditLimit__c,
              Add_New_Retailer_Visit__c: v?.Add_New_Retailer_Visit__c,
              AdHocVisit__c: v?.AdHocVisit__c,
              AdHocReason__c: v?.AdHocReason__c,
              NonPjpOutlet__c: v?.NonPjpOutlet__c,
              VisitStatus__c: v.VisitStatus__c,
              CheckInLocation__Longitude: v.CheckInLocation__Longitude__s,
              CheckInLocation__Latitude: v.CheckInLocation__Latitude__s,
              CheckOutLocation__Longitude: v.CheckOutLocation__Longitude__s,
              CheckOutLocation__Latitude: v.CheckOutLocation__Latitude__s,
              BillingLatitude: accountDetails?.BillingLatitude || accountDetails?.Account_Location_Latitude_Longitude__Latitude__s,
              BillingLongitude: accountDetails?.BillingLongitude || accountDetails?.Account_Location_Latitude_Longitude__Longitude__s,
              BeatDay__c: v?.BeatDay__c,
              Beat__c: v?.Beat__c, // || accountDetails?.Beat__c,
              nonBuyingIndicatorColor: getTodayOrderColor(v.AccountId),
              code: accountDetails?.Party_Code__c,
              // Record type belongs to the linked Account; ad-hoc Visit records
              // usually do not carry it themselves.
              RecordType:
                accountDetails?.RecordType || v?.RecordType || v?.recordType || "",
              accountType:
                accountDetails?.accountType ||
                v?.accountType ||
                (isDistributorAccount(accountDetails) || isDistributorAccount(v) ? "Distributor" : "Retailer"),
              // subchannel: accountDetails?.SubChannel__c,
              // subchannel1: accountDetails?.SubChannel1__c,
              // subchannel2: accountDetails?.SubChannel2__c,
              is_synced: v.is_synced,
              ErrorMsg: v.ErrorMsg,
              isJointWork: isJointWork,
              Joint_Visit_User_Validated__c: v.Joint_Visit_User_Validated__c,
            };

            const isCompleted = (v.CheckInTime__c && v.CheckOutTime__c) ||
              v.Joint_Visit_User_Validated__c === true ||
              v.Joint_Visit_User_Validated__c === 1 ||
              v.Joint_Visit_User_Validated__c === "true";

            if (isCompleted) {
              categorized["Check Out"].push(base);
            } else if (
              (v.CheckInTime__c && !v.CheckOutTime__c) ||
              v.VisitStatus__c === "Check In"
            ) {
              categorized["Check In"].push(base);
              // console.log('INPROGRESS VISIT>.....................', base)
              dispatch(
                setCheckInStatus({
                  VisitId: v.Sf_Id,
                  status: "Check In",
                  date: dateStore,
                })
              );
            } else {
              base.nonBuyingIndicatorColor = "black";
              categorized.Upcoming.push(base);
            }
          });

          categorized.All = [
            ...categorized["Check In"],
            ...categorized["Check Out"],
            ...categorized.Upcoming,
          ];

          // console.log('filtered', JSON.stringify(categorized))

          // console.log('categorized mahendra',categorized)
          setCategorizedData(categorized);

          const developerName = users[0]?.DeveloperName;
          const isManager = ["MT_SO", "MT_Merchandiser", "H_T_SO"].includes(developerName);
          const beatAssignments = await UniversalUpdateInsert({
            ObjectName: "SR_Beat_Assignment__c",
            Type: "get",
            filters: [{
              field: isManager ? "Sales_Person_ManagerId__c" : "Assigned_To__c",
              value: users[0]?.Sf_Id,
            }],
          });
          // Do not apply a user-role filter here: the current Beat is already
          // in scope, and all of its assignment rows are needed to show every
          // distributor mapped to that Beat (including offline).
          const currentBeatAssignments = await UniversalUpdateInsert({
            ObjectName: "SR_Beat_Assignment__c",
            Type: "get",
            filters: [{ field: "Beat__c", value: currentBeatDay.Beat__c }],
          });

          // The local Visit cache is the offline retailer-to-beat mapping. A
          // retailer/distributor which already has a visit on today's Beat Day
          // must not appear as an Ad-Hoc candidate.
          const accountsAlreadyOnBeatDay = new Set(
            (filtered || [])
              .map((visit) => visit?.AccountId__c || visit?.AccountId)
              .filter(Boolean)
          );
          let currentBeatMappings = await UniversalUpdateInsert({
            ObjectName: "Beat_Mapping__c",
            Type: "get",
            filters: [{ field: "Beat__c", value: currentBeatDay.Beat__c }],
          });

          // A distributor is attached to the Beat itself, not to
          // Beat_Mapping__c.Account__c.  Keep the cached Beat master as a
          // fallback so the Ad-Hoc picker works offline too.
          const currentBeatRecord = await UniversalUpdateInsert({
            ObjectName: "Beat__c",
            Type: "get",
            filters: [{ field: "Sf_Id", value: currentBeatDay.Beat__c }],
          });
          let remoteDistributorId = null;
          const remoteAccountsById = new Map();

          // Refresh the actual retailer-to-beat mapping when online, then use
          // the cached mapping below. When offline, the saved mapping is used
          // directly, so the Ad-Hoc picker remains available.
          if (await isInternetAvailable()) {
            try {
              // Use the user's BA mappings as the source of distributors,
              // then load the Beats owned by those distributors. This is the
              // same sequence used by Route Planning and does not depend on
              // SR_Beat_Assignment__c being present in the local cache.
              const userIdVal = authUserId || users[0]?.Sf_Id;
              const userBaQuery = `SELECT Id, Name, Account__c, Account__r.Name, User__c, User__r.Name FROM User_BA_Mapping__c WHERE User__c = '${userIdVal}' AND Is_Active__c = true AND Status__c = 'Active'
 `;
              const userBaMappings = userIdVal
                ? await fetchRecords("User_BA_Mapping__c", userBaQuery)
                : [];
              const mappedDistributors = Array.isArray(userBaMappings)
                ? userBaMappings.filter((mapping) => mapping?.Account__c)
                : [];
              const accountIds = [...new Set(mappedDistributors.map((mapping) => mapping.Account__c))];
              const accountFilter = accountIds.map((id) => `'${id}'`).join(",");

              if (accountFilter) {
                const beatQuery = `SELECT Id, Name, Beat_Status__c, Beat_Visit_Frequency__c, Distributor__c, Distributor__r.Name FROM Beat__c WHERE Distributor__c IN (${accountFilter})`;
                const beatsForMappedDistributors = await fetchRecords("Beat__c", beatQuery);
                const currentBeat = Array.isArray(beatsForMappedDistributors)
                  ? beatsForMappedDistributors.find((beat) =>
                    String(beat?.Id || "").slice(0, 15) === String(currentBeatDay.Beat__c || "").slice(0, 15)
                  )
                  : null;

                if (currentBeat?.Distributor__c) {
                  remoteDistributorId = currentBeat.Distributor__c;
                  const mappedDistributor = mappedDistributors.find((mapping) =>
                    String(mapping.Account__c).slice(0, 15) === String(remoteDistributorId).slice(0, 15)
                  );
                  remoteAccountsById.set(remoteDistributorId, {
                    Sf_Id: remoteDistributorId,
                    Name: currentBeat.Distributor__r?.Name || mappedDistributor?.Account__r?.Name || "Unnamed Distributor",
                    accountType: "Distributor",
                  });
                }
              }

              // Direct Beat lookup remains an online fallback only. It covers
              // legacy data where the current Beat is not returned by the
              // user's BA mapping query.
              if (!remoteDistributorId) {
                const currentBeatQuery = `SELECT Id, Distributor__c, Distributor__r.Name FROM Beat__c WHERE Id = '${currentBeatDay.Beat__c}'`;
                const currentBeatResult = await fetchRecords("Beat__c", currentBeatQuery);
                const currentBeat = Array.isArray(currentBeatResult) ? currentBeatResult[0] : null;
                remoteDistributorId = currentBeat?.Distributor__c || null;
                if (remoteDistributorId) {
                  remoteAccountsById.set(remoteDistributorId, {
                    Sf_Id: remoteDistributorId,
                    Name: currentBeat?.Distributor__r?.Name || "Unnamed Distributor",
                    accountType: "Distributor",
                  });
                }
              }

              const mappingQuery = `SELECT Id, Beat__c, Account__c, Account__r.Name, Account__r.Party_Code__c, Beat__r.Distributor__c FROM Beat_Mapping__c WHERE  Beat__c = '${currentBeatDay.Beat__c}' AND Is_Active__c = true AND Status__c = 'Active'
 `;
              const remoteMappings = await fetchRecords("Beat_Mapping__c", mappingQuery);
              if (Array.isArray(remoteMappings)) {
                remoteMappings.forEach((mapping) => {
                  if (mapping.Account__c) {
                    remoteAccountsById.set(mapping.Account__c, {
                      Sf_Id: mapping.Account__c,
                      Name: mapping.Account__r?.Name || "Unnamed Retailer",
                      Party_Code__c: mapping.Account__r?.Party_Code__c,
                      accountType: "Retailer",
                    });
                  }
                });
                await UniversalUpdateInsert({
                  ObjectName: "Beat_Mapping__c",
                  Type: "insert",
                  data: remoteMappings.map((mapping) => ({
                    Sf_Id: mapping.Id,
                    Beat__c: mapping.Beat__c,
                    Account__c: mapping.Account__c,
                    is_synced: true,
                    last_modified: Date.now(),
                    SoftDelete: false,
                  })),
                });
                currentBeatMappings = remoteMappings.map((mapping) => ({
                  Beat__c: mapping.Beat__c,
                  Account__c: mapping.Account__c,
                  Distributor__c: mapping.Beat__r?.Distributor__c,
                }));
              }
            } catch (mappingError) {
              console.log("Using cached Beat_Mapping__c records:", mappingError);
            }
          }
          const retailerIdsForCurrentBeat = new Set(
            (currentBeatMappings || [])
              .map((mapping) => mapping?.Account__c)
              .filter(Boolean)
          );
          const distributorIdsForCurrentBeat = new Set(
            [
              ...(currentBeatMappings || []).map((mapping) => mapping?.Distributor__c),
              ...(beatAssignments || [])
                .filter((assignment) => assignment?.Beat__c === currentBeatDay.Beat__c)
                .map((assignment) => assignment?.Distributor__c),
              ...(currentBeatAssignments || []).map((assignment) => assignment?.Distributor__c),
              currentBeatRecord?.[0]?.Distributor__c,
              remoteDistributorId,
            ].filter(Boolean)
          );

          // The Account cache is not guaranteed to contain every distributor
          // assigned to a Beat. Build candidates from the Beat relationship
          // IDs first, then enrich them from the local cache where available.
          const accountById = new Map((accountData || []).map((account) => [account.Sf_Id, account]));
          const mappedAccountIds = new Set([
            ...retailerIdsForCurrentBeat,
            ...distributorIdsForCurrentBeat,
          ]);
          const AdHocfiltered = Array.from(mappedAccountIds)
            .filter((accountId) => !accountsAlreadyOnBeatDay.has(accountId))
            .map((accountId) => {
              const localAccount = accountById.get(accountId);
              const remoteAccount = remoteAccountsById.get(accountId);
              return {
                ...(remoteAccount || {}),
                ...(localAccount || {}),
                Sf_Id: accountId,
                accountType: remoteAccount?.accountType
                  || (distributorIdsForCurrentBeat.has(accountId) ? "Distributor" : "Retailer"),
              };
            })
            .filter((account) => account?.Active__c !== false && account?.IsActive__c !== false);

          const mappedAdHocVisits = AdHocfiltered.map((v) => {
            const matchingVisit = Visit.find((visit) => (visit.AccountId__c === v.Sf_Id || visit.AccountId === v.Sf_Id));
            return {
              Name: v?.Name || "",
              Sf_Id: v.Sf_Id,
              AccountId: v.Sf_Id,
              BeatDay__c: currentBeatDay.Sf_Id,
              BillingLatitude: v?.BillingLatitude || v?.Account_Location_Latitude_Longitude__Latitude__s,
              BillingLongitude: v?.BillingLongitude || v?.Account_Location_Latitude_Longitude__Longitude__s,
              code: v?.Party_Code__c,
              Beat: currentBeatDay.Beat__c,
              RecordType: matchingVisit?.RecordType || matchingVisit?.recordType || "",
              accountType: v.accountType || (distributorIdsForCurrentBeat.has(v.Sf_Id) ? "Distributor" : "Retailer"),
            };
          });
          const sortedAdHocVisits = mappedAdHocVisits.sort((a, b) =>
            a.Name.toLowerCase().localeCompare(b.Name.toLowerCase())
          );
          //console.log('mappedAdHocVisits', JSON.stringify(sortedAdHocVisits))
          setAdHocVisits(sortedAdHocVisits);

          // console.log('categorized',JSON.stringify(categorized))
        } catch (e) {
          console.error(" Error fetching Visit data:", e);
        } finally {
          setLoading(false);
        }
      };

      fetchVisits();

      // Optional: clean-up logic if needed
      return () => {
        // Cleanup (if necessary)
      };
      /* Original useFocusEffect dependency:
      }, [dateStore, selfieModalVisible, refreshBeatData, checkoutModalVisible])
      */
    }, [dateStore, selfieModalVisible, refreshBeatData, checkoutModalVisible, refreshTrigger])
  );

  // const zoomIn = () => {
  //   setRegion((prev) => ({
  //     ...prev,
  //     latitudeDelta: prev.latitudeDelta / 2,
  //     longitudeDelta: prev.longitudeDelta / 2,
  //   }));
  // };

  // const zoomOut = () => {
  //   setRegion((prev) => ({
  //     ...prev,
  //     latitudeDelta: prev.latitudeDelta * 2,
  //     longitudeDelta: prev.longitudeDelta * 2,
  //   }));
  // };

  const outlets = categorizedData[activeTab] || [];

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (visitFilters.outletName && visitFilters.outletName.trim()) count += 1;
    if (visitFilters.distanceSort) count += 1;
    if (visitFilters.selectedClasses && visitFilters.selectedClasses.length > 0) count += 1;
    if (visitFilters.selectedChannels && visitFilters.selectedChannels.length > 0) count += 1;
    if (visitFilters.perfectStoreOnly) count += 1;
    return count;
  }, [visitFilters]);

  const filteredOutlets = useMemo(() => {
    let result = [...outlets];

    // 1. Global search parameter from Redux
    if (searchParam && searchParam.trim()) {
      const q = searchParam.trim().toLowerCase();
      result = result.filter(
        (outlet) => outlet.name && outlet.name.toLowerCase().includes(q)
      );
    }

    // 2. Outlet / Retailer Name Filter (case-insensitive)
    if (visitFilters.outletName && visitFilters.outletName.trim()) {
      const nameQ = visitFilters.outletName.trim().toLowerCase();
      result = result.filter(
        (outlet) => outlet.name && outlet.name.toLowerCase().includes(nameQ)
      );
    }

    // 2b. Perfect Store Filter
    if (visitFilters.perfectStoreOnly) {
      result = result.filter((outlet) => outlet.isPerfectStore === true);
    }

    // 3. Class Filter (Multi-select)
    if (visitFilters.selectedClasses && visitFilters.selectedClasses.length > 0) {
      const selectedClassValues = new Set<string>();
      visitFilters.selectedClasses.forEach((sc) => {
        const scLower = sc.trim().toLowerCase();
        selectedClassValues.add(scLower);
        const opt = classOptions.find(
          (o: any) =>
            (typeof o === "object" &&
              (o.value?.toLowerCase() === scLower ||
                o.label?.toLowerCase() === scLower)) ||
            (typeof o === "string" && o.toLowerCase() === scLower)
        );
        if (opt && typeof opt === "object") {
          if (opt.value) selectedClassValues.add(opt.value.toLowerCase());
          if (opt.label) selectedClassValues.add(opt.label.toLowerCase());
        }
      });

      result = result.filter((outlet) => {
        const val = (outlet.Class__c || outlet.tier || "").toString().trim().toLowerCase();
        return selectedClassValues.has(val);
      });
    }

    // 4. Channel Filter (Multi-select)
    if (visitFilters.selectedChannels && visitFilters.selectedChannels.length > 0) {
      const selectedChannelValues = new Set<string>();
      visitFilters.selectedChannels.forEach((sc) => {
        const scLower = sc.trim().toLowerCase();
        selectedChannelValues.add(scLower);
        const opt = channelOptions.find(
          (o: any) =>
            (typeof o === "object" &&
              (o.value?.toLowerCase() === scLower ||
                o.label?.toLowerCase() === scLower)) ||
            (typeof o === "string" && o.toLowerCase() === scLower)
        );
        if (opt && typeof opt === "object") {
          if (opt.value) selectedChannelValues.add(opt.value.toLowerCase());
          if (opt.label) selectedChannelValues.add(opt.label.toLowerCase());
        }
      });

      result = result.filter((outlet) => {
        const val = (outlet.Channel__c || outlet.target || "").toString().trim().toLowerCase();
        return selectedChannelValues.has(val);
      });
    }

    // 5. Distance Sorting / Default Sorting
    result.sort((a, b) => {
      const aHasCoords =
        currentLocation &&
        a.BillingLatitude &&
        a.BillingLongitude &&
        !isNaN(Number(a.BillingLatitude)) &&
        !isNaN(Number(a.BillingLongitude));
      const bHasCoords =
        currentLocation &&
        b.BillingLatitude &&
        b.BillingLongitude &&
        !isNaN(Number(b.BillingLatitude)) &&
        !isNaN(Number(b.BillingLongitude));

      let distA: number | null = null;
      let distB: number | null = null;

      if (aHasCoords) {
        distA = getDistanceInKm(
          currentLocation.latitude,
          currentLocation.longitude,
          Number(a.BillingLatitude),
          Number(a.BillingLongitude)
        );
      }

      if (bHasCoords) {
        distB = getDistanceInKm(
          currentLocation.latitude,
          currentLocation.longitude,
          Number(b.BillingLatitude),
          Number(b.BillingLongitude)
        );
      }

      if (visitFilters.distanceSort === "asc") {
        // Distance: Low to High
        if (distA !== null && distB !== null) return distA - distB;
        if (distA !== null) return -1;
        if (distB !== null) return 1;
        return (a.name || "").localeCompare(b.name || "");
      } else if (visitFilters.distanceSort === "desc") {
        // Distance: High to Low
        if (distA !== null && distB !== null) return distB - distA;
        if (distA !== null) return -1;
        if (distB !== null) return 1;
        return (a.name || "").localeCompare(b.name || "");
      } else {
        // Default sorting behavior
        if (distA !== null && distB !== null) return distA - distB;
        if (distA !== null) return -1;
        if (distB !== null) return 1;
        return (a.name || "").localeCompare(b.name || "");
      }
    });

    return result;
  }, [outlets, searchParam, visitFilters, currentLocation]);

  const allOutlets = [
    ...categorizedData.Upcoming,
    ...(categorizedData["Check In"] || []),
    ...categorizedData["Check Out"],
  ];

  // ── Beat map markers ────────────────────────────────────────────────────────
  // Source: every outlet in the plan (prefer the pre-merged `.All`, fall back to
  // the union). A visit shows a pin only if its Account carries usable coords in
  // BillingLatitude/Longitude OR the Account_Location_Latitude_Longitude__c
  // compound field.
  const mapSourceOutlets =
    categorizedData.All && categorizedData.All.length
      ? categorizedData.All
      : allOutlets;

  const readCoord = (o, latKey, lngKey) => ({
    latitude: Number(o?.[latKey]),
    longitude: Number(o?.[lngKey]),
  });
  const pickCoords = (o) => {
    const candidates = [
      readCoord(o, "BillingLatitude", "BillingLongitude"),
      readCoord(
        o,
        "Account_Location_Latitude_Longitude__Latitude__s",
        "Account_Location_Latitude_Longitude__Longitude__s",
      ),
      readCoord(o, "Geolocation__Latitude__s", "Geolocation__Longitude__s"),
    ];
    return candidates.find(
      (c) =>
        Number.isFinite(c.latitude) &&
        Number.isFinite(c.longitude) &&
        c.latitude !== 0 &&
        c.longitude !== 0,
    );
  };

  const markerPoints = (() => {
    const seen = new Set();
    const out = [];
    for (const o of mapSourceOutlets) {
      const c = pickCoords(o);
      if (!c) continue;
      const id =
        o.sfId ||
        o.AccountId ||
        `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, ...c, title: o.name, address: o.BillingAddress });
    }
    return out;
  })();

  console.warn(
    "[BeatMap] outlets:",
    mapSourceOutlets.length,
    "markers:",
    markerPoints.length,
    "detail:",
    JSON.stringify(
      mapSourceOutlets.slice(0, 8).map((o) => ({
        name: o.name,
        BL: o.BillingLatitude,
        Bn: o.BillingLongitude,
        AL: o.Account_Location_Latitude_Longitude__Latitude__s,
      })),
    ),
  );

  const regionForMarkers = () => {
    if (markerPoints.length === 0) return null;
    const lats = markerPoints.map((p) => p.latitude);
    const lngs = markerPoints.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      // 60% padding around the spread; clamp so a single point isn't absurdly zoomed
      latitudeDelta: Math.min(Math.max((maxLat - minLat) * 1.6, 0.05), 60),
      longitudeDelta: Math.min(Math.max((maxLng - minLng) * 1.6, 0.05), 60),
    };
  };

  const fitMapToMarkers = () => {
    const map = mapRef.current;
    const r = regionForMarkers();
    if (!map || !r) return;
    // animateToRegion is more predictable than fitToCoordinates on the new
    // Google renderer (fitToCoordinates over-zooms out for small clusters).
    map.animateToRegion(r, 500);
    // MapView lives inside a ScrollView; nudge the camera once more so the
    // renderer re-draws the markers after it settles.
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          { ...r, latitudeDelta: r.latitudeDelta * 1.02, longitudeDelta: r.longitudeDelta * 1.02 },
          250,
        );
      }
    }, 900);
  };

  // Google Static Maps image for the beat overview (reliable — plain <Image>).
  // Needs "Maps Static API" enabled on this key.
  const staticBeatMapUrl = (() => {
    if (markerPoints.length === 0) return null;
    const mtype = mapType === "satellite" ? "hybrid" : "roadmap";
    const pins = markerPoints
      .map((p) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`)
      .join("|");
    const params = [
      "size=640x220",
      "scale=2",
      `maptype=${mtype}`,
      `markers=${encodeURIComponent("color:0xC89930|" + pins)}`,
      `key=REDACTED_SECRET`,
    ];
    return `https://maps.googleapis.com/maps/api/staticmap?${params.join("&")}`;
  })();


  // Completed outlets (from categorizedData["Check Out"])
  const completedOutlets = categorizedData["Check Out"] || [];

  // Billed outlets: Completed & ProductiveCall__c === true
  const billedOutletsCount = completedOutlets.filter(
    (item) => item.ProductiveCall__c === true
  ).length;

  // Unbilled outlets: Completed & ProductiveCall__c !== true
  const unbilledOutletsCount = completedOutlets.filter(
    (item) => item.ProductiveCall__c !== true
  ).length;

  const isMTPersona =
    userState[0]?.DeveloperName === "MT_SO" ||
    userState[0]?.DeveloperName === "MT_Merchandiser";

  // useFocusEffect(
  //   useCallback(() => {
  //     let isActive = true;
  //     let timer;
  //     const checkAndSync = async () => {
  //       const connected = await isInternetAvailable();
  //       if (connected && isActive) {
  //         timer = setTimeout(async () => {
  //           await Promise.all([
  //             syncVisitRecord(apiFetch),
  //             syncBeatDayRecord(apiFetch),
  //           ]);
  //         }, 0);
  //         console.log("Syncing data in background...");
  //       }
  //     };
  //     checkAndSync();
  //     return () => {
  //       isActive = false;
  //       if (timer) clearTimeout(timer);
  //     };
  useEffect(() => {
    const r = regionForMarkers();
    if (r) setRegion(r); // lite-mode MapView re-renders on region change
  }, [categorizedData]);

  const isMtpApproved = (() => {
    // 1. Check parent Route Plan status
    if (currentMonthRoutePlanState && currentMonthRoutePlanState.length > 0) {
      const parentStatus = currentMonthRoutePlanState[0]?.Status__c?.toLowerCase() || "";
      if (parentStatus === "pending" || parentStatus === "pending approval" || parentStatus === "submitted") {
        return false;
      }
    }

    // 2. Respect the Beat Day approval status (works both offline and online)
    if (beatDayApprovalStatus) {
      const bStatus = beatDayApprovalStatus.toLowerCase();
      if (bStatus === "pending" || bStatus === "pending approval" || bStatus === "submitted") {
        return false;
      }
      if (bStatus === "approved") {
        return true;
      }
    }

    // 3. Fallback to local visits' approval status if offline and no beat day status is set
    if (filteredVisits.length > 0) {
      const hasPendingVisit = filteredVisits.some((v) => {
        const status = (v.MTP_Admin_Approval_Status__c || v.mTP_Admin_Approval_Status__c || "").toLowerCase();
        return status === "pending" || status === "pending approval" || status === "submitted";
      });
      if (hasPendingVisit) {
        return false;
      }
    }

    // 4. For non-managers, if they have visits but no approved status, default to locked
    if (filteredVisits.length > 0) {
      const isAllApproved = filteredVisits.every((v) => {
        const status = (v.MTP_Admin_Approval_Status__c || v.mTP_Admin_Approval_Status__c || "").toLowerCase();
        return !status || status === "approved";
      });
      if (!isAllApproved) return false;
    }

    // 5. Managers (RSM, ASM, ASE, ASO, SO) don't have locks unless explicitly pending above
    const rawRole = userState[0]?.Role || "";
    const devName = userState[0]?.DeveloperName || "";
    const checkString = (rawRole + " " + devName).toUpperCase();
    const isManager = checkString.includes("RSM") || checkString.includes("ASM") || checkString.includes("ASE") || checkString.includes("ASO") || checkString.includes("SO");
    if (isManager) return true;

    return true;
  })();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {currentMonthRoutePlanState.length === 0 ? (
        <View style={styles.noRoutePlanContainer}>
          <Text style={styles.noRoutePlanText}>
            Add a Route Plan to change beat or ad-hoc
          </Text>
        </View>
      ) : (
        <ChangeBeat
          selectedBeatId={selecteBeatId}
          beatDaysId={beatDaysId}
          onRefresh={() => setRefreshBeatData((prev) => !prev)}
          adHocVisits={adHocVisits}
          isToday={isToday}
          selectedBeatIdNew={selectedBeatIdNew}
          setSelectedBeatIdNew={setSelectedBeatIdNew}
          handleSavePress={handleSavePress}
          categorizedData={categorizedData}
          updateSelectedBeatId={updateSelectedBeatId}
          stockCheck={stockChecked}
          userState={userState}
          currentBeatDaysId={beatDaysId}
          selectedDate={dateStore}
        />
      )}
      <SelfieCheckIn
        visible={selfieModalVisible}
        onClose={() => {
          setSelfieModalVisible(false);
          setSelectedOutlet(null);
          () => setRefreshBeatData((prev) => !prev);
        }}
        outlet={selectedOutlet} // pass the outlet
        selectedDate={dateStore}
        categorizedData={categorizedData}
      />

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(checkInDistanceError)}
        onRequestClose={() => setCheckInDistanceError(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#B91C1C", marginBottom: 10 }}>
              Check-in unavailable
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: "#1F1D1A" }}>
              {checkInDistanceError}
            </Text>
            <TouchableOpacity
              onPress={() => setCheckInDistanceError(null)}
              style={{ alignSelf: "flex-end", marginTop: 22, backgroundColor: "#C00000", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {selectedOutlet && (
        <CheckOut
          visible={checkoutModalVisible}
          onClose={() => {
            setCheckoutModalVisible(false);
            setSelectedOutlet(null);
            () => setRefreshBeatData((prev) => !prev);
          }}
          outlet={selectedOutlet}
          selectedDate={dateStore}
          categorizedData={categorizedData}
        />
      )}

      <VisitFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={(newFilters) => setVisitFilters(newFilters)}
        onClear={() =>
          setVisitFilters({
            outletName: "",
            distanceSort: null,
            selectedClasses: [],
            selectedChannels: [],
            perfectStoreOnly: false,
          })
        }
        currentFilters={visitFilters}
        classOptions={classOptions}
        channelOptions={channelOptions}
      />

      <View style={styles.mapcontainer}>
        {/* {isConnected ? (
          <MapView
            {...(Platform.OS === 'android' ? { provider: PROVIDER_GOOGLE } : {})}
            style={styles.map}
            mapType={mapType}
            region={region}
          >

          </MapView>
        ) : (
          <Image
            source={require("../assets/images/Map.png")}
            style={styles.map}
            resizeMode="cover"
          />
        )} */}

        {/* Static Google map — an <Image>, so no interactive-MapView / new-Google-
            renderer / MapView-in-ScrollView marker glitches. Google draws the
            pins server-side. Tap opens the full interactive map. */}
        {staticBeatMapUrl ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.map}
            onPress={() =>
              navigation.navigate("FullMap", {
                locations: markerPoints.map((p) => ({
                  latitude: p.latitude,
                  longitude: p.longitude,
                  title: p.title,
                  address: p.address,
                })),
              })
            }
          >
            <Image
              source={{ uri: staticBeatMapUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              onError={(e) =>
                console.warn(
                  "[BeatMap] static image failed:",
                  e?.nativeEvent?.error,
                )
              }
            />
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.map,
              {
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#F1EFE9",
              },
            ]}
          >
            <Text style={{ color: "#8A8578", fontSize: 13 }}>
              No mapped visit locations
            </Text>
          </View>
        )}

        {/* Map Controls */}
        <View style={styles.mapTypeToggle}>
          <TouchableOpacity
            style={[
              styles.mapTypeButton,
              mapType === "standard" && styles.activeMapType,
            ]}
            onPress={() => setMapType("standard")}
          >
            <Text
              style={[
                styles.mapTypeText,
                mapType === "standard" && styles.activeMapTypeText,
              ]}
            >
              Map
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.mapTypeButton,
              mapType === "satellite" && styles.activeMapType,
            ]}
            onPress={() => setMapType("satellite")}
          >
            <Text
              style={[
                styles.mapTypeText,
                mapType === "satellite" && styles.activeMapTypeText,
              ]}
            >
              Satellite
            </Text>
          </TouchableOpacity>
        </View>
        {/* 
        <View style={styles.zoomButtonsContainer}>
          <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
            <Text style={styles.zoomText}>-</Text>
          </TouchableOpacity>
        </View> */}

        <View style={styles.zoomButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.zoomButton,
              zoomInCount >= MAX_ZOOM_TIMES && styles.disabledButton,
            ]}
            onPress={zoomIn}
            disabled={zoomInCount >= MAX_ZOOM_TIMES}
          >
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.zoomButton,
              zoomOutCount >= MAX_ZOOM_TIMES && styles.disabledButton,
            ]}
            onPress={zoomOut}
            disabled={zoomOutCount >= MAX_ZOOM_TIMES}
          >
            <Text style={styles.zoomText}>-</Text>
          </TouchableOpacity>
        </View>



        {/* Dashboard Card */}
        <View style={styles.dashboardCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {selectedBeatName}{" "}
              <Text style={{ fontSize: 12 }}>
                {selectedBeatCode ? "(#" + selectedBeatCode + ")" : ""}
              </Text>
            </Text>
            {isToday && (
              <Animated.View
                style={[styles.liveBadge, { backgroundColor: animatedBg }]}
              >
                <Animated.Text
                  style={[styles.liveText, { color: animatedTextColor }]}
                >
                  LIVE
                </Animated.Text>
              </Animated.View>
            )}
          </View>

          {/* Joint Working Info Display */}
          {jointWorkingInfo && jointWorkingInfo.user !== userState[0]?.Sf_Id && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FFF1F1", // Light red matching Emami theme
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 10,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: "#FCA5A5", // Soft red border
              shadowColor: "#C9A24D",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 2,
              elevation: 1
            }}>
              <Ionicons name="people" size={18} color="#C9A24D" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#A67C2E" }}>
                  Joint Working Active
                </Text>
                <Text style={{ fontSize: 11, color: "#7F1D1D", marginTop: 3 }}>
                  Working Partner: <Text style={{ fontWeight: "700" }}>{jointWorkingInfo.userName}</Text>
                </Text>
                {jointWorkingInfo.reason ? (
                  <View style={{
                    marginTop: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    backgroundColor: "rgba(201, 162, 77, 0.05)",
                    borderRadius: 4,
                    alignSelf: "flex-start"
                  }}>
                    <Text style={{ fontSize: 10, color: "#A67C2E", fontStyle: "italic" }}>
                      Reason: {jointWorkingInfo.reason}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* Lock Reason Warning Box for Joint Working List */}
          {!isMtpApproved && activeJointWorkingList.length > 0 && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FFFBEB", // Light yellow warning banner
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 10,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: "#FCD34D", // Soft yellow border
              shadowColor: "#D08C1F",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 2,
              elevation: 1
            }}>
              <Ionicons name="lock-closed" size={18} color="#D08C1F" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#D08C1F" }}>
                  Your Personal Visits Locked
                </Text>
                <Text style={{ fontSize: 11, color: "#92400E", marginTop: 3, lineHeight: 15 }}>
                  Your route plan/beat day for this day is currently{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {beatDayApprovalStatus || filteredVisits[0]?.MTP_Admin_Approval_Status__c || "Pending Approval"}
                  </Text>
                  . Please wait for manager approval to start your own visits. Joint working visits are active.
                </Text>
              </View>
            </View>
          )}

          {userState[0]?.DeveloperName !== "MT_SO" &&
            userState[0]?.DeveloperName !== "MT_Merchandiser" && (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValueBlue}>{allOutlets.length}</Text>
                  <Text style={styles.statLabel}>Outlets</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValueBlue}>{billedOutletsCount}</Text>
                  <Text style={styles.statLabel}>Spot Sales Outlet</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValueBlue}>
                    {unbilledOutletsCount}
                  </Text>
                  <Text style={styles.statLabel}>Non-Spot Sales Outlet</Text>
                </View>
              </View>
            )}
        </View>
      </View>

      {/* Joint Working Section (Separate Card) */}
      {activeJointWorkingList.length > 0 && (
        <View style={{
          marginHorizontal: 16,
          marginTop: 12,
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#E9D5FF",
          shadowColor: "#7E22CE",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 3,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View style={{
              backgroundColor: "#F3E8FF",
              padding: 6,
              borderRadius: 8,
              marginRight: 10,
            }}>
              <Ionicons name="people" size={20} color="#7E22CE" />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#1F1D1A" }}>
                Joint Working Assignments
              </Text>
              <Text style={{ fontSize: 11, color: "#7A7266" }}>
                Today's co-working visits
              </Text>
            </View>
          </View>

          {activeJointWorkingList.map((jbd, idx) => (
            <View
              key={idx}
              style={{
                marginTop: idx > 0 ? 12 : 0,
                paddingTop: idx > 0 ? 12 : 0,
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: "#F3E8FF"
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#7A7266" }}>
                    User / Partner:
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#7E22CE", marginTop: 2 }}>
                    {jbd.Joint_Working_User_Name__c || "Representative"}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#7A7266" }}>
                    Beat Name:
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1F1D1A", marginTop: 2 }}>
                    {jbd.Beat__Name || "No Beat"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#7A7266" }}>
                    Date:
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#1F1D1A", marginTop: 1 }}>
                    {jbd.Beat_Date__c || "N/A"}
                  </Text>
                </View>
              </View>

              {jbd.Joint_Working_Reason__c ? (
                <View style={{
                  marginTop: 8,
                  backgroundColor: "#FAF5FF",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4
                }}>
                  <Text style={{ fontSize: 10, color: "#7E22CE", fontStyle: "italic" }}>
                    Reason: {jbd.Joint_Working_Reason__c}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Tabs & Filter */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            const content = (
              <Text style={isActive ? styles.activeTabText : styles.tabText}>
                {tab} ({categorizedData[tab]?.length || 0})
              </Text>
            );

            return (
              <Pressable
                key={tab}
                style={styles.tabWrapper}
                onPress={() => setActiveTab(tab)}
              >
                {isActive ? (
                  <LinearGradient
                    colors={Gradients.primary}
                    style={styles.activeTabButton}
                  >
                    {content}
                  </LinearGradient>
                ) : (
                  <View style={styles.tabButton}>{content}</View>
                )}
              </Pressable>
            );
          })}

          {/* Filter Button */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilterCount > 0 && styles.activeFilterButton,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="funnel"
              size={13}
              color={activeFilterCount > 0 ? "#FFF" : "#C9A24D"}
            />
            <Text
              style={[
                styles.filterButtonText,
                activeFilterCount > 0 && styles.activeFilterButtonText,
              ]}
            >
              Filter
            </Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* <Pressable
        key={'CloseButton'}
        style={{
          borderRadius: 20,
          alignSelf: 'flex-end',
          marginRight: 10,
        }}
      >
        <LinearGradient
          colors={Gradients.primary}
          style={{
            borderRadius: 20,
            paddingVertical: 6,
            paddingHorizontal: 12,
            maxWidth: 150,
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center' }}>End Day</Text>
        </LinearGradient>
      </Pressable> */}

      {/* Outlet Cards */}
      {loading ? (
        <View style={{ justifyContent: "center", alignItems: "center", paddingVertical: 50 }}>
          <ActivityIndicator size="large" color="#C9A24D" />
          <Text style={{ marginTop: 12, color: "#7A7266", fontSize: 14, fontWeight: "600" }}>
            Loading visits...
          </Text>
        </View>
      ) : (!isMtpApproved && activeJointWorkingList.length === 0) ? (
        <View style={{
          padding: 24,
          marginHorizontal: 16,
          backgroundColor: "#fff",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#D9D2C3",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 20,
          marginBottom: 40
        }}>
          <Ionicons name="lock-closed" size={48} color="#7A7266" />
          <Text style={{
            fontSize: 16,
            fontWeight: "700",
            color: "#1F1D1A",
            marginTop: 12,
            textAlign: "center"
          }}>
            Visits Locked
          </Text>
          <Text style={{
            fontSize: 13,
            color: "#7A7266",
            marginTop: 6,
            textAlign: "center",
            lineHeight: 18
          }}>
            Your route plan for this day is currently{" "}
            <Text style={{ fontWeight: "700", color: "#D08C1F" }}>
              {beatDayApprovalStatus || filteredVisits[0]?.MTP_Admin_Approval_Status__c || "Pending Approval"}
            </Text>
            .
          </Text>
          <Text style={{
            fontSize: 12,
            color: "#7A7266",
            marginTop: 4,
            textAlign: "center"
          }}>
            Please wait for manager approval to start your visits.
          </Text>
        </View>
      ) : outlets.length > 0 ? (
        filteredOutlets.length > 0 ? (
          <View style={{ paddingBottom: 50 }}>
            {filteredOutlets.map((item, index) => {
              const perc = parseFloat(item.propensity) / 100;
              const isVisitLocked = !isMtpApproved && !item.isJointWork;
              return (
                <TouchableOpacity
                  key={`${item.name}_${index}`}
                  style={[
                    styles.card,
                    {
                      borderLeftWidth: 5,
                      borderStartColor: isMTPersona
                        ? "black"
                        : item.nonBuyingIndicatorColor,
                      backgroundColor: item.isJointWork ? "#FAF5FF" : "#ffffff",
                      borderColor: item.isJointWork ? "#D8B4FE" : "#D9D2C3",
                      borderWidth: 1,
                    },
                    isVisitLocked && { opacity: 0.65 },
                  ]}
                  onPress={(item.isJointWork || isVisitLocked) ? null : () => handleNavigateToDetails(item)}
                >
                  {item.isPerfectStore && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        alignSelf: "flex-start",
                        backgroundColor: "#ECFDF5",
                        borderColor: "#A7F3D0",
                        borderWidth: 0.5,
                        borderRadius: 10,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        marginBottom: 6,
                      }}
                    >
                      <Ionicons name="star" size={12} color="#2E7D5B" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#2E7D5B" }}>
                        Perfect Store
                      </Text>
                    </View>
                  )}
                  <View style={styles.cardHeader}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      {/* Title container — important: minWidth: 0 allows the text to shrink on Android/iOS */}
                      <View
                        style={{ flex: 1, flexDirection: "row", minWidth: 0 }}
                      >
                        <View style={{ maxWidth: 235 }}>
                          <View
                            style={{ flexDirection: "row", alignItems: "center" }}
                          >
                            <Text
                              style={styles.cardTitle}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {item.name}
                            </Text>
                            {item.isJointWork && (
                              <View style={{
                                backgroundColor: "#FAF5FF",
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 4,
                                marginLeft: 6,
                                borderWidth: 0.5,
                                borderColor: "#D8B4FE",
                              }}>
                                <Text style={{ fontSize: 9, color: "#7E22CE", fontWeight: "700" }}>
                                  Joint Work
                                </Text>
                              </View>
                            )}
                            {isVisitLocked && (
                              <View style={{
                                backgroundColor: "#FEF2F2",
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 4,
                                marginLeft: 6,
                                borderWidth: 0.5,
                                borderColor: "#FCA5A5",
                                flexDirection: "row",
                                alignItems: "center"
                              }}>
                                <Ionicons name="lock-closed" size={10} color="#B3261E" style={{ marginRight: 2 }} />
                                <Text style={{ fontSize: 9, color: "#B3261E", fontWeight: "700" }}>
                                  Locked
                                </Text>
                              </View>
                            )}
                            {(item.is_synced === false ||
                              item.is_synced === 0) && (
                                <Text
                                  style={{
                                    color: "#B3261E",
                                    fontSize: 10,
                                    fontWeight: "700",
                                    marginLeft: 6,
                                  }}
                                >
                                  Not Synced
                                </Text>
                              )}
                          </View>

                          <View style={{ marginTop: 4, gap: 4 }}>
                            {(item.is_synced === false || item.is_synced === 0) && item.ErrorMsg ? (
                              <Text
                                numberOfLines={2}
                                style={{ fontSize: 11, color: "#B3261E" }}
                              >
                                {item.ErrorMsg}
                              </Text>
                            ) : null}
                            {userState[0]?.DeveloperName !== "MT_SO" &&
                              userState[0]?.DeveloperName !== "MT_Merchandiser" &&
                              item.code ? (
                              <Text style={{ fontSize: 12, color: "#7A7266" }}>
                                {"#" + item.code}
                              </Text>
                            ) : null}

                            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                              {(() => {
                                const isDistributor =
                                  item.accountType === "Distributor" ||
                                  item.RecordType === "BAs" ||
                                  isDistributorAccount(item);
                                const tagLabel = isDistributor ? "Distributor" : "Retailer";

                                return (
                                  <View style={{ backgroundColor: "#EEF4FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 10, color: "#A67C2E", fontWeight: "600" }}>
                                      {tagLabel}
                                    </Text>
                                  </View>
                                );
                              })()}

                              {(() => {
                                if (
                                  currentLocation &&
                                  item.BillingLatitude &&
                                  item.BillingLongitude &&
                                  !isNaN(Number(item.BillingLatitude)) &&
                                  !isNaN(Number(item.BillingLongitude))
                                ) {
                                  const dist = getDistanceInKm(
                                    currentLocation.latitude,
                                    currentLocation.longitude,
                                    Number(item.BillingLatitude),
                                    Number(item.BillingLongitude)
                                  );
                                  return (
                                    <View style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      backgroundColor: "#E6F4EA",
                                      paddingHorizontal: 6,
                                      paddingVertical: 2,
                                      borderRadius: 4,
                                    }}>
                                      <Ionicons name="location-outline" size={10} color="#137333" style={{ marginRight: 2 }} />
                                      <Text style={{ fontSize: 10, color: "#137333", fontWeight: "600" }}>
                                        {dist.toFixed(2)} KM
                                      </Text>
                                    </View>
                                  );
                                }
                                return null;
                              })()}
                            </View>
                          </View>
                        </View>

                        {userState[0]?.DeveloperName !== "MT_SO" &&
                          userState[0]?.DeveloperName !== "MT_Merchandiser" && (
                            <Tooltip
                              isVisible={tooltipVisible === item.AccountId}
                              content={
                                <Text style={{ color: "black" }}>
                                  {item?.OTPVerified__c === "Yes"
                                    ? "This Outlet is OTP Verified"
                                    : "Outlet is Not OTP Verified"}
                                </Text>
                              }
                              placement="top"
                              onClose={() => setTooltipVisible(null)}
                              backgroundColor="rgba(0,0,0,0.3)"
                            >
                              <TouchableOpacity
                                onPress={() =>
                                  setTooltipVisible((prev) =>
                                    prev === item.AccountId
                                      ? null
                                      : item.AccountId
                                  )
                                }
                                style={styles.tooltipButton}
                              >
                                {item?.OTPVerified__c === "Yes" ? (
                                  <View style={styles.verifiedDot}>
                                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                                      <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    </Svg>
                                  </View>
                                ) : (
                                  /* Commented out as requested:
                                  <View style={styles.unverifiedDot}>
                                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                                      <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    </Svg>
                                  </View>
                                  */
                                  null
                                )}
                              </TouchableOpacity>
                            </Tooltip>
                          )}
                      </View>

                      {/* Tooltip button — stays to the right of the title but before the icons */}
                    </View>

                    {/* Right-side icons (map/phone) remain unchanged */}
                    <View style={styles.iconRow}>
                      {/* {item?.BillingLongitude !== 0 && item?.BillingLatitude !== 0 && (
                      <TouchableOpacity style={styles.iconCircle}>
                        <Ionicons name="location" size={18} color="#C9A24D" />
                      </TouchableOpacity>
                    )} */}

                      {item?.BillingLongitude &&
                        item?.BillingLatitude &&
                        !isNaN(Number(item.BillingLatitude)) &&
                        !isNaN(Number(item.BillingLongitude)) ? (
                        <TouchableOpacity
                          style={[styles.iconCircle, isVisitLocked && { opacity: 0.5 }]}
                          disabled={isVisitLocked}
                          onPress={isVisitLocked ? null : () =>
                            navigation.navigate("FullMap", {
                              locations: [
                                {
                                  latitude: Number(item.BillingLatitude),
                                  longitude: Number(item.BillingLongitude),
                                  title: item.name,
                                  address: item.BillingAddress,
                                  AccountId: item.AccountId,
                                },
                              ],
                            })
                          }
                        >
                          <Ionicons name="location" size={23} color="#C9A24D" />
                        </TouchableOpacity>
                      ) : null}

                      {!item.isJointWork && (
                        <TouchableOpacity
                          onPress={isVisitLocked ? null : () => {
                            handleCallPress(item?.Phone);
                          }}
                          style={[styles.iconCircle, { marginLeft: 8 }, isVisitLocked && { opacity: 0.5 }]}
                          disabled={isVisitLocked}
                        >
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                              stroke="#C9A24D"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            />
                          </Svg>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {item.BillingAddress ? (
                    <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 6, paddingRight: 10 }}>
                      <Ionicons name="location-outline" size={14} color="#7A7266" style={{ marginTop: 2, marginRight: 4 }} />
                      <Text style={{ fontSize: 11, color: "#7A7266", flex: 1, lineHeight: 15 }} numberOfLines={2}>
                        {item.BillingAddress}
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      {userState[0]?.DeveloperName === "MT_SO" ||
                        userState[0]?.DeveloperName === "MT_Merchandiser" ? (
                        <>
                          <View
                            style={{
                              flexDirection: "column",
                              alignItems: "center",
                            }}
                          >
                            <Text style={styles.fieldlabel}>Party Code</Text>
                            {/* <Text style={{ fontSize: 12 }}></Text> */}
                            <Text style={styles.fieldText}>
                              {item.code ? " (#" + item.code + ")" : ""}
                            </Text>
                          </View>
                        </>
                      ) : (
                        (item.accountType === "Distributor" || item.RecordType === "BAs" || isDistributorAccount(item)) ? null : (
                          <>
                            <View
                              style={{
                                flexDirection: "column",
                                alignItems: "center",
                              }}
                            >
                              <Text style={styles.fieldlabel}>Class</Text>

                              <Text style={styles.fieldText}>{item.tier}</Text>
                            </View>

                            {/* <View
                            style={{ flexDirection: "column", alignItems: "center" }}
                          >
                            <Text style={styles.fieldlabel}>Channel</Text>
                            <Text style={styles.fieldText}>{item.target}</Text>
                          </View> */}

                            <View
                              style={{
                                flexDirection: "column",
                                alignItems: "center",
                              }}
                            >
                              <Text style={styles.fieldlabel}>Channel</Text>
                              <Text style={styles.fieldText}>
                                {/* Commented out as requested: {item.subchannel} */}
                                {item.target}
                              </Text>
                            </View>
                          </>
                        )
                      )}
                    </View>

                    {isToday && !hasVisitTime(EndOfDayTime) && (
                      <View style={{ height: 32 }}>
                        {isVisitLocked ? (
                          <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#F1EADB",
                            borderColor: "#D1D5DB",
                            borderWidth: 1,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            height: 32,
                            justifyContent: "center",
                          }}>
                            <Ionicons name="lock-closed" size={14} color="#7A7266" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, color: "#7A7266", fontWeight: "700" }}>Locked</Text>
                          </View>
                        ) : item.isJointWork ? (
                          !item.Joint_Visit_User_Validated__c ? (
                            (() => {
                              const isCheckedOut = !!item.CheckOutTime__c;
                              return (
                                <LinearGradient
                                  colors={isCheckedOut ? ["#A855F7", "#7E22CE"] : ["#D9D2C3", "#D9D2C3"]}
                                  style={[styles.checkInGradient, { position: "relative", width: 90, height: 32, right: 0 }]}
                                >
                                  <TouchableOpacity
                                    style={styles.submitButton}
                                    onPress={() => {
                                      if (isCheckedOut) {
                                        handleValidateJointWork(item);
                                      } else {
                                        dispatch(
                                          showToast({
                                            message: "Please ask the user to check out of this visit first before validating.",
                                            type: "warning",
                                          })
                                        );
                                      }
                                    }}
                                    disabled={false}
                                  >
                                    <Text style={[styles.submitButtonText, !isCheckedOut && { color: "#7A7266" }]}>
                                      Validate
                                    </Text>
                                  </TouchableOpacity>
                                </LinearGradient>
                              );
                            })()
                          ) : (
                            <LinearGradient
                              colors={["#2E7D5B", "#2E7D5B"]}
                              style={[styles.checkInGradient, { position: "relative", width: 90, height: 32, right: 0 }]}
                            >
                              <View style={styles.submitButton}>
                                <Text style={styles.submitButtonText}>
                                  Completed
                                </Text>
                              </View>
                            </LinearGradient>
                          )
                        ) : (
                          (() => {
                            const isCheckedOut =
                              item.VisitStatus__c === "Check Out" ||
                              item.VisitStatus__c === "Completed" ||
                              hasVisitTime(item.CheckOutTime__c);

                            const isCheckedIn =
                              !isCheckedOut &&
                              (item.VisitStatus__c === "Check In" || hasVisitTime(item.CheckInTime__c));

                            if (isCheckedOut) {
                              return (
                                <LinearGradient
                                  colors={["#2E7D5B", "#2E7D5B"]}
                                  style={[styles.checkInGradient, { position: "relative", width: 90, height: 32, right: 0 }]}
                                >
                                  <View style={styles.submitButton}>
                                    <Text style={styles.submitButtonText}>
                                      Completed
                                    </Text>
                                  </View>
                                </LinearGradient>
                              );
                            }

                            if (isCheckedIn) {
                              return (
                                <LinearGradient
                                  colors={Gradients.primary}
                                  style={[styles.checkInGradient, { position: "relative", width: 90, height: 32, right: 0 }]}
                                >
                                  <TouchableOpacity
                                    style={styles.submitButton}
                                    onPress={() => {
                                      setSelectedOutlet(item);
                                      setCheckoutModalVisible(true);
                                    }}
                                  >
                                    <Text style={styles.submitButtonText}>
                                      Check Out
                                    </Text>
                                  </TouchableOpacity>
                                </LinearGradient>
                              );
                            }

                            // Not checked in yet -> Check In Button
                            const isAlreadyCheckedIn =
                              alredyCheckIn?.VisitId &&
                              alredyCheckIn?.date === todaysDate;

                            return (
                              <LinearGradient
                                colors={
                                  isAlreadyCheckedIn
                                    ? Gradients.disabled
                                    : Gradients.primary
                                }
                                style={[styles.checkInGradient, { position: "relative", width: 90, height: 32, right: 0 }]}
                              >
                                <TouchableOpacity
                                  style={styles.submitButton}
                                  onPress={
                                    !isAlreadyCheckedIn
                                      ? async () => {
                                        if (
                                          userState[0]?.DeveloperName ===
                                          "H_T_ASO"
                                        ) {
                                          const isStock = await stockCheck();
                                          if (isStock) {
                                            openCheckinModal(item);
                                          } else {
                                            dispatch(
                                              showToast({
                                                message:
                                                  "Please complete Stock Entry before Check-In.",
                                                type: "warning",
                                              })
                                            );
                                          }
                                        } else {
                                          openCheckinModal(item);
                                        }
                                      }
                                      : null
                                  }
                                  disabled={isAlreadyCheckedIn}
                                >
                                  <Text style={styles.submitButtonText}>
                                    Check In
                                  </Text>
                                </TouchableOpacity>
                              </LinearGradient>
                            );
                          })()
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={{ padding: 32, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="funnel-outline" size={44} color="#7A7266" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#1F1D1A",
                marginTop: 12,
                textAlign: "center",
              }}
            >
              No matching visits found
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#7A7266",
                marginTop: 4,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              Try adjusting or clearing your filter criteria to see visits.
            </Text>
            <TouchableOpacity
              onPress={() =>
                setVisitFilters({
                  outletName: "",
                  distanceSort: null,
                  selectedClasses: [],
                  selectedChannels: [],
                  perfectStoreOnly: false,
                })
              }
              style={{
                backgroundColor: "#C9A24D",
                paddingHorizontal: 18,
                paddingVertical: 9,
                borderRadius: 8,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>
                Clear Filters
              </Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <Text style={styles.noDataText}>No outlets in this category.</Text>
      )}
    </ScrollView>
  );
};

export default BeatPlanning;
