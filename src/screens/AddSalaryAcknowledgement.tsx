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
import moment from 'moment';


const generateRandomId = () => {
    const ts = Date.now();
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `SAL-${ts}-${rnd}`;
};

const AddSalaryAcknowledgement = ({ navigation }) => {
    const { apiFetch } = useApiFetch();
    const dispatch = useDispatch();
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    // const [yearValues, setYearValues] = useState([])
    const [distributorList, setDistributorList] = useState([])
    const [loggedInUserData, setLoggedInUserData] = useState([])
    // const [selectedYear, setSelectedYear] = useState(null)
    const [formData, setFormData] = useState({
        submittedDate: '',
        month: '',
        year: '',
        amount: '',
        dbName: '',
        description: '',
    });
    const monthPicklistold = [
        { label: 'January', value: 'January' },
        { label: 'February', value: 'February' },
        { label: 'March', value: 'March' },
        { label: 'April', value: 'April' },
        { label: 'May', value: 'May' },
        { label: 'June', value: 'June' },
        { label: 'July', value: 'July' },
        { label: 'August', value: 'August' },
        { label: 'September', value: 'September' },
        { label: 'October', value: 'October' },
        { label: 'November', value: 'November' },
        { label: 'December', value: 'December' },
    ];
    const getMonthPicklist = () => {
        const currentMonth = moment();
        const previousMonth = moment().subtract(1, 'month');
        const previousMonth2 = moment().subtract(2, 'month');

        return [
            // {
            //     label: currentMonth.format('MMMM'),
            //     value: currentMonth.format('MMMM'),
            // },
            {
                label: previousMonth.format('MMMM'),
                value: previousMonth.format('MMMM'),
            },
            {
                label: previousMonth2.format('MMMM'),
                value: previousMonth2.format('MMMM'),
            },
        ];
    };
    const getYearPicklist = () => {
        const currentYear = moment().year();
        return [
            {
                label: currentYear.toString(),
                value: currentYear.toString(),
            },
            {
                label: (currentYear - 1).toString(),
                value: (currentYear - 1).toString(),
            },
        ];
    };
    const [yearValues, setYearValues] = useState([]);
    const [monthPicklist, setMonthPicklist] = useState([]);
    useEffect(() => {
        setMonthPicklist(getMonthPicklist());
        const years = getYearPicklist();
        setYearValues(years);
        setFormData(prev => ({
            ...prev,
            year: years[0].value,
        }));
    }, []);


    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

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

    useEffect(() => {
        getRequiredData()
        getDistributorList()
        getLoggedInUserData()
    }, [])
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            submittedDate: moment().format('DD-MM-YYYY') // match your validation format
        }));
    }, []);

    const validate = () => {
        const newErrors = {};

        // 📌 SUBMITTED DATE (DD-MM-YYYY format)
        if (!formData.submittedDate.trim()) {
            newErrors.submittedDate = "Submitted Date is required";
        } else if (!/^\d{2}-\d{2}-\d{4}$/.test(formData.submittedDate)) {
            newErrors.submittedDate = "Date format: DD-MM-YYYY";
        }

        // 📌 MONTH
        if (!formData.month.trim()) {
            newErrors.month = "Month is required";
        }

        // 📌 YEAR
        if (!formData.year.trim()) {
            newErrors.year = "Year is required";
        } else if (!/^\d{4}$/.test(formData.year)) {
            newErrors.year = "Year should be 4 digits (e.g., 2025)";
        }

        // 📌 AMOUNT
        if (!formData.amount.trim()) {
            newErrors.amount = "Amount is required";
        } else if (!/^\d+$/.test(formData.amount)) {
            newErrors.amount = "Amount must contain only digits";
        } else if (Number(formData.amount) <= 0) {
            newErrors.amount = "Amount must be a positive number";
        }

        // 📌 DB NAME
        if (!formData.dbName.trim()) {
            newErrors.dbName = "DB Name is required";
        }

        // 📌 DESCRIPTION
        if (!formData.description.trim()) {
            newErrors.description = "Description is required";
        }


        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const getRequiredData = async () => {
        try {
            const allPicklistData = await UniversalUpdateInsert({
                ObjectName: 'AllDataPicklist',
                Type: 'get'
            });
            let optionsData = allPicklistData[0]?.OptionsData;
            if (typeof optionsData === 'string') {
                try {
                    optionsData = JSON.parse(optionsData);
                } catch (e) {
                    console.error("Failed to parse OptionsData:", e);
                }
            }
            const years =
                optionsData.YearValues ?? [];
            console.log('years', years)
            // setYearValues(prev =>
            //     JSON.stringify(prev) === JSON.stringify(years) ? prev : years
            // );
        } catch (e) {
            console.error(e);
        }
    };
    const getLoggedInUserData = async () => {
        try {
            const loggedInUser = await UniversalUpdateInsert({
                ObjectName: "User",
                Type: "get"
            });
            setLoggedInUserData(loggedInUser)

            console.log('this is logged in user in the screen Add salary acknowledgement')
        } catch (e) {
            console.error(e);
        }
    };

    // const getDistributorList = async () => {
    //     try {
    //         setLoading(true);

    //         const loggedInUser = await UniversalUpdateInsert({
    //             ObjectName: "User",
    //             Type: "get"
    //         });
    //         console.log(' loggedInUser[0]?.Sf_Id', loggedInUser[0]?.DeveloperName)
    //         let disData = [];
    //         disData = await UniversalUpdateInsert({
    //             ObjectName: "SR_Beat_Assignment__c",
    //             Type: "get",
    //             filters: [
    //                 { field: "Assigned_To__c", value: loggedInUser[0]?.Sf_Id },

    //             ],
    //         });
    //         const response = disData.map((item) => ({
    //             label: item?.Name + ' (#' + item?.PartyCode__c + ')',
    //             value: item?.Distributor__c,
    //         })).filter(
    //             (item, index, self) =>
    //                 index === self.findIndex((obj) => obj.value === item.value)
    //         );
    //         setDistributorList(response);
    //     } catch (error) {
    //         console.log("Error fetching distributor list:", error);
    //     } finally {
    //         setLoading(false);
    //     }
    // };
    const getDistributorList = async () => {
        try {
            setLoading(true);
            const loggedInUser = await UniversalUpdateInsert({
                ObjectName: "User",
                Type: "get"
            });
            const userId = loggedInUser[0]?.Sf_Id;
            const userType = loggedInUser[0]?.DeveloperName;
            let disData = await UniversalUpdateInsert({
                ObjectName: "SR_Beat_Assignment__c",
                Type: "get",
                filters: [
                    { field: "Assigned_To__c", value: userId },
                ],
            });
            let response = [];
            // 🔥 CONDITION: H_T_ASO user
            if (userType === "H_T_ASO") {
                const distributorIds = disData.map(i => i?.Distributor__c).filter(Boolean);
                const disDataParent = await UniversalUpdateInsert({
                    ObjectName: "Account",
                    Type: "get",
                    filters: [
                        {
                            field: "Sf_Id",
                            operator: "in",
                            value: distributorIds
                        }
                    ]
                });
                const uniqueParentIds = [...new Set(disDataParent.map(item => item.ParentId))];
                const disDataParentFiltered = await UniversalUpdateInsert({
                    ObjectName: "Account",
                    Type: "get",
                    filters: [
                        {
                            field: "Sf_Id",
                            operator: "in",
                            value: uniqueParentIds
                        }
                    ]
                });
                response = disDataParentFiltered?.map((item) => ({
                    label: item?.Name + ' (#' + item?.Party_Code__c + ')',
                    value: item?.Sf_Id,
                }));
            } else {
                response = disData.map((item) => ({
                    label: item?.Name + ' (#' + item?.PartyCode__c + ')',
                    value: item?.Distributor__c,
                }));

            }
            const uniqueResponse = response.filter(
                (item, index, self) =>
                    index === self.findIndex((obj) => obj.value === item.value)
            );
            setDistributorList(uniqueResponse || []);
        } catch (error) {
            console.log("Error fetching distributor list:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        const currentDate = moment().format('YYYY-MM-DD');
        console.log(currentDate);

        const oldData = await UniversalUpdateInsert({
            ObjectName: 'Salary_Acknowledgement__c',
            Type: 'get',
            filters: [
                { field: "Year__c", value: formData.year },
                { field: "Month__c", value: formData.month },
                { field: "Assigned_To__c", value: loggedInUserData[0]?.Sf_Id },
                { field: "DB_Name__c", value: formData.dbName },
            ],
        });
        if (oldData && oldData.length > 0) {
            setLoading(false);
            dispatch(
                showToast({
                    message: `This DB already has a salary acknowledgement for ${formData.month} ${formData.year}.`,
                    type: 'warning',
                })
            );
            return; //  STOP SUBMIT
        }


        setLoading(true);
        let recordId = generateRandomId();
        let isFromApi = false;

        try {
            const connected = await isInternetAvailable();
            if (connected) {
                const payload = {
                    apiName: 'Salary_Acknowledgement__c',
                    fields: {
                        Submitted_Date__c: currentDate,
                        Month__c: formData.month,
                        Year__c: formData.year,
                        Amount__c: Number(formData.amount),
                        DB_Name__c: formData.dbName,
                        Description__c: formData.description,
                        Assigned_To__c: loggedInUserData[0].Sf_Id,
                        Claim_Generated__c: false,
                    },
                };

                const response = await apiFetch('POST', 'records', payload, 'standard');
                if (response.status === 'success' && response.data?.id) {
                    recordId = response.data.id;
                    isFromApi = true;
                }
            }

            console.log('form data.year ', formData.year, currentDate)

            const payload = {
                Sf_Id: recordId,
                Submitted_Date__c: currentDate,
                Month__c: formData.month,
                Year__c: formData.year,
                Amount__c: Number(formData.amount),
                DB_Name__c: formData.dbName,
                Description__c: formData.description,
                Assigned_To__c: loggedInUserData[0].Sf_Id,
                Claim_Generated__c: false,
                is_locally_changed: !isFromApi,
                is_synced: isFromApi,
                operation_type: isFromApi ? null : 'insert',
                last_modified: Date.now(),

            }

            await UniversalUpdateInsert({
                ObjectName: 'Salary_Acknowledgement__c',
                Type: 'insert',
                data: payload
            });

            setLoading(false);
            dispatch(showToast({ message: 'Salary Acknowledgement saved successfully!', type: 'success' }));
            navigation.goBack();
        } catch (err) {
            setLoading(false);
            dispatch(showToast({ message: 'Unexpected error occurred', type: 'error' }));
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        let sanitizedValue = value;
        if (field === 'amount') {
            // Remove any non-digits (only allow 0-9)
            sanitizedValue = value.replace(/[^0-9]/g, '');
        }

        setFormData(prev => ({ ...prev, [field]: sanitizedValue }));

        // Clear error for this field
        setErrors(prev => {
            if (prev[field]) {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            }
            return prev;
        });
    };

    const fields = [
        { key: 'dbName', label: 'DB Name', keyboardType: 'default', fieldType: 'Dropdown' },
        { key: 'amount', label: 'Amount', keyboardType: 'numeric' },
        { key: 'month', label: 'Month', keyboardType: 'default', fieldType: 'Dropdown' },
        { key: 'year', label: 'Year', keyboardType: 'numeric', fieldType: 'Dropdown' },
        { key: 'description', label: 'Description', keyboardType: 'default', multiline: true },
    ];

    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Salary Acknowledgement" />
            </View>

            <View style={styles.formContainer}>
                <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                    {fields.map(({ key, label, keyboardType, multiline, fieldType }) => (
                        <View key={key} style={styles.qCard}>
                            <Text style={styles.label}>
                                {label} <Text style={{ color: 'red', marginLeft: 2 }}>*</Text>
                            </Text>
                            {fieldType === "Dropdown" ? (
                                <>
                                    <Dropdown
                                        data={key === "month" ? monthPicklist : key === "dbName" ? distributorList : yearValues}
                                        labelField="label"
                                        valueField="value"
                                        search
                                        searchPlaceholder="Search..."
                                        style={styles.dropdown}
                                        containerStyle={styles.dropdownContainer}
                                        placeholderStyle={styles.placeholderStyle}
                                        selectedTextStyle={styles.selectedTextStyle}
                                        placeholder={`Select ${label}`}
                                        value={formData[key]}
                                        onChange={(item) => handleChange(key, item.value)}
                                    />
                                    {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                                </>
                            ) : (
                                <>
                                    <TextInput
                                        style={[styles.input, { minHeight: multiline ? 80 : 38 }]}
                                        value={formData[key]}
                                        onChangeText={val => handleChange(key, val)}
                                        keyboardType={keyboardType}
                                        placeholder={`Enter ${label}`}
                                        placeholderTextColor="#999"
                                        multiline={multiline}
                                        textAlignVertical={multiline ? 'top' : 'center'}
                                    />
                                    {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                                </>
                            )}






                        </View>
                    ))}

                    <View style={{ height: keyboardVisible ? 320 : 80 }} />
                </ScrollView>
                {
                    !keyboardVisible && (
                        <TouchableOpacity
                            style={styles.footer}
                            onPress={handleSubmit}
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
                    )
                }
            </View >

            <LoaderOverlay visible={loading} message="Saving salary acknowledgement..." />
        </SafeAreaProvider >
    );
};

export default AddSalaryAcknowledgement;



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
});