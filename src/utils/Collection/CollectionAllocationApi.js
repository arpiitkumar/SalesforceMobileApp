/**
* Handles collection API submission with passed-in `apiFetch`.
*
* @param {Function} apiFetch - The API fetch function passed from component.
* @param {Function} showToast - Toast dispatcher (passed from component or store).
* @param {Object} payload - The payload to be submitted.
* @returns {Promise<string|boolean>}
*/
export const CollectionAllocationApi = async (apiFetch, showToast, payload) => {
  try {
    console.log('📦 Final Payload:', payload);

    const response = await apiFetch('POST', 'records', payload, 'standard');

    console.log('API Response:', response);

    if (response?.status === 'success') {
      const serverOrderNumber = response?.data?.id;
      // showToast({ message: 'Allocation Submitted Successfully (ONLINE)', type: 'success' });
      return serverOrderNumber;
    } else {
      // showToast({ message: 'Allocation Submission Failed (ONLINE)', type: 'error' });
      return false;
    }
  } catch (error) {
    console.error(' API Error:', error);
    showToast({ message: 'Something went wrong while submitting collection.', type: 'error' });
    return false;
  }
};
