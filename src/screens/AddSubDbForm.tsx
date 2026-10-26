import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
    StatusBar,
    Keyboard,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import HeaderMain from '../components/HeaderMain';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Dropdown } from "react-native-element-dropdown";
import { useDispatch } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { isInternetAvailable } from '../utils/networkUtils';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import LoaderOverlay from '../utils/helper/LoaderOverlay';
import LinearGradient from 'react-native-linear-gradient';

const generateRandomId = () => {
    const ts = Date.now();
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `ACC-${ts}-${rnd}`;
};

const AddSubDbForm = ({ navigation }) => {
    const { apiFetch, fetchRecords } = useApiFetch();
    const dispatch = useDispatch();
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        pan: '',
        gst: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [subChannelOptions, setSubChannelOptions] = useState([]);
    const [selectedSubChannel, setSelectedSubChannel] = useState('');

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

    const [superOptions, setSuperOptions] = useState([]);
    const [selectedSuper, setSelectedSuper] = useState('');
    const [ASOOptions, setASOOptions] = useState([]);
    const [selectedASO, setSelectedASO] = useState('');
    const [SUBDBReplaceOptions, setSUBDBReplaceOptions] = useState([]);
    const [selectedSUBDBReplace, setSelectedSUBDBReplace] = useState('');
    const [isReplaceSubDB, setIsReplaceSubDB] = useState(false);


    useEffect(() => {
        const initialize = async () => {
            const usersData = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });
            setUsers(usersData);

            const superData = await UniversalUpdateInsert({
                ObjectName: 'Line_SR_Distributor_Mapping__c', Type: 'get', filters: [
                    { field: 'SR__c', value: usersData[0].Sf_Id },
                    { field: 'DBType__c', value: 'Super' },
                ],
            });
            const uniqueDistributorsMap = {};
            superData.forEach(item => {
                if (!item.Distributor__c) return;
                if (!uniqueDistributorsMap[item.Distributor__c]) {
                    uniqueDistributorsMap[item.Distributor__c] = {
                        label: item.Distributor__Name + ' (' + item.Distributor__PartyCode__c + ')',   // abhi ID, baad me name laga sakte ho
                        value: item.Distributor__c,
                    };
                }
            });
            const distributorDropdownList = Object.values(uniqueDistributorsMap);
            // console.log('distributorDropdownList', distributorDropdownList);
            // console.log('usersData[0].Sf_Id', usersData[0].Sf_Id);
            setSuperOptions(distributorDropdownList);


            const AsoData = await UniversalUpdateInsert({
                ObjectName: 'so_users', Type: 'get',
                // filters: [
                // { field: 'User_Type__c', value: 'H_T_ASO' },
                // ],
            });
            const uniqueAsoOptions = Object.values(
                AsoData.reduce((acc, item) => {
                    if (!item.Sf_Id || !item.Name) return acc;
                    acc[item.Sf_Id] = {
                        label: item.Name + ' (' + item.EmployeeCode__c + ')',
                        value: item.Sf_Id,
                    };
                    return acc;
                }, {})
            );
            // console.log('uniqueAsoOptions', uniqueAsoOptions);
            setASOOptions(uniqueAsoOptions)

        };
        initialize();
    }, []);


    useEffect(() => {
        const getSUBDB = async () => {
            if (selectedSuper) {
                // console.log('selectedSuper',selectedSuper)
                const SUBDBData = await UniversalUpdateInsert({
                    ObjectName: 'Account', Type: 'get',
                    filters: [
                        { field: 'ParentId', value: selectedSuper },
                    ],
                });
                const uniqueSubDBOptions = Object.values(
                    SUBDBData.reduce((acc, item) => {
                        if (!item.Sf_Id || !item.Name) return acc;
                        acc[item.Sf_Id] = {
                            label: item.Name + ' (' + item.PartyCode__c + ')',
                            value: item.Sf_Id,
                        };
                        return acc;
                    }, {})
                );
                console.log('uniqueSubDBOptions', uniqueSubDBOptions);
                setSUBDBReplaceOptions(uniqueSubDBOptions)
            } else {
                setSUBDBReplaceOptions([])
            }
        };
        getSUBDB();
    }, [selectedSuper]);

    const validate = () => {
        const newErrors = {};

        // 📌 SUB CHANNEL
        // if (!selectedSubChannel) {
        //     newErrors.subChannel = "Sub Channel is required";
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

        // 📌 NAME
        if (!formData.name.trim()) {
            newErrors.name = "Name is required";
        }

        // 📌 PHONE
        if (!formData.phone.trim()) {
            newErrors.phone = "Phone number is required";
        }
        else if (!/^[6-9]\d{9}$/.test(formData.phone)) {
            newErrors.phone = "Invalid phone number";
        }

        if (formData.email.trim()) {

            if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(formData.email)) {
                newErrors.email = "Invalid email address";
            }
        }

        // 📌 PAN
        if (!formData.pan.trim()) {
            newErrors.pan = "PAN is required";
        }
        else if (!/[A-Z]{5}[0-9]{4}[A-Z]/.test(formData.pan)) {
            newErrors.pan = "Invalid PAN number";
        }

        if (formData.gst.trim()) {
            if (!/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/.test(formData.gst)) {
                newErrors.gst = "Invalid GST number";
            }
        }
        if (!selectedSuper) {
            newErrors.super = 'Super Distributor is required';
        }
        // if (!selectedASO) {
        //     newErrors.aso = 'ASO is required';
        // }

        if (isReplaceSubDB && !selectedSUBDBReplace) {
            newErrors.replaceSubDB = 'Replace Sub DB is required';
        }

        // 📌 GST
        // if (!formData.gst.trim()) {
        //     newErrors.gst = "GST is required";
        // }
        // else if (!/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/.test(formData.gst)) {
        //     newErrors.gst = "Invalid GST number";
        // }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const getRequiredData = async () => {

        try {
            const AllPicklistData = await UniversalUpdateInsert({ ObjectName: 'AllDataPicklist', Type: 'get' });
            // console.log(JSON.parse(AllPicklistData[0].OptionsData))
            return AllPicklistData && AllPicklistData[0]?.OptionsData
                ? JSON.parse(AllPicklistData[0].OptionsData).subDbRecordTypeId
                : null;
        } catch {
            return null;
        }
    };


    const handleSubmit = async () => {

        const recordTypeId = await getRequiredData();

        if (!validate()) return;
        //   console.log("RECORD TYPE ID", recordTypeId)
        //         return;

        setLoading(true);
        let accountId = generateRandomId();
        let isFromApi = false;

        try {
            const connected = await isInternetAvailable();
            if (connected) {
                const existingAccountPhone = await fetchRecords(
                    'Account',
                    `SELECT Id
                                        FROM Account
                                        WHERE Phone='${formData.phone}'
                                        LIMIT 1`
                );
                // console.log('existingAccountPhone',JSON.stringify(existingAccountPhone))
                if (existingAccountPhone && existingAccountPhone.length > 0) {
                    dispatch(showToast({
                        message: 'Same phone number already exist. Please correct before saving.',
                        type: 'warning'
                    }));
                    setLoading(false);
                    console.log('Same phone number already exist. Please correct before saving.')
                    return;
                }


                const existingAccount = await fetchRecords(
                    'Account',
                    `SELECT Id
                                        FROM Account
                                        WHERE Name='${formData.name}'
                                        AND Phone='${formData.phone}'
                                        AND RecordTypeId='${recordTypeId}'
                                        AND BillingCity='${formData.city}'
                                        AND BillingPostalCode='${formData.postalCode}'
                                        AND BillingState='${formData.state}'
                                        AND BillingStreet='${formData.street}'
                                        AND PAN_Number__c='${formData.pan}'
                                        AND BillingCountry='India'
                                        AND Type='Sub Distributor'
                                        AND DBType__c='SUB DB'
                                        AND CreatedById='${users[0]?.Sf_Id}'
                                        LIMIT 1`
                );
                // console.log('existingAccount',JSON.stringify(existingAccount))
                if (existingAccount && existingAccount.length > 0) {
                    dispatch(showToast({
                        message: 'Same account already exists',
                        type: 'warning'
                    }));
                    setLoading(false);
                    console.log('Same account already exists')
                    return;
                }


                const payload = {
                    apiName: 'Account',
                    fields: {
                        Name: formData.name,
                        Phone: formData.phone,
                        Email__c: formData.email,
                        PAN_Number__c: formData.pan,
                        GSTIN_Number__c: formData.gst,
                        RecordTypeId: recordTypeId,
                        Type: 'Sub Distributor',
                        BillingCity: formData.city,
                        BillingPostalCode: formData.postalCode,
                        BillingState: formData.state,
                        BillingStreet: formData.street,
                        BillingCountry: 'India',
                        ParentId: selectedSuper,
                        DBType__c: 'SUB DB',
                        Replace_SubDb__c: isReplaceSubDB ? selectedSUBDBReplace : null,
                        // BillingAddress: formData.street + ',' + formData.city + ',' + formData.state + ',' + formData.postalCode,
                    },
                };

                const response = await apiFetch('POST', 'records', payload, 'standard');
                if (response.status === 'success' && response.data?.id) {
                    accountId = response.data.id;
                    isFromApi = true;
                }
            } else {
                console.log('no internet saving locally')
                dispatch(showToast({ message: 'No internet — for saving', type: 'warning' }));
                return;
            }

            await UniversalUpdateInsert({
                ObjectName: 'Account',
                Type: 'insert',
                data: {
                    Sf_Id: accountId,
                    Name: formData.name,
                    Phone: formData.phone,
                    Email__c: formData.email,
                    PAN_Number__c: formData.pan,
                    GSTIN_Number__c: formData.gst,
                    RecordTypeId: recordTypeId,
                    Type: 'Sub Distributor',
                    BillingCity: formData.city,
                    BillingPostalCode: formData.postalCode,
                    BillingState: formData.state,
                    BillingStreet: formData.street,
                    BillingCountry: 'India',
                    ParentId: selectedSuper,
                    DBType__c: 'SUB DB',
                    Replace_SubDb__c: isReplaceSubDB ? selectedSUBDBReplace : null,
                    BillingAddress: formData.street + ',' + formData.city + ',' + formData.state + ',' + formData.postalCode,
                    is_locally_changed: !isFromApi,
                    is_synced: isFromApi,
                    operation_type: isFromApi ? null : 'insert',
                    last_modified: Date.now(),
                }
            });

            setLoading(false);
            dispatch(showToast({ message: 'Sub DB Scouting saved.', type: 'success' }));
            navigation.goBack();
        } catch (err) {
            setLoading(false);
            dispatch(showToast({ message: 'Unexpected error', type: 'error' }));
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const fields = [
        { key: 'name', label: 'Name', keyboardType: 'default', isRequired: true },
        { key: 'phone', label: 'Phone', keyboardType: 'phone-pad', isRequired: true },
        { key: 'email', label: 'Email', keyboardType: 'email-address', isRequired: false },
        { key: 'pan', label: 'PAN Number', keyboardType: 'default', isRequired: true },
        { key: 'gst', label: 'GST Number', keyboardType: 'default', isRequired: false },
        { key: 'street', label: 'Billing Street', keyboardType: 'default', isRequired: true },
        { key: 'city', label: 'Billing City', keyboardType: 'default', isRequired: true },
        { key: 'postalCode', label: 'Billing Postal Code', keyboardType: 'default', isRequired: true },
        { key: 'state', label: 'Billing State', keyboardType: 'default', isRequired: true },
    ];

    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Sub DB Onboarding" />
            </View>

            <View style={styles.formContainer}>
                <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                    {fields.map(({ key, label, keyboardType, isRequired }) => (
                        <>
                            <View key={key} style={styles.qCard}>
                                <Text style={styles.label}>{label} {isRequired && <Text style={{ color: 'red', marginLeft: 2 }}>*</Text>} </Text>
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
                            {key === 'gst' && (
                                <>
                                    {/* 🔹 ASO Dropdown */}
                                    {/* <View style={styles.qCard}>
                                        <Text style={styles.label}>
                                            ASO <Text style={{ color: 'red' }}>*</Text>
                                        </Text>

                                        <Dropdown
                                            data={ASOOptions}
                                            labelField="label"
                                            valueField="value"
                                            style={styles.dropdown}
                                            containerStyle={styles.dropdownContainer}
                                            placeholderStyle={styles.placeholderStyle}
                                            selectedTextStyle={styles.selectedTextStyle}
                                            search
                                            searchPlaceholder="Search ASO"
                                            placeholder="Select ASO"
                                            value={selectedASO}
                                            onChange={item => setSelectedASO(item.value)}
                                        />

                                        {errors.aso && (
                                            <Text style={styles.error}>{errors.aso}</Text>
                                        )}
                                    </View> */}

                                    {/* 🔹 Super Distributor Dropdown */}
                                    <View style={styles.qCard}>
                                        <Text style={styles.label}>
                                            Super Distributor <Text style={{ color: 'red' }}>*</Text>
                                        </Text>

                                        <Dropdown
                                            data={superOptions}
                                            labelField="label"
                                            valueField="value"
                                            style={styles.dropdown}
                                            containerStyle={styles.dropdownContainer}
                                            placeholderStyle={styles.placeholderStyle}
                                            selectedTextStyle={styles.selectedTextStyle}
                                            search
                                            searchPlaceholder="Search Super Distributor"
                                            placeholder="Select Super Distributor"
                                            value={selectedSuper}
                                            onChange={item => setSelectedSuper(item.value)}
                                        />

                                        {errors.super && (
                                            <Text style={styles.error}>{errors.super}</Text>
                                        )}
                                    </View>

                                    {/* 🔁 Replace Sub DB Toggle */}
                                    <View style={styles.qCard}>
                                        <View style={styles.toggleRow}>
                                            <Text style={styles.toggleLabel}>Replace Sub DB</Text>

                                            <TouchableOpacity
                                                style={[
                                                    styles.toggleBtn,
                                                    isReplaceSubDB && styles.toggleBtnActive
                                                ]}
                                                onPress={() => {
                                                    setIsReplaceSubDB(prev => !prev);
                                                    setSelectedSUBDBReplace('');
                                                }}
                                            >
                                                <View
                                                    style={[
                                                        styles.toggleCircle,
                                                        isReplaceSubDB && styles.toggleCircleActive
                                                    ]}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </View>


                                    {isReplaceSubDB && (
                                        <View style={styles.qCard}>
                                            <Text style={styles.label}>
                                                Replace Sub DB <Text style={{ color: 'red' }}>*</Text>
                                            </Text>

                                            <Dropdown
                                                data={SUBDBReplaceOptions}
                                                labelField="label"
                                                valueField="value"
                                                style={styles.dropdown}
                                                containerStyle={styles.dropdownContainer}
                                                placeholderStyle={styles.placeholderStyle}
                                                selectedTextStyle={styles.selectedTextStyle}
                                                search
                                                searchPlaceholder="Search Sub DB"
                                                placeholder="Select Sub DB"
                                                value={selectedSUBDBReplace}
                                                onChange={item => setSelectedSUBDBReplace(item.value)}
                                            />

                                            {errors.replaceSubDB && (
                                                <Text style={styles.error}>{errors.replaceSubDB}</Text>
                                            )}
                                        </View>
                                    )}

                                </>
                            )}

                        </>
                    ))}

                    <View style={{ height: keyboardVisible ? 320 : 80 }} />
                </ScrollView>
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

            <LoaderOverlay visible={loading} message="Saving sub DB..." />
        </SafeAreaProvider>
    );
};

export default AddSubDbForm;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#A67C2E',
    },
    headerContainer: {
        backgroundColor: '#A67C2E',
    },
    formContainer: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },

    content: {
        padding: moderateScale(20),
    },
    inputWrapper: {
        marginBottom: 15,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 6,
        color: '#333',
    },
    input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        fontSize: 14,
    },
    error: {
        color: 'red',
        fontSize: 12,
        marginTop: 4,
    },
    submitButton: {
        marginTop: 30,
        backgroundColor: '#A67C2E',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    dropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#D9D2C3',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    dropdownContainer: {
        borderRadius: 6,
        marginTop: -40,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    selectedTextStyle: {
        fontSize: 12,
        color: '#000',
    },
    placeholderStyle: {
        fontSize: 12,
        color: '#888',
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
    container: {
        flex: 1,
        width: "100%",
        // paddingBottom: 100,
        alignSelf: "center",
        borderColor: "#BEBEBE",
        borderWidth: 1,
        borderRadius: 8,
        backgroundColor: "#fff",
        height: 38,

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
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        // marginBottom: 10,
    },

    toggleLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#000',
    },

    toggleBtn: {
        width: 46,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#ccc',
        justifyContent: 'center',
        padding: 3,
    },

    toggleBtnActive: {
        backgroundColor: '#A67C2E',
    },

    toggleCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#fff',
    },

    toggleCircleActive: {
        alignSelf: 'flex-end',
    },

});