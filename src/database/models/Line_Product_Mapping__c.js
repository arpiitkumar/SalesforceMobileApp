import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class LineProductMapping extends Model {
  static table = "Line_Product_Mapping__c";

  // Salesforce record ID
  @field("Sf_Id") sfId;

  @field("Line__c") line__c;
  @field("Category__c") category__c;
  @field("Sub_Category__c") subCategory__c;

  // Sync / meta fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    line__c: "Line__c",
    category__c: "Category__c",
    subCategory__c: "Sub_Category__c",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
