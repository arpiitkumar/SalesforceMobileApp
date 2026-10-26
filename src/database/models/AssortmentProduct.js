import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class AssortmentProduct extends Model {
  static table = "AssortmentProduct";

  @field("Sf_Id") sfId;

  // Mandatory fields
  @field("Customer__c") customer;
  @field("ProductId") productId;
  @field("Type__c") type;
  @field("Priority__c") priority;

  // Optional fields
  @field("Location_Issue__c") locationIssue;
  @field("Missing_SKU__c") missingSku;
  @field("New_SKU_Idea__c") newSkuIdea;
  @field("Notes__c") notes;
  @field("Observed_Price__c") observedPrice;
  @field("Photo__c") photo;
  @field("Potential_Volume__c") potentialVolume;
  @field("User__c") user;

  // Sync-related fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    customer: "Customer__c",
    productId: "ProductId",
    type: "Type__c",
    priority: "Priority__c",
    locationIssue: "Location_Issue__c",
    missingSku: "Missing_SKU__c",
    newSkuIdea: "New_SKU_Idea__c",
    notes: "Notes__c",
    observedPrice: "Observed_Price__c",
    photo: "Photo__c",
    potentialVolume: "Potential_Volume__c",
    user: "User__c",
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
