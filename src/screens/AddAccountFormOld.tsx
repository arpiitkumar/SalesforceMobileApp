import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Keyboard,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
    StatusBar,
    Image,
    PermissionsAndroid,
    ActivityIndicator,
    Modal
} from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from "react-native-responsive-screen";
import HeaderMain from '../components/HeaderMain';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Dropdown } from "react-native-element-dropdown";
import LinearGradient from 'react-native-linear-gradient';

import { useDispatch } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { isInternetAvailable } from '../utils/networkUtils';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import LoaderOverlay from '../utils/helper/LoaderOverlay'
import moment from 'moment'
import { PlaceId_var } from '../../config'
import { launchCamera } from "react-native-image-picker";
import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import Ionicons from "../components/Ionicons";
import { resizeAndConvertImage } from '../utils/helper/resizeAndConvertImage';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Feather from '@react-native-vector-icons/feather';
import Icon from '@react-native-vector-icons/feather';
import { getCurrentLocation } from '../utils/getCurrentLocation';

const generateRandomId = () => {
    const ts = Date.now();
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `ACC-${ts}-${rnd}`;
};

const AccountForm = ({ navigation }) => {
    const { apiFetch } = useApiFetch();
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        pan: '',
        gst: '',
        outletOwnerName: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
    });

    const [outletImage, setOutletImage] = useState(null);

    const dispatch = useDispatch();

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false)
    const [users, setUsers] = useState([])
    const [selectedBeatDay, setSelectedBeatDay] = useState([])
    const [selectedBeatId, setSelecteBeatId] = useState([])
    const [beatDaysId, setBeatDaysId] = useState([])
    const [selectedSubChannel, setSelectedSubChannel] = useState('');
    const [existingAccounts, setExistingAccounts] = useState([]);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    //for pick list values 
    // picklist option arrays
    const [classOptions, setClassOptions] = useState([]);
    const [channelOptions, setChannelOptions] = useState([]);
    const [subChannelOptions, setSubChannelOptions] = useState([])
    const [subChannel2Options, setSubChannel2Options] = useState([]);
    const [subChannel1Options, setSubChannel1Options] = useState([]);

    // selected values
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('');
    const [selectedSubChannel2, setSelectedSubChannel2] = useState('');
    const [selectedSubChannel1, setSelectedSubChannel1] = useState('');





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
            dispatch(showToast({ message: 'Camera permission denied', type: 'error' }));
            return;
        }
        try {
            const result = await launchCamera({
                mediaType: "photo",
                cameraType: "back",
                quality: 0.8,
            });

            if (!result || !result.assets || result.assets.length === 0) return;

            const asset = result.assets[0];
            const originalUri = asset.uri;

            const resized = await ImageResizer.createResizedImage(
                originalUri,
                800,
                800,
                "JPEG",
                80,
                0
            );

            const pathForRead =
                Platform.OS === "ios"
                    ? resized.uri.replace("file://", "")
                    : resized.uri;

            const base64Data = await RNFS.readFile(pathForRead, "base64");

            setOutletImage({
                uri: resized.uri,
                base64: base64Data
            });

        } catch (err) {
            console.log("Camera error", err);
        }
    };


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
                    dispatch(showToast({ message: 'Camera permission denied', type: 'error' }));
                    return;
                }
            } else {
                // iOS
                const status = await Camera.requestCameraPermission();
                if (status !== 'granted') {
                    dispatch(showToast({ message: 'Camera permission denied', type: 'error' }));
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
            const { base64, uri: resizedUri, sizeKB } = await resizeAndConvertImage(photo.path);
            setOutletImage({
                uri: filePath,
                base64: base64
            });
            setShowCamera(false);
        } catch (e) {
            console.log(' Camera Error:', e);
        }
    };

    // normalization helpers
    const normalizeEmail = (v) => (v || '').trim().toLowerCase();
    const normalizePhone = (v) => (v || '').replace(/\D/g, '').trim(); // digits only
    const normalizePAN = (v) => (v || '').trim().toUpperCase();
    const normalizeGST = (v) => (v || '').trim().toUpperCase();

    const [dependentData, setDependentData] = useState(null);

    useEffect(() => {
        const initialize = async () => {
            const usersData = await UniversalUpdateInsert({
                ObjectName: 'User',
                Type: 'get',
            });

            //set(users)
            setUsers(usersData)

            const RoutePlans = await UniversalUpdateInsert({
                ObjectName: "Route_Plans__c",
                Type: "get",
                filters: [
                    { field: 'Assigned_To__c', value: usersData[0].Sf_Id },
                ],
            });
            const todayForRoutePlans = new Date();
            const firstDayOfMonth = new Date(
                todayForRoutePlans.getFullYear(),
                todayForRoutePlans.getMonth(),
                1
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

            const activePlanId = currentMonthRoutePlans[0].Sf_Id;
            // Beat Day for that exact calendar day:

            const BeatDays = await UniversalUpdateInsert({
                ObjectName: "BeatDay__c",
                Type: "get",
            });

            const beatDayForDate = BeatDays.find(
                (b) =>
                    b.Tour_Plan__c === activePlanId && // belongs to the route plan
                    b.BeatDate__c === moment().format('YYYY-MM-DD') // is for the selected date
            );

            if (!beatDayForDate) {
                console.log('No Beat Day found for date', dateStore);
                //dispatch(setSelectedBeatDay(null));

                setSelecteBeatId(null);
                setBeatDaysId(null);

                return; // nothing more to do for this date
            }
            setBeatDaysId(beatDayForDate?.Sf_Id);

            setSelecteBeatId(beatDayForDate?.Beat__c);
            setBeatDaysId(beatDayForDate?.Sf_Id);

            const beatId = beatDayForDate?.Beat__c ?? null;

            const AllPicklistData = await UniversalUpdateInsert({ ObjectName: 'AllDataPicklist', Type: 'get' });
            let optionsObj = null;

            if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
                const raw = AllPicklistData[0]?.OptionsData;
                const dependingData = AllPicklistData[0]?.DependentOptionsData;
                console.log('dependingData', dependingData)
                if (raw) {
                    try {
                        optionsObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    } catch (e) {
                        console.warn('Failed to parse AllDataPicklist.OptionsData, falling back to defaults', e);
                        optionsObj = null;
                    }
                }
            }

            const dependingData = AllPicklistData[0]?.DependentOptionsData;

            if (dependingData) {
                try {
                    const parsed = typeof dependingData === "string"
                        ? JSON.parse(dependingData)
                        : dependingData;

                    setDependentData(parsed);
                } catch (e) {
                    console.log("Dependent parsing error", e);
                }
            }
            // if (optionsObj?.AccountSubChannel) {
            //     setSubChannelOptions(optionsObj.AccountSubChannel);
            // }

            if (optionsObj?.ClassValues) setClassOptions(optionsObj.ClassValues);
            if (optionsObj?.ChannelValues) setChannelOptions(optionsObj.ChannelValues);
            // if (optionsObj?.SubChannel2Values) setSubChannel2Options(optionsObj.SubChannel2Values);
            // if (optionsObj?.SubChannel1Values) setSubChannel1Options(optionsObj.SubChannel1Values);

            const retailerData = await UniversalUpdateInsert({
                ObjectName: 'Account',
                Type: 'get',
            });

            setExistingAccounts(Array.isArray(retailerData) ? retailerData : []);
            console.log('usersData', usersData[0]?.DeveloperName)
            const channelvalue = usersData[0]?.DeveloperName === 'H_T_SR' ? 'Direct' : 'Sub DB';
            setSelectedChannel(channelvalue)
        }

        initialize()
    }, [])




    useEffect(() => {
        if (!selectedChannel || !dependentData) return;
        const subChannels =
            dependentData.channelToSubChannel?.[selectedChannel] || [];
        setSubChannelOptions(subChannels);
        // reset downstream
        setSelectedSubChannel('');
        setSelectedSubChannel1('');
        setSelectedSubChannel2('');
        setSubChannel1Options([]);
        setSubChannel2Options([]);
    }, [selectedChannel]);

    useEffect(() => {
        if (!selectedSubChannel || !dependentData) return;
        const subChannel1 =
            dependentData.subChannelToSubChannel1?.[selectedSubChannel] || [];
        setSubChannel1Options(subChannel1);
        // reset next
        setSelectedSubChannel1('');
        setSelectedSubChannel2('');
        setSubChannel2Options([]);
    }, [selectedSubChannel]);

    useEffect(() => {
        if (!selectedSubChannel1 || !dependentData) return;
        const subChannel2 =
            dependentData.subChannel1ToSubChannel2?.[selectedSubChannel1] || [];
        setSubChannel2Options(subChannel2);
        // reset last
        setSelectedSubChannel2('');
    }, [selectedSubChannel1]);





    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const findDuplicates = (form) => {
        const dupFields = [];
        const e = normalizeEmail(form.email);
        const p = normalizePhone(form.phone);
        const pan = normalizePAN(form.pan);
        const gst = normalizeGST(form.gst);

        // iterate existing accounts
        for (let acc of existingAccounts) {
            if (!acc) continue;
            // field names from your data: Email__c, Phone, PAN_Number__c, GSTIN_Number__c
            if (e && normalizeEmail(acc.Email__c) === e) {
                dupFields.push('Email');
            }
            if (p && normalizePhone(acc.Phone) === p) {
                dupFields.push('Phone');
            }
            if (pan && normalizePAN(acc.PAN_Number__c) === pan) {
                dupFields.push('PAN');
            }
            if (gst && normalizeGST(acc.GSTIN_Number__c) === gst) {
                dupFields.push('GST');
            }
            // if all fields found, break early
            if (dupFields.length >= 4) break;
        }
        // remove dup duplicates (in case multiple accounts match same field)
        return Array.from(new Set(dupFields));
    };


    const validate = () => {
        const newErrors = {};

        // 📌 DROPDOWNS (mandatory)
        if (!selectedSubChannel) {
            newErrors.subChannel = "Sub Channel is required";
        }

        if (!selectedClass) {
            newErrors.class = "Class is required";
        }

        if (!selectedChannel) {
            newErrors.channel = "Channel is required";
        }

        if (!selectedSubChannel1) {
            newErrors.subChannel1 = "Sub Channel 1 is required";
        }

        if (!selectedSubChannel2) {
            newErrors.subChannel2 = "Sub Channel 2 is required";
        }

        // 📌 SUB CHANNEL (required)
        // if (!selectedSubChannel) {
        //     newErrors.subChannel = "Sub Channel is required";
        // }
        // if (!selectedClass) newErrors.class = 'Class is required';
        // if (!selectedChannel) newErrors.channel = 'Channel is required';

        // 📌 NAME (required)
        if (!formData.name.trim()) {
            newErrors.name = "Name is required";
        }

        if (!formData.outletOwnerName.trim()) {
            newErrors.outletOwnerName = "Outlet Owner Name is required";
        }

        // 📌 PHONE (required)
        if (!formData.phone.trim()) {
            newErrors.phone = "Phone number is required";
        } else if (!/^[6-9]\d{9}$/.test(formData.phone)) {
            newErrors.phone = "Invalid phone number";
        }

        // if (!formData.email.trim()) {
        //     newErrors.email = "Email number is required";
        // }
        // if (!formData.pan.trim()) {
        //     newErrors.pan = "PAN number is required";
        // }
        // if (!formData.gst.trim()) {
        //     newErrors.gst = "GST number is required";
        // }
        if (!formData.street.trim()) {
            newErrors.street = "Street is required";
        }

        if (!formData.city.trim()) {
            newErrors.city = "City is required";
        }

        if (!formData.postalCode.trim()) {
            newErrors.postalCode = "Postal Code is required";
        }

        if (!formData.state.trim()) {
            newErrors.state = "State is required";
        }


        // 📌 EMAIL (optional, validate only if entered)
        if (
            formData.email.trim() &&
            !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(formData.email)
        ) {
            newErrors.email = "Invalid email address";
        }

        // 📌 PAN (optional, validate only if entered)
        if (
            formData.pan.trim() &&
            !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(formData.pan)
        ) {
            newErrors.pan = "Invalid PAN number";
        }

        // 📌 GST (optional, validate only if entered)
        if (
            formData.gst.trim() &&
            !/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/.test(formData.gst)
        ) {
            newErrors.gst = "Invalid GST number";
        }

        if (!outletImage) {
            newErrors.outletImage = "Outlet Image is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    useEffect(() => {
        const getLocation = async () => {
            const { latitude, longitude } = await getCurrentLocation();
        }
        getLocation()
    }, [])


    // console.log('selectedBeatId',selectedBeatId)
    // console.log('beatDaysId',beatDaysId)
    const handleSubmit = async () => {
        console.log('this is in submit')
        if (!validate()) return;

        // Duplicate check — block and show toast
        const duplicates = findDuplicates(formData);
        if (duplicates.length) {
            dispatch(showToast({
                message: `${duplicates.join(', ')} already exist. Please correct before saving.`,
                type: 'warning'
            }));
            return; // stop submit
        }
        setLoading(true);

        const { latitude, longitude } = await getCurrentLocation();
        // console.log(latitude,longitude)
        // return;
        const getRequiredData = async () => {
            try {
                const AllPicklistData = await UniversalUpdateInsert({
                    ObjectName: 'AllDataPicklist',
                    Type: 'get',
                });

                const recordTypeId = AllPicklistData && AllPicklistData[0]?.OptionsData
                    ? JSON.parse(AllPicklistData[0].OptionsData).accountRecordTypeId
                    : null;

                console.log('Extracted recordTypeId:', recordTypeId);
                return recordTypeId;

                console.log(AllPicklistData)
            } catch (e) {
                console.log('could not get the data')
            }
        }

        const recordTypeId = await getRequiredData();

        //return



        setLoading(true);
        let accountId = generateRandomId();
        let image1 = null;
        let visitId = generateRandomId();
        let isFromApi = false;
        let isVisitFromApi = false;

        try {
            const connected = await isInternetAvailable();
            const currentDate = new Date().toISOString().slice(0, 10);
            // 1️⃣ If online, try the API first
            if (connected) {
                const payload = {
                    apiName: 'Account',
                    fields: {
                        Name: formData.name,
                        Outlet_Owner_Name__c: formData.outletOwnerName,
                        Phone: formData.phone,
                        Email__c: formData.email,
                        PAN_Number__c: formData.pan,
                        GSTIN_Number__c: formData.gst,
                        RecordTypeId: recordTypeId,
                        // SubChannel__c: selectedSubChannel,        // existing
                        // Beat__c: selectedBeatId,
                        BillingCity: formData.city,
                        BillingPostalCode: formData.postalCode,
                        BillingState: formData.state,
                        BillingStreet: formData.street,
                        BillingCountry: 'India',
                        Type: 'Retailer',
                        OTPVerified__c: 'No',
                        OTPVerifiedDate__c: moment().format('YYYY-MM-DD'),
                        Account_Approve__c: false,
                        // <-- newly added fields:
                        Class__c: selectedClass || null,
                        Channel__c: selectedChannel || null,      // or DBType__c depending on mapping
                        // SubChannel1__c: selectedSubChannel1 || null,
                        // SubChannel2__c: selectedSubChannel2 || null,
                        // DBType__c: selectedChannel || null,    
                        Account_Location_Latitude__Latitude__s: latitude || 0,
                        Account_Location_Longitude__Longitude__s: longitude || 0,
                    },
                };


                console.log(payload)
                //return

                const response = await apiFetch('POST', 'records', payload, 'standard');
                console.log('response::::', JSON.stringify(response))
                if (response.status === 'success' && response.data?.id) {
                    console.log('API create account successful, now in visits', response.data?.id)
                    accountId = response.data?.id;
                    console.log('New Account ID from API:', accountId);
                    isFromApi = true;
                    console.log('account created on the server')
                    const currentDate = new Date().toISOString().slice(0, 10);
                    //create a visit if api is successful

                    const payloadiamge = {
                        AccountId: accountId,
                        FIFODone: null,
                        HiredType: null,
                        Visibility: null,
                        VisibilityImage: outletImage?.base64,
                        fileNamePrefix1: 'outletImage.png',
                        OtherPromotionActivity: null,
                        OtherPromotionActivity2: null,
                        fileNamePrefix2: null,
                        fileNamePrefix3: null,
                    };
                    const responseiamge = await apiFetch('POST', 'updateAccount', payloadiamge, 'Custom');
                    if (responseiamge?.data?.status === 'success') {
                        image1 = responseiamge.data?.responseBody?.publicUrl1 || null;
                    }

                    console.log('API create account successful, now in visits')
                    const visitPayload = {
                        apiName: 'Visit',
                        fields: {
                            Beat__c: selectedBeatId,

                            BeatDay__c: beatDaysId,
                            VisitDate__c: currentDate,
                            AccountId: accountId,
                            VisitStatus__c: 'Planned',
                            Add_New_Retailer_Visit__c: true,

                            PlaceId__c: PlaceId_var,
                            PlannedVisitStartTime: new Date().toISOString(),
                        },
                    };

                    console.log('visit payload', visitPayload)
                    const visitResponse = await apiFetch('POST', 'records', visitPayload, 'standard');
                    console.log('Visit response::::', JSON.stringify(visitResponse))

                    if (visitResponse.status === 'success' && visitResponse.data?.id) {
                        visitId = visitResponse.data?.id;
                        console.log('New Visit ID from API:', visitId);
                        isVisitFromApi = true;
                    }

                    // return
                    //dispatch(showToast({ message: 'Account created on server', type: 'success' }));
                } else {
                    console.log('API create account failed...')
                    //dispatch(showToast({ message: 'API create failed, saved locally', type: 'warning' }));
                }
            } else {
                console.log('no internet saving locally')
                dispatch(showToast({ message: 'No internet — for saving', type: 'warning' }));
                return;
            }

            if (!isFromApi) throw new Error
            if (isFromApi === true) {
                // 2️⃣ Persist locally (flags let you reconcile later)
                await UniversalUpdateInsert({
                    ObjectName: 'Account',
                    Type: 'insert',
                    data: {
                        Sf_Id: accountId,
                        Name: formData.name,
                        Outlet_Owner_Name__c: formData.outletOwnerName,
                        Phone: formData.phone,
                        Email__c: formData.email,
                        PAN_Number__c: formData.pan,
                        GSTIN_Number__c: formData.gst,
                        RecordTypeId: recordTypeId,
                        is_locally_changed: !isFromApi,
                        is_synced: isFromApi,
                        // SubChannel__c: selectedSubChannel,
                        // Beat__c: selectedBeatId,
                        BillingCity: formData.city,
                        BillingPostalCode: formData.postalCode,
                        BillingState: formData.state,
                        BillingStreet: formData.street,
                        BillingCountry: 'India',
                        Type: 'Retailer',
                        Class__c: selectedClass,
                        Channel__c: selectedChannel,
                        // SubChannel1__c: selectedSubChannel1,
                        // SubChannel2__c: selectedSubChannel2,
                        // OTPVerified__c: 'Yes',
                        OTPVerified__c: 'No',
                        Account_Approve__c: false,
                        Visibility_Image__c: image1 ? image1 : outletImage?.base64,
                        OTPVerifiedDate__c: moment().format('YYYY-MM-DD'),
                        BillingAddress: formData.street + ',' + formData.city + ',' + formData.state + ',' + formData.postalCode,
                        BillingLongitude: longitude || 0,
                        BillingLatitude: latitude || 0,
                        // DBType__c: selectedChannel, 
                        operation_type: isFromApi ? null : 'insert',
                        last_modified: Date.now(),
                    }
                });



                await UniversalUpdateInsert({
                    ObjectName: 'Visit',
                    Type: 'insert',
                    data: {
                        Sf_Id: visitId,
                        Beat__c: selectedBeatId,
                        BeatDay__c: beatDaysId,
                        VisitDate__c: currentDate,
                        AccountId: accountId,
                        VisitStatus__c: 'Planned',
                        Add_New_Retailer_Visit__c: true,
                        PlaceId__c: PlaceId_var,
                        PlannedVisitStartTime: new Date().toISOString(),

                        is_locally_changed: !isFromApi,
                        is_synced: isFromApi,

                        operation_type: isFromApi ? null : 'insert',
                        last_modified: Date.now(),
                    }
                });
            }


            setLoading(false)
            dispatch(showToast({ message: 'Retailer saved.', type: 'success' }));

            navigation.goBack();

        } catch (err) {
            setLoading(false)
            alert('AccountForm error: ' + JSON.stringify(err));
            // console.error('AccountForm error:', err);
            dispatch(showToast({ message: 'Failed to create Account', type: 'error' }));
        } finally {
            setLoading(false);
        }
    };

    // const handleChange = (field, value) => {
    //     setFormData(prev => ({ ...prev, [field]: value }));
    // };

    const handleChange = (field, value) => {
        // if (field === 'name') {
        //     value = value.replace(/[^a-zA-Z\s]/g, '');
        // }
        if (field === 'outletOwnerName') {
            value = value.replace(/[^a-zA-Z\s]/g, '');
        }

        if (field === 'outletOwnerName') {
            // Allow only letters and spaces
            value = value.replace(/[^a-zA-Z\s]/g, '');
        }
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const fields = [
        { key: 'name', label: 'Name', keyboardType: 'default' },
        { key: 'outletOwnerName', label: 'Outlet Owner Name', keyboardType: 'default' },
        { key: 'phone', label: 'Phone', keyboardType: 'phone-pad' },
        { key: 'email', label: 'Email', keyboardType: 'email-address' },
        { key: 'pan', label: 'PAN Number', keyboardType: 'default' },
        { key: 'gst', label: 'GST Number', keyboardType: 'default' },
        { key: 'street', label: 'Billing Street', keyboardType: 'default' },
        { key: 'city', label: 'Billing City', keyboardType: 'default' },
        { key: 'postalCode', label: 'Billing Postal Code', keyboardType: 'default' },
        { key: 'state', label: 'Billing State', keyboardType: 'default' },


    ];

    const addressFields = [
        { key: 'street', label: 'Street' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'postalCode', label: 'Postal Code', keyboardType: 'numeric' },
        { key: 'country', label: 'Country' },
    ];

    return (
        <>
            <SafeAreaProvider style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
                <View style={styles.headerContainer}>
                    <HeaderMain screenName="Add Retailer" />
                </View>

                <View style={{
                    flex: 1,
                    backgroundColor: 'white',
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20
                }}>
                    {loading && (
                        <View style={{
                            flex: 1,
                            justifyContent: "center",
                            alignItems: "center"
                        }}>
                            <LoaderOverlay visible={loading} message="Saving retailer..." />
                        </View>
                    )}

                    {!loading && (
                        <ScrollView
                            style={{ padding: 15 }}
                            contentContainerStyle={{ paddingBottom: 300 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            {fields.map(({ key, label, keyboardType }) => (
                                <View key={key} style={styles.qCard}>
                                    <Text style={styles.label}>{label} {(label === "Email" || label === "PAN Number" || label === "GST Number") ? null : <Text style={{ color: 'red', marginLeft: 2 }}>*</Text>} </Text>
                                    <TextInput
                                        style={[styles.container, { padding: 8 }]}
                                        value={formData[key]}
                                        onChangeText={val => handleChange(key, val)}
                                        keyboardType={keyboardType}
                                        placeholder={`Enter ${label}`}
                                        placeholderTextColor="#999"
                                    />
                                    {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                                </View>
                            ))}


                            {/* Class (Class__c) */}
                            <View style={styles.qCard}>
                                <Text style={styles.label}>
                                    Class <Text style={{ color: 'red' }}>*</Text>
                                </Text>

                                <Dropdown
                                    data={classOptions}
                                    labelField="label"
                                    valueField="value"
                                    style={styles.dropdown}
                                    containerStyle={styles.dropdownContainer}
                                    inputSearchStyle={styles.searchbox}
                                    placeholderStyle={styles.placeholderDropdown}
                                    selectedTextStyle={styles.valueDropdown}
                                    placeholder="Select Class"
                                    search
                                    searchPlaceholder={"Search"}
                                    value={selectedClass}
                                    onChange={(item) => setSelectedClass(item.value)}
                                />

                                {errors.class && <Text style={styles.error}>{errors.class}</Text>}
                            </View>


                            {/* Channel / DBType (Channel__c / DBType__c) */}
                            <View style={styles.qCard}>
                                <Text style={styles.label}>
                                    Channel <Text style={{ color: 'red' }}>*</Text>
                                </Text>

                                <Dropdown
                                    data={channelOptions}
                                    labelField="label"
                                    valueField="value"
                                    style={styles.dropdown}
                                    containerStyle={styles.dropdownContainer}
                                    inputSearchStyle={styles.searchbox}
                                    placeholderStyle={styles.placeholderDropdown}
                                    selectedTextStyle={styles.valueDropdown}
                                    placeholder="Select Channel / DB Type"
                                    search
                                    searchPlaceholder={"Search"}
                                    value={selectedChannel}
                                    onChange={(item) => setSelectedChannel(item.value)}
                                    disable={true}
                                />

                                {errors.channel && <Text style={styles.error}>{errors.channel}</Text>}
                            </View>

                            {/* Sub Channel Dropdown */}
                            <View style={styles.qCard}>
                                <Text style={styles.label}>Select Sub Channel <Text style={{ color: 'red', marginLeft: 2 }}>*</Text> </Text>
                                <Dropdown
                                    data={subChannelOptions}
                                    labelField="label"
                                    valueField="value"
                                    style={styles.dropdown}
                                    containerStyle={styles.dropdownContainer}
                                    inputSearchStyle={styles.searchbox}
                                    placeholderStyle={styles.placeholderDropdown}
                                    selectedTextStyle={styles.valueDropdown}
                                    placeholder="Select Sub Channel"
                                    search
                                    searchPlaceholder={"Search"}
                                    value={selectedSubChannel}
                                    onChange={(item) => setSelectedSubChannel(item.value)}
                                    disable={!selectedChannel}
                                />
                                {errors['subChannel'] && <Text style={styles.error}>{errors['subChannel']}</Text>}
                            </View>



                            {/* Sub Channel 1 (SubChannel1__c) */}
                            <View style={styles.qCard}>
                                <Text style={styles.label}>
                                    Sub Channel 1 <Text style={{ color: 'red' }}>*</Text>
                                </Text>

                                <Dropdown
                                    data={subChannel1Options}
                                    labelField="label"
                                    valueField="value"
                                    style={styles.dropdown}
                                    containerStyle={styles.dropdownContainer}
                                    inputSearchStyle={styles.searchbox}
                                    placeholderStyle={styles.placeholderDropdown}
                                    selectedTextStyle={styles.valueDropdown}
                                    placeholder="Select Sub Channel 1"
                                    search
                                    searchPlaceholder={"Search"}
                                    value={selectedSubChannel1}
                                    onChange={(item) => setSelectedSubChannel1(item.value)}
                                    disable={!selectedSubChannel}
                                />

                                {errors.subChannel1 && <Text style={styles.error}>{errors.subChannel1}</Text>}
                            </View>


                            {/* Sub Channel 2 (SubChannel2__c) */}
                            <View style={styles.qCard}>
                                <Text style={styles.label}>
                                    Sub Channel 2 <Text style={{ color: 'red' }}>*</Text>
                                </Text>

                                <Dropdown
                                    data={subChannel2Options}
                                    labelField="label"
                                    valueField="value"
                                    style={styles.dropdown}
                                    containerStyle={styles.dropdownContainer}
                                    inputSearchStyle={styles.searchbox}
                                    placeholderStyle={styles.placeholderDropdown}
                                    selectedTextStyle={styles.valueDropdown}
                                    placeholder="Select Sub Channel 2"
                                    search
                                    searchPlaceholder={"Search"}
                                    value={selectedSubChannel2}
                                    onChange={(item) => setSelectedSubChannel2(item.value)}
                                    disable={!selectedSubChannel1}
                                />

                                {errors.subChannel2 && <Text style={styles.error}>{errors.subChannel2}</Text>}
                            </View>

                            <View style={styles.qCard}>
                                <Text style={styles.label}>
                                    Outlet Image <Text style={{ color: 'red' }}>*</Text>
                                </Text>

                                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                                    <TouchableOpacity
                                        style={styles.uploadBox}
                                        onPress={openCamera}
                                    >
                                        <Ionicons name="camera" size={24} />
                                    </TouchableOpacity>

                                    {outletImage && (
                                        <View style={{ marginLeft: 10 }}>
                                            <Image
                                                source={{ uri: outletImage.uri }}
                                                style={{ width: 60, height: 60, borderRadius: 8 }}
                                            />
                                        </View>
                                    )}
                                </View>

                                {errors.outletImage && (
                                    <Text style={styles.error}>{errors.outletImage}</Text>
                                )}
                            </View>


                        </ScrollView>
                    )}

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


                    {!keyboardVisible && (
                        <TouchableOpacity
                            style={styles.footer}
                            onPress={() => { handleSubmit(); }}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.footerInner}
                            >
                                <Text style={styles.footerText}>
                                    {loading ? 'Saving...' : 'Save'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                </View>
            </SafeAreaProvider>
        </>
    );
};

export default AccountForm;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#A67C2E',
    },
    headerContainer: {
        backgroundColor: '#A67C2E',
    },
    container: {
        width: "100%",
        alignSelf: "center",
        borderColor: "#BEBEBE",
        borderWidth: 1,
        borderRadius: 8,
        backgroundColor: "#fff",
        height: 38,
        justifyContent: "center",
    },
    qCard: {
        backgroundColor: "#fff",
        marginBottom: 10,
        padding: 10,
        borderRadius: 8,
        margin: 1,
        // iOS Shadow
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        // Android Shadow
        elevation: 4,
    },
    label: {
        fontSize: 12,
        color: "#000",
        marginBottom: 4,
        fontWeight: "500",
    },
    error: {
        color: 'red',
        fontSize: 12,
        marginTop: 4,
    },
    dropdown: {
        height: 38,
        paddingHorizontal: 12,
        backgroundColor: "#FBF8F1",
        borderColor: "#ccc",
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 10,
        marginTop: 4,
        color: "#000",
    },
    searchbox: {
        borderWidth: 0,
        backgroundColor: "transparent",
        fontSize: 14,
        paddingLeft: 4,
        borderBottomWidth: 0.2,
        borderColor: "gray",
        height: 40,
    },
    dropdownContainer: {
        borderRadius: 8,
        marginTop: -40,
        paddingVertical: 5
    },
    placeholderDropdown: {
        color: "#7A7266",
        fontSize: 14
    },
    valueDropdown: {
        color: "#1F1D1A",
        fontSize: 14
    },
    footer: {
        position: "absolute",
        bottom: 30,
        marginHorizontal: 15,
        left: 0,
        right: 0,
        height: 50,
    },
    footerInner: {
        flex: 1,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    footerText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600"
    },
    uploadBox: {
        width: 60,
        height: 60,
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
});