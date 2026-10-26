import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from 'react-native';
import { Formik } from 'formik';
import LinearGradient from 'react-native-linear-gradient';
import { Gradients } from '../assets/css/MasterCss';
import StoreHeaderTabs from '../components/StoreHeaderTabs';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert'
import { update } from 'react-native-force/dist/react.force.net';
import { useNavigation } from '@react-navigation/native';


const FormScreen = ({ route }) => {
    const navigation = useNavigation()
    const { accountData } = route.params || {};
    console.log('THIS IS ACCOUNT DATA INSIDE THE EDIT ', accountData)
    const handleSubmit = (values) => {
        const updatedAccount = {
            ...accountData,
            Phone: values.mobile,
            Name: values.customerName,
            BillingAddress: values.address,
        };

        const saveLocally = async () => {

            const payload = {
                Sf_Id: updatedAccount.Sf_Id,
                BillingAddress: updatedAccount.BillingAddress,
                Phone: updatedAccount.Phone,
                Name: updatedAccount.Name,
                is_locally_changed: true,
                operation_type: "insert",
                last_modified: Date.now(),
                is_synced: false,
                sync_status: 'unsynced',
            };

            const inserted = await UniversalUpdateInsert({
                ObjectName: 'Account',
                Type: 'insert',
                data: payload,
            });
            if (inserted) {
                console.log('success', 'Attendance saved locally.');
                return true;
            } else {
                console.log('error', 'Failed to save attendance.');
                return false;
            }
        }
        saveLocally()

        console.log('Updated Account Data:', updatedAccount);
        navigation.goBack()
        // Call your API or local state update here
    };
const validate = (values) => {
    const errors = {};

    // Clean input: keep only digits
    let mobile = String(values.mobile || "")
        .replace(/\D/g, "")        // remove non-digits
        .replace(/^91/, "");       // remove leading country code

    const indianPhoneRegex = /^(?!.*(\d)\1{2})[6-9]\d{9}$/;

    if (!mobile) {
        errors.mobile = 'Mobile Number is required';
    } else if (!indianPhoneRegex.test(mobile)) {
        errors.mobile = 'Enter a valid Indian mobile number';
    }

    if (!values.customerName) {
        errors.customerName = 'Customer Name is required';
    }

    // if (!values.address) {
    //     errors.address = 'Address is required';
    // }

    return errors;
};





    return (
        <LinearGradient colors={Gradients.primary}
            style={{ flex: 1 }}>
            <StoreHeaderTabs tabBar={false} />
            <View style={styles.container}>


                <Formik
                    enableReinitialize
                    initialValues={{
                        mobile: accountData?.Phone || '',
                        customerName: accountData?.Name || '',
                        address: accountData?.BillingAddress || '',
                    }}
                    validate={validate}
                    onSubmit={handleSubmit}
                >
                    {({
                        handleChange,
                        handleBlur,
                        handleSubmit,
                        values,
                        errors,
                        touched,
                    }) => (
                        <View style={styles.card}>
                            {/* Mobile Number */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>
                                    Mobile Number <Text style={styles.required}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Phone"
                                    keyboardType="numeric"
                                    maxLength={10}
                                    onChangeText={handleChange('mobile')}
                                    onBlur={handleBlur('mobile')}
                                    value={values.mobile}
                                />
                                {touched.mobile && errors.mobile && (
                                    <Text style={styles.error}>{errors.mobile}</Text>
                                )}
                            </View>

                            {/* Customer Name */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>
                                    Name <Text style={styles.required}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Mr./Ms."
                                    onChangeText={handleChange('customerName')}
                                    onBlur={handleBlur('customerName')}
                                    value={values.customerName}
                                />
                                {touched.customerName && errors.customerName && (
                                    <Text style={styles.error}>{errors.customerName}</Text>
                                )}
                            </View>

                            {/* Address */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>
                                    Address <Text style={styles.required}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Street, City, ZIP"
                                    onChangeText={handleChange('address')}
                                    onBlur={handleBlur('address')}
                                    value={values.address}
                                />
                                {touched.address && errors.address && (
                                    <Text style={styles.error}>{errors.address}</Text>
                                )}
                            </View>


                            {/* Submit Button */}
                            <TouchableOpacity onPress={handleSubmit} style={styles.buttonContainer}>
                                <LinearGradient
                                    colors={Gradients.primary}
                                    style={styles.buttonGradient}
                                >
                                    <Text style={styles.buttonText}>Submit</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </Formik>
            </View>
        </LinearGradient>
    );
};

export default FormScreen;

// Styles remain the same as in your original code
const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: 20,
        backgroundColor: '#f2f2f2',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
    },
    fieldContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: '#333',
        marginBottom: 6,
        fontWeight: '500',
    },
    required: {
        color: 'red',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#D9D2C3',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        elevation: 1.1,
    },
    error: {
        color: 'red',
        fontSize: 12,
        marginTop: 4,
    },
    buttonContainer: {
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 8,
    },
    buttonGradient: {

        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
