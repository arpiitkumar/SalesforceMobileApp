import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Formik } from 'formik';
import LinearGradient from 'react-native-linear-gradient';
import Entypo from '@react-native-vector-icons/entypo';
import { Gradients } from '../../assets/css/MasterCss';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { isInternetAvailable } from '../../utils/networkUtils';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import { Dropdown } from 'react-native-element-dropdown';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/slices/toastSlice';

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
    cities: ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jaljaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur", "Siliguri", "Asansol", "Durgapur"]
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

const { height } = Dimensions.get('window');

const EditAccountModal = ({
  visible,
  onClose,
  accountData = {},
  onSuccess,
}) => {
  const { apiFetch, apiComposite } = useApiFetch();
  const dispatch = useDispatch();

  // Validators object
  const validators = {
    Phone: {
      regex: /^[6-9]\d{9}$/,
      error: "Invalid phone number",
    },
    Email: {
      regex: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
      error: "Invalid email address",
    },
    PAN: {
      regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
      error: "Invalid PAN number",
    },
    GST: {
      regex: /^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/,
      error: "Invalid GST number",
    },
  };

  // Validation function
  const validate = (values) => {
    const errors = {};

    // Mobile validation (required)
    const mobile = values.mobile?.trim();
    if (!mobile) {
      errors.mobile = "Mobile number is required";
    } else if (!validators.Phone.regex.test(mobile)) {
      errors.mobile = validators.Phone.error;
    }

    // Customer Name validation (required)
    const customerName = values.customerName?.trim();
    if (!customerName) {
      errors.customerName = "Customer Name is required";
    }

    // PAN validation (optional but must be valid if provided)
    if (values.PAN_Number__c) {
      const pan = values.PAN_Number__c.trim().toUpperCase();
      if (!validators.PAN.regex.test(pan)) {
        errors.PAN_Number__c = validators.PAN.error;
      }
    }

    // GST validation (optional but must be valid if provided)
    if (values.GSTIN_Number__c) {
      const gst = values.GSTIN_Number__c.trim().toUpperCase();
      if (!validators.GST.regex.test(gst)) {
        errors.GSTIN_Number__c = validators.GST.error;
      }
    }

    // Billing Street validation
    if (!values.BillingStreet?.trim()) {
      errors.BillingStreet = "Street is required";
    }

    // Billing State validation
    if (!values.BillingState?.trim()) {
      errors.BillingState = "State is required";
    }

    // Billing City validation
    if (!values.BillingCity?.trim()) {
      errors.BillingCity = "City is required";
    }

    // Postal code validation
    const postalCode = values.BillingPostalCode?.trim();
    if (!postalCode) {
      errors.BillingPostalCode = "Postal Code is required";
    } else {
      if (!/^\d+$/.test(postalCode)) {
        errors.BillingPostalCode = "Postal Code must contain digits only";
      } else if (postalCode.startsWith("0")) {
        errors.BillingPostalCode = "Postal Code cannot start with 0";
      } else if (postalCode.length !== 6) {
        errors.BillingPostalCode = "Postal Code must be exactly 6 digits";
      } else if (/^(\d)\1{5}$/.test(postalCode)) {
        errors.BillingPostalCode = "Postal Code cannot have all repeating digits";
      }
    }

    return errors;
  };

  // Handle form submission
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const updatedAccount = {
        ...accountData,
        Phone: values.mobile,
        Name: values.customerName,
        BillingStreet: values.BillingStreet,
        BillingCity: values.BillingCity,
        BillingState: values.BillingState,
        BillingPostalCode: values.BillingPostalCode,
        GSTIN_Number__c: values.GSTIN_Number__c,
        PAN_Number__c: values.PAN_Number__c,
      };


      const connected = await isInternetAvailable();
      let isFromApi = false;
      let errorMsg = '';

      // Try API sync if connected
      if (connected) {
        const compositePayload = {
          compositeRequest: [
            {
              method: "PATCH",
              url: `/services/data/v61.0/sobjects/Account/${updatedAccount.Sf_Id}`,
              referenceId: "updateAccount",
              body: {
                Phone: updatedAccount.Phone,
                BillingCity: updatedAccount.BillingCity,
                BillingPostalCode: updatedAccount.BillingPostalCode,
                BillingState: updatedAccount.BillingState,
                BillingStreet: updatedAccount.BillingStreet,
                PAN_Number__c: updatedAccount.PAN_Number__c,
                GSTIN_Number__c: updatedAccount.GSTIN_Number__c,
              },
            },
          ],
          allOrNone: true,
        };

        const response = await apiComposite("POST", "composite", compositePayload);
        console.log("COMPOSITE RESPONSE ========", JSON.stringify(response));

        if (response.status === "success") {
          const updateResp = response.data.compositeResponse.find(
            (r) => r.referenceId === "updateAccount"
          );
          if (updateResp && (updateResp.httpStatusCode === 200 || updateResp.httpStatusCode === 204)) {
            isFromApi = true;
            console.log("API SUCCESS — isFromApi set to TRUE");
          } else {
            console.log("API FAILED — isFromApi remains FALSE");
            const firstError = updateResp?.body?.[0] || updateResp?.body?.errors?.[0];
            errorMsg = firstError?.message || firstError?.errorMessage || "API error saving Account";
          }
        } else {
          errorMsg = response.message || "Network request failed";
        }
      } else {
        errorMsg = "Device is offline";
      }

      // Save to local database
      const payload = {
        Sf_Id: updatedAccount.Sf_Id,
        Phone: updatedAccount.Phone,
        BillingCity: updatedAccount.BillingCity,
        BillingPostalCode: updatedAccount.BillingPostalCode,
        BillingState: updatedAccount.BillingState,
        BillingStreet: updatedAccount.BillingStreet,
        PAN_Number__c: updatedAccount.PAN_Number__c,
        GSTIN_Number__c: updatedAccount.GSTIN_Number__c,
        is_locally_changed: true,
        operation_type: "insert",
        last_modified: Date.now(),
        is_synced: isFromApi,
        sync_status: isFromApi ? 'synced' : 'failed',
        ErrorMsg: errorMsg,
      };

      const inserted = await UniversalUpdateInsert({
        ObjectName: 'Account',
        Type: 'insert',
        data: payload,
      });

      if (inserted) {
        if (isFromApi) {
          dispatch(showToast({
            message: 'Account saved successfully.',
            type: 'success',
          }));
        } else {
          Alert.alert('Saved Locally', `Failed to sync to server. Error: ${errorMsg}`);
        }
        onClose();
        if (onSuccess) onSuccess(updatedAccount);
      } else {
        Alert.alert('Error', 'Failed to save account.');
      }
    } catch (error) {
      console.error('Error saving account:', error);
      Alert.alert('Error', 'An error occurred while saving account.');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if OTP is verified
  const isOTPVerified = accountData?.OTPVerified__c === "Yes";

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Account Info</Text>
            <TouchableOpacity onPress={onClose}>
              <Entypo name="cross" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Formik
              enableReinitialize
              initialValues={{
                mobile: accountData.Phone || '',
                customerName: accountData.Name || '',
                GSTIN_Number__c: accountData.GSTIN_Number__c || '',
                PAN_Number__c: accountData.PAN_Number__c || '',
                BillingStreet: accountData.BillingStreet || '',
                BillingState: accountData.BillingState || '',
                BillingPostalCode: accountData.BillingPostalCode || '',
                BillingCity: accountData.BillingCity || '',
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
                isSubmitting,
                setFieldValue,
              }) => {
                const stateOptions = STATE_CITY_DATA.map(item => ({ label: item.state, value: item.state }));
                const selectedStateObj = STATE_CITY_DATA.find(item => item.state === values.BillingState);
                const cityOptions = selectedStateObj
                  ? selectedStateObj.cities.map(city => ({ label: city, value: city }))
                  : [];

                return (
                  <>
                    {/* Name - Not Editable */}
                    <View style={styles.fieldContainer}>
                      <Text style={styles.label}>
                        Name
                      </Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: '#F1EADB' }]}
                        placeholder="Mr./Ms."
                        onChangeText={handleChange('customerName')}
                        onBlur={handleBlur('customerName')}
                        value={values.customerName}
                        editable={false}
                      />
                      {touched.customerName && errors.customerName && (
                        <Text style={styles.error}>{errors.customerName}</Text>
                      )}
                    </View>

                    {/* Mobile Number - Conditional Edit */}
                    <View style={styles.fieldContainer}>
                      <Text style={styles.label}>
                        Mobile Number <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          isOTPVerified && { backgroundColor: '#F1EADB' },
                        ]}
                        placeholder="10-digit mobile number"
                        keyboardType="numeric"
                        maxLength={10}
                        onChangeText={handleChange('mobile')}
                        onBlur={handleBlur('mobile')}
                        value={values.mobile}
                        editable={!isOTPVerified}
                      />
                      {touched.mobile && errors.mobile && (
                        <Text style={styles.error}>{errors.mobile}</Text>
                      )}
                      {isOTPVerified && (
                        <Text style={styles.disabledInfo}>
                          ℹ️ Phone is locked after OTP verification
                        </Text>
                      )}
                    </View>

                    {/* GST - Conditional Edit */}
                    <View style={styles.fieldContainer}>
                      <Text style={styles.label}>
                        GST <Text style={styles.required}></Text>
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          isOTPVerified && { backgroundColor: '#F1EADB' },
                        ]}
                        placeholder="GST Number (15 chars)"
                        onChangeText={(text) => handleChange('GSTIN_Number__c')(text.toUpperCase())}
                        onBlur={handleBlur('GSTIN_Number__c')}
                        value={values.GSTIN_Number__c}
                        editable={!isOTPVerified}
                        maxLength={15}
                      />
                      {touched.GSTIN_Number__c && errors.GSTIN_Number__c && (
                        <Text style={styles.error}>{errors.GSTIN_Number__c}</Text>
                      )}
                    </View>

                    {/* PAN - Conditional Edit */}
                    <View style={styles.fieldContainer}>
                      <Text style={styles.label}>
                        PAN <Text style={styles.required}></Text>
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          isOTPVerified && { backgroundColor: '#F1EADB' },
                        ]}
                        placeholder="PAN Number (10 chars)"
                        onChangeText={(text) => handleChange('PAN_Number__c')(text.toUpperCase())}
                        onBlur={handleBlur('PAN_Number__c')}
                        value={values.PAN_Number__c}
                        editable={!isOTPVerified}
                        maxLength={10}
                      />
                      {touched.PAN_Number__c && errors.PAN_Number__c && (
                        <Text style={styles.error}>{errors.PAN_Number__c}</Text>
                      )}
                    </View>

                    {/* Billing Street - Conditional Edit */}
                    <View style={styles.fieldContainer}>
                      <Text style={styles.label}>
                        Billing Street <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Street address"
                        onChangeText={handleChange('BillingStreet')}
                        onBlur={handleBlur('BillingStreet')}
                        value={values.BillingStreet}
                      />
                      {touched.BillingStreet && errors.BillingStreet && (
                        <Text style={styles.error}>{errors.BillingStreet}</Text>
                      )}
                    </View>

                    {/* Billing State - Conditional Edit */}
                    <View style={styles.fieldContainer}>
                      <Text style={styles.label}>
                        Billing State <Text style={styles.required}>*</Text>
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
                        searchPlaceholder="Search"
                        value={values.BillingState}
                        onChange={(item) => {
                          setFieldValue('BillingState', item.value);
                          setFieldValue('BillingCity', '');
                        }}
                      />
                      {touched.BillingState && errors.BillingState && (
                        <Text style={styles.error}>{errors.BillingState}</Text>
                      )}
                    </View>

                    {/* Billing City - Conditional Edit */}
                    <View style={styles.fieldContainer}>
                      <Text style={styles.label}>
                        Billing City <Text style={styles.required}>*</Text>
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
                        placeholder={values.BillingState ? "Select City" : "Select State First"}
                        search
                        searchPlaceholder="Search"
                        value={values.BillingCity}
                        disable={!values.BillingState}
                        onChange={(item) => {
                          setFieldValue('BillingCity', item.value);
                        }}
                      />
                      {touched.BillingCity && errors.BillingCity && (
                        <Text style={styles.error}>{errors.BillingCity}</Text>
                      )}
                    </View>

                    {/* Billing Postal Code - Conditional Edit */}
                    <View style={styles.fieldContainer}>
                      <Text style={styles.label}>
                        Billing Postal Code <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Postal code"
                        keyboardType="numeric"
                        onChangeText={handleChange('BillingPostalCode')}
                        onBlur={handleBlur('BillingPostalCode')}
                        value={values.BillingPostalCode}
                        maxLength={6}
                      />
                      {touched.BillingPostalCode && errors.BillingPostalCode && (
                        <Text style={styles.error}>{errors.BillingPostalCode}</Text>
                      )}
                    </View>



                    {/* Save Button - Only Show if OTP NOT Verified */}
                    {/* {!isOTPVerified && ( */}
                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={isSubmitting}
                      style={styles.buttonContainer}
                    >

                      <LinearGradient
                        colors={Gradients.primary}
                        style={styles.buttonGradient}
                      >
                        <Text style={styles.buttonText}>
                          {isSubmitting ? 'Saving...' : 'Save'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    {/* )} */}

                    {isOTPVerified && (
                      <View style={styles.verifiedMessage}>
                        <Text style={styles.verifiedText}>
                          ✓ Account verified. You can update billing address only.
                        </Text>
                      </View>
                    )}
                  </>
                )
              }}
            </Formik>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default EditAccountModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: height * 0.85,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  fieldContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  required: {
    color: '#ff4444',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#333',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  dropdownContainer: {
    borderRadius: 8,
  },
  searchbox: {
    height: 40,
    fontSize: 14,
  },
  placeholderDropdown: {
    color: '#999',
    fontSize: 14,
  },
  valueDropdown: {
    color: '#333',
    fontSize: 14,
  },
  error: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  disabledInfo: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  buttonContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 24,
    marginBottom: 8,
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedMessage: {
    backgroundColor: '#E3F1EA',
    borderWidth: 1,
    borderColor: '#4caf50',
    borderRadius: 8,
    padding: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  verifiedText: {
    color: '#2E7D5B',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
