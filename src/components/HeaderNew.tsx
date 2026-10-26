import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Cart from '../assets/images/Cart.svg'; // SVG Cart icon
import { useNavigation } from '@react-navigation/native';

const StoreHeader = ({ screenName = '', title = 'Outlets' }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.leftRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path 
                d="M19 12H5M12 19l-7-7 7-7" 
                stroke="#fff" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
        </View>

      
          {/* <TouchableOpacity onPress={() => navigation.navigate('CartScreen')}>
            <Cart width={25} height={25} />
          </TouchableOpacity> */}
       
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 70,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 15,
    marginLeft: 8,
    fontWeight: '400',
  },
});

export default StoreHeader;
