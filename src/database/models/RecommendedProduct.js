// models/RecommendedProduct.js
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class RecommendedProduct extends Model {
  static table = "Recommended_Product__c";

  @field("Sf_Id") sfId;

  @field("Customer__c") customer;
  @field("Type__c") type__c;
  @field("Must_Sell_Products__c") mustSellProducts;
  @field("OverDue_Products__c") overdueProducts;
  @field("Top_Sell_Products__c") topSellProducts;
  @field("Scheme_Pitch__c") schemePitch;
  @field("New_Launch_Product__c") newLaunchProduct;

  // sync fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    customer: "Customer__c",
    type__c: "Type__c",
    mustSellProducts: "Must_Sell_Products__c",
    overdueProducts: "OverDue_Products__c",
    topSellProducts: "Top_Sell_Products__c",
    schemePitch: "Scheme_Pitch__c",
    newLaunchProduct: "New_Launch_Product__c",

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
