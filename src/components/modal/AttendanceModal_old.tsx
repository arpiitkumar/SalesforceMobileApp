import React, { useState, useEffect, useRef } from 'react';
import {
    ActivityIndicator, InteractionManager,
    Modal, View, Text, StyleSheet, TextInput, AppState,
    TouchableOpacity, PermissionsAndroid, Platform, Image, KeyboardAvoidingView, ScrollView
} from 'react-native';
import ImageResizer from 'react-native-image-resizer';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import LinearGradient from 'react-native-linear-gradient';
import Icon from '@react-native-vector-icons/feather';
import moment from 'moment';
import { getCurrentLocation } from '../../utils/getCurrentLocation';
import { Dropdown } from 'react-native-element-dropdown';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../../utils/networkUtils';
import { getAddressFromCoords } from '../../utils/reverseGeocode';
import { showToast } from '../../redux/slices/toastSlice.js'
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from '@react-navigation/native';
import CTextInput from "../customUtilityComponents/CTextInput";
import { launchCamera } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import crashlytics from '@react-native-firebase/crashlytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_LEAVE_OPTIONS = [
    { label: 'Full Day', value: 'Full Day' },
    { label: 'First Half', value: 'First Half' },
    { label: 'Second Half', value: 'Second Half' },
];


if (!Text.defaultProps) Text.defaultProps = {};
if (!TextInput.defaultProps) TextInput.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
TextInput.defaultProps.allowFontScaling = false;

// ============================================================================
// UTILITY FUNCTIONS FOR TIME HANDLING
// ============================================================================

/**
 * Parses a 12-hour time string (e.g., "10:00 AM") to a moment object for today
 * @param {string} timeString - Time in format "HH:MM AM/PM"
 * @returns {moment.Moment} - Moment object representing today at the given time
 */
const parseTimeString = (timeString) => {
    if (!timeString || typeof timeString !== 'string') {
        console.warn('Invalid time string:', timeString);
        return null;
    }
    return moment(timeString, 'hh:mm A');
};

/**
 * Determines the attendance status based on current time and dynamic rules
 * @param {moment.Moment} currentTime - Current time
 * @param {object} attendanceRules - Rules object from backend
 * @returns {object} - { status: 'Present'|'Leave', statusLeave: 'Full Day'|'First Half'|'Second Half', message: string }
 */
const determineAttendanceStatus = (currentTime, attendanceRules) => {
    if (!attendanceRules) {
        return { status: 'Present', statusLeave: '', message: '' };
    }

    try {
        // Parse all time boundaries from backend rules
        const startTime = parseTimeString(attendanceRules.Start_Time__c);
        const warningStartTime = parseTimeString(attendanceRules.Warning_Start_Time__c);
        const warningEndTime = parseTimeString(attendanceRules.Warning_End_Time__c);
        const halfDayStartTime = parseTimeString(attendanceRules.Half_Day_Start_Time__c);
        const halfDayEndTime = parseTimeString(attendanceRules.Half_Day_End_Time__c);
        const fullDayStartTime = parseTimeString(attendanceRules.Full_Day_Start_Time__c);

        console.log('⏱️  Time Boundaries:', {
            startTime: startTime?.format('hh:mm A'),
            warningStartTime: warningStartTime?.format('hh:mm A'),
            warningEndTime: warningEndTime?.format('hh:mm A'),
            halfDayStartTime: halfDayStartTime?.format('hh:mm A'),
            halfDayEndTime: halfDayEndTime?.format('hh:mm A'),
            fullDayStartTime: fullDayStartTime?.format('hh:mm A'),
            currentTime: currentTime.format('hh:mm A'),
        });

        // Priority 1: Check if current time is after Full Day Start Time
        if (currentTime.isSameOrAfter(fullDayStartTime)) {
            return {
                status: 'Leave',
                statusLeave: 'Full Day',
                message: 'Attendance marked as Full Day leave due to late timing.',
            };
        }

        // Priority 2: Check if current time is between Half Day times
        if (currentTime.isBetween(halfDayStartTime, halfDayEndTime, null, '[]')) {
            return {
                status: 'Leave',
                statusLeave: 'First Half',
                message: 'Attendance marked as Half Day leave due to late timing.',
            };
        }

        // Priority 3: Check if current time is in warning window
        if (currentTime.isBetween(warningStartTime, warningEndTime, null, '[]')) {
            return {
                status: 'Present',
                statusLeave: '',
                message: 'You are late to mark attendance.',
            };
        }

        // Default: Mark as Present (on time)
        return {
            status: 'Present',
            statusLeave: '',
            message: '',
        };
    } catch (error) {
        console.error(' Error determining attendance status:', error);
        return { status: 'Present', statusLeave: '', message: '' };
    }
};

/**
 * Validates if a reason is properly filled based on current status
 * @param {string} status - 'Present' or 'Leave'
 * @param {string} statusLeave - Leave duration if applicable
 * @param {string} reason - Selected reason
 * @param {string} otherReason - Custom reason text
 * @returns {object} - { isValid: boolean, message: string }
 */
const validateAttendanceSubmission = (status, statusLeave, reason, otherReason) => {
    if (status === 'Leave') {
        if (!statusLeave || statusLeave.trim() === '') {
            return { isValid: false, message: 'Please select leave type (Full Day, First Half, or Second Half).' };
        }

        if (!reason || reason.trim() === '') {
            return { isValid: false, message: 'Please select a leave reason.' };
        }

        // If "Other" is selected, ensure custom text is provided
        if (reason === 'Other' && (!otherReason || otherReason.trim() === '')) {
            return { isValid: false, message: 'Please enter a custom reason for your leave.' };
        }
    }

    return { isValid: true, message: '' };
};

/**
 * Gets the effective reason (handles "Other" custom input)
 * @param {string} reason - Selected reason
 * @param {string} otherReason - Custom reason if "Other" selected
 * @returns {string} - Effective reason to submit
 */
const getEffectiveReason = (reason, otherReason) => {
    return reason === 'Other' ? (otherReason || '').trim() : (reason || '').trim();
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================


const safeFont = {
    fontFamily: Platform.OS === 'android' ? 'sans-serif' : undefined,
};

const AttendanceModel = ({ visible, onClose }) => {
    const dispatch = useDispatch();
    const scrollRef = useRef(null);
    const isApplyingAutoSelectionRef = useRef(false);
    const userInteractedRef = useRef(false);
    const statusDropdownRef = useRef(null);
    const leaveDropdownRef = useRef(null);
    const reasonDropdownRef = useRef(null);
    const navigation = useNavigation();
    const [selfieUri, setSelfieUri] = useState(null);
    const date = moment().format('YYYY-MM-DD');
    const displayDate = moment().format('DD MMM YYYY');
    const [location, setLocation] = useState('');
    const [users, setUsers] = useState([]);
    const userId = useSelector(state => state.auth.userId);
    const { handleLogout, apiFetch } = useApiFetch();

    // Attendance state management
    const [status, setStatus] = useState('Present');
    const [statusLeave, setStatusLeave] = useState('');
    const [reason, setReason] = useState('');
    const [otherReason, setOtherReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [isPreparingAttendance, setIsPreparingAttendance] = useState(false);
    const [latitudeState, setLatitudeState] = useState('');
    const [longitudeState, setLongitudeState] = useState('');
    const [base64Image, setBase64Image] = useState('');
    // const hasImage = !!base64Image || !!selfieUri;
    const hasImage = !!selfieUri;
    const [leaveOptions, setLeaveOptions] = useState(BASE_LEAVE_OPTIONS);
    const [isStatusLockedAfterWarning, setIsStatusLockedAfterWarning] = useState(false);
    // Backend rules and options
    const [attendanceRules, setAttendanceRules] = useState(null);
    const [options, setOptions] = useState([
        { label: 'Present', value: 'Present' },
        { label: 'Leave', value: 'Leave' },
    ]);
    const [reasonOptions, setReasonOptions] = useState([]);

    // UI state
    const [userInteracted, setUserInteracted] = useState(false);
    const [trainingContentType, setTrainingContentType] = useState('');
    const [trainingContent, setTrainingContent] = useState('');

    // ========================================================================
    // CAMERA PERMISSIONS & IMAGE CAPTURE
    // ========================================================================


    const getLeaveOptionsByTime = (now, attendanceRules) => {
        if (!attendanceRules) return BASE_LEAVE_OPTIONS;

        const warningEndTime = parseTimeString(attendanceRules.Warning_End_Time__c);
        const halfDayStartTime = parseTimeString(attendanceRules.Half_Day_Start_Time__c);
        const halfDayEndTime = parseTimeString(attendanceRules.Half_Day_End_Time__c);
        const fullDayStartTime = parseTimeString(attendanceRules.Full_Day_Start_Time__c);

        // 1️⃣ Warning not over → no restriction
        if (!warningEndTime || now.isSameOrBefore(warningEndTime)) {
            return BASE_LEAVE_OPTIONS;
        }

        // 2️⃣ After warning & during first-half window
        if (
            halfDayStartTime &&
            halfDayEndTime &&
            now.isBetween(halfDayStartTime, halfDayEndTime, null, '[]')
        ) {
            return [
                { label: 'First Half', value: 'First Half' },
                { label: 'Full Day', value: 'Full Day' },
            ];
        }

        // 3️⃣ After first-half → only full day
        if (fullDayStartTime && now.isSameOrAfter(fullDayStartTime)) {
            return [{ label: 'Full Day', value: 'Full Day' }];
        }

        return BASE_LEAVE_OPTIONS;
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

    const generateBase64 = async () => {
        try {
            const resized = await ImageResizer.createResizedImage(
                selfieUri,
                200,
                200,
                'JPEG',
                25
            );
            const base64 = await RNFS.readFile(resized.uri, 'base64');
            if (base64.length > 150000) {
                alert("⚠️ Too large, skipping base64");
                return '';
            }
            return base64;
        } catch (e) {
            crashlytics().recordError(e);
            alert(e)
            console.log('base64', e)
            return '';
        }
    };

    const openCamera = async () => {
        try {
            const hasPermission = await requestCameraPermission();
            if (!hasPermission) return;
            const result = await launchCamera({
                mediaType: 'photo',
                cameraType: 'front',
                quality: 0.2,          // 🔥 reduce more
                maxWidth: 200,
                maxHeight: 200,
                includeBase64: false,
                saveToPhotos: false,
                presentationStyle: 'fullScreen',
            });
            // alert("📸 Camera result:" + JSON.stringify(result));
            // console.log("📸 Camera result:", result);
            if (result.didCancel) return;

            if (result.errorCode) {
                alert(" Camera error:" + JSON.stringify(result.errorMessage));
                return;
            }
            const uri = result.assets?.[0]?.uri;
            if (uri) {
                setSelfieUri(uri);
                await AsyncStorage.setItem('TEMP_SELFIE', uri); // 🔥 MUST
            }

        } catch (err) {
            alert("💥 Camera crash:" + JSON.stringify(err));
            crashlytics().recordError(err);
        }
    };
    useEffect(() => {
        const sub = AppState.addEventListener('change', async (state) => {
            if (state === 'active') {
                const saved = await AsyncStorage.getItem('TEMP_SELFIE');
                if (saved) {
                    setSelfieUri(saved);
                }
            }
        });
        return () => sub.remove();
    }, []);
    // ========================================================================
    // TOAST NOTIFICATIONS
    // ========================================================================

    const showToastvisible = (type, message) => {
        dispatch(showToast({
            message: message,
            type: type,
        }));
    };

    const closeAttendanceDropdowns = () => {
        statusDropdownRef.current?.close?.();
        leaveDropdownRef.current?.close?.();
        reasonDropdownRef.current?.close?.();
    };

    // ========================================================================
    // STATUS CHANGE HANDLER
    // ========================================================================

    const statusSetter = (value) => {
        setStatus(value);
        if (value === 'Present') {
            setStatusLeave('');
            setReason('');
            setOtherReason('');
        }
    };

    // ========================================================================
    // API SUBMISSION
    // ========================================================================

    const submitToApi = async (effectiveReason, base64) => {
        const payload = {
            Id: userId,
            AttendanceStatus: status,
            LeaveDuration: status === 'Leave' ? statusLeave : '',
            AttendanceDate: date,
            Reason: status === 'Leave' ? reason : null,
            GeoLocationLatitude: latitudeState,
            GeoLocationLongitude: longitudeState,
            AttendanceStartTime: moment().format("YYYY-MM-DD HH:mm:ss"),
            base64Content: base64,
            OtherLeaveReason: status === 'Leave' ? effectiveReason : null,
        };

        try {
            const response = await apiFetch('POST', 'attendance-update', payload, 'Custom');

            const publicUrl =
                response?.data?.responseBody?.publicUrl &&
                    String(response.data.responseBody.publicUrl).trim()
                    ? String(response.data.responseBody.publicUrl).trim()
                    : null;

            if (response.status === 'success') {
                console.log('Attendance marked successfully. URL:', publicUrl);
                return { success: true, publicUrl };
            } else {
                console.log(' Failed to mark attendance');
                return { success: false, publicUrl: null };
            }
        } catch (error) {
            console.error(' API submission error:', error);
            return { success: false, publicUrl: null };
        }
    };

    // ========================================================================
    // LOCAL DATABASE SAVE
    // ========================================================================

    const saveLocally = async (apiSuccess, publicUrl = null, effectiveReason, base64) => {
        console.log("💾 Saving locally. apiSuccess:", apiSuccess, "publicUrl:", publicUrl);

        const payload = {
            Sf_Id: `LOCAL_${Date.now()}`,
            User__c: userId,
            AttendanceStatus__c: status,
            GeoLocation__c: `${latitudeState},${longitudeState}`,
            StartTime__c: moment().format("YYYY-MM-DD HH:mm:ss"),
            LeaveDuration__c: status === 'Leave' ? statusLeave : null,
            SelfieURL__c: publicUrl || null,
            AttendanceDate__c: date,
            Reason__c: status === 'Leave' ? reason : null,
            AttendanceBase64: base64,
            CapturedSelfie__c: true,
            Other_Leave_Reason__c: status === 'Leave' ? effectiveReason : null,
            is_locally_changed: true,
            operation_type: "insert",
            last_modified: Date.now(),
            is_synced: apiSuccess ? true : false,
        };

        try {
            const inserted = await UniversalUpdateInsert({
                ObjectName: 'Attendant__c',
                Type: 'insert',
                data: payload,
            });

            if (inserted) {
                console.log('Attendance saved locally');
                return true;
            } else {
                console.log(' Failed to save attendance locally');
                return false;
            }
        } catch (error) {
            console.error(' Local save error:', error);
            return false;
        }
    };

    // ========================================================================
    // MAIN SUBMISSION HANDLER
    // ========================================================================

    const handleAttendanceSubmit = async () => {
        // console.log('longitudeState',longitudeState)
        // console.log('latitudeState',latitudeState)
        // return;
        if (!latitudeState || !longitudeState) {
            showToastvisible(
                'warning',
                'Location is turned off. Turn it on to continue with your daily attendance.'
            );
            return;
        }

        try {
            // Validate: Image is required
            if (!hasImage) {
                showToastvisible('warning', 'Please upload a selfie image before submitting attendance.');
                return;
            }

            // Validate: Reason and leave type if Leave is selected
            const validation = validateAttendanceSubmission(status, statusLeave, reason, otherReason);
            if (!validation.isValid) {
                showToastvisible('warning', validation.message);
                return;
            }

            const effectiveReason = getEffectiveReason(reason, otherReason);

            setLoading(true);

            // Check internet connectivity
            const connected = await isInternetAvailable();
            let apiResult = { success: false, publicUrl: null };
            const base64 = await generateBase64();
            if (connected) {
                apiResult = await submitToApi(effectiveReason, base64);
                if (!apiResult.success) {
                    console.log('⚠️  API failed. Will save locally for sync later.');
                }
            } else {
                console.log('📡 No internet. Saving locally only.');
            }

            // Always attempt to save locally
            const localSuccess = await saveLocally(apiResult.success, apiResult.publicUrl, effectiveReason, base64);
            await AsyncStorage.removeItem('TEMP_SELFIE');
            if (localSuccess) {
                if (!apiResult.success && connected) {
                    showToastvisible('success', 'Saved locally. Will sync when online.');
                } else if (apiResult.success) {
                    showToastvisible('success', 'Attendance marked successfully.');
                }
                if (status === 'Leave') {
                    showToastvisible('info', `You have marked ${statusLeave || 'leave'} for the day.`);
                    if (statusLeave === 'Full Day') {
                        // Optional: Logout after full day leave
                        // handleLogout();
                    }
                }

                console.log('Closing attendance modal...');
                onClose();
            } else {
                showToastvisible('error', 'Failed to save attendance. Please try again.');
            }
        } catch (error) {
            console.error(' Attendance submission error:', error);
            showToastvisible('error', 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    // ========================================================================
    // AUTO-SELECTION LOGIC ON MODAL OPEN
    // ========================================================================

    useEffect(() => {
        const applyAutoSelection = async () => {
            if (!visible || !attendanceRules || isApplyingAutoSelectionRef.current) return;

            let isMounted = true;
            isApplyingAutoSelectionRef.current = true;
            setIsPreparingAttendance(true);

            // Reset all fields when modal opens
            closeAttendanceDropdowns();
            setSelfieUri(null);
            setBase64Image('');
            setReason('');
            setOtherReason('');
            setLoading(false);
            setUserInteracted(false);
            userInteractedRef.current = false;

            try {
                // Get fresh location
                const { latitude, longitude } = await getCurrentLocation();
                if (!isMounted) return;
                setLatitudeState(latitude);
                setLongitudeState(longitude);

                const connected = await isInternetAvailable();
                if (connected) {
                    const addr = await getAddressFromCoords(latitude, longitude);
                    console.log('addr', addr)
                    if (!isMounted) return;
                    setLocation(addr || `Lat: ${latitude}, Long: ${longitude}`);
                } else {
                    if (!isMounted) return;
                    setLocation(`Lat: ${latitude}, Long: ${longitude}`);
                }
            } catch (e) {
                console.warn('⚠️  Location refresh failed on modal open:', e);
            }

            const now = moment();

            // 🎯 Dynamically control Leave Duration options
            const dynamicLeaveOptions = getLeaveOptionsByTime(now, attendanceRules);
            if (!isMounted) return;
            setLeaveOptions(dynamicLeaveOptions);

            // Reset invalid selection if needed
            if (
                status === 'Leave' &&
                statusLeave &&
                !dynamicLeaveOptions.some(o => o.value === statusLeave)
            ) {
                setStatusLeave('');
            }


            // NEW: check if warning time is over
            const warningEndTime = parseTimeString(attendanceRules.Warning_End_Time__c);
            const isWarningOver = warningEndTime ? now.isAfter(warningEndTime) : false;
            setIsStatusLockedAfterWarning(isWarningOver);

            // Determine attendance status based on current time and rules
            if (!userInteractedRef.current) {
                const now = moment();
                const attendanceStatus = determineAttendanceStatus(now, attendanceRules);
                if (!isMounted) return;

                setStatus(attendanceStatus.status);
                setStatusLeave(attendanceStatus.statusLeave);
                closeAttendanceDropdowns();

                if (attendanceStatus.message) {
                    showToastvisible(
                        attendanceStatus.status === 'Leave' ? 'info' : 'warning',
                        attendanceStatus.message
                    );
                }

                console.log('🎯 Auto-selected status:', attendanceStatus);
            }

            isApplyingAutoSelectionRef.current = false;
            if (isMounted) setIsPreparingAttendance(false);

            return () => {
                isMounted = false;
                isApplyingAutoSelectionRef.current = false;
                setIsPreparingAttendance(false);
            };
        };

        let cleanup;
        applyAutoSelection().then(result => {
            cleanup = result;
        });

        return () => {
            closeAttendanceDropdowns();
            if (typeof cleanup === 'function') cleanup();
            isApplyingAutoSelectionRef.current = false;
            setIsPreparingAttendance(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, attendanceRules]);

    // ========================================================================
    // INITIALIZATION: FETCH RULES, OPTIONS & USER DATA
    // ========================================================================

    useEffect(() => {
        const initialize = async () => {
            try {
                setLoading(true);

                // Fetch Attendance Rules
                const AttendanceRuleDataRaw = await UniversalUpdateInsert({
                    ObjectName: 'AttendanceRule',
                    Type: 'get',
                });

                let AttendanceRuleDataTransformed = AttendanceRuleDataRaw?.[0]?.JSON;
                console.log('AttendanceRuleDataTransformed', AttendanceRuleDataTransformed)
                if (typeof AttendanceRuleDataTransformed === 'string') {
                    try {
                        AttendanceRuleDataTransformed = JSON.parse(AttendanceRuleDataTransformed);
                    } catch (e) {
                        console.error(' Failed to parse AttendanceRuleData:', e);
                    }
                }

                setAttendanceRules(AttendanceRuleDataTransformed);
                console.log('📋 Attendance Rules Loaded:', AttendanceRuleDataTransformed);

                // Fetch Picklist Options
                const AllPicklistData = await UniversalUpdateInsert({
                    ObjectName: 'AllDataPicklist',
                    Type: 'get',
                });

                let optionsData = AllPicklistData?.[0]?.OptionsData;

                if (typeof optionsData === 'string') {
                    try {
                        optionsData = JSON.parse(optionsData);
                    } catch (e) {
                        console.error(' Failed to parse OptionsData:', e);
                    }
                }

                // Set leave reason options
                const leaveReasons = optionsData?.AttendanceLeaveReason || [];
                const hasOther = leaveReasons.some(
                    r => r.label?.toLowerCase() === 'other' || r.value?.toLowerCase() === 'other'
                );
                const finalReasons = hasOther
                    ? leaveReasons
                    : [...leaveReasons, { label: 'Other', value: 'Other' }];

                setReasonOptions(finalReasons);

                // Set training content
                setTrainingContent(optionsData?.traningVideo || '');
                setTrainingContentType(optionsData?.traningVideoType || '');

                // Fetch User Data
                const userResult = await UniversalUpdateInsert({
                    ObjectName: 'User',
                    Type: 'get',
                });

                setUsers(userResult);
                console.log('👤 User Data:', userResult);

                // Update attendance status options based on user role
                setOptions(prevOptions => {
                    let newOptions = [...prevOptions];

                    if (userResult?.[0]?.DeveloperName === 'MT_Merchandiser') {
                        if (!newOptions.some(o => o.value === 'Meeting')) {
                            newOptions.push({ label: 'Meeting', value: 'Meeting' });
                        }
                    }

                    if (userResult?.[0]?.DeveloperName === 'MT_SO') {
                        if (!newOptions.some(o => o.value === 'Admin')) {
                            newOptions.push({ label: 'Admin', value: 'Admin' });
                        }
                    }

                    return newOptions;
                });
            } catch (error) {
                console.error(' Initialization error:', error);
                showToastvisible('error', 'Failed to load attendance configuration.');
            } finally {
                setLoading(false);
            }
        };

        initialize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-scroll when Leave is selected
    useEffect(() => {
        if (status === 'Leave') {
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 300);
        }
    }, [status]);

    // ========================================================================
    // RENDER
    // ========================================================================
    const isSubmitDisabled =
        !hasImage ||
        loading ||
        (status === 'Leave' && (
            !statusLeave ||
            !reason.trim() ||
            (reason === 'Other' && !otherReason.trim())
        ));



    return (
        <>
            <Modal visible={visible} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.overlay}
                >
                    <View style={styles.modalContainer}>
                        {/* HEADER ROW */}
                        <View style={styles.headerRow}>
                            <Text style={styles.header}>Confirm Attendance</Text>

                            {(users?.[0]?.DeveloperName === 'MT_SO' ||
                                users?.[0]?.DeveloperName === 'MT_Merchandiser') && (
                                    <TouchableOpacity
                                        style={styles.trainingContainer}
                                        onPress={() => {
                                            onClose();
                                            navigation.navigate('VideoScreen', {
                                                type: trainingContentType,
                                                url: trainingContent,
                                                heading: 'Training Video'
                                            });
                                        }}
                                    >
                                        <Text style={styles.trainingText}>Training Video</Text>
                                        <Icon name="arrow-up" size={20} color="#C9A24D" style={styles.tiltedArrow} />
                                    </TouchableOpacity>
                                )}
                        </View>

                        <Text style={styles.subtext}>System will capture your geo-location.</Text>

                        {/* SCROLL CONTENT */}
                        <ScrollView
                            ref={scrollRef}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >
                            {/* DATE ROW */}
                            <View style={styles.row}>
                                <Icon name="calendar" size={22} color="#C9A24D" style={styles.icon} />
                                <View>
                                    <Text style={styles.label}>Date</Text>
                                    <Text style={styles.value}>{displayDate}</Text>
                                </View>
                            </View>

                            {/* LOCATION ROW */}
                            <View style={styles.row}>
                                <Icon name="map-pin" size={22} color="red" style={styles.icon} />
                                <View>
                                    <Text style={styles.label}>Current Location</Text>
                                    <Text style={[styles.value, { width: 300 }]}>{location}</Text>
                                </View>
                            </View>

                            {/* STATUS DROPDOWN */}
                            <Dropdown
                                ref={statusDropdownRef}
                                data={options}
                                labelField="label"
                                valueField="value"
                                disable={isStatusLockedAfterWarning || isPreparingAttendance}
                                value={status}
                                onChange={item => {
                                    userInteractedRef.current = true;
                                    setUserInteracted(true);
                                    statusSetter(item.value);
                                    closeAttendanceDropdowns();
                                }}
                                style={styles.dropdown}
                                containerStyle={styles.dropdownContainer}
                                inputSearchStyle={styles.searchbox}
                                placeholderStyle={styles.placeholderDropdown}
                                selectedTextStyle={styles.valueDropdown}
                                search
                                searchPlaceholder="Search"
                                itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
                            />

                            {/* LEAVE SECTION (shown when status is Leave) */}
                            {status === 'Leave' && (
                                <>
                                    {/* LEAVE DURATION DROPDOWN */}
                                    <Dropdown
                                        ref={leaveDropdownRef}
                                        data={leaveOptions}

                                        labelField="label"
                                        valueField="value"
                                        value={statusLeave}
                                        placeholder="Select leave duration"
                                        disable={isPreparingAttendance}
                                        onChange={item => {
                                            userInteractedRef.current = true;
                                            setUserInteracted(true);
                                            setStatusLeave(item.value);
                                            closeAttendanceDropdowns();
                                        }}
                                        style={styles.dropdown}
                                        containerStyle={styles.dropdownContainer}
                                        inputSearchStyle={styles.searchbox}
                                        placeholderStyle={styles.placeholderDropdown}
                                        selectedTextStyle={styles.valueDropdown}
                                        search
                                        searchPlaceholder="Search"
                                        itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
                                    />

                                    {/* LEAVE REASON DROPDOWN */}
                                    <Dropdown
                                        ref={reasonDropdownRef}
                                        data={reasonOptions}
                                        labelField="label"
                                        valueField="value"
                                        value={reason}
                                        placeholder="Select reason for leave"
                                        disable={isPreparingAttendance}
                                        onChange={item => {
                                            userInteractedRef.current = true;
                                            setUserInteracted(true);
                                            setReason(item.value);
                                            // Clear custom text when not Other
                                            if (item.value !== 'Other') setOtherReason('');
                                            closeAttendanceDropdowns();
                                        }}
                                        style={styles.dropdown}
                                        containerStyle={styles.dropdownContainer}
                                        inputSearchStyle={styles.searchbox}
                                        placeholderStyle={styles.placeholderDropdown}
                                        selectedTextStyle={styles.valueDropdown}
                                        search
                                        searchPlaceholder="Search"
                                        itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
                                    />
                                    {!reason.trim() && (
                                        <Text style={{ color: 'red', fontSize: 12 }}>
                                            Please select reason for leave
                                        </Text>
                                    )}


                                    {/* CUSTOM REASON INPUT (if "Other" selected) */}
                                    {reason === 'Other' && (
                                        <CTextInput
                                            style={styles.reasonInput}
                                            value={otherReason}
                                            placeholder="Enter other reason*"
                                            placeholderTextColor="#999"
                                            validationType="text"
                                            minValue={1}
                                            onChangeText={t => {
                                                userInteractedRef.current = true;
                                                setUserInteracted(true);
                                                setOtherReason(t);
                                            }}
                                        />

                                    )}
                                    {reason === 'Other' && !otherReason.trim() && (
                                        <Text style={{ color: 'red', fontSize: 12 }}>
                                            Please enter other reason
                                        </Text>
                                    )}

                                </>
                            )}

                            {/* IMAGE UPLOAD */}
                            <View style={styles.uploadRow}>
                                <View>
                                    <Text style={styles.uploadLabel}>
                                        Upload Image <Text style={styles.requiredStar}>*</Text>
                                    </Text>
                                </View>

                                <TouchableOpacity onPress={openCamera}>
                                    <LinearGradient colors={['#C9A24D', '#A67C2E', '#C9A24D']} style={styles.button}>
                                        <Icon name="camera" size={20} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* IMAGE PREVIEW */}
                            {selfieUri && (
                                <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
                            )}
                        </ScrollView>

                        {/* SUBMIT BUTTON */}
                        <TouchableOpacity
                            onPress={handleAttendanceSubmit}
                            // disabled={
                            //     !hasImage ||
                            //     loading ||
                            //     (status === 'Leave' && (!statusLeave || !reason.trim()))
                            // }
                            disabled={isSubmitDisabled}

                            activeOpacity={0.8}
                            style={{ width: '100%', marginBottom: 10 }}
                        >
                            {!isSubmitDisabled ? (
                                <LinearGradient colors={['#C9A24D', '#A67C2E', '#C9A24D']} style={styles.button}>
                                    <Text style={styles.buttonText}>
                                        {loading ? 'Submitting...' : 'Attendance'}
                                    </Text>
                                </LinearGradient>
                            ) : (
                                <View style={[styles.button, styles.buttonDisabled]}>
                                    <Text style={[styles.buttonText, styles.buttonTextDisabled]}>
                                        {loading ? 'Submitting...' : 'Attendance'}
                                    </Text>
                                </View>
                            )}

                        </TouchableOpacity>
                    </View>
                    <LoaderOverlay visible={loading || isPreparingAttendance} />
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: '#00000080',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 14,
        maxHeight: '85%',
    },
    header: {
        fontSize: 18,
        // fontWeight: '600',
        color: '#A67C2E',
        marginBottom: 6,
        ...safeFont
    },
    subtext: { fontSize: 12, color: '#666', marginBottom: 20 },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    icon: { marginRight: 10 },
    label: { fontSize: 12, color: '#888' },
    value: {
        fontSize: 14,
        //  fontWeight: '500',
        ...safeFont,
        color: '#000'
    },
    reasonInput: {
        height: 42,
        paddingHorizontal: 12,
        backgroundColor: '#FBF8F1',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 10,
        marginTop: 4,
        color: '#000',
    },
    button: {
        marginTop: 12,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 12,
        alignItems: 'center',
        elevation: 3,
    },
    buttonText: {
        color: '#fff', fontSize: 15,
        //  fontWeight: 'bold'
        ...safeFont
    },
    dropdown: {
        height: 42,
        paddingHorizontal: 12,
        backgroundColor: '#FBF8F1',
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
    dropdownContainer: { borderRadius: 8, marginTop: -42, paddingVertical: 5 },
    placeholderDropdown: { color: '#7A7266', fontSize: 14 },
    valueDropdown: { color: '#1F1D1A', fontSize: 14 },
    selfieImage: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#C9A24D',
        marginTop: 20,
        resizeMode: 'cover',
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
        // fontWeight: '500'
        ...safeFont
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, borderBottomColor: '#000', borderBottomWidth: 0.5 },
    trainingContainer: { flexDirection: 'row', alignItems: 'center' },
    trainingText: {
        fontSize: 14, color: '#A67C2E',
        // fontWeight: '500', 
        ...safeFont,
        marginRight: 5
    },
    tiltedArrow: { transform: [{ rotate: '45deg' }] },
    requiredStar: {
        color: 'red',
        // fontWeight: '700',
        ...safeFont
    },
    buttonDisabled: {
        backgroundColor: '#bfcbe9',
        opacity: 0.95,
    },
    buttonTextDisabled: {
        color: '#f1f5fb',
    },
});

export default AttendanceModel;
