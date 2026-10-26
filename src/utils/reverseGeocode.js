import { GOOGLE_API_KEY as GOOGLE_KEY } from '../secrets';
// utils/reverseGeocode.js
import axios from 'axios';
import { InsertNSyncLog } from './InsertNSyncLog';

const GOOGLE_API_KEY = GOOGLE_KEY;
const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

export const getAddressFromCoords = async (latitude, longitude) => {
  try {
    const response = await axios.get(
      `${GEOCODE_ENDPOINT}?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`
    );

    //console.log("RESPONES E FROM REVERSE GEOCODING CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",JSON.stringify(response))

    // 📝 Log the integration call (Google geocode is a direct API, not via apiFetch)
    InsertNSyncLog({
      endpoint: `${GEOCODE_ENDPOINT} (reverseGeocode)`,
      requestBody: { latitude, longitude },
      responseBody: { status: response.data?.status, address: response.data?.results?.[0]?.formatted_address },
      statusCode: response.status,
      loggingType: response.data?.status === 'OK' ? 'Success' : 'Warn',
    }).catch(() => {});

    if (response.data.status === 'OK') {
      return response.data.results[0].formatted_address;
    } else {
      return null;
    }
  } catch (error) {
    console.log('Reverse geocoding failed::::::::', error);

    // 📝 Log the failure
    InsertNSyncLog({
      endpoint: `${GEOCODE_ENDPOINT} (reverseGeocode)`,
      requestBody: { latitude, longitude },
      responseBody: error.response?.data || { message: error.message },
      statusCode: error.response?.status || 0,
      loggingType: 'Error',
    }).catch(() => {});

    return null;
  }
};
