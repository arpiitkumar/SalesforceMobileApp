// models/CgcloudInventory.js
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class CgcloudInventory extends Model {
  static table = "cgcloud__Inventory__c";

  @field("Sf_Id") sfId;

  @field("cgcloud__Account__c") account;
  @field("cgcloud__Product__c") product;
  @field("Saleable_Stock_Pcs__c") saleableStockPcs;

  // sync fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    account: "cgcloud__Account__c",
    product: "cgcloud__Product__c",
    saleableStockPcs: "Saleable_Stock_Pcs__c",

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
