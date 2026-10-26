import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isApprovalResponseSuccessful = (response) => {
  if (!response) return false;
  if (response.status === 'error') return false;
  if (response.success === false || response.data?.success === false) return false;
  if (response.error || response.data?.error) return false;
  return true;
};

export const submitApprovalAction = async (actionType, workitemId, comments = '', apiFetch = null) => {
  try {
    if (!workitemId) {
      console.warn("submitApprovalAction: Missing workitemId / actionId");
      return { status: 'error', message: 'Missing workitemId' };
    }

    if (apiFetch && typeof apiFetch === 'function') {
      try {
        console.log(`Submitting approval action [${actionType}] via apiFetch for workItemId: ${workitemId}`);
        const response = await apiFetch(
          "POST",
          "v1/approval/action",
          {
            action: actionType,
            workItemId: workitemId,
            recordId: workitemId,
            comments,
          },
          "Custom"
        );
        if (!isApprovalResponseSuccessful(response)) {
          return {
            status: 'error',
            message:
              response?.message ||
              response?.data?.message ||
              response?.error ||
              response?.data?.error ||
              'Approval action failed',
            data: response,
          };
        }
        return { status: 'success', data: response };
      } catch (err) {
        console.log("apiFetch approval action error, falling back to direct axios:", err);
      }
    }

    let accessToken = await AsyncStorage.getItem('accessToken_for_datasyncer');
    let instanceUrl = await AsyncStorage.getItem('instanceUrl_for_datasyncer');

    if (!accessToken || !instanceUrl) {
      accessToken = await AsyncStorage.getItem('accessToken');
      instanceUrl = await AsyncStorage.getItem('instanceUrl');
    }

    if (!accessToken || !instanceUrl) {
      return { status: 'error', message: 'Missing auth credentials' };
    }

    const res = await axios.post(
      `${instanceUrl}/services/apexrest/v1/approval/action`,
      {
        action: actionType,
        workItemId: workitemId,
        recordId: workitemId,
        comments,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!isApprovalResponseSuccessful(res.data)) {
      return {
        status: 'error',
        message:
          res.data?.message ||
          res.data?.error ||
          'Approval action failed',
        data: res.data,
      };
    }
    return { status: 'success', data: res.data };
  } catch (err) {
    console.log('Approval action error:', err.response?.data || err.message);
    return {
      status: 'error',
      message: err.response?.data?.[0]?.message || err.message,
    };
  }
};
