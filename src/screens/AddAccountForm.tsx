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
    Modal,
    KeyboardAvoidingView
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
import { buildSyncFields, extractApiErrorMessage } from '../utils/sync/syncStatus';
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

const STATE_CITY_DATA = [
    {
        state: "Andhra Pradesh",
        cities: ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Prakasam", "Srikakulam", "Sri Potti Sriramulu Nellore", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa", "Vijayawada", "Nellore", "Tirupati", "Rajahmundry", "Kakinada", "Eluru"]
    },
    {
        state: "Arunachal Pradesh",
        cities: ["Tawang", "West Kameng", "East Kameng", "Papum Pare", "Kurung Kumey", "Kra Daadi", "Lower Subansiri", "Upper Subansiri", "West Siang", "East Siang", "Siang", "Upper Siang", "Lower Siang", "Lower Dibang Valley", "Dibang Valley", "Anjaw", "Lohit", "Namsai", "Changlang", "Tirap", "Longding", "Itanagar"]
    },
    {
        state: "Assam",
        cities: ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup Metropolitan", "Kamrup", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong", "Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Tezpur"]
    },
    {
        state: "Bihar",
        cities: ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"]
    },
    {
        state: "Chhattisgarh",
        cities: ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Jashpur", "Kabirdham", "Kanker", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sukma", "Surajpur", "Surguja", "Bhilai"]
    },
    {
        state: "Goa",
        cities: ["North Goa", "South Goa", "Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"]
    },
    {
        state: "Gujarat",
        cities: ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udepur", "Dahod", "Dangs", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"]
    },
    {
        state: "Haryana",
        cities: ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"]
    },
    {
        state: "Himachal Pradesh",
        cities: ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una", "Dharamshala"]
    },
    {
        state: "Jammu and Kashmir",
        cities: ["Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"]
    },
    {
        state: "Jharkhand",
        cities: ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum", "Jamshedpur"]
    },
    {
        state: "Karnataka",
        cities: ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir", "Hubballi", "Mangaluru"]
    },
    {
        state: "Kerala",
        cities: ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad", "Kochi", "Kollam"]
    },
    {
        state: "Ladakh",
        cities: ["Leh", "Kargil"]
    },
    {
        state: "Madhya Pradesh",
        cities: ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"]
    },
    {
        state: "Maharashtra",
        cities: ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal", "Navi Mumbai", "Kalyan"]
    },
    {
        state: "Manipur",
        cities: ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Ukhrul", "Thoubal"]
    },
    {
        state: "Meghalaya",
        cities: ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills", "Shillong"]
    },
    {
        state: "Mizoram",
        cities: ["Aizawl", "Champhai", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Serchhip"]
    },
    {
        state: "Nagaland",
        cities: ["Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Peren", "Phek", "Tuensang", "Wokha", "Zunheboto"]
    },
    {
        state: "Odisha",
        cities: ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh", "Bhubaneswar", "Rourkela"]
    },
    {
        state: "Punjab",
        cities: ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Muktsar", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur", "Shahid Bhagat Singh Nagar", "Tarn Taran"]
    },
    {
        state: "Rajasthan",
        cities: ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"]
    },
    {
        state: "Sikkim",
        cities: ["East Sikkim", "North Sikkim", "South Sikkim", "West Sikkim", "Gangtok"]
    },
    {
        state: "Tamil Nadu",
        cities: ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"]
    },
    {
        state: "Telangana",
        cities: ["Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal Rural", "Warangal Urban", "Yadadri Bhuvanagiri"]
    },
    {
        state: "Tripura",
        cities: ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura", "Agartala"]
    },
    {
        state: "Uttar Pradesh",
        cities: ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kushinagar", "Lakhimpur Kheri", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi", "Noida", "Greater Noida"]
    },
    {
        state: "Uttarakhand",
        cities: ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi", "Haldwani", "Roorkee"]
    },
    {
        state: "West Bengal",
        cities: ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur", "Siliguri", "Asansol", "Durgapur"]
    },
    {
        state: "Andaman and Nicobar Islands",
        cities: ["Nicobar", "North and Middle Andaman", "South Andaman", "Port Blair"]
    },
    {
        state: "Chandigarh",
        cities: ["Chandigarh"]
    },
    {
        state: "Dadra and Nagar Haveli and Daman and Diu",
        cities: ["Dadra and Nagar Haveli", "Daman", "Diu"]
    },
    {
        state: "Delhi",
        cities: ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"]
    },
    {
        state: "Lakshadweep",
        cities: ["Kavaratti"]
    },
    {
        state: "Puducherry",
        cities: ["Karaikal", "Mahe", "Puducherry", "Yanam"]
    }
];

const generateRandomId = () => {
    const ts = Date.now();
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `ACC-${ts}-${rnd}`;
};

const GOOGLE_API_KEY = 'REDACTED_SECRET';
const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

const fetchAddressDetails = async (latitude, longitude) => {
    try {
        const url = `${GEOCODE_ENDPOINT}?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const json = await response.json();
        if (json.status === 'OK' && json.results?.length > 0) {
            const result = json.results[0];
            const address = result.formatted_address;

            let street = address;
            let city = '';
            let state = '';
            let postalCode = '';

            const components = result.address_components || [];
            for (const comp of components) {
                const types = comp.types || [];
                if (types.includes('locality')) {
                    city = comp.long_name;
                } else if (types.includes('administrative_area_level_1')) {
                    state = comp.long_name;
                } else if (types.includes('postal_code')) {
                    postalCode = comp.long_name;
                }
            }

            return { street, city, state, postalCode };
        }
    } catch (error) {
        console.warn('Reverse geocoding error:', error);
    }
    return null;
};

const AccountForm = ({ navigation, route }) => {
    const { apiFetch, fetchRecords } = useApiFetch();
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        pan: '',
        gst: '',
        fssai: '',
        registeredDate: moment().format('YYYY-MM-DD'),
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
    });

    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('Saving retailer...');

    const [outletImage, setOutletImage] = useState(null);

    const dispatch = useDispatch();

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false)
    const [users, setUsers] = useState([])
    const [selectedBeatDay, setSelectedBeatDay] = useState([])
    const [selectedBeatId, setSelecteBeatId] = useState("");
    const [beats, setBeats] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [showCreateBeatModal, setShowCreateBeatModal] = useState(false);
    const [newBeatName, setNewBeatName] = useState("");
    const [selectedDistributorId, setSelectedDistributorId] = useState("");

    const fetchBeatsAndDistributors = async (userIdVal) => {
        try {
            if (!userIdVal) return;

            const userBaQuery = `
                SELECT Id, Name, Account__c, Account__r.Name, User__c, User__r.Name
                FROM User_BA_Mapping__c
                WHERE Is_Active__c = true AND Status__c = 'Active' AND User__c = '${userIdVal}'
            `;
            const baMappings = await fetchRecords("User_BA_Mapping__c", userBaQuery);

            if (Array.isArray(baMappings) && baMappings.length > 0) {
                setDistributors(baMappings);

                const distributorIds = baMappings
                    .map((item: any) => item.Account__c)
                    .filter((id: any) => id);

                if (distributorIds.length > 0) {
                    const distributorFilter = distributorIds.map((id: string) => `'${id}'`).join(", ");
                    const beatQuery = `
                        SELECT Id, Name, Beat_Status__c, Beat_Visit_Frequency__c, Distributor__c, Distributor__r.Name
                        FROM Beat__c
                        WHERE Distributor__c IN (${distributorFilter})
                    `;
                    const beatsList = await fetchRecords("Beat__c", beatQuery);
                    if (Array.isArray(beatsList)) {
                        setBeats(beatsList);
                    } else {
                        setBeats([]);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching beats/distributors:", error);
        }
    };

    const handleCreateBeat = async () => {
        if (!newBeatName.trim() || !selectedDistributorId) {
            return;
        }

        setLoading(true);
        try {
            const payload = {
                Name: newBeatName.trim(),
                Distributor__c: selectedDistributorId,
                Beat_Status__c: "Active",
            };

            const response = await apiFetch("POST", "sobjects/Beat__c", payload, "SObjects");

            if (response && response.status === "success" && response.data?.id) {
                const newBeatId = response.data.id;
                dispatch(showToast({ message: "Beat Created Successfully", type: "success" }));

                // Insert locally
                await UniversalUpdateInsert({
                    ObjectName: "Beat__c",
                    Type: "insert",
                    data: {
                        Sf_Id: newBeatId,
                        Name: newBeatName.trim(),
                        Distributor__c: selectedDistributorId,
                        Beat_Status__c: "Active",
                    },
                });

                if (users[0]?.Sf_Id) {
                    await fetchBeatsAndDistributors(users[0]?.Sf_Id);
                }
                setSelecteBeatId(newBeatId);
                setShowCreateBeatModal(false);
                setNewBeatName("");
                setSelectedDistributorId("");
            } else {
                dispatch(showToast({ message: response?.message || "Failed to create Beat", type: "error" }));
            }
        } catch (error) {
            console.error("Error creating Beat:", error);
            dispatch(showToast({ message: "Error creating Beat", type: "error" }));
        } finally {
            setLoading(false);
        }
    };

    const renderSmallDropdownItem = (item: any) => {
        return (
            <View style={styles.dropdownItemSmall}>
                <Text style={styles.dropdownItemTextSmall}>
                    {item.label}
                </Text>
            </View>
        );
    };

    const renderSelectBeatField = () => {
        const beatOptions = beats.map((b) => ({
            label: b.Name,
            value: b.Id,
        }));
        beatOptions.push({
            label: "+ Create New Beat",
            value: "CREATE_NEW_BEAT",
        });

        const renderDropdownItem = (item: any) => {
            const isCreateNew = item.value === "CREATE_NEW_BEAT";
            return (
                <View style={{ padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{
                        fontSize: 12,
                        color: isCreateNew ? "#C9A24D" : "#333",
                        fontWeight: isCreateNew ? "600" : "400"
                    }}>
                        {item.label}
                    </Text>
                </View>
            );
        };

        return (
            <View style={styles.qCard}>
                <Text style={styles.label}>
                    Select Beat
                </Text>
                <Dropdown
                    data={beatOptions}
                    labelField="label"
                    valueField="value"
                    style={styles.dropdown}
                    containerStyle={styles.dropdownContainer}
                    placeholderStyle={styles.placeholderDropdown}
                    selectedTextStyle={styles.valueDropdown}
                    placeholder="Select Beat"
                    search
                    searchPlaceholder="Search Beat"
                    value={selectedBeatId || null}
                    onChange={(item) => {
                        if (item.value === "CREATE_NEW_BEAT") {
                            setShowCreateBeatModal(true);
                        } else {
                            setSelecteBeatId(item.value);
                        }
                    }}
                    renderItem={renderDropdownItem}
                />
                {errors["selectedBeatId"] && (
                    <Text style={styles.error}>
                        {errors["selectedBeatId"]}
                    </Text>
                )}
            </View>
        );
    };

    const renderCreateBeatModal = () => {
        const distributorOpts = distributors.map((d) => ({
            label: d.Account__r?.Name || d.Name,
            value: d.Account__c,
        }));

        return (
            <Modal
                visible={showCreateBeatModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateBeatModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalHeader}>Create New Beat</Text>

                        {/* Beat Name Input */}
                        <Text style={styles.modalLabel}>
                            Beat Name <Text style={{ color: "red" }}>*</Text>
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Enter Beat Name"
                            value={newBeatName}
                            onChangeText={setNewBeatName}
                        />

                        {/* Select Distributor Dropdown */}
                        <Text style={styles.modalLabel}>
                            Select Distributor <Text style={{ color: "red" }}>*</Text>
                        </Text>
                        <Dropdown
                            data={distributorOpts}
                            labelField="label"
                            valueField="value"
                            style={styles.modalDropdown}
                            containerStyle={styles.modalDropdownContainer}
                            dropdownPosition="bottom"
                            placeholderStyle={styles.placeholderDropdown}
                            selectedTextStyle={styles.valueDropdown}
                            placeholder="Select Distributor"
                            value={selectedDistributorId || null}
                            onChange={(item) => setSelectedDistributorId(item.value)}
                        />

                        {/* Buttons */}
                        <View style={styles.modalButtonsRow}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelBtn]}
                                onPress={() => {
                                    setShowCreateBeatModal(false);
                                    setNewBeatName("");
                                    setSelectedDistributorId("");
                                }}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.submitBtn,
                                    (!newBeatName.trim() || !selectedDistributorId) && { backgroundColor: "#BEBEBE" }
                                ]}
                                disabled={!newBeatName.trim() || !selectedDistributorId}
                                onPress={handleCreateBeat}
                            >
                                <Text style={styles.submitBtnText}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    const [beatDaysId, setBeatDaysId] = useState("");
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
            setErrors(prev => ({ ...prev, outletImage: null }));

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
            setErrors(prev => ({ ...prev, outletImage: null }));
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

            const classMap = new Map<string, { label: string; value: string }>();
            const channelMap = new Map<string, { label: string; value: string }>();

            const addOption = (map: Map<string, { label: string; value: string }>, labelRaw: any, valueRaw: any) => {
                if (!labelRaw && !valueRaw) return;
                const label = String(labelRaw || valueRaw).trim();
                const value = String(valueRaw || labelRaw).trim();
                if (!label || !value) return;
                const key = value.toLowerCase();
                if (!map.has(key)) {
                    map.set(key, { label, value });
                }
            };

            const addList = (map: Map<string, { label: string; value: string }>, list: any) => {
                if (!Array.isArray(list)) return;
                list.forEach((item: any) => {
                    if (typeof item === 'object' && item !== null) {
                        addOption(map, item.label || item.value || item.Name || item.name, item.value || item.label || item.Id || item.id);
                    } else if (typeof item === 'string' || typeof item === 'number') {
                        addOption(map, item, item);
                    }
                });
            };

            const addFromDescribe = (describeData: any) => {
                if (!describeData) return;
                const fields = Array.isArray(describeData.fields)
                    ? describeData.fields
                    : Array.isArray(describeData?.data?.fields)
                    ? describeData.data.fields
                    : Array.isArray(describeData?.responseBody?.fields)
                    ? describeData.responseBody.fields
                    : [];

                fields.forEach((f: any) => {
                    const fName = (f?.name || '').toLowerCase();
                    const isClass = fName === 'class__c' || fName === 'class' || fName === 'tier__c';
                    const isChannel = fName === 'channel__c' || fName === 'channel' || fName === 'dbtype__c';

                    if ((isClass || isChannel) && Array.isArray(f?.picklistValues)) {
                        f.picklistValues.forEach((pv: any) => {
                            const targetMap = isClass ? classMap : channelMap;
                            addOption(targetMap, pv.label || pv.value, pv.value || pv.label);
                        });
                    }
                });
            };

            // 1️⃣ Load from AllDataPicklist
            if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
                AllPicklistData.forEach((row: any) => {
                    if (row?.OptionsData) {
                        try {
                            const parsed = typeof row.OptionsData === 'string' ? JSON.parse(row.OptionsData) : row.OptionsData;
                            if (parsed?.ClassValues) addList(classMap, parsed.ClassValues);
                            if (parsed?.ChannelValues) addList(channelMap, parsed.ChannelValues);
                            if (parsed?.classValues) addList(classMap, parsed.classValues);
                            if (parsed?.channelValues) addList(channelMap, parsed.channelValues);
                            if (parsed?.Class) addList(classMap, parsed.Class);
                            if (parsed?.Channel) addList(channelMap, parsed.Channel);
                            addFromDescribe(parsed);
                        } catch (e) {
                            console.warn('Failed to parse AllDataPicklist.OptionsData', e);
                        }
                    }

                    if (row?.DependentOptionsData) {
                        try {
                            const depParsed = typeof row.DependentOptionsData === 'string' ? JSON.parse(row.DependentOptionsData) : row.DependentOptionsData;
                            if (depParsed?.channelToSubChannel && typeof depParsed.channelToSubChannel === 'object') {
                                Object.keys(depParsed.channelToSubChannel).forEach(ch => addOption(channelMap, ch, ch));
                            }
                            if (Array.isArray(depParsed?.channels)) addList(channelMap, depParsed.channels);
                            if (Array.isArray(depParsed?.ChannelValues)) addList(channelMap, depParsed.ChannelValues);
                            if (Array.isArray(depParsed?.ClassValues)) addList(classMap, depParsed.ClassValues);
                        } catch (e) {
                            console.warn('Failed to parse AllDataPicklist.DependentOptionsData', e);
                        }
                    }
                });
            }

            // 2️⃣ Load from local Account table
            const retailerData = await UniversalUpdateInsert({
                ObjectName: 'Account',
                Type: 'get',
            });
            setExistingAccounts(Array.isArray(retailerData) ? retailerData : []);
            if (Array.isArray(retailerData)) {
                retailerData.forEach((acc: any) => {
                    if (acc?.Class__c) addOption(classMap, acc.Class__c, acc.Class__c);
                    if (acc?.Channel__c) addOption(channelMap, acc.Channel__c, acc.Channel__c);
                    if (acc?.DBType__c) addOption(channelMap, acc.DBType__c, acc.DBType__c);
                });
            }

            // Update UI with local data immediately
            if (classMap.size > 0) setClassOptions(Array.from(classMap.values()));
            if (channelMap.size > 0) setChannelOptions(Array.from(channelMap.values()));

            // 3️⃣ Fetch from Salesforce Online (Describe + SOQL)
            try {
                const isOnline = await isInternetAvailable();
                if (isOnline) {
                    // Lead__c describe
                    try {
                        const leadDesc = await apiFetch('GET', 'sobjects/Lead__c/describe', {}, 'SObjects');
                        const descObj = leadDesc?.data?.fields ? leadDesc.data : (leadDesc?.data?.data || leadDesc?.data);
                        addFromDescribe(descObj);
                    } catch (e) {
                        console.warn('Lead__c describe fetch error:', e);
                    }

                    // Account describe
                    try {
                        const accDesc = await apiFetch('GET', 'sobjects/Account/describe', {}, 'SObjects');
                        const descObj = accDesc?.data?.fields ? accDesc.data : (accDesc?.data?.data || accDesc?.data);
                        addFromDescribe(descObj);
                    } catch (e) {
                        console.warn('Account describe fetch error:', e);
                    }

                    // Lead standard describe
                    try {
                        const stdLeadDesc = await apiFetch('GET', 'sobjects/Lead/describe', {}, 'SObjects');
                        const descObj = stdLeadDesc?.data?.fields ? stdLeadDesc.data : (stdLeadDesc?.data?.data || stdLeadDesc?.data);
                        addFromDescribe(descObj);
                    } catch (e) {
                        console.warn('Lead standard describe fetch error:', e);
                    }

                    // SOQL query on Account for all distinct Class__c and Channel__c
                    try {
                        const accSoql = 'SELECT Class__c, Channel__c FROM Account WHERE Class__c != null OR Channel__c != null LIMIT 1000';
                        const accSoqlRes = await apiFetch('GET', `query/?q=${encodeURIComponent(accSoql)}`, {}, 'SObjects');
                        const records = accSoqlRes?.data?.records || accSoqlRes?.data?.data?.records || [];
                        if (Array.isArray(records)) {
                            records.forEach((r: any) => {
                                if (r?.Class__c) addOption(classMap, r.Class__c, r.Class__c);
                                if (r?.Channel__c) addOption(channelMap, r.Channel__c, r.Channel__c);
                            });
                        }
                    } catch (e) {
                        console.warn('Account SOQL picklist fetch error:', e);
                    }

                    // SOQL query on Lead__c for all distinct Class__c and Channel__c
                    try {
                        const leadSoql = 'SELECT Class__c, Channel__c FROM Lead__c WHERE Class__c != null OR Channel__c != null LIMIT 1000';
                        const leadSoqlRes = await apiFetch('GET', `query/?q=${encodeURIComponent(leadSoql)}`, {}, 'SObjects');
                        const recordsLead = leadSoqlRes?.data?.records || leadSoqlRes?.data?.data?.records || [];
                        if (Array.isArray(recordsLead)) {
                            recordsLead.forEach((r: any) => {
                                if (r?.Class__c) addOption(classMap, r.Class__c, r.Class__c);
                                if (r?.Channel__c) addOption(channelMap, r.Channel__c, r.Channel__c);
                            });
                        }
                    } catch (e) {
                        console.warn('Lead__c SOQL picklist fetch error:', e);
                    }
                }
            } catch (leadErr) {
                console.warn('Online picklist fetch error:', leadErr);
            }

            // Final sorted list with all options merged
            const finalClasses = Array.from(classMap.values()).sort((a, b) => a.label.localeCompare(b.label));
            const finalChannels = Array.from(channelMap.values()).sort((a, b) => a.label.localeCompare(b.label));

            if (finalClasses.length > 0) setClassOptions(finalClasses);
            if (finalChannels.length > 0) setChannelOptions(finalChannels);

            console.log('usersData', usersData[0]?.DeveloperName)
            const channelvalue = usersData[0]?.DeveloperName === 'H_T_SR' ? 'Direct' : 'Sub DB';
            setSelectedChannel(channelvalue)





            //set(users)
            setUsers(usersData)
            if (usersData[0]?.Sf_Id) {
                await fetchBeatsAndDistributors(usersData[0].Sf_Id);
            }

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

    const checkDuplicates = async () => {
        const outletName = (formData.name || '').trim().toLowerCase();
        const mobile = normalizePhone(formData.phone);
        const email = normalizeEmail(formData.email);
        const panVal = normalizePAN(formData.pan);
        const gstNum = normalizeGST(formData.gst);
        const address = (formData.street || '').trim().toLowerCase();

        // 1. Local Account check
        if (Array.isArray(existingAccounts)) {
            for (const acc of existingAccounts) {
                if (!acc) continue;
                if (acc.Name && acc.Name.trim().toLowerCase() === outletName) {
                    return 'Retailer Name already exists. Enter a new one.';
                }
                if (acc.Phone && normalizePhone(acc.Phone) === mobile) {
                    return 'Mobile number already exists. Enter a new one.';
                }
                if (email && acc.Email__c && normalizeEmail(acc.Email__c) === email) {
                    return 'Email address already exists. Enter a new one.';
                }
                if (panVal && acc.PAN_Number__c && normalizePAN(acc.PAN_Number__c) === panVal) {
                    return 'PAN number already exists. Enter a new one.';
                }
                if (acc.GSTIN_Number__c && normalizeGST(acc.GSTIN_Number__c) === gstNum) {
                    return 'GST number already exists. Enter a new one.';
                }
                if (acc.BillingStreet && acc.BillingStreet.trim().toLowerCase() === address) {
                    return 'Address already exists. Enter a new one.';
                }
            }
        }



        // 3. Online Salesforce check (if internet is available)
        const connected = await isInternetAvailable();
        if (connected) {
            try {
                const escapedName = formData.name.replace(/'/g, "\\'");
                const escapedStreet = formData.street.replace(/'/g, "\\'");
                const escapedEmail = formData.email.trim().replace(/'/g, "\\'");
                const escapedPan = formData.pan.trim().toUpperCase().replace(/'/g, "\\'");

                // Online Account Query
                let queryParts = [
                    `Name = '${escapedName}'`,
                    `Phone = '${mobile}'`,
                    `GSTIN_Number__c = '${gstNum}'`,
                    `BillingStreet = '${escapedStreet}'`
                ];
                if (escapedEmail) queryParts.push(`Email__c = '${escapedEmail}'`);
                if (escapedPan) queryParts.push(`PAN_Number__c = '${escapedPan}'`);

                const accountQuery = `SELECT Id, Name, Phone, Email__c, PAN_Number__c, GSTIN_Number__c, BillingStreet FROM Account WHERE ${queryParts.join(' OR ')} LIMIT 1`;
                const serverAccounts = await fetchRecords('Account', accountQuery);
                if (serverAccounts && serverAccounts.length > 0) {
                    const match = serverAccounts[0];
                    if (match.Name && match.Name.trim().toLowerCase() === outletName) {
                        return 'Retailer Name already exists on server. Enter a new one.';
                    }
                    if (match.Phone && normalizePhone(match.Phone) === mobile) {
                        return 'Mobile number already exists on server. Enter a new one.';
                    }
                    if (email && match.Email__c && normalizeEmail(match.Email__c) === email) {
                        return 'Email address already exists on server. Enter a new one.';
                    }
                    if (panVal && match.PAN_Number__c && normalizePAN(match.PAN_Number__c) === panVal) {
                        return 'PAN number already exists on server. Enter a new one.';
                    }
                    if (match.GSTIN_Number__c && normalizeGST(match.GSTIN_Number__c) === gstNum) {
                        return 'GST number already exists on server. Enter a new one.';
                    }
                    if (match.BillingStreet && match.BillingStreet.trim().toLowerCase() === address) {
                        return 'Address already exists on server. Enter a new one.';
                    }
                }

                // Online Lead__c Query
                let leadQueryParts = [
                    `Name = '${escapedName}'`,
                    `MobileNumber__c = '${mobile}'`,
                    `GSTIN_Number__c = '${gstNum}'`,
                    `Billing_Street__c = '${escapedStreet}'`
                ];
                if (escapedEmail) leadQueryParts.push(`Email__c = '${escapedEmail}'`);
                if (escapedPan) leadQueryParts.push(`PANNumber__c = '${escapedPan}'`);

                const leadQuery = `SELECT Id, Name, MobileNumber__c, Email__c, PANNumber__c, GSTIN_Number__c, Billing_Street__c FROM Lead__c WHERE ${leadQueryParts.join(' OR ')} LIMIT 1`;
                const serverLeads = await fetchRecords('Lead__c', leadQuery);
                if (serverLeads && serverLeads.length > 0) {
                    const match = serverLeads[0];
                    if (match.Name && match.Name.trim().toLowerCase() === outletName) {
                        return 'Retailer Name already exists as a pending Lead on server. Enter a new one.';
                    }
                    if (match.MobileNumber__c && normalizePhone(match.MobileNumber__c) === mobile) {
                        return 'Mobile number already exists as a pending Lead on server. Enter a new one.';
                    }
                    if (email && match.Email__c && normalizeEmail(match.Email__c) === email) {
                        return 'Email address already exists as a pending Lead on server. Enter a new one.';
                    }
                    if (panVal && match.PANNumber__c && normalizePAN(match.PANNumber__c) === panVal) {
                        return 'PAN number already exists as a pending Lead on server. Enter a new one.';
                    }
                    if (match.GSTIN_Number__c && normalizeGST(match.GSTIN_Number__c) === gstNum) {
                        return 'GST number already exists as a pending Lead on server. Enter a new one.';
                    }
                    if (match.Billing_Street__c && match.Billing_Street__c.trim().toLowerCase() === address) {
                        return 'Address already exists as a pending Lead on server. Enter a new one.';
                    }
                }
            } catch (err) {
                console.warn('Online duplicate check query failed:', err);
            }
        }
        return null;
    };


    const validate = () => {
        const newErrors = {};

        // No field is required; formats are validated only when a value is entered.

        if (formData.phone.trim() && !/^[6-9]\d{9}$/.test(formData.phone)) {
            newErrors.phone = "Invalid Mobile number (must be 10 digits starting with 6-9)";
        }

        if (
            formData.email.trim() &&
            !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(formData.email)
        ) {
            newErrors.email = "Invalid email address";
        }

        if (formData.pan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(formData.pan.toUpperCase())) {
            newErrors.pan = "Invalid PAN number (format: ABCDE1234F)";
        }

        if (
            formData.gst.trim() &&
            !/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/.test(formData.gst.toUpperCase())
        ) {
            newErrors.gst = "Invalid GST number (format: 22AAAAA1111A1Z1)";
        }

        if (formData.fssai.trim()) {
            if (!/^\d{14}$/.test(formData.fssai)) {
                newErrors.fssai = "Invalid FSSAI number (must be exactly 14 digits)";
            } else if (/^0+$/.test(formData.fssai)) {
                newErrors.fssai = "FSSAI number cannot be all zeros";
            }
        }

        const postalCodeTrimmed = formData.postalCode.trim();
        if (postalCodeTrimmed) {
            if (!/^\d+$/.test(postalCodeTrimmed)) {
                newErrors.postalCode = "Postal Code must contain digits only";
            } else if (postalCodeTrimmed.startsWith("0")) {
                newErrors.postalCode = "Postal Code cannot start with 0";
            } else if (postalCodeTrimmed.length !== 6) {
                newErrors.postalCode = "Postal Code must be exactly 6 digits";
            } else if (/^(\d)\1{5}$/.test(postalCodeTrimmed)) {
                newErrors.postalCode = "Postal Code cannot have all repeating digits";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    useEffect(() => {
        const fetchLocationAndAddress = async () => {
            const prefilled = route?.params?.prefilled;
            if (prefilled && prefilled.latitude && prefilled.longitude) {
                // Instantly prefill known data (no loading screen!)
                const latStr = String(prefilled.latitude);
                const lngStr = String(prefilled.longitude);
                setLatitude(latStr);
                setLongitude(lngStr);

                setFormData(prev => ({
                    ...prev,
                    name: prefilled.name || prev.name,
                    street: prefilled.address || prev.street,
                }));

                try {
                    const details = await fetchAddressDetails(prefilled.latitude, prefilled.longitude);
                    if (details) {
                        let matchedState = '';
                        let matchedCity = '';

                        if (details.state) {
                            const stateLower = details.state.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const foundState = STATE_CITY_DATA.find(item => {
                                const itemStateLower = item.state.toLowerCase().replace(/[^a-z0-9]/g, '');
                                return itemStateLower.includes(stateLower) || stateLower.includes(itemStateLower);
                            });
                            if (foundState) {
                                matchedState = foundState.state;
                            }
                        }

                        if (details.city && matchedState) {
                            const cityLower = details.city.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const foundState = STATE_CITY_DATA.find(item => item.state === matchedState);
                            if (foundState) {
                                const foundCity = foundState.cities.find(c => {
                                    const cLower = c.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    return cLower.includes(cityLower) || cityLower.includes(cLower);
                                });
                                if (foundCity) {
                                    matchedCity = foundCity;
                                }
                            }
                        }

                        setFormData(prev => ({
                            ...prev,
                            street: details.street || prefilled.address || prev.street,
                            city: matchedCity || details.city || prev.city,
                            state: matchedState || details.state || prev.state,
                            postalCode: details.postalCode || prev.postalCode,
                        }));
                    } else if (prefilled.address) {
                        setFormData(prev => ({
                            ...prev,
                            street: prefilled.address,
                        }));
                    }
                } catch (err) {
                    console.warn('Prefilled address resolve error:', err);
                }
            } else {
                setLoadingMessage('Fetching location...');
                setLoading(true);
                try {
                    const coords = await getCurrentLocation();
                    if (coords && coords.latitude && coords.longitude) {
                        const latStr = String(coords.latitude);
                        const lngStr = String(coords.longitude);
                        setLatitude(latStr);
                        setLongitude(lngStr);

                        const details = await fetchAddressDetails(coords.latitude, coords.longitude);
                        if (details) {
                            let matchedState = '';
                            let matchedCity = '';

                            if (details.state) {
                                const stateLower = details.state.toLowerCase().replace(/[^a-z0-9]/g, '');
                                const foundState = STATE_CITY_DATA.find(item => {
                                    const itemStateLower = item.state.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    return itemStateLower.includes(stateLower) || stateLower.includes(itemStateLower);
                                });
                                if (foundState) {
                                    matchedState = foundState.state;
                                }
                            }

                            if (details.city && matchedState) {
                                const cityLower = details.city.toLowerCase().replace(/[^a-z0-9]/g, '');
                                const foundState = STATE_CITY_DATA.find(item => item.state === matchedState);
                                if (foundState) {
                                    const foundCity = foundState.cities.find(c => {
                                        const cLower = c.toLowerCase().replace(/[^a-z0-9]/g, '');
                                        return cLower.includes(cityLower) || cityLower.includes(cLower);
                                    });
                                    if (foundCity) {
                                        matchedCity = foundCity;
                                    }
                                }
                            }

                            setFormData(prev => ({
                                ...prev,
                                street: details.street || prev.street,
                                city: matchedCity || details.city || prev.city,
                                state: matchedState || details.state || prev.state,
                                postalCode: details.postalCode || prev.postalCode,
                            }));
                        }
                    } else {
                        dispatch(showToast({
                            message: 'Unable to get location coordinates.',
                            type: 'warning'
                        }));
                    }
                } catch (err) {
                    console.warn('Location/Address fetch error:', err);
                    dispatch(showToast({
                        message: 'Failed to fetch current location.',
                        type: 'error'
                    }));
                } finally {
                    setLoading(false);
                    setLoadingMessage('Saving retailer...');
                }
            }
        };

        fetchLocationAndAddress();
    }, [route?.params]);


    const isSubmitting = useRef(false);
    // console.log('beatDaysId',beatDaysId)
    const handleSubmit = async () => {
        if (isSubmitting.current || loading) {
            return;
        }
        if (!validate()) return;

        isSubmitting.current = true;
        setLoading(true);

        // Check for duplicate accounts (local and server)
        const dupError = await checkDuplicates();
        if (dupError) {
            dispatch(showToast({ message: dupError, type: 'warning' }));
            isSubmitting.current = false;
            setLoading(false);
            return;
        }

        // Check internet connectivity
        const connected = await isInternetAvailable();
        if (!connected) {
            dispatch(showToast({ message: 'Internet connection is required to submit a Retailer Lead.', type: 'error' }));
            isSubmitting.current = false;
            setLoading(false);
            return;
        }

        // Fetch GPS coordinates
        const latVal = Number(latitude);
        const lngVal = Number(longitude);

        if (!latVal || !lngVal) {
            dispatch(showToast({
                message: 'GPS location is required. Please turn on location services and try again.',
                type: 'error'
            }));
            isSubmitting.current = false;
            setLoading(false);
            return;
        }

        try {
            // Build the Lead__c payload
            const payload = {
                apiName: 'Lead__c',
                fields: {
                    Name: formData.name,
                    GSTIN_Number__c: formData.gst || null,
                    PANNumber__c: formData.pan,
                    MobileNumber__c: formData.phone,
                    Email__c: formData.email || null,
                    RegisteredDate__c: formData.registeredDate,
                    Latitude__c: latVal || 0,
                    Longitude__c: lngVal || 0,
                    Billing_Street__c: formData.street,
                    Billing_City__c: formData.city,
                    Billing_State__c: formData.state,
                    Billing_Postal_Code__c: formData.postalCode,
                    Billing_Country__c: formData.country || 'India',
                    Approval_Status__c: 'Pending',
                    Base64_Image__c: outletImage?.base64 || null,
                    FSSAINumber__c: formData.fssai || null,
                    Beat__c: selectedBeatId || null,
                    Class__c: selectedClass || null,
                    Channel__c: selectedChannel || null,
                },
            };

            console.log('Lead submission payload:', payload);
            const response = await apiFetch('POST', 'records', payload, 'standard');
            console.log('Lead submission response:', JSON.stringify(response));

            if (response.status === 'success' && response.data?.id) {
                dispatch(showToast({ message: 'Retailer submitted successfully.', type: 'success' }));
                navigation.navigate("TabbedScreen", {
                    defaultTab: "Rocket"
                });
            } else {
                const apiError = extractApiErrorMessage(response, null);
                dispatch(showToast({ message: apiError || 'Failed to submit Retailer Lead.', type: 'error' }));
            }
        } catch (err) {
            console.error('Lead submission exception:', err);
            dispatch(showToast({ message: 'An unexpected error occurred during submission.', type: 'error' }));
        } finally {
            isSubmitting.current = false;
            setLoading(false);
        }
    };

    // const handleChange = (field, value) => {
    //     setFormData(prev => ({ ...prev, [field]: value }));
    // };

    const validateField = (field, value) => {
        let errorMsg = null;
        if (field === 'name') {
        } else if (field === 'phone') {
            if (value.trim() && !/^[6-9]\d{9}$/.test(value)) {
                errorMsg = "Invalid Mobile number (must be 10 digits starting with 6, 7, 8, 9)";
            }
        } else if (field === 'email') {
            if (
                value.trim() &&
                !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value)
            ) {
                errorMsg = "Invalid email address";
            }
        } else if (field === 'pan') {
            if (value.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value.toUpperCase())) {
                errorMsg = "Invalid PAN number (format: ABCDE1234F)";
            }
        } else if (field === 'gst') {
            if (value.trim() && !/^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/.test(value.toUpperCase())) {
                errorMsg = "Invalid GST number (format: 22AAAAA1111A1Z1)";
            }
        } else if (field === 'fssai') {
            if (value.trim()) {
                if (!/^\d{14}$/.test(value)) {
                    errorMsg = "Invalid FSSAI number (must be exactly 14 digits)";
                } else if (/^0+$/.test(value)) {
                    errorMsg = "FSSAI number cannot be all zeros";
                }
            }
        } else if (field === 'postalCode') {
            if (value.trim()) {
                const postalCodeTrimmed = value.trim();
                if (!/^\d+$/.test(postalCodeTrimmed)) {
                    errorMsg = "Postal Code must contain digits only";
                } else if (postalCodeTrimmed.startsWith("0")) {
                    errorMsg = "Postal Code cannot start with 0";
                } else if (postalCodeTrimmed.length !== 6) {
                    errorMsg = "Postal Code must be exactly 6 digits";
                } else if (/^(\d)\1{5}$/.test(postalCodeTrimmed)) {
                    errorMsg = "Postal Code cannot have all repeating digits";
                }
            }
        }

        setErrors(prev => ({ ...prev, [field]: errorMsg }));
    };

    const handleChange = (field, value) => {
        let cleanedValue = value;
        if (field === 'fssai') {
            cleanedValue = value.replace(/\D/g, '').slice(0, 14);
        } else if (field === 'phone') {
            cleanedValue = value.replace(/\D/g, '').slice(0, 10);
        } else if (field === 'postalCode') {
            cleanedValue = value.replace(/\D/g, '').slice(0, 6);
        } else if (field === 'pan') {
            cleanedValue = value.toUpperCase().slice(0, 10);
        } else if (field === 'gst') {
            cleanedValue = value.toUpperCase().slice(0, 15);
        }
        setFormData(prev => ({ ...prev, [field]: cleanedValue }));
        validateField(field, cleanedValue);
    };

    const isNamePrefilled = !!route?.params?.prefilled?.name;

    const generalFields = [
        { key: 'name', label: 'Retailer Name', keyboardType: 'default', disabled: isNamePrefilled },
        { key: 'registeredDate', label: 'Registered Date', keyboardType: 'default', disabled: true },
        { key: 'phone', label: 'Mobile number', keyboardType: 'phone-pad', maxLength: 10 },
        { key: 'email', label: 'Email', keyboardType: 'email-address' },
        { key: 'pan', label: 'PAN Number', keyboardType: 'default', maxLength: 10, autoCapitalize: 'characters' as const },
        { key: 'gst', label: 'GST Number', keyboardType: 'default', maxLength: 15, autoCapitalize: 'characters' as const },
        { key: 'fssai', label: 'FSSAI Number', keyboardType: 'numeric', maxLength: 14 },
    ];

    const addressInputFields = [
        { key: 'street', label: 'Billing Street', keyboardType: 'default' },
        { key: 'postalCode', label: 'Billing Postal Code', keyboardType: 'numeric', maxLength: 6 },
    ];

    const addressFields = [
        { key: 'street', label: 'Street' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'postalCode', label: 'Postal Code', keyboardType: 'numeric' },
        { key: 'country', label: 'Country' },
    ];

    const stateOptions = STATE_CITY_DATA.map(item => ({ label: item.state, value: item.state }));
    const selectedStateObj = STATE_CITY_DATA.find(item => item.state === formData.state);
    const cityOptions = selectedStateObj
        ? selectedStateObj.cities.map(city => ({ label: city, value: city }))
        : [];

    return (
        <>
            <SafeAreaProvider style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
                <View style={styles.headerContainer}>
                    <HeaderMain screenName="Add Retailer" />
                </View>
                {renderCreateBeatModal()}

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
                            <LoaderOverlay visible={loading} message={loadingMessage} />
                        </View>
                    )}

                    {!loading && (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ flex: 1 }}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}
                        >
                            <ScrollView
                                style={{ padding: 15 }}
                                contentContainerStyle={{ paddingBottom: 90 }}
                                keyboardShouldPersistTaps="handled"
                            >

                                {generalFields.map(({ key, label, keyboardType, disabled, maxLength, autoCapitalize }) => {
                                    if (key === 'gst') {
                                        return (
                                            <View key={key}>
                                                {/* GST Field */}
                                                {(
                                                    <View style={styles.qCard}>
                                                        <Text style={styles.label}>{label}</Text>
                                                        <TextInput
                                                            style={[styles.container, { padding: 8, backgroundColor: disabled ? "#F1EADB" : "#fff" }]}
                                                            value={formData[key]}
                                                            onChangeText={val => handleChange(key, val)}
                                                            keyboardType={keyboardType}
                                                            placeholder={disabled ? "" : `Enter ${label}`}
                                                            placeholderTextColor="#999"
                                                            editable={!disabled}
                                                            maxLength={maxLength}
                                                            autoCapitalize={autoCapitalize || 'none'}
                                                        />
                                                        {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    }

                                    return (
                                        <View key={key}>
                                            {key === 'name' && renderSelectBeatField()}
                                            <View style={styles.qCard}>
                                                <Text style={styles.label}>{label}</Text>
                                                <TextInput
                                                    style={[styles.container, { padding: 8, backgroundColor: disabled ? "#F1EADB" : "#fff" }]}
                                                    value={formData[key]}
                                                    onChangeText={val => handleChange(key, val)}
                                                    keyboardType={keyboardType}
                                                    placeholder={disabled ? "" : `Enter ${label}`}
                                                    placeholderTextColor="#999"
                                                    editable={!disabled}
                                                    maxLength={maxLength}
                                                    autoCapitalize={autoCapitalize || 'none'}
                                                />
                                                {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                                            </View>
                                        </View>
                                    );
                                })}

                                {/* Class Dropdown (Above Address) */}
                                <View style={styles.qCard}>
                                    <Text style={styles.label}>
                                        Class
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
                                        itemTextStyle={styles.dropdownItemTextSmall}
                                        itemContainerStyle={styles.dropdownItemContainerSmall}
                                        renderItem={renderSmallDropdownItem}
                                        placeholder="Select Class"
                                        search
                                        searchPlaceholder="Search Class"
                                        maxHeight={200}
                                        value={selectedClass || null}
                                        onChange={(item) => {
                                            setSelectedClass(item.value);
                                            if (errors.class) {
                                                setErrors(prev => ({ ...prev, class: null }));
                                            }
                                        }}
                                    />
                                    {errors.class && <Text style={styles.error}>{errors.class}</Text>}
                                </View>

                                {/* Channel Dropdown (Above Address) */}
                                <View style={styles.qCard}>
                                    <Text style={styles.label}>
                                        Channel
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
                                        itemTextStyle={styles.dropdownItemTextSmall}
                                        itemContainerStyle={styles.dropdownItemContainerSmall}
                                        renderItem={renderSmallDropdownItem}
                                        placeholder="Select Channel"
                                        search
                                        searchPlaceholder="Search Channel"
                                        maxHeight={200}
                                        value={selectedChannel || null}
                                        onChange={(item) => {
                                            setSelectedChannel(item.value);
                                            if (errors.channel) {
                                                setErrors(prev => ({ ...prev, channel: null }));
                                            }
                                        }}
                                    />
                                    {errors.channel && <Text style={styles.error}>{errors.channel}</Text>}
                                </View>

                                {/* Address Fields */}
                                {addressInputFields.map(({ key, label, keyboardType, disabled, maxLength, autoCapitalize }) => (
                                    <View key={key} style={styles.qCard}>
                                        <Text style={styles.label}>{label}</Text>
                                        <TextInput
                                            style={[styles.container, { padding: 8, backgroundColor: disabled ? "#F1EADB" : "#fff" }]}
                                            value={formData[key]}
                                            onChangeText={val => handleChange(key, val)}
                                            keyboardType={keyboardType}
                                            placeholder={disabled ? "" : `Enter ${label}`}
                                            placeholderTextColor="#999"
                                            editable={!disabled}
                                            maxLength={maxLength}
                                            autoCapitalize={autoCapitalize || 'none'}
                                        />
                                        {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
                                    </View>
                                ))}

                                {/* Billing State Dropdown */}
                                <View style={styles.qCard}>
                                    <Text style={styles.label}>
                                        Billing State
                                    </Text>

                                    <Dropdown
                                        data={stateOptions}
                                        labelField="label"
                                        valueField="value"
                                        style={styles.dropdown}
                                        containerStyle={styles.dropdownContainer}
                                        inputSearchStyle={styles.searchbox}
                                        placeholderStyle={styles.placeholderDropdown}
                                        selectedTextStyle={styles.valueDropdown}
                                        placeholder="Select State"
                                        search
                                        searchPlaceholder={"Search"}
                                        value={formData.state}
                                        onChange={(item) => {
                                            setFormData(prev => ({ ...prev, state: item.value, city: '' }));
                                            if (errors.state) {
                                                setErrors(prev => ({ ...prev, state: null }));
                                            }
                                        }}
                                    />

                                    {errors.state && <Text style={styles.error}>{errors.state}</Text>}
                                </View>

                                {/* Billing City Dropdown */}
                                <View style={styles.qCard}>
                                    <Text style={styles.label}>
                                        Billing City
                                    </Text>

                                    <Dropdown
                                        data={cityOptions}
                                        labelField="label"
                                        valueField="value"
                                        style={styles.dropdown}
                                        containerStyle={styles.dropdownContainer}
                                        inputSearchStyle={styles.searchbox}
                                        placeholderStyle={styles.placeholderDropdown}
                                        selectedTextStyle={styles.valueDropdown}
                                        placeholder={formData.state ? "Select City" : "Select State First"}
                                        search
                                        searchPlaceholder={"Search"}
                                        value={formData.city}
                                        disable={!formData.state}
                                        onChange={(item) => {
                                            setFormData(prev => ({ ...prev, city: item.value }));
                                            if (errors.city) {
                                                setErrors(prev => ({ ...prev, city: null }));
                                            }
                                        }}
                                    />

                                    {errors.city && <Text style={styles.error}>{errors.city}</Text>}
                                </View>

                                {/* Latitude & Longitude Fields */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                                    <View style={[styles.qCard, { flex: 1, marginBottom: 0 }]}>
                                        <Text style={styles.label}>Latitude</Text>
                                        <TextInput
                                            style={[styles.container, { padding: 8, backgroundColor: '#F1EADB' }]}
                                            value={latitude}
                                            editable={false}
                                            placeholder="Auto-filled"
                                            placeholderTextColor="#999"
                                        />
                                    </View>
                                    <View style={[styles.qCard, { flex: 1, marginBottom: 0 }]}>
                                        <Text style={styles.label}>Longitude</Text>
                                        <TextInput
                                            style={[styles.container, { padding: 8, backgroundColor: '#F1EADB' }]}
                                            value={longitude}
                                            editable={false}
                                            placeholder="Auto-filled"
                                            placeholderTextColor="#999"
                                        />
                                    </View>
                                </View>

                                <View style={styles.qCard}>
                                    <Text style={styles.label}>
                                        Outlet Image
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
                        </KeyboardAvoidingView>
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
        backgroundColor: "#fff",
        borderColor: "#BEBEBE",
        borderWidth: 1,
        borderRadius: 8,
        justifyContent: "center",
    },
    searchbox: {
        borderWidth: 0,
        backgroundColor: "transparent",
        fontSize: 13,
        paddingLeft: 4,
        borderBottomWidth: 0.5,
        borderColor: "#D9D2C3",
        height: 38,
    },
    dropdownContainer: {
        borderRadius: 8,
        backgroundColor: "#fff",
        borderColor: "#D9D2C3",
        borderWidth: 1,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    placeholderDropdown: {
        color: "#7A7266",
        fontSize: 13,
    },
    valueDropdown: {
        color: "#1F1D1A",
        fontSize: 13,
    },
    dropdownItemSmall: {
        height: 34,
        paddingHorizontal: 12,
        justifyContent: "center",
        borderBottomWidth: 0.5,
        borderBottomColor: "#F1EADB",
    },
    dropdownItemTextSmall: {
        fontSize: 12,
        color: "#1F1D1A",
    },
    dropdownItemContainerSmall: {
        paddingVertical: 0,
        height: 34,
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
    checkboxBox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 24,
        width: "90%",
        maxWidth: 400,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalHeader: {
        fontSize: 18,
        fontWeight: "700",
        color: "#A67C2E",
        marginBottom: 16,
        textAlign: "center",
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: "500",
        color: "#333",
        marginBottom: 4,
        marginTop: 10,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: "#BEBEBE",
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 35,
        fontSize: 13,
        color: "#000",
    },
    modalDropdown: {
        height: 35,
        borderColor: "#BEBEBE",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    modalDropdownContainer: {
        borderRadius: 8,
        paddingVertical: 5,
    },
    modalButtonsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 18,
    },
    modalButton: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBtn: {
        backgroundColor: "#F1EADB",
        marginRight: 8,
    },
    submitBtn: {
        backgroundColor: "#C9A24D",
        marginLeft: 8,
    },
    cancelBtnText: {
        color: "#333",
        fontSize: 13,
        fontWeight: "600",
    },
    submitBtnText: {
        color: "#13265C",
        fontSize: 13,
        fontWeight: "600",
    },
});