// src/screens/FullMapScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
  StatusBar,
  Linking
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from '@react-native-vector-icons/fontawesome5';
import HeaderMain from "../components/HeaderMain";
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getCurrentLocation } from '../utils/getCurrentLocation';


const FullMapScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  // Expect param shape:
  // { locations: [{ latitude: 22.57, longitude: 88.36, title: 'Outlet A', address: '' }, ...] }
  // or single: { latitude, longitude, title, address }
  const params = route.params || {};

  const locations = params.locations
    ? params.locations
    : params.latitude && params.longitude
      ? [{ latitude: Number(params.latitude), longitude: Number(params.longitude), title: params.title, address: params.address }]
      : [];

  const [region, setRegion] = useState({
    latitude: locations[0]?.latitude ?? 22.5726,
    longitude: locations[0]?.longitude ?? 88.3639,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  const [userCoords, setUserCoords] = useState<any>(null);

  useEffect(() => {
    const fetchUserLoc = async () => {
      try {
        const loc = await getCurrentLocation();
        if (loc && loc.latitude && loc.longitude) {
          setUserCoords(loc);
        }
      } catch (err) {
        console.warn("Could not get user location in FullMapScreen:", err);
      }
    };
    fetchUserLoc();
  }, []);

  useEffect(() => {
    if (locations.length === 1) {
      if (userCoords) {
        const lats = [userCoords.latitude, locations[0].latitude];
        const lngs = [userCoords.longitude, locations[0].longitude];
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const latitudeDelta = Math.max(0.015, (maxLat - minLat) * 1.5);
        const longitudeDelta = Math.max(0.015, (maxLng - minLng) * 1.5);
        setRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta,
          longitudeDelta,
        });
      } else {
        setRegion({
          latitude: locations[0].latitude,
          longitude: locations[0].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } else if (locations.length > 1) {
      const lats = locations.map((l) => l.latitude);
      const lngs = locations.map((l) => l.longitude);
      if (userCoords) {
        lats.push(userCoords.latitude);
        lngs.push(userCoords.longitude);
      }
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const latitudeDelta = Math.max(0.015, (maxLat - minLat) * 1.5);
      const longitudeDelta = Math.max(0.015, (maxLng - minLng) * 1.5);
      setRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta,
        longitudeDelta,
      });
    }
  }, [route.params, userCoords]);

  const handleOpenNavigation = () => {
    if (locations.length === 0) return;
    const lat = locations[0].latitude;
    const lng = locations[0].longitude;
    const label = encodeURIComponent(locations[0].title || 'Outlet');
    
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}&q=${label}`,
      android: `google.navigation:q=${lat},${lng}`
    });

    if (url) {
      Linking.openURL(url).catch((err) => {
        console.warn("Failed to open native maps:", err);
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        Linking.openURL(webUrl);
      });
    }
  };

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={styles.headerContainer}>
        <HeaderMain screenName={locations[0]?.title || 'Map'} />
      </View>

      <View style={styles.container}>
        <MapView
          style={styles.map}
          region={region}
          provider={Platform.OS === 'android' ? MapView.PROVIDER_GOOGLE : undefined}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {locations.map((loc, i) => (
            <Marker
              key={`marker-${i}`}
              coordinate={{ latitude: Number(loc.latitude), longitude: Number(loc.longitude) }}
              title={loc.title || `Location ${i + 1}`}
              description={loc.address || ''}
            />
          ))}

        </MapView>

        {locations.length > 0 && (
          <View style={styles.floatingCard}>
            <View style={styles.cardDetails}>
              <Text style={styles.outletTitle} numberOfLines={1}>
                {locations[0].title}
              </Text>
              <Text style={styles.outletAddress} numberOfLines={2}>
                {locations[0].address || "No address details available."}
              </Text>
            </View>
            <TouchableOpacity style={styles.navigateBtn} onPress={handleOpenNavigation}>
              <LinearGradient colors={['#C9A24D', '#A67C2E', '#C9A24D']} style={styles.navGradient}>
                <Text style={styles.navBtnText}>Get Directions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
};

export default FullMapScreen;

const styles = StyleSheet.create({
   safeArea: {
        flex: 1,
        backgroundColor: '#A67C2E',
    },
  container: { flex: 1, overflow:'hidden',padding: 0,  borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  map: { flex: 1,borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtn: {
    marginRight: 12,
  },
  backGradient: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  headerTitle: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    maxWidth: screenWidth - 120,
  },
  floatingCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  cardDetails: {
    flex: 1,
    marginRight: 12,
  },
  outletTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F1D1A',
    marginBottom: 4,
  },
  outletAddress: {
    fontSize: 12,
    color: '#7A7266',
  },
  navigateBtn: {
    minWidth: 110,
  },
  navGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
