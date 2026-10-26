import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  PermissionsAndroid,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from '@react-native-vector-icons/feather';
import moment from 'moment';
import { launchCamera } from 'react-native-image-picker';
import { Dropdown } from 'react-native-element-dropdown';
import { useSelector } from 'react-redux';
import ToastModal from './ToastModal';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../../utils/networkUtils';
import { getCurrentLocation } from '../../utils/getCurrentLocation';
import { getAddressFromCoords } from '../../utils/reverseGeocode';
import { useDispatch } from "react-redux";
import { setSelectedVisit } from '../../redux/slices/selectedVisitSlice';
import { setCheckInStatus } from '../../redux/slices/checkInSlice'
import { useNavigation } from '@react-navigation/native';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import { showToast } from '../../redux/slices/toastSlice.js'
import { resizeAndConvertImage } from '../../utils/helper/resizeAndConvertImage';
import getDistanceInKm from '../../utils/helper/GetDistance';
import { get } from 'react-native/Libraries/TurboModule/TurboModuleRegistry';
import { s } from 'react-native-size-matters';
import { Dimensions } from 'react-native';
const { height } = Dimensions.get('window');
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Feather from '@react-native-vector-icons/feather';


const options = [
  { label: 'Present', value: 'Present' },
  { label: 'Leave', value: 'Leave' },
];

const optionsLeave = [
  { label: 'Full Day', value: 'Full Day' },
  { label: 'First Half', value: 'First Half' },
  { label: 'Second Half', value: 'Second Half' },
];

const SelfieCheckIn = ({ visible, onClose, outlet, selectedDate, categorizedData }) => {
  const date = moment().format('YYYY-MM-DD');
  const displayDate = moment().format('DD MMMM YYYY');
  const [location, setLocation] = useState('')
  const [address, setAddress] = useState('');
  const navigation = useNavigation();
  const [workingWith, setWorkingWith] = useState('');
  // console.log("SELECTED OUTLET===========================", categorizedData)

  const [latitudeState, setLatitudeState] = useState('');
  const [longitudeState, setLongitudeState] = useState('');


  const WORKING_OPTIONS = [
    { label: 'Select...', value: '' },
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
  ];

  const onSelect = (item) => {
    // item is { label, value }
    setWorkingWith(item.value);

    // if user chooses 'no' we clear remarks (adjust if you want to keep previous text)
    if (item.value === 'no') {
      setRemarks('');
    }
  };


  const dispatch = useDispatch();
  const selectedVisit = useSelector((state) => state.selectedVisit); // Redux se
  const userId = useSelector(state => state.auth.userId);
  const { handleLogout, apiFetch } = useApiFetch();
  const [status, setStatus] = useState('Present');
  const [statusLeave, setStatusLeave] = useState('First Half');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [selfieUri, setSelfieUri] = useState(null);
  const [base64Image, setBase64Image] = useState('');



  const statusSetter = value => {
    setStatus(value);
    if (value === 'Present') {
      setStatusLeave('');
      setReason('');
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs access to your camera to take a selfie.',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };



  const openCameraold = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      showToastvisible('error', 'Camera permission denied');
      return;
    }

    const options = {
      mediaType: 'photo',
      cameraType: 'front',
      saveToPhotos: false,
      includeBase64: false, // we'll manually generate base64
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
    };

    launchCamera(options, async (response) => {
      if (response.didCancel) {
        console.log('User cancelled');
        return;
      }
      if (response.errorCode) {
        showToastvisible('error', response.errorMessage);
        return;
      }

      if (response.assets?.length) {
        let asset = response.assets[0];
        let imageUri = asset.uri;

        try {
          // Handle content:// URI on Android
          if (Platform.OS === 'android' && imageUri.startsWith('content://')) {
            const destPath = `${RNFS.CachesDirectoryPath}/temp_image.jpg`;
            await RNFS.copyFile(imageUri, destPath);
            imageUri = destPath;
          }

          let quality = 70; // start at 70%
          let base64Image = '';
          let imageSizeKB = Infinity;

          // Keep compressing until size is under 200 KB or quality drops too much
          while (imageSizeKB > 200 && quality > 30) {
            // const resizedImage = await ImageResizer.createResizedImage(
            //   imageUri,
            //   800, // width
            //   800, // height
            //   'JPEG',
            //   quality,
            //   0
            // );
            const { base64, uri: resizedUri, sizeKB } = await resizeAndConvertImage(imageUri);
            base64Image = base64
            base64Image = await RNFS.readFile(resizedUri, 'base64');
            //imageSizeKB = (base64Image.length * 3 / 4) / 1024;
            imageSizeKB = sizeKB
            console.log('image size in kb ::', imageSizeKB)
            const sizeNum = Number(imageSizeKB);
            console.log(`Quality ${quality}% → ${sizeNum.toFixed(2)} KB`);
            quality -= 10; // reduce quality for next iteration if needed
          }
          console.log('BSE64 IMAGE::::', base64Image)

          if (imageSizeKB > 200) {
            showToastvisible('warning', 'Could not compress image below 200 KB.');
          }

          setSelfieUri(imageUri);
          setBase64Image(base64Image);
        } catch (err) {
          console.error('Image compression error details:', err);
          showToastvisible('error', 'Failed to process image.');
        }
      }
    });
  };


  const [user, setUser] = useState([])
  useEffect(() => {
    const getuser = async () => {
      const result = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });
      setUser(result[0] || [])
    }
    getuser()
  }, [])



  const distanceCounter = async () => {
    const { latitude, longitude } = await getCurrentLocation();

    // console.log("latitude current", latitude);
    // console.log("longitude current", longitude);

    if (categorizedData?.Completed?.length === 0) {
      const result = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });
      const today = moment().format("YYYY-MM-DD");
      const userId = result[0]?.Sf_Id;
      const attendanceRecords = await UniversalUpdateInsert({
        ObjectName: "Attendant__c",
        Type: "get",
        filters: [
          { field: "AttendanceDate__c", value: today },
          { field: "User__c", value: userId },
        ],
      });

      // console.log("ALL ATTENDANCE RECORDS ::::::", attendanceRecords);

      if (attendanceRecords?.length > 0) {
        const geoLocation = attendanceRecords[0]?.GeoLocation__c; // "lat,long"
        if (geoLocation && geoLocation.includes(",")) {
          const [lat, lon] = geoLocation.split(",").map(Number);
          const distance = getDistanceInKm(latitude, longitude, lat, lon);
          console.log("Distance from Attendance GeoLocation:", distance.toFixed(2), "km");
          return distance;
        }
      }
      return 0; // if GeoLocation missing/null
    } else {
      // ---- Take last record from Completed ----
      const lastRecord =
        categorizedData.Completed[categorizedData.Completed.length - 1];

      if (lastRecord) {
        const { CheckInLocation__Latitude, CheckInLocation__Longitude } = lastRecord;
        console.log(CheckInLocation__Latitude, CheckInLocation__Longitude)
        if (CheckInLocation__Latitude && CheckInLocation__Longitude) {
          const distance = getDistanceInKm(
            latitude,
            longitude,
            CheckInLocation__Latitude,
            CheckInLocation__Longitude
          );
          console.log(
            "Distance from last Completed record:",
            distance.toFixed(2),
            "km"
          );
          return distance;
        }
      }
      return 0; // if BillingLatitude/BillingLongitude missing/null
    }
  };


  const distanceCounterAccount = async () => {
    const { latitude, longitude } = await getCurrentLocation();
    // console.log("latitude current", latitude);
    // console.log("longitude current", longitude);
    if (outlet?.BillingLatitude && outlet?.BillingLongitude) {
      const distance = getDistanceInKm(
        latitude,
        longitude,
        outlet?.BillingLatitude,
        outlet?.BillingLongitude
      );
      console.log(
        "Distance from Account location:",
        distance.toFixed(2),
        "km"
      );
      return distance;
    }
    return 0;
  }

  const getCurrentDateTimeString = () => {
    const now = new Date();
    // Example format: "2025-09-15 13:45:30"
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-based
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }




  const submitToApi = async () => {
    // const { latitude, longitude } = await getCurrentLocation();
    const checkindistance = await distanceCounter();
    const Accountdistance = await distanceCounterAccount();
    const payload = {
      requestWrapper: {
        Id: outlet.sfId,
        CheckInTime: new Date().toISOString(),
        CheckInLocation: location,
        Status: 'In Progress',
        CheckInBase64: base64Image,
        Type: "Check-In",
        Before12Noon: false,
        Before3PM: false,
        Before6PM: false,
        After6PM: false,
        FirstCallVisit: categorizedData?.Completed?.length === 0 && categorizedData?.["In Progress"]?.length === 0 ? true : false,
        DistanceTravelledKm: checkindistance,
        LocationVarianceOLtoSCA: Accountdistance,
        CheckInLocationLongitude: longitudeState,
        CheckInLocationLatitude: latitudeState,
        BeatDayId: outlet?.BeatDay__c,
        FirstCallTime: categorizedData?.Completed?.length === 0 && categorizedData?.["In Progress"]?.length === 0 ? getCurrentDateTimeString() : null,
        Remark: workingWith === 'yes' ? remarks : null,
        WorkingWith: workingWith,
      }
    };

    const now = new Date();
    const currentHour = now.getHours(); // 0 - 23

    if (currentHour < 12) {
      payload.requestWrapper.Before12Noon = true;
    } else if (currentHour >= 12 && currentHour < 15) {
      payload.requestWrapper.Before3PM = true;
    } else if (currentHour >= 15 && currentHour < 18) {
      payload.requestWrapper.Before6PM = true;
    } else {
      payload.requestWrapper.After6PM = true;
    }

    console.log("THISIS NEW PAYLOAD =============", payload, "THISIS NEW PAYLOAD")

    const response = await apiFetch('POST', 'visitCheckIn-update', payload, 'Custom');
    if (response.status === 'success') {

      console.log('api successsssss')
      //showToastvisible('success', 'Attendance marked successfully.');
      return true;
    } else {
      console.log('API FAILED')
      //showToastvisible('error', 'Failed to mark attendance.');
      return false;
    }
  };


  const saveLocally = async (apiSuccess) => {
    // const { latitude, longitude } = await getCurrentLocation();
    const checkindistance = await distanceCounter();
    const Accountdistance = await distanceCounterAccount();
    const payload = {
      Sf_Id: outlet.sfId,
      CheckInTime__c: JSON.stringify(new Date().toISOString()),
      CheckInLocation__c: location,
      VisitStatus__c: 'In Progress',

      Before12Noon__c: false,
      Before3PM__c: false,
      Before6PM__c: false,
      After6PM__c: false,
      FirstCallVisit__c: categorizedData?.Completed?.length === 0 && categorizedData?.["In Progress"]?.length === 0 ? true : false,
      DistanceTravelledKm__c: checkindistance,
      LocationVarianceOLtoSCA__c: Accountdistance,
      CheckInLocation__Longitude__s: longitudeState,
      CheckInLocation__Latitude__s: latitudeState,
      CheckInComment__c: workingWith === 'yes' ? remarks : null,
      WorkingWith__c: workingWith,

      is_locally_changed: apiSuccess ? false : true,
      operation_type: "insert",
      last_modified: Date.now(),
      is_synced: apiSuccess ? true : false,
      CheckInBase64: base64Image,
    };

    // current time nikalo
    const now = new Date();
    const currentHour = now.getHours(); // 0 - 23

    if (currentHour < 12) {
      payload.Before12Noon__c = true;
    } else if (currentHour >= 12 && currentHour < 15) {
      payload.Before3PM__c = true;
    } else if (currentHour >= 15 && currentHour < 18) {
      payload.Before6PM__c = true;
    } else {
      payload.After6PM__c = true;
    }

    console.log("PAYLOAD================================------------", payload)
    // return false;
    const inserted = await UniversalUpdateInsert({
      ObjectName: 'Visit',
      Type: 'insert',
      data: payload,
    });

    if (categorizedData?.Completed?.length === 0 && categorizedData?.["In Progress"]?.length === 0) {
      const payloadBeat = {
        Sf_Id: outlet?.BeatDay__c,
        First_Call_Time__c: getCurrentDateTimeString(),
        is_locally_changed: apiSuccess ? false : true,
        last_modified: Date.now(),
        is_synced: apiSuccess ? true : false,
      };
      const insertedBeat = await UniversalUpdateInsert({
        ObjectName: 'BeatDay__c',
        Type: 'insert',
        data: payloadBeat,
      });
    }



    const result = await UniversalUpdateInsert({
      ObjectName: 'Visit',
      Type: 'get',
      data: payload,
    });
    // console.log("Result=--------===============================------------", result)

    if (inserted) {
      //showToastvisible('success', 'Visit saved locally.');
      console.log('Saved local success!')
      return true;
    } else {
      showToastvisible('error', 'Failed to save attendance locally.');
      return false;
    }
  };

  const isValidCoordinate = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (isNaN(num)) return false;
    return num !== 0;
  };

  const handleCheckInSubmit = async () => {
    if (!latitudeState || !longitudeState) {
      showToastvisible(
        'warning',
        'Location is turned off. Turn it on to continue with check-in.'
      );
      return;
    }

    if (outlet.Add_New_Retailer_Visit__c === false) {
      if (!isValidCoordinate(outlet.BillingLatitude) || !isValidCoordinate(outlet.BillingLongitude)) {
        showToastvisible(
          'warning',
          'Outlet does not have valid lat long. You cannot check in.'
        );
        return;
      }
    }
    const distanceInKm = await distanceCounterAccount();
    const distanceInMeter = distanceInKm * 1000;

    // if ((user?.DeveloperName === 'MT_Merchandiser' || user?.DeveloperName === 'MT_SO') && distanceInMeter > 200) {
    //   showToastvisible(
    //     'warning',
    //     'Your check-in location is more than 200 meters away from the outlet location. You cannot check in.'
    //   );
    //   return;
    // }

    if (
      user?.DeveloperName === 'MT_Merchandiser' ||
      user?.DeveloperName === 'MT_SO'
    ) {
      if (!workingWith) {
        showToastvisible(
          'warning',
          'Please select "Are you working with someone else?" for Check-In.'
        );
        return;
      }

      if (workingWith === 'yes' && !remarks) {
        showToastvisible(
          'warning',
          'Please enter name in remarks for Check-In.'
        );
        return;
      }
    }



    if ((user?.DeveloperName === 'MT_Merchandiser' || user?.DeveloperName === 'MT_SO') && !base64Image) {
      showToastvisible('warning', 'Please capture a selfie before Check-In.');
      return;
    }
    try {
      setLoading(true);
      // const connected = await isInternetAvailable();
      // const localSuccess = await saveLocally();
      // return;
      const connected = await isInternetAvailable();

      let apiSuccess = false;
      if (connected) {
        apiSuccess = await submitToApi();
        if (!apiSuccess) {
          console.log('warning', 'API failed. Saving Check-In Offline.');
          // showToastvisible('warning', 'API failed. Saving Check-In Offline.');
        }
      }
      const localSuccess = await saveLocally(apiSuccess);
      // return;
      if (localSuccess) {
        const updatedVisit = {
          ...(selectedVisit || {}),
          VisitStatus__c: 'In Progress',
        };
        dispatch(setSelectedVisit(updatedVisit));
        dispatch(setCheckInStatus({
          VisitId: outlet.sfId,
          status: 'In Progress',
          date: selectedDate
        }));
        const GETDATA = await UniversalUpdateInsert({
          ObjectName: 'Visit',
          Type: 'get',
        });
        const targetDate = "2025-07-10";
        const filteredVisits = GETDATA.filter(item => item.VisitDate__c === targetDate);
        // console.log("UPDATED VISIT DATA ++++++++", filteredVisits)
        onClose()
        showToastvisible('success', 'Check-In successful.');
        setRemarks('')
        setTimeout(() => {
          navigation.navigate("AccountDetailContainer", {
            accountDetailId: outlet?.Sf_Id,
            visitDetail: outlet,
          });
        }, 1000);

      }
    } catch (error) {
      console.error(' Check In error:', error);
      showToastvisible(
        'error',
        error?.response?.data?.message ||
        error?.response?.data?.error_description ||
        error?.message ||
        'Something went wrong'
      );
      alert(JSON.stringify(error))
    } finally {
      setLoading(false);
    }
  };

  const showToastvisible = (type, message) => {
    dispatch(showToast({
      message: message,
      type: type, // 'success' | 'error' | 'warning'
    }));
  };


  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!visible) return;
    const getLocation = async () => {
      try {
        // console.log('heloooooocd')
        const { latitude, longitude } = await getCurrentLocation();
        console.log(latitude, longitude)
        setLatitudeState(latitude);
        setLongitudeState(longitude);
        const connected = await isInternetAvailable();
        if (connected) {
          const address = await getAddressFromCoords(latitude, longitude);
          if (address) {
            setLocation(address);

            //console.log("THIA IS AASDDREDD",address)
          } else {
            setLocation(`Lat: ${latitude}, Long: ${longitude}`);
          }
        } else {
          setLocation(`Lat: ${latitude}, Long: ${longitude}`);
        }
      } catch (err) {
        console.warn('Error getting location/address:', err);
        setLocation('Location unavailable');
      }
    };

    getLocation();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setSelfieUri(null);
      setBase64Image('');
      setWorkingWith('');
      setRemarks('');
    }
  }, [visible]);






  const cameraRef = useRef(null);
  const [cameraType, setCameraType] = useState('front');
  const device = useCameraDevice(cameraType);
  const fallbackDevice = useCameraDevice('back');
  const finalDevice = device ?? fallbackDevice;
  const [showCamera, setShowCamera] = useState(false);
  const [hasCamPermission, setHasCamPermission] = useState(false);
  const openCamera = async () => {
    try {
      let permission;

      if (Platform.OS === 'android') {
        permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs camera access to take selfie',
            buttonPositive: 'OK',
          }
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          showToastvisible('error', 'Camera permission denied');
          return;
        }
      } else {
        // iOS
        const status = await Camera.requestCameraPermission();
        if (status !== 'granted') {
          showToastvisible('error', 'Camera permission denied');
          return;
        }
      }

      setHasCamPermission(true);
      setShowCamera(true);

    } catch (e) {
      console.log('Permission error:', e);
    }
  };
  const capturePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed', // 🔥 memory safe
        flash: 'off',
      });
      const filePath = 'file://' + photo.path;
      // set UI
      setSelfieUri(filePath);
      const { base64, uri: resizedUri, sizeKB } = await resizeAndConvertImage(photo.path);
      setBase64Image(base64);
      setShowCamera(false);
    } catch (e) {
      console.log(' Camera Error:', e);
    }
  };
  return (
    <>
      <Modal visible={visible} statusBarTranslucent={false} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >

          <View style={styles.overlay}>

            {/* ========== FIXED HEADER ========== */}
            <View style={styles.modalContainer}>
              <View style={styles.headerContainer}>
                <View style={styles.headerRow}>
                  <Text style={styles.header}>Check-In</Text>
                  <TouchableOpacity onPress={() => onClose()}>
                    <Text style={{ fontSize: 28 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.subtext}>
                  System will capture your geo-location.
                </Text>
              </View>

              {/* ========== SCROLLABLE CONTENT ========== */}
              <ScrollView
                style={{}}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingTop: 16,
                  paddingBottom: 20,
                  flexGrow: 1,   // 🔑 content ke hisaab se grow
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {/* Date Row */}
                <View style={styles.row}>
                  <Icon name="calendar" size={22} color="#C9A24D" style={styles.icon} />
                  <View>
                    <Text style={styles.label}>Date</Text>
                    <Text style={styles.value}>
                      {selectedDate ? moment(selectedDate, "YYYY-MM-DD").format("DD MMM YYYY") : ""}
                    </Text>
                  </View>
                </View>

                {/* Location Row */}
                <View style={styles.row}>
                  <Icon name="map-pin" size={22} color="red" style={styles.icon} />
                  <View>
                    <Text style={styles.label}>Current Location</Text>
                    <Text style={[styles.value, { width: 260 }]}>{location}</Text>
                  </View>
                </View>

                {/* Working With Dropdown */}
                {user?.DeveloperName === 'MT_Merchandiser' || user?.DeveloperName === 'MT_SO' ? (
                  <>
                    <Text style={[styles.label, { marginBottom: 10 }]}>
                      Are you currently working with someone? <Text style={{ color: 'red' }}>*</Text>
                    </Text>
                    <Dropdown
                      data={WORKING_OPTIONS}
                      labelField="label"
                      valueField="value"
                      value={workingWith}
                      onChange={onSelect}
                      placeholder="Select..."
                      itemTextStyle={styles.itemTextStyle}
                      style={styles.dropdown}
                      containerStyle={styles.dropdownContainer}
                      selectedTextStyle={styles.selectedTextStyle}
                      itemContainerStyle={{ marginVertical: -2 }}
                      placeholderStyle={styles.placeholderStyle}
                    />

                    {/* Conditional Name Input */}
                    {workingWith === 'yes' && (
                      <>
                        <Text style={[styles.label, { marginVertical: 12 }]}>Enter Name <Text style={{ color: 'red' }}>*</Text></Text>
                        <TextInput
                          style={[styles.remarks, { minHeight: 80 }]}
                          placeholder="Type here"
                          value={remarks}
                          onChangeText={setRemarks}
                          multiline
                          textAlignVertical="top"
                        />
                      </>
                    )}
                  </>
                ) : null}

                {/* Upload Image */}
                <View style={styles.uploadRow}>
                  <Text style={styles.uploadLabel}>
                    Upload Image
                    {
                      (user?.DeveloperName === 'MT_Merchandiser' || user?.DeveloperName === 'MT_SO') && (
                        <Text style={styles.requiredStar}>*</Text>
                      )
                    }
                  </Text>
                  <TouchableOpacity onPress={openCamera}>
                    <LinearGradient
                      colors={['#C9A24D', '#A67C2E', '#C9A24D']}
                      style={styles.button}
                    >
                      <Icon name="camera" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Selfie Preview */}
                {base64Image !== '' && (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${base64Image}` }}
                    style={styles.selfieImage}
                  />
                )}

                {/* Bottom spacing for ScrollView */}
                <View style={{ height: 20 }} />
              </ScrollView>

              <Modal visible={showCamera} animationType="slide">
                {finalDevice && hasCamPermission ? (
                  <View style={{ flex: 1, backgroundColor: '#000' }}>

                    <Camera
                      ref={cameraRef}
                      style={{ flex: 1 }}
                      device={finalDevice}
                      isActive={showCamera}   // 🔥 IMPORTANT
                      photo={true}
                    />

                    {/* CAPTURE */}
                    <TouchableOpacity
                      onPress={capturePhoto}
                      style={{
                        position: 'absolute',
                        bottom: 50,
                        alignSelf: 'center',
                        backgroundColor: '#C9A24D',
                        padding: 20,
                        borderRadius: 50,
                      }}
                    >
                      <Icon name="camera" size={30} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setCameraType(prev => (prev === 'front' ? 'back' : 'front'));
                      }}
                      style={{
                        position: 'absolute',
                        top: 50,
                        left: 20,
                        backgroundColor: '#00000080',
                        padding: 10,
                        borderRadius: 30,
                      }}
                    >
                      <Icon name="refresh-cw" size={22} color="#fff" />
                    </TouchableOpacity>

                    {/* CLOSE */}
                    <TouchableOpacity
                      onPress={() => setShowCamera(false)}
                      style={{
                        position: 'absolute',
                        top: 50,
                        right: 20,
                        backgroundColor: '#00000080',
                        padding: 10,
                        borderRadius: 10
                      }}
                    >
                      <Feather name="x" size={22} color="#fff" />
                    </TouchableOpacity>

                  </View>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#000' }}>Loading Camera...</Text>
                  </View>
                )}
              </Modal>



              {/* ========== FIXED BOTTOM BUTTON ========== */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  onPress={handleCheckInSubmit}
                // disabled={!base64Image}
                >
                  <LinearGradient
                    colors={
                      // !base64Image
                      //   ? ['#cccccc', '#cccccc', '#cccccc'] :
                      ['#C9A24D', '#A67C2E', '#C9A24D']
                    }
                    style={styles.buttonCheckIn}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        // !base64Image && { color: '#888' }
                      ]}
                    >
                      {loading ? 'Submitting...' : 'Check In'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            <LoaderOverlay visible={loading} />
          </View>

        </KeyboardAvoidingView>
      </Modal>
    </>
  );

};

export default SelfieCheckIn;
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
    flexDirection: 'column', // column layout: header -> scrollview -> button
  },

  // ========== HEADER STYLES ==========
  headerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    // elevation: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    // shadowColor: '#000',
    // shadowOpacity: 0.1,
    // shadowOffset: { width: 0, height: -2 },
    // shadowRadius: 10,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,

    maxHeight: height * 0.75,   // 🔥 LIMIT
    alignSelf: 'stretch',       // 🔑 IMPORTANT
    overflow: 'hidden',
  },


  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },

  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#A67C2E',
    textAlign: 'left',
    flex: 1,
  },

  subtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
  },

  // ========== SCROLLVIEW STYLES ==========
  scrollViewContainer: {
    flex: 1,
    // height: 60,
    backgroundColor: '#fff',
  },

  scrollContentContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },

  // ========== BUTTON CONTAINER (FIXED BOTTOM) ==========
  buttonContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1EADB',
  },

  buttonCheckIn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    elevation: 5,
  },

  // ========== EXISTING STYLES (KEEP SAME) ==========
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },

  icon: {
    marginRight: 14,
  },

  label: {
    fontSize: 14,
    color: '#000',
  },

  value: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    marginTop: 2,
  },

  button: {
    borderRadius: 50,
    paddingVertical: 10,
    alignItems: 'center',
    width: 50,
    height: 50,
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#C9A24D',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  selfieImage: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#C9A24D',
    marginTop: 20,
    resizeMode: 'contain',
  },

  uploadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },

  uploadLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },

  remarks: {
    color: '#0B0B0B',
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 6,
    height: 80,
    padding: 8,
    marginBottom: 12,
    textAlignVertical: 'top',
  },

  requiredStar: {
    color: 'red',
    fontWeight: '700',
  },

  dropdown: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    width: '100%',
    marginBottom: 12,
  },

  dropdownContainer: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },

  selectedTextStyle: {
    fontSize: 12,
    color: '#000',
  },

  placeholderStyle: {
    fontSize: 14,
    color: '#888',
  },

  itemTextStyle: {
    fontSize: 14,
    color: '#000',
  },
});