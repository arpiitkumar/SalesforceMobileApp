import { useApiFetch } from '../apiFetchHooks/useApiFetch';
import uuid from 'react-native-uuid'; // For generating unique IDs if needed

export const syncData = async ({
  objectName = 'Your_Object__c',
  externalIdField = 'External_Id__c', // or any unique field
  generateMissingId = true, // Whether to generate an ID if missing
  updatePayloadBuilder = (record) => record, // customize payload if needed
  createPayloadBuilder = (record) => record, // customize payload if needed
}) => {
  const { fetchRecords, apiFetch } = useApiFetch();

  try {
    const soqlQuery = `SELECT Id, ${externalIdField}, Name FROM ${objectName}`;
    const records = await fetchRecords(objectName, soqlQuery);

    if (!Array.isArray(records)) {
      console.error('Error fetching records:', records);
      return;
    }

    for (const record of records) {
      const externalId = record[externalIdField];

      if (externalId) {
        // Update record
        const payload = updatePayloadBuilder(record);
        const result = await apiFetch('PATCH', `sobjects/${objectName}/${record.Id}`, payload, 'SObjects');
        console.log(`Updated ${record.Id}:`, result);
      } else if (generateMissingId) {
        // 🆕 Create new record if ExternalId is missing
        const newExternalId = uuid.v4(); // Generate new UUID
        const newRecord = {
          ...record,
          [externalIdField]: newExternalId,
        };
        const payload = createPayloadBuilder(newRecord);
        const result = await apiFetch('POST', `sobjects/${objectName}`, payload, 'SObjects');
        console.log(`Created new record with ${externalIdField}:`, result);
      }
    }
  } catch (err) {
    console.error('Sync Error:', err);
  }
};

