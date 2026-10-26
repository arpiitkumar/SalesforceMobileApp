import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
    StatusBar,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import HeaderMain from '../components/HeaderMain';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const AccountForm = () => {
    const { apiFetch } = useApiFetch();
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

    const validate = () => {
        const newErrors = {};

        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!/^[6-9]\d{9}$/.test(formData.phone)) newErrors.phone = 'Invalid phone number';
        if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email address';
        if (!/[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(formData.pan)) newErrors.pan = 'Invalid PAN number';
        if (
            formData.gst &&
            !/^(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})$/.test(formData.gst)
        )
            newErrors.gst = 'Invalid GST number';
        if (!formData.street.trim()) newErrors.street = 'Street is required';
        if (!formData.city.trim()) newErrors.city = 'City is required';
        if (!formData.state.trim()) newErrors.state = 'State is required';
        if (!/^\d{5,6}$/.test(formData.postalCode)) newErrors.postalCode = 'Invalid postal code';
        if (!formData.country.trim()) newErrors.country = 'Country is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        const submitToApi = async () => {
            const payload = {
                apiName: 'Account',
                fields: {
                    Name: formData.name,
                    Phone: formData.phone,
                    cgcloud__Account_Email__c: formData.email,
                    PANNumber__c: formData.pan,
                    GSTNumber__c: formData.gst,
                },
            };

            const response = await apiFetch('POST', 'records', payload, 'standard');
            console.log('API Response:', response);
        };

        if (validate()) {
            submitToApi();
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const fields = [
        { key: 'name', label: 'Name', keyboardType: 'default' },
        { key: 'phone', label: 'Phone', keyboardType: 'phone-pad' },
        { key: 'email', label: 'Email', keyboardType: 'email-address' },
        { key: 'pan', label: 'PAN Number', keyboardType: 'default' },
        { key: 'gst', label: 'GST Number', keyboardType: 'default' },
    ];

    const addressFields = [
        { key: 'street', label: 'Street' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'postalCode', label: 'Postal Code', keyboardType: 'numeric' },
        { key: 'country', label: 'Country' },
    ];

    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Add Accounts" />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {fields.map(({ key, label, keyboardType }) => (
                    <View key={key} style={styles.inputWrapper}>
                        <Text style={styles.label}>{label}</Text>
                        <TextInput
                            style={styles.input}
                            value={formData[key]}
                            onChangeText={val => handleChange(key, val)}
                            keyboardType={keyboardType}
                        />
                        {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                    </View>
                ))}

                <Text style={styles.sectionTitle}>Address Details</Text>

                {addressFields.map(({ key, label, keyboardType }) => (
                    <View key={key} style={styles.inputWrapper}>
                        <Text style={styles.label}>{label}</Text>
                        <TextInput
                            style={styles.input}
                            value={formData[key]}
                            onChangeText={val => handleChange(key, val)}
                            keyboardType={keyboardType || 'default'}
                        />
                        {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                    </View>
                ))}

                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                    <Text style={styles.submitText}>Submit</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaProvider>
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
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: moderateScale(20),
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#A67C2E',
        marginTop: 20,
        marginBottom: 10,
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
        backgroundColor: '#FBF8F1',
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
});
