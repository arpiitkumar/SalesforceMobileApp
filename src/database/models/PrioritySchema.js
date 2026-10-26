// db/schemas/PrioritySchema.js
import { tableSchema } from "@nozbe/watermelondb";

export default tableSchema({
  name: "Priority__c",
  columns: [
    { name: "Sf_Id", type: "string" },

    { name: "Ranking__c", type: "string", isOptional: true },
    { name: "Category__c", type: "string", isOptional: true },

    // sync fields
    { name: "is_locally_changed", type: "boolean", isOptional: true },
    { name: "operation_type", type: "string", isOptional: true },
    { name: "last_modified", type: "number", isOptional: true },
    { name: "is_synced", type: "boolean", isOptional: true },
    { name: "SoftDelete", type: "boolean", isOptional: true },
  ],
});
