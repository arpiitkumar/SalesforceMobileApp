import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import Icon from "@react-native-vector-icons/material-icons";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../../assets/css/MasterCss.js";
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { useSelector, useDispatch } from 'react-redux';
import { setDistributorId, clearDistributorId } from '../../redux/slices/distributorSlice';
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { getDistributorListForBeat } from "../../utils/distributorHelper";

const DistributorModal = ({ visible, onClose, onConfirm }) => {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedValue, setSelectedValue] = useState(null);
    const dispatch = useDispatch();
    const [showModal, setShowModal] = useState(false);


    const selectedVisit = useSelector((state) => state.selectedVisit);
    const selectedAccount = useSelector((state) => state.selectedAccount?.selectedAccount);
    const userState = useSelector((state) => state.user?.userData || state.user?.user);
    const { id: beatId } = useSelector((state) => state.beatSelection);

    const { fetchRecords } = useApiFetch();

    const getDistributorList = async () => {
        try {
            setLoading(true);

            const currentBeatId = selectedVisit?.Beat__c || selectedAccount?.Beat__c || beatId;
            const accountId = selectedVisit?.AccountId || selectedVisit?.AccountId__c || selectedAccount?.Sf_Id || selectedAccount?.Id;
            const userId = userState?.[0]?.Sf_Id || userState?.Sf_Id || userState?.[0]?.Id;

            const response = await getDistributorListForBeat({
                currentBeatId,
                accountId,
                userId,
                fetchRecords
            });

            if (response && response.length === 1) {
                const singleValue = response[0].value;
                dispatch(setDistributorId(singleValue));
                onConfirm(singleValue);
                return;
            }
            if (response && response.length > 1) {
                setList(response);
                setSelectedValue(response[0].value);
                setShowModal(true);
                return;
            }
            if (!response || response.length === 0) {
                console.log("DistributorModal: No cached distributor found for this beat, proceeding to Spot Sales");
                onConfirm(null);
                return;
            }
        } catch (error) {
            console.log("Error fetching distributor list in modal:", error);
            onConfirm(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            setShowModal(false);
            getDistributorList();
        }
    }, [visible]);


    return (
        // <Modal transparent visible={visible} animationType="slide">
        <Modal transparent visible={visible && showModal} animationType="slide">
            <View style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.4)",
                justifyContent: "flex-end"
            }}>
                <View style={{
                    backgroundColor: "white",
                    padding: 20,
                    height: "38%",
                    borderTopLeftRadius: 18,
                    borderTopRightRadius: 18
                }}>

                    {/* Header */}
                    <View style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 15
                    }}>
                        <Text style={{ fontSize: 22, fontWeight: "700", color: "#000" }}>
                            Distributor List
                        </Text>

                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={26} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {/* Separator */}
                    <View style={{
                        height: 1.3,
                        backgroundColor: "#cfcfcf",
                        width: "100%",
                        marginBottom: 15
                    }} />

                    {/* Select Label */}
                    <Text style={{
                        fontSize: 16,
                        fontWeight: "600",
                        marginBottom: 6,
                        color: "#333"
                    }}>
                        Select Distributor
                    </Text>

                    {loading ? (
                        <ActivityIndicator size="large" />
                    ) : (
                        <Dropdown
                            data={list}
                            labelField="label"
                            valueField="value"
                            placeholder="Choose Distributor"
                            //   search
                            //   searchPlaceholder="Search"
                            value={selectedValue}
                            style={{
                                height: 48,
                                paddingHorizontal: 12,
                                backgroundColor: "#FFFFFF",
                                borderColor: "#c2c2c2",
                                borderWidth: 1,
                                borderRadius: 10,
                                marginBottom: 10,
                                elevation: 1
                            }}
                            containerStyle={{
                                borderRadius: 10,
                                elevation: 4,
                                borderWidth: 1,
                                borderColor: "#D9D2C3",
                            }}
                            inputSearchStyle={{
                                borderWidth: 1,
                                borderColor: "#D0D0D0",
                                backgroundColor: "#F1EADB",
                                fontSize: 14,
                                borderRadius: 6,
                                paddingHorizontal: 10,
                                margin: 6,
                                height: 38
                            }}
                            placeholderStyle={{ color: "#8E8E8E", fontSize: 14 }}
                            selectedTextStyle={{ color: "#000", fontSize: 15, fontWeight: "500" }}
                            onChange={(item) => setSelectedValue(item.value)}
                        />
                    )}

                    {/* Gradient Save Button */}
                    <TouchableOpacity
                        disabled={!selectedValue}
                        onPress={() => {
                            // console.log("Selected Distributor:", selectedValue);
                            dispatch(setDistributorId(selectedValue));
                            onConfirm(selectedValue);
                        }}
                        style={{ marginTop: 20 }}
                    >
                        <LinearGradient
                            colors={selectedValue ? Gradients.primary : Gradients.disabled}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                paddingVertical: 12,
                                borderRadius: 10,
                                opacity: selectedValue ? 1 : 0.6
                            }}
                        >
                            <Text style={{
                                textAlign: "center",
                                fontSize: 18,
                                fontWeight: "bold",
                                color: "white"
                            }}>
                                Save
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                </View>
            </View>
        </Modal>
    );
};

export default DistributorModal;
