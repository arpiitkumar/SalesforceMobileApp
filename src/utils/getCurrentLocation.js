import { PermissionsAndroid, Platform, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

export async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      } else {
        Alert.alert(
          'Permission Denied',
          'Please enable location permission from settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => openSettings(),
            },
          ]
        );
        return false;
      }
    } catch (err) {
      console.warn('Android permission error:', err);
      return false;
    }
  } else if (Platform.OS === 'ios') {
    try {
      const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);

      if (result === RESULTS.GRANTED) {
        return true;
      } else {
        Alert.alert(
          'Permission Denied',
          'Please enable location permission from settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => openSettings(),
            },
          ]
        );
        return false;
      }
    } catch (err) {
      console.warn('iOS permission error:', err);
      return false;
    }
  }

  return false;
}

export async function getCurrentLocation() {
  const hasPermission = await requestLocationPermission();

  if (!hasPermission) {
    throw new Error('Location permission not granted');
  }

  return new Promise((resolve, reject) => {
    console.log("Attempting to get location with high accuracy...");
    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;

        console.log("LAT:", latitude);
        console.log("LONG:", longitude);
        console.log("Accuracy:", accuracy); // meters

        resolve({
          latitude,
          longitude,
          accuracy
        });
      },
      error => {
        console.log("High accuracy Location Error:", error);
        console.log("Attempting fallback with low accuracy...");

        Geolocation.getCurrentPosition(
          position => {
            const { latitude, longitude, accuracy } = position.coords;

            console.log("Fallback LAT:", latitude);
            console.log("Fallback LONG:", longitude);
            console.log("Fallback Accuracy:", accuracy);

            resolve({
              latitude,
              longitude,
              accuracy
            });
          },
          fallbackError => {
            console.log("Fallback Location Error:", fallbackError);
            reject(fallbackError);
          },
          {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 10000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        accuracy: {
          android: 'high',
          ios: 'bestForNavigation',
        },
        timeout: 15000, // 15 seconds instead of 60 seconds
        maximumAge: 0,
        distanceFilter: 0,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  });
}
