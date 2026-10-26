import { useEffect, useState } from 'react';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { getUniqueDeviceId, getAndroidDeviceId } from '../utils/helper/deviceUtils';
import { isInternetAvailable } from '../utils/networkUtils'; // adjust path if needed
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { setLoginStatus } from '../redux/slices/deviceSlice';

//const dispatch = useDispatch()

export const useDeviceValidation = (accessToken) => {
  const { apiFetch, handleLogout } = useApiFetch();
  //const dispatch = useDispatch()
  const [isModalVisible, setModalVisible] = useState(false);
  const [users, setUsers] = useState([]);
  const [uniqueId, setUniqueId] = useState(null);

  const dispatch = useDispatch();

  const triggerStateTrue = () => {
    dispatch(setLoginStatus({ loginStatus: true }));
  };

  // Run only when accessToken is present
  useEffect(() => {
    if (!accessToken) return;

    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });

        setUsers(result);

        const deviceUniqueId = await getUniqueDeviceId();
        setUniqueId(deviceUniqueId);

        const registeredDeviceId = result?.[0]?.DeviceId__c;

        // if (registeredDeviceId && registeredDeviceId === "") {
        //   console.log("❗ Device ID mismatch ON SALESFORCE IT IS==============================", registeredDeviceId);
        //   handleModalYes()
        //   //setModalVisible(true);
        // } 
        // Bypass check and trigger state directly
        triggerStateTrue();
        /*
        if (registeredDeviceId && registeredDeviceId !== deviceUniqueId) {
          console.log("❗ Device ID mismatch");
          setModalVisible(true);
        } else {

          triggerStateTrue()
          // console.log("Device ID matches");
        }
        */
      } catch (error) {
        console.error(" Initialization failed:", error);
      }
    };

    initialize();
  }, [accessToken]);

  const updateDeviceId = async () => {
    const payload = {
      allowSaveOnDuplicate: false,
      fields: {
       Deviceid__c: uniqueId,
      },
    };

    const response = await apiFetch(
      'PATCH',
      `records/${users?.[0]?.Sf_Id}`,
      payload,
      'standard'
    );

    if (response.status === 'success') {
      console.log('Device ID updated in Salesforce');
    } else {
      console.error(' Failed to update Device ID:', response.message);
    }

    return response;
  };

  const handleModalYes = async () => {
    try {



      const connected = await isInternetAvailable();

      if (!connected) {
        console.log(' Your device is not connected to the internet');
        triggerToast();
        return; // 🔁 Exit early, DO NOT proceed or close the modal
      }



      setModalVisible(false);

      const userId = users?.[0]?.Sf_Id;
      if (!userId || !uniqueId) {
        console.warn("User ID or Device ID missing");
        return;
      }

      const result = await updateDeviceId();

      if (result.status === 'success') {
        const updateResult = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'insert',
          data: {
            Sf_Id: userId,
           DeviceId__c: uniqueId,
          },
        });
        console.log('Device ID registered in local DB:', updateResult);

        triggerStateTrue()
      }
    } catch (error) {
      console.error(' Failed to register device:', error);
    }
  };




  const handleLogoutFun = async () => {

    await AsyncStorage.setItem("hasLoggedOut", "true");
    await UniversalUpdateInsert({
      ObjectName: 'User',
      Type: 'delete_all',
    });

    await UniversalUpdateInsert({
      ObjectName: 'Attendant__c',
      Type: 'delete_all',
    });

    await UniversalUpdateInsert({
      ObjectName: 'Visit',
      Type: 'delete_all',
    });
    await UniversalUpdateInsert({
      ObjectName: 'Account',
      Type: 'delete_all',
    });

    await AsyncStorage.removeItem('initialDataSynced');

    console.log('cleared the async storage of initial data SYNCED')
    await handleLogout()
  }

  const handleModalNo = async () => {
    setModalVisible(false);
    await handleLogoutFun();  // Await the async function
    console.log("User declined to register device");
  };

  return {
    isModalVisible,
    handleModalYes,
    handleModalNo,
  };
};
