// models/PricingMarginMaster.js
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class PricingMarginMaster extends Model {
  static table = "Pricing_Margin_Master__c";

  @field("Sf_Id") sfId;

  @field("Category__c") category;
  @field("Price_Group__c") priceGroup;
  @field("Direct__c") direct;
  @field("Super__c") superField;
  @field("Sub_DB__c") subDB;

  // sync fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    category: "Category__c",
    priceGroup: "Price_Group__c",
    direct: "Direct__c",
    superField: "Super__c",
    subDB: "Sub_DB__c",

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
