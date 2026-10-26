import React, { useState } from 'react';
import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Alert,
    StatusBar,
    Platform,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import FontAwesome from '@react-native-vector-icons/fontawesome';
import LinearGradient from 'react-native-linear-gradient';
//import call from 'react-native-phone-call';
import moment from 'moment';
import { useNavigation } from '@react-navigation/native';
 
const appointments = [
    {
      id: 'SA-001',
      customerName: 'Rahul Sharma',
      location: 'Diggi Bazaar, Ajmer',
      issue: 'Oil Change & Filter Replacement',
      phone: '9876543210',
      coords: { latitude: 26.4518, longitude: 74.6392 },
      date: '2025-07-17',
      time: '10:30 AM',
      vehicle: 'Maruti Suzuki Swift',
      status: 'Scheduled',
      technician: 'Anil Verma',
      serviceType: 'Routine Maintenance',
      remarks: 'Customer requested synthetic oil',
    },
    {
      id: 'SA-002',
      customerName: 'Sunita Joshi',
      location: 'Dargah Bazar, Ajmer',
      issue: 'Brake Inspection',
      phone: '9876512345',
      coords: { latitude: 26.4501, longitude: 74.6383 },
      date: '2025-07-17',
      time: '12:00 PM',
      vehicle: 'Hyundai i20',
      status: 'In Progress',
      technician: 'Ramesh Meena',
      serviceType: 'Safety Check',
      remarks: 'Customer reports screeching noise',
    },
    {
      id: 'SA-004',
      customerName: 'Priya Mehta',
      location: 'Naya Bazar, Ajmer',
      issue: 'Tire Rotation & Wheel Alignment',
      phone: '9123456780',
      coords: { latitude: 26.4520, longitude: 74.6368 },
      date: '2025-07-17',
      time: '2:30 PM',
      vehicle: 'Honda City',
      status: 'Pending',
      technician: 'Mukesh Saini',
      serviceType: 'Wheel Service',
      remarks: 'Customer recently changed tires',
    },
    {
      id: 'SA-005',
      customerName: 'Rajeev Kumar',
      location: 'Kaisarganj, Ajmer',
      issue: 'Engine Checkup',
      phone: '9876501234',
      coords: { latitude: 26.4533, longitude: 74.6379 },
      date: '2025-07-17',
      time: '4:00 PM',
      vehicle: 'Toyota Innova',
      status: 'Completed',
      technician: 'Naresh Gupta',
      serviceType: 'Diagnostic',
      remarks: 'Engine light was on',
    },
  ];
  
 
 
 
 
// const makeCall = (phone) => {
//     const args = { number: phone, prompt: true };
//     call(args).catch(() => Alert.alert('Error', 'Unable to make a call'));
// };
 
const AppointmentScreen = () => {
    const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
 
    const navigation = useNavigation();
    return (
        <>
            <StatusBar backgroundColor={'#1E3A8A'} barStyle="light-content" />
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <LinearGradient colors={['#1E3A8A', '#314DA1']} style={styles.header}>
                    <Text style={styles.headerText}>Service Appointments</Text>
                </LinearGradient>
 
                {/* Map Section */}
                <View style={styles.mapWrapper}>
                    <View style={styles.mapContainer}>
                        <MapView
                            style={styles.map}
                            initialRegion={{
                                latitude: 26.4535,
                                longitude: 74.6375,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            }}
                        >
                            {appointments.map((item) => (
                                <Marker
                                    key={item.id}
                                    coordinate={item.coords}
                                    title={item.customerName}
                                    description={item.location}
                                />
                            ))}
                        </MapView>
                    </View>
                </View>
 
                {/* Appointment Cards Overlapping Map */}
                <View style={styles.appointmentWrapper}>
                    <View style={styles.outerCard}>
                        <FlatList
                            data={appointments}
                            keyExtractor={(item) => item.id}
                            ListEmptyComponent={
                                <Text style={styles.noAppointmentsText}>
                                    No appointments for this date.
                                </Text>
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.glassCard} onPress={()=>navigation.navigate('CustomTabs',{data:item})}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>{item.customerName}</Text>
                                        {/* <TouchableOpacity onPress={() => makeCall(item.phone)} style={styles.callBtn}>
                                            <FontAwesome name="phone" size={14} color="#fff" />
                                        </TouchableOpacity> */}
                                    </View>
 
                                    <View style={styles.infoRow}>
                                        <FontAwesome name="calendar" size={14} color="#1E3A8A" style={styles.icon} />
                                        <Text style={styles.cardText}>{moment().format('dddd, MMM D')}</Text>
                                    </View>
 
                                    <View style={styles.infoRow}>
                                        <FontAwesome name="map-marker" size={14} color="#1E3A8A" style={styles.icon} />
                                        <Text style={styles.cardText}>{item.location}</Text>
                                    </View>
 
                                    <View style={styles.infoRow}>
                                        <FontAwesome name="wrench" size={14} color="#1E3A8A" style={styles.icon} />
                                        <Text style={styles.cardIssue}>{item.issue}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
};
 
export default AppointmentScreen;
 
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e6ecf5',
    },
    header: {
        paddingTop: 2,
        paddingHorizontal: 10,
        paddingBottom: 10,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        elevation: 2,
    },
    headerText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 5,
    },
    mapWrapper: {
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderColor: '#ccc',
        borderWidth: 1,
    },
    mapContainer: {
        height: 350,
        width: '100%',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    appointmentWrapper: {
        marginTop: -40, // overlay effect
        // paddingHorizontal: 16,
    },
    outerCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
        paddingBottom:'92%'
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        borderLeftWidth: 5,
        borderLeftColor: '#1E3A8A',
        ...Platform.select({
            android: { elevation: 1 },
        }),
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E3A8A',
    },
    callBtn: {
        backgroundColor: '#1E3A8A',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    icon: {
        marginRight: 10,
    },
    cardText: {
        fontSize: 14,
        color: '#333',
    },
    cardIssue: {
        fontSize: 14,
        color: '#1E3A8A',
    },
    noAppointmentsText: {
        textAlign: 'center',
        color: '#777',
        fontSize: 16,
        marginTop: 20,
    },
});