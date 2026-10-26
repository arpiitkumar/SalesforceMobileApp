import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ScrollView,
    LayoutAnimation,
    Platform,
    UIManager,
    StatusBar,
    Image,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import HeaderMain from '../components/HeaderMain';
import SimpleLineIcons from '@react-native-vector-icons/simple-line-icons';
import FontAwesome from '@react-native-vector-icons/fontawesome';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { launchImageLibrary } from "react-native-image-picker";
import ImageResizer from "react-native-image-resizer";
import Ionicons from "../components/Ionicons";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert.js";
import { buildSyncFields, extractApiErrorMessage } from "../utils/sync/syncStatus";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../utils/networkUtils';
import LoaderOverlay from '../utils/helper/LoaderOverlay'


if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ensureNumberOrNull = (value) => {
    // Check if the value is null, undefined, or an empty string after trimming whitespace
    if (value === null || value === undefined || String(value).trim() === '') {
        return null;
    }
    // If it's a non-empty string, parse it as a number (WatermelonDB should handle this,
    // but explicit parsing makes it safer if the field state is guaranteed to be a number string)
    const num = Number(value);
    return isNaN(num) ? null : num;
};

const generateLocalSfId = () => `local_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const saveLocally = async (apiResult = { success: false }, payload = {}) => {
    try {

        console.log('save locally called..................')

        console.log('save locally ............................ payload', payload)
        const apiSuccess = !!apiResult.success;
        const onlineRecordId = apiSuccess ? apiResult.recordId : null;
        const Sf_Id = onlineRecordId || generateLocalSfId();
        const localPayload = {
            Sf_Id,
            Outlet_Name__c: payload.accountId || null,
            Product__c: payload.sku || null,
            Type__c: payload.type || payload.Type__c || '',
            Priority__c: payload.priority || null,
            LocationIssue__c: payload.location || null,
            // Missing_SKU__c: payload.missingSku || null,
            SKU__c: payload.type === 'Assortment Gap' ? payload.missingSku : payload.newSkuIdea || null,
            Remarks__c: payload.remarks || null,
            ObservedPrice__c: ensureNumberOrNull(payload.price),
            PotentialVolume__c: ensureNumberOrNull(payload.potential),
            // User__c: payload.userId || null,
            // FileNamePrefix__c: payload.fileNamePrefix || `IMG_${Date.now()}`,

            // image handling: prefer server publicUrl, else base64, else uri
            CapturePhoto__c: apiResult?.publicUrl
                ? apiResult.publicUrl
                : payload?.image?.base64
                    ? payload.image.base64
                    : payload?.image?.uri || null,

            is_locally_changed: !apiSuccess,
            operation_type: 'insert',
            last_modified: Date.now(),
            ...buildSyncFields({
                apiSuccess,
                attempted: !!apiResult.attempted,
                errorMsg: apiResult.errorMsg,
            }),
            SoftDelete: false,
        };

        console.log("🟡 Saving locally with payload:", localPayload);

        // UniversalUpdateInsert often expects either an array or single object.
        // Use array to be safe.
        const inserted = await UniversalUpdateInsert({
            ObjectName: "Growth_Mapping_Entry__c",
            Type: "insert",
            data: [localPayload],
        });

        console.log("Local save result:", inserted);

        return { success: !!inserted, Sf_Id, isSynced: apiSuccess };
    } catch (err) {
        console.error(" saveLocally failed:", err);
        return { success: false, error: err };
    }
};




const handleSave = async (type, data, apiFetch, dispatch, navigation, setLoading) => {
    try {
        setLoading(true)
        // Build API payload (adapt field names to your backend)
        const apiFields = {
            Type: type,
            OutletName: data.accountId || null,
            Product: data.sku || null,
            // MissingSKU: data.missingSku || null,
            SKU: type === 'Assortment Gap' ? data.missingSku : data.newSkuIdea || null,
            Remarks: data.remarks || null,
            LocationIssue: data.location || null,
            ObservedPrice: data.price || null,
            PotentialVolume: data.potential || null,
            Priority: data.priority || null,
            Units: null,
            // UserId: data.userId || null,
            // AssortmentId: data.assortmentId || null,
            CapturePhoto: data.image?.base64 ? data.image.base64 : null,
            fileNamePrefix: data.image?.name || null,
        };

        console.log("API Fields::::::::::::::", apiFields);
        // return
        // Local payload that'll be saved regardless of online success
        const localPayload = {
            ...data,
            type, // include type as well
        };




        // Try online submit if connected
        const connected = await isInternetAvailable();
        let apiResult = { success: false };

        if (connected) {
            try {
                const res = await apiFetch('POST', 'createGrowthMappingEntry', apiFields, 'Custom');
                console.log("createAssortmentProduct response:", res);
                // if (res?.data?.status === 'error') {
                //     setLoading(false)
                //     dispatch(showToast({ message: res?.data?.message, type: 'error' }));
                //     return;
                // }

                const responseBody =
                    res?.data?.data?.responseBody ||
                    res?.data?.responseBody ||
                    res?.responseBody ||
                    res?.data ||
                    null;

                const recordId = responseBody?.recordId || null;
                const publicUrl = responseBody?.publicUrl || null;
                const successFlag =
                    (res?.status === 'success') ||
                    (res?.data?.status === 'success') ||
                    Boolean(recordId) ||
                    Boolean(publicUrl);

                apiResult = {
                    success: !!successFlag,
                    recordId,
                    publicUrl,
                    raw: res,
                    Name: responseBody?.Name,
                    attempted: true,
                    errorMsg: successFlag ? null : extractApiErrorMessage(res, null),
                };

                if (!apiResult.success) {
                    console.warn("API returned non-success. Will still save locally.");
                }
            } catch (err) {
                console.warn("Online submit failed, will save locally:", err);
                apiResult = { success: false, error: err, attempted: true, errorMsg: extractApiErrorMessage(null, err) };
            }
        } else {
            console.log("No internet or apiFetch; saving locally.");
        }

        console.log('this is new..........................')

        // ALWAYS persist locally and mark sync flag according to apiResult
        const saveResult = await saveLocally(apiResult, localPayload);

        // feedback
        if (saveResult.success && saveResult.isSynced) {
            dispatch && dispatch(showToast({ message: 'Growth Mapping Saved Successfully.', type: 'success' }));
            setTimeout(() => {
                setLoading(false)
                navigation.goBack();
            }, 3000)
            return;
        } else if (saveResult.success) {
            dispatch && dispatch(showToast({ message: 'Growth Mapping Saved Successfully.', type: 'success' }));
            setTimeout(() => {
                setLoading(false)
                navigation.goBack();
            }, 3000)
            return;
        } else {
            setLoading(false)
            dispatch && dispatch(showToast({ message: 'Failed to save locally', type: 'error' }));
            return;
        }

        // return { success: !!saveResult.success, apiResult, saveResult };
    } catch (err) {
        console.error('handleSave error:', err);
        dispatch && dispatch(showToast({ message: 'Save failed', type: 'error' }));
        return { success: false, error: err };
    }
};



const CollapsibleCard = ({ title, children, activeCard, setActiveCard }) => {
    const isOpen = activeCard === title;

    const toggleCard = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveCard(isOpen ? null : title);
    };

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={toggleCard}>
                <Text style={styles.cardTitle}>{title}</Text>
                {isOpen ? (
                    <SimpleLineIcons name="arrow-up" color="#000" size={12} />
                ) : (
                    <SimpleLineIcons name="arrow-down" color="#000" size={12} />
                )}
            </TouchableOpacity>
            {isOpen && <View style={styles.cardContent}>{children}</View>}
        </View>
    );
};

const DynamicAssortmentCard = ({ item, activeCard, setActiveCard, priorityOptions, product2List, dummyProductId, user, loading, setLoading }) => {
    const [sku, setSku] = useState("");
    const [priority, setPriority] = useState(null);
    const [location, setLocation] = useState("");
    const [image, setImage] = useState(null);
    const [price, setPrice] = useState("");
    const [potential, setPotential] = useState("");
    const [remarks, setRemarks] = useState("");
    const selectedVisit = useSelector(state => state.selectedVisit)
    const { apiFetch } = useApiFetch()
    const dispatch = useDispatch()
    const navigation = useNavigation()


    const openImagePicker = async () => {
        try {
            const options = { mediaType: "photo", quality: 0.7, includeBase64: false };
            const res = await launchImageLibrary(options);

            if (res.didCancel || res.errorCode) return;
            if (res.assets && res.assets.length > 0) {
                const selected = res.assets[0];
                const resizedImage = await ImageResizer.createResizedImage(
                    selected.uri,
                    800,
                    800,
                    "JPEG",
                    70
                );

                const response = await fetch(resizedImage.uri);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64data = reader.result.split(',')[1];
                    setImage({
                        uri: resizedImage.uri,
                        base64: base64data,
                        name: selected.fileName || `image_${Date.now()}.jpg`,
                    });
                };
            }
        } catch (e) {
            console.warn(e);
        }
    };

    const removeImage = () => setImage(null);

    const handleSubmit = () => {
        const payload = {
            assortmentId: item.Sf_Id,
            sku: null,
            newSkuIdea: null,
            missingSku: null,
            priority: null,
            location: null,
            image: null,
            price: null,
            potential: null,
            remarks: remarks || null,
            accountId: selectedVisit?.AccountId || null,
            userId: user,
        };

        let isValid = true;
        let missingFields = [];

        if (item.Name === "Assortment Gap") {
            if (!sku) { isValid = false; missingFields.push('Missing SKU'); }
            if (!priority) { isValid = false; missingFields.push('Priority'); }

            payload.missingSku = sku;
            payload.sku = dummyProductId;
            payload.priority = priority;

            if (isValid) {
                handleSave("Assortment Gap", payload, apiFetch, dispatch, navigation, setLoading);
            }

        } else if (item.Name === "Assortment Expansion") {
            if (!sku) { isValid = false; missingFields.push('New SKU Idea'); }
            if (!potential) { isValid = false; missingFields.push('Potential Volume'); }

            payload.newSkuIdea = sku;
            payload.sku = dummyProductId;
            payload.potential = potential;

            if (isValid) {
                handleSave("Assortment Expansion", payload, apiFetch, dispatch, navigation, setLoading);
            }

        } else if (item.Name === "Assortment Visibility") {
            if (!location) { isValid = false; missingFields.push('Location Issue'); }
            if (!image) { isValid = false; missingFields.push('Image Evidence'); }

            payload.location = location;
            payload.sku = dummyProductId;
            payload.image = image;

            if (isValid) {
                handleSave("Assortment Visibility", payload, apiFetch, dispatch, navigation, setLoading);
            }

        } else if (item.Name === "Assortment Price") {
            if (!sku) { isValid = false; missingFields.push('SKU Name'); }
            if (!price) { isValid = false; missingFields.push('Observed Price'); }

            payload.sku = sku;
            payload.price = price;

            if (isValid) {
                handleSave("Assortment Price", payload, apiFetch, dispatch, navigation, setLoading);
            }
        }

        if (!isValid) {
            // alert('Please fill all required fields:\n' + missingFields.join('\n'));
            dispatch(showToast({ message: 'Please fill all required fields:\n' + missingFields.join('\n'), type: 'error' }));
        }
    };



    return (
        <CollapsibleCard title={item.Name} activeCard={activeCard} setActiveCard={setActiveCard}>
            {item.Name === "Assortment Gap" && (
                <>
                    <Text style={styles.label}>Missing SKU</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Missing SKU"
                        value={sku}
                        onChangeText={setSku}
                    />
                    <Text style={styles.label}>Priority</Text>

                    <Dropdown
                        data={priorityOptions}
                        search
                        searchPlaceholder="Search"
                        inputSearchStyle={{ fontSize: 10, borderRadius: 10, height: 40 }}
                        labelField="label"
                        itemTextStyle={{ fontSize: 12 }}
                        valueField="value"
                        placeholder="Select Priority"
                        value={priority}
                        style={styles.dropdown}
                        containerStyle={styles.dropdownContainer}
                        selectedTextStyle={styles.selectedTextStyle}
                        itemContainerStyle={{ marginVertical: -2 }}
                        placeholderStyle={styles.placeholderStyle}
                        onChange={(item) => setPriority(item.value)}
                    />

                </>
            )}

            {item.Name === "Assortment Expansion" && (
                <>
                    <Text style={styles.label}>New SKU Idea</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter New SKU Idea"
                        value={sku}
                        onChangeText={setSku}
                    />
                    <Text style={styles.label}>Potential Volume</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Potential Volume"
                        value={potential}
                        onChangeText={setPotential}
                        keyboardType="numeric"
                    />
                </>
            )}

            {item.Name === "Assortment Visibility" && (
                <>
                    <Text style={styles.label}>Location Issue</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Location Issue"
                        value={location}
                        onChangeText={setLocation}
                    />
                    <Text style={styles.label}>Image Evidence</Text>
                    {!image && (
                        <TouchableOpacity style={styles.imageBox} onPress={openImagePicker}>
                            <FontAwesome name="camera" size={18} />
                        </TouchableOpacity>
                    )}
                    {image && (
                        <View style={styles.thumbWrap}>
                            <Image source={{ uri: image.uri }} style={styles.thumb} />
                            <TouchableOpacity style={styles.removeIcon} onPress={removeImage}>
                                <Ionicons name="close" size={12} color="#ff5b5b" />
                            </TouchableOpacity>
                        </View>
                    )}
                </>
            )}

            {item.Name === "Assortment Price" && (
                <>
                    <Text style={styles.label}>SKU Name</Text>
                    <Dropdown
                        data={product2List}
                        search
                        searchPlaceholder="Search"
                        inputSearchStyle={{ fontSize: 10, borderRadius: 10, height: 40 }}
                        labelField="label"
                        itemTextStyle={{ fontSize: 12 }}
                        valueField="value"
                        placeholder="Select SKU"
                        value={sku}
                        onChange={(item) => setSku(item.value)}
                        style={styles.dropdown}
                        containerStyle={styles.dropdownContainer}
                        selectedTextStyle={styles.selectedTextStyle}
                        itemContainerStyle={{ marginVertical: -2 }}
                        placeholderStyle={styles.placeholderStyle}
                    />
                    <Text style={styles.label}>Observed Price</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Observed Price"
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="numeric"
                    />
                </>
            )}

            <Text style={styles.label}>Remarks</Text>
            <TextInput
                style={styles.remarks}
                placeholder="Notes"
                value={remarks}
                onChangeText={setRemarks}
                multiline
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
                <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
        </CollapsibleCard>
    );
};

const AssortmentScreen = () => {
    const [activeCard, setActiveCard] = useState(null);
    const [priorityOptions, setPriorityOptions] = useState([]);
    const [product2List, setProduct2List] = useState([]);
    const [assortmentData, setAssortmentData] = useState([]);
    const [dummyProductId, setDummyProductId] = useState(null);
    const dispatch = useDispatch();
    const { apiFetch } = useApiFetch();
    const [user, setUser] = useState([])
    const [loading, setLoading] = useState(false)

    const assortmentObjectJson = [
        { Name: 'Assortment Gap', Sf_Id: '1' },
        { Name: 'Assortment Expansion', Sf_Id: '2' },
        { Name: 'Assortment Visibility', Sf_Id: '3' },
        { Name: 'Assortment Price', Sf_Id: '4' },

    ]


    useEffect(() => {
        const initialize = async () => {
            try {
                const result = await UniversalUpdateInsert({ ObjectName: 'Product2', Type: 'get' });
                const userData = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });
                // const getAssortmentData = await UniversalUpdateInsert({ ObjectName: 'Assortment', Type: 'get' });
                setAssortmentData(assortmentObjectJson);
                setUser(userData[0])
                const dropdownData = Array.isArray(result)
                    ? result.map((item) => ({
                        label: item.Name,
                        value: item.Sf_Id,
                    }))
                    : [];
                setProduct2List(dropdownData);

                const AllPicklistData = await UniversalUpdateInsert({ ObjectName: 'AllDataPicklist', Type: 'get' });
                console.log('AllPicklistData:', JSON.stringify(AllPicklistData));
                let optionsObj = null;

                if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
                    const raw = AllPicklistData[0]?.OptionsData;
                    optionsObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
                }

                setDummyProductId(optionsObj?.dummyProductId || null);
                const AssortmentPrioritypick = Array.isArray(optionsObj?.AssortmentPriority)
                    ? optionsObj.AssortmentPriority.map(it => ({
                        label: it.label || it.value,
                        value: it.value,
                    }))
                    : [];
                setPriorityOptions(AssortmentPrioritypick);
            } catch (error) {
                console.error(error);
            }
        };

        initialize();
    }, []);




    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Growth Mapping" />
            </View>
            <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                <ScrollView style={styles.container}>
                    {assortmentData.map((item) => (
                        <DynamicAssortmentCard
                            key={item.Sf_Id}
                            item={item}
                            activeCard={activeCard}
                            setActiveCard={setActiveCard}
                            priorityOptions={priorityOptions}
                            product2List={product2List}
                            dummyProductId={dummyProductId}
                            user={user.Sf_Id}
                            loading={loading}
                            setLoading={setLoading}
                        />
                    ))}
                </ScrollView>

                <LoaderOverlay visible={loading} />
            </View>
        </SafeAreaProvider>
    );
};

// Styles (reuse previous styles or adjust as needed)
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#A67C2E" },
    headerContainer: { backgroundColor: '#A67C2E' },
    container: { flex: 1, padding: 16 },
    card: {
        borderWidth: 1,
        borderColor: "#D9D2C3",
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: 'center',
        padding: 15,
        backgroundColor: "#FFFFFF",
    },
    cardTitle: { fontSize: 16, fontWeight: "600", color: '#1F1D1A' },
    cardContent: { paddingHorizontal: 15 },
    label: { fontSize: 14, marginBottom: 5, fontWeight: '500', color: '#333' },
    selectedText: { color: "#000000", fontSize: 14 },
    dropdown: {
        height: 40,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        width: '100%',
        marginBottom: 12
    },
    dropdownContainer: {
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#ccc',
        marginTop: -40
    },
    selectedTextStyle: {
        fontSize: 12,
        color: '#000',
    },
    placeholderStyle: {
        fontSize: 14,
        color: '#888',
    },
    input: {

        borderRadius: 6,
        paddingHorizontal: 8,
        height: 40,
        marginBottom: 12,
        borderColor: '#ccc',
        borderWidth: 1,
    },
    remarks: {
        color: '#0B0B0B',
        borderWidth: 1,
        borderColor: "#D9D2C3",
        borderRadius: 6,
        height: 80,
        padding: 8,
        marginBottom: 12,
        textAlignVertical: "top",
    },
    saveBtn: {
        backgroundColor: "#C9A24D",
        width: 100,
        alignSelf: 'center',
        paddingVertical: 12,
        marginBottom: 10,
        borderRadius: 10,
        alignItems: "center",
    },
    saveText: { color: "#fff", fontWeight: "600" },
    imageBox: {
        borderWidth: 1,
        borderColor: "#888",
        borderRadius: 6,
        width: "50%",
        height: 44,
        justifyContent: "center",
        alignItems: "center",
        borderStyle: "dashed",
        marginBottom: 12,
    },
    thumbWrap: {
        width: 100,
        height: 42,
        marginRight: 8,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#F1EADB',
        marginBottom: 12,
    },
    thumb: { width: '100%', height: '100%', resizeMode: 'contain' },
    removeIcon: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default AssortmentScreen;