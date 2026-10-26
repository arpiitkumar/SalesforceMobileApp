import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../utils/networkUtils';
import { getCurrentLocation } from '../utils/getCurrentLocation';
import { setSelectedVisit } from '../redux/slices/selectedVisitSlice';
import { showToast } from '../redux/slices/toastSlice';
import UniversalUpdateInsert from '../../src/database/dbService/UniversalUpdateInsert';

const UpdateOutletLocationModal = ({
  visible,
  onClose,
  outlet,
}) => {
  const dispatch = useDispatch();
  const { apiFetch } = useApiFetch();

  const selectedVisit = useSelector(
    state => state.selectedVisit,
  );

  const [loading, setLoading] = useState(false);

  const handleYes = async () => {
    try {
      setLoading(true);
      // Internet Check
      const connected = await isInternetAvailable();
      if (!connected) {
        dispatch(
          showToast({
            message: 'Internet connection is required.',
            type: 'error',
          }),
        );
        return;
      }
      // Current Location
      const { latitude, longitude } = await getCurrentLocation();
      if (
        latitude === undefined ||
        longitude === undefined ||
        latitude === null ||
        longitude === null
      ) {
        dispatch(
          showToast({
            message: 'Unable to fetch current location.',
            type: 'error',
          }),
        );
        return;
      }
      let apiUpdated = false;
      try {
        const response = await apiFetch(
          'PATCH',
          `sobjects/Account/${outlet?.AccountId}`,
          {
            Account_Location_Latitude_Longitude__Latitude__s: latitude,
            Account_Location_Latitude_Longitude__Longitude__s: longitude,
          },
          'SObjects',
        );
        console.log('LAT LONG UPDATED ON SERVER', JSON.stringify(response),);
        if (response?.status === 'success') {
          apiUpdated = true;
        }
      } catch (apiErr) {
        console.log(' API update failed', apiErr);
      }
      await UniversalUpdateInsert({
        ObjectName: 'Account',
        Type: 'insert',
        data: {
          Sf_Id: outlet?.AccountId,
          BillingLatitude: latitude,
          BillingLongitude: longitude,
          is_synced: apiUpdated,
        },
      });
      const updatedVisit = {
        ...selectedVisit,
        BillingLatitude: latitude,
        BillingLongitude: longitude,
      };
      dispatch(setSelectedVisit(updatedVisit));
      dispatch(
        showToast({
          message:
            'Outlet location updated successfully.',
          type: 'success',
        }),
      );

      onClose();
    } catch (error) {
      console.log(
        'Update Outlet Location Error',
        error,
      );

      dispatch(
        showToast({
          message: 'Failed to update location.',
          type: 'error',
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            width: '92%',
            backgroundColor: '#FFF',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: 15,
              color: '#333',
            }}
          >
            Update Outlet Location
          </Text>



          <Text
            style={{
              fontSize: 13,
              textAlign: 'center',
              color: '#333',
              marginTop: 10,
              lineHeight: 22,
            }}
          >
            Do you want to update this
            outlet's location with your
            current location?
          </Text>

          <View
            style={{
              flexDirection: 'row',
              marginTop: 25,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#C9A24D',
                paddingVertical: 12,
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  color: '#A67C2E',
                  fontWeight: '600',
                }}
              >
                No
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleYes}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: '#C9A24D',
                paddingVertical: 12,
                borderRadius: 8,
                marginLeft: 8,
                alignItems: 'center',
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    color: '#FFF',
                    fontWeight: '600',
                  }}
                >
                  Yes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UpdateOutletLocationModal;