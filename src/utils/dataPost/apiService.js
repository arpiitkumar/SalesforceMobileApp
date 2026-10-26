// utils/apiService.js/
//import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';

/**
 * Attempts to save a record to Salesforce.
 * @param {string} objectName  e.g. 'Account' or 'OrderItem'
 * @param {Object} fields      key–value SFDC payload
 * @returns {Promise<{ sfId: string }>}  resolves with { sfId } or rejects on any failure
 */
export async function saveToApi(apiFetch, objectName, fields) {
  //const { apiFetch } = useApiFetch();
  const payload= {apiName: objectName, fields}
  console.log("PAYLOAD TO BE SENT::",payload)
  const resp = await apiFetch(
    'POST',
    'records',
    payload,
    'standard'
  );
  console.log("RESPONSE FORM API ::",resp)
  if (resp.status !== 'success') {
    throw new Error(`API error saving ${objectName}: ${JSON.stringify(resp)}`);
  }
  return { sfId: resp.data.id };
}
