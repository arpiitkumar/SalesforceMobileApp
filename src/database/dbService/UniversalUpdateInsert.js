import database from '../index';
import { Q } from '@nozbe/watermelondb';

const UniversalUpdateInsert = async ({
  ObjectName,
  Type,
  data = [],
  filters = [],
  batchSize = 1000,  // Configurable batch size
  onProgress = null  // Progress callback for large operations
}) => {
  try {
    const collection = database.get(ObjectName);

    const getModelFieldFromColumnName = (modelInstance, columnName) => {
      const modelClass = modelInstance.constructor;
      const reverseMap = Object.entries(modelClass.columns || {}).reduce((acc, [prop, col]) => {
        acc[col] = prop;
        return acc;
      }, {});
      return reverseMap[columnName];
    };

    switch (Type) {
      case 'insert': {
        if (!Array.isArray(data)) {
          data = [data];
        }

        if (data.length === 0) {
          console.log(`No data to insert into [${ObjectName}]`);
          return [];
        }

        console.log(`🔄 Starting insert for [${ObjectName}] with ${data.length} records`);

        // OPTIMIZATION: Chunk the data to avoid blocking the database
        const chunks = [];
        for (let i = 0; i < data.length; i += batchSize) {
          chunks.push(data.slice(i, i + batchSize));
        }

        console.log(`📦 Split into ${chunks.length} batches of ~${batchSize} records`);

        const allResults = [];

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          const progressPercent = Math.round(((chunkIndex + 1) / chunks.length) * 100);

          if (onProgress) {
            onProgress(`Inserting batch ${chunkIndex + 1}/${chunks.length} (${progressPercent}%) into [${ObjectName}]`);
          }

          // OPTIMIZATION: Fetch ALL existing Sf_Ids in this chunk at once (single query)
          const sfIdsInChunk = chunk
            .map(item => item?.Sf_Id?.trim?.())
            .filter(id => id);

          const existingRecords = await collection.query(
            Q.where('Sf_Id', Q.oneOf(sfIdsInChunk))
          ).fetch();

          // OPTIMIZATION: Create a Map for O(1) lookup instead of looping through array
          const existingMap = new Map(
            existingRecords.map(rec => [rec._raw.Sf_Id, rec])
          );

          // Split chunk into items to create vs update
          const toCreate = [];
          const toUpdate = [];

          chunk.forEach(item => {
            const sfId = item?.Sf_Id?.trim?.();
            if (!sfId) return;

            if (existingMap.has(sfId)) {
              toUpdate.push({ item, record: existingMap.get(sfId) });
            } else {
              toCreate.push(item);
            }
          });

          // OPTIMIZATION: Process creates and updates in a single transaction per batch
          await database.write(async () => {
            // Batch create
            for (const item of toCreate) {
              try {
                await collection.create(rec => {
                  Object.entries(item).forEach(([apiKey, value]) => {
                    if (value !== undefined) {
                      const modelKey = getModelFieldFromColumnName(rec, apiKey);
                      if (modelKey) {
                        try {
                          rec[modelKey] = value;
                        } catch (err) {
                          console.warn(`❗ Error setting ${modelKey}:`, err);
                        }
                      }
                    }
                  });
                });
              } catch (err) {
                console.error(` Error creating record:`, err);
              }
            }

            // Batch update
            for (const { item, record } of toUpdate) {
              try {
                await record.update(rec => {
                  Object.entries(item).forEach(([apiKey, value]) => {
                    if (value !== undefined) {
                      const modelKey = getModelFieldFromColumnName(rec, apiKey);
                      if (modelKey) {
                        try {
                          rec[modelKey] = value;
                        } catch (err) {
                          console.warn(`❗ Error setting ${modelKey}:`, err);
                        }
                      }
                    }
                  });
                });
              } catch (err) {
                console.error(` Error updating record:`, err);
              }
            }
            // console.log('the record created:::::', JSON.stringify(toCreate))
            console.log(`Batch ${chunkIndex + 1}: Created ${toCreate.length}, Updated ${toUpdate.length}`);
          });

          allResults.push(...toCreate, ...toUpdate.map(u => u.record));
        }

        console.log(`Completed insert for [${ObjectName}]: ${allResults.length} total records processed`);
        return allResults;
      }

      case 'get': {
        let query = collection.query();

        if (filters && filters.length) {
          filters.forEach(filter => {
            if (!filter || filter.value === undefined || filter.value === null) {
              return;
            }
            if (filter.operator) {
              if (filter.operator === 'in' && Array.isArray(filter.value)) {
                if (filter.value.length > 0) {
                  query = query.extend(Q.where(filter.field, Q.oneOf(filter.value)));
                }
              } else if (typeof Q[filter.operator] === 'function') {
                query = query.extend(Q[filter.operator](filter.field, filter.value));
              }
            } else {
              query = query.extend(Q.where(filter.field, filter.value));
            }
          });
        }

        const records = await query.fetch();
        return records.map(rec => ({
          id: rec.id,
          ...rec._raw,
        }));
      }

      case 'delete': {
        if (!data || (!data.id && !data.Sf_Id)) {
          throw new Error('Missing "id" or "Sf_Id" for delete');
        }

        return await database.write(async () => {
          let record;
          if (data.id) {
            record = await collection.find(data.id);
          } else {
            const sfId = data.Sf_Id;
            const found = await collection.query(Q.where('Sf_Id', sfId)).fetch();
            if (!found || found.length === 0) {
              return false;
            }
            record = found[0];
          }

          await record.markAsDeleted();
          await record.destroyPermanently();
          return true;
        });
      }

      case 'delete_bulk': {
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('delete_bulk requires data to be a non-empty array of ids or Sf_Ids');
        }

        return await database.write(async () => {
          for (const identifier of data) {
            const found = await collection.query(Q.where('Sf_Id', identifier)).fetch();
            if (found.length > 0) {
              const rec = found[0];
              await rec.markAsDeleted();
              await rec.destroyPermanently();
              continue;
            }

            try {
              const recById = await collection.find(identifier);
              if (recById) {
                await recById.markAsDeleted();
                await recById.destroyPermanently();
              }
            } catch (e) {
              console.warn(`[UniversalUpdateInsert] delete_bulk - not found: ${identifier}`);
            }
          }
          return true;
        });
      }

      case 'delete_all': {
        return await database.write(async () => {
          const allRecords = await collection.query().fetch();
          for (const record of allRecords) {
            await record.markAsDeleted();
            await record.destroyPermanently();
          }

          console.log(`🧹 Deleted all records from ${ObjectName}`);
          return true;
        });
      }

      case 'delete_synced_only': {
        return await database.write(async () => {
          const allRecords = await collection.query().fetch();
          let deletedCount = 0;
          let skippedCount = 0;
          for (const record of allRecords) {
            const raw = record._raw;
            if (raw.is_synced === undefined) {
              await record.markAsDeleted();
              await record.destroyPermanently();
              deletedCount++;
              continue;
            }

            if (raw.is_synced === true || raw.is_synced === 1) {
              await record.markAsDeleted();
              await record.destroyPermanently();
              deletedCount++;
            } else {
              // 👉 unsynced skip
              skippedCount++;
            }
          }
          console.log(`🧹 Deleted ${deletedCount} synced records from ${ObjectName}`);
          console.log(`⏭️ Skipped ${skippedCount} unsynced records`);
          return {
            deleted: deletedCount,
            skipped: skippedCount
          };
        });
      }

      default:
        throw new Error(` Invalid operation type: ${Type}`);
    }
  } catch (error) {
    console.error(`[UniversalUpdateInsert]  Error during "${Type}" on [${ObjectName}]:`, error);
    throw error;
  }
};

export default UniversalUpdateInsert;