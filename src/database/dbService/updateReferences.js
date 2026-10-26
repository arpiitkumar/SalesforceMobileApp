import database from '../index';
import { Q } from '@nozbe/watermelondb';

/**
* Replaces oldId with newId across all related tables.
* @param {string} oldId - The temporary/local Sf_Id
* @param {string} newId - The actual Sf_Id from server
* @param {Array<string>} objectNames - List of all WatermelonDB table names
*/
const updateReferences = async (oldId, newId, objectNames = []) => {
  try {
    await database.write(async () => {
      for (const objName of objectNames) {
        const collection = database.get(objName);
        const allRecords = await collection.query().fetch();

        for (const record of allRecords) {
          const modelClass = record.constructor;
          const reverseMap = Object.entries(modelClass.columns || {}).reduce((acc, [prop, col]) => {
            acc[col] = prop;
            return acc;
          }, {});

          let updated = false;
          const rawData = { ...record._raw };

          // Loop through all fields in the record
          for (const key in rawData) {
            const value = rawData[key];
            if (value && typeof value === 'string' && value.includes(oldId)) {
              const newValue = value.replace(oldId, newId);
              const modelField = reverseMap[key];
              if (modelField && record[modelField] !== undefined) {
                await record.update(r => {
                  r[modelField] = newValue;
                });
                updated = true;
                console.log(`🔁 Updated [${objName}] record ${record.id} (${modelField})`);
              }
            }
          }
        }
      }
    });

    console.log(`Replaced all occurrences of ${oldId} with ${newId}`);
    return true;
  } catch (err) {
    console.error(' Error updating references:', err);
    return false;
  }
};

export default updateReferences;