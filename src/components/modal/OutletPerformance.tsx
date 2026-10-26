import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { LineChart, ProgressCircle } from 'react-native-svg-charts';
import * as shape from 'd3-shape';
import Feather from '@react-native-vector-icons/feather';
 
const { width } = Dimensions.get('window');
 
const OutletPerformanceModal = ({ visible, onClose }) => {
    const redData = [50, 10, 40, 30, 60, 20, 0]; // downward trend
    const greenData = [20, 30, 25, 40, 35, 45, 50]; // upward trend
 
    return (
        <Modal visible={visible} statusBarTranslucent transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Performance Summary</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Feather name="x" size={20} />
                        </TouchableOpacity>
                    </View>
 
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* First Two Cards */}
                        <View style={styles.cardRow1}>
                            <View style={styles.graphCard1}>
                                <View style={styles.graphLeft}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.amount}>₹ 1490</Text>
                                        <View style={[styles.badgeGreen, {backgroundColor:'#FFEBEB'}]}>
                                        <Text style={[styles.badgeText, {color:'#ED174F'}]}>▼ 10%</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.cardLabel}>Current month sales</Text>
                                </View>
                                <LineChart
                                    style={styles.graphChart}
                                    data={redData}
                                    svg={{ stroke: 'red' }}
                                    contentInset={{ top: 5, bottom: 5 }}
                                    curve={shape.curveNatural}
                                />
                            </View>
                            <View style={styles.graphCard1}>
                                <View style={styles.graphLeft}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.amount}>₹ 1690</Text>
                                        <View style={[styles.badgeGreen, {backgroundColor:'#D3FFDD'}]}>
                                        <Text style={[styles.badgeText, {color:'#239D3E'}]}>▲ 10%</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.cardLabel}>Previous month sales</Text>
                                </View>
                                <LineChart
                                    style={styles.graphChart}
                                    data={greenData}
                                    svg={{ stroke: 'green' }}
                                    contentInset={{ top: 5, bottom: 5 }}
                                    curve={shape.curveNatural}
                                />
                            </View>
                        </View>
 
                        {/* Metric Cards */}
                        <View style={styles.cardRow}>
                            <View style={styles.smallCard}>
                                <Text style={styles.smallValue}>3</Text>
                                <Text style={styles.smallLabel}>Must Sell Products</Text>
                            </View>
                            <View style={styles.smallCard}>
                                <Text style={styles.smallValue}>25%</Text>
                                <Text style={styles.smallLabel}>Lines Sold</Text>
                            </View>
                        </View>
 
                        <View style={styles.cardRow}>
                            <View style={styles.smallCard}>
                                <Text style={styles.smallValue}>₹ 1300</Text>
                                <Text style={styles.smallLabel}>Average Sales - 3M</Text>
                            </View>
                            <View style={styles.smallCard}>
                                <Text style={styles.smallValue}>90%</Text>
                                <Text style={styles.smallLabel}>Avg Bill Cut</Text>
                            </View>
                        </View>
 
                        {/* Progress Circle */}
                        <View style={styles.circleContainer}>
                            <ProgressCircle
                                style={styles.circle}
                                progress={0.6899}
                                progressColor={'#C9A24D'}
                                strokeWidth={25}
                                backgroundColor="#eee"
                            />
                            <View style={styles.circleTextContainer}>
                                <Text style={styles.achievedAmount}>₹6,899</Text>
                                <Text style={styles.achievedLabel}>Achieved</Text>
                                <Text style={styles.growth}>▲ <Text style={{ color: '#7A7266' }}>₹2,343 from last month</Text></Text>
 
                                {/* <Text style={styles.target}>Target : ₹10,000</Text> */}
                            </View>
                        </View>
 
                        <View style={{ height: 30 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};
 
export default OutletPerformanceModal;
 
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#00000070',
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 12,
        height: '85%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // backgroundColor:'red',
        height: 50,
        borderBottomColor: '#313131',
        borderBottomWidth: 0.5
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: 'black'
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 5,
    },
    cardRow1: {
        justifyContent: 'space-between',
        marginVertical: 10,
    },
    graphCard: {
        width: (width - 48) / 2,
        backgroundColor: '#FBF8F1',
        borderRadius: 10,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    graphCard1: {
        width: '100%', flexDirection: 'row', borderWidth: 1, padding: 12, borderRadius: 12, borderColor: '#D9D2C3',
        marginTop: 12
    },
    graphLeft: {
        flex: 1,
        paddingRight: 6,
    },
    graphChart: {
        height: 50,
        width: 170,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    amount: {
        fontSize: 20,
        fontWeight: '700',
        color: 'black'
 
    },
    badgeRed: {
        fontSize: 13,
        color: '#ED174F',
        backgroundColor: '#FFEBEB',
        paddingHorizontal: 6,
        borderRadius: 17,
        fontWeight: '700',
        marginLeft: 6,
 
 
    },
    badgeGreen: {
        borderRadius: 17,
        paddingHorizontal: 6,
        // padding:5,
        marginLeft: 6,
    },
    badgeText:{
fontSize: 13,
        fontWeight: '700',
    },
    cardLabel: {
        fontSize: 12,
        color: 'black',
        fontWeight: '400',
        marginTop:7
    },
    smallCard: {
        width: (width - 48) / 2,
        backgroundColor: 'white',
        borderWidth: 1, borderRadius: 12, borderColor: '#D9D2C3',
        padding: 12,
    },
    smallValue: {
        fontSize: 20,
        color: 'black',
        fontWeight: 'bold',
    },
    smallLabel: {
        fontSize: 12,
        color: 'black',
        fontWeight: '400',
        marginTop:7
    },
    circleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        position: 'relative',
    },
    circle: {
        height: 250,
        width: 220,
    },
    circleTextContainer: {
        position: 'absolute',
        alignItems: 'center',
    },
    achievedAmount: {
        fontSize: 22,
        color: 'black',
        fontWeight: 'bold',
 
    },
    achievedLabel: {
        fontSize: 10,
        color: '#1F1D1A',
    },
    growth: {
        fontSize: 10,
        color: 'green',
        marginTop: 4,
    },
    target: {
        fontSize: 14,
        color: 'crimson',
        fontWeight: 'bold',
    },
});
 