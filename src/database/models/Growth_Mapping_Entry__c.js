import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class GrowthMappingEntry extends Model {
  // The table name MUST match the 'name' property in the tableSchema
  static table = "Growth_Mapping_Entry__c";

  // Fields (mapped using @field decorator)
  @field("Sf_Id") sfId;

  @field("CapturePhoto__c") capturePhoto;
  @field("Name") name;
  @field("LocationIssue__c") locationIssue;
  @field("ObservedPrice__c") observedPrice;
  @field("Outlet_Name__c") outletName;
  @field("PotentialVolume__c") potentialVolume;
  @field("Priority__c") priority;
  @field("Product__c") product;
  @field("Remarks__c") remarks;
  @field("SKU__c") sku;
  @field("Type__c") type;
  @field("Units__c") units;

  // Standard/Sync Fields

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",

    capturePhoto: "CapturePhoto__c",
    name: "Name",
    locationIssue: "LocationIssue__c",
    observedPrice: "ObservedPrice__c",
    outletName: "Outlet_Name__c",
    potentialVolume: "PotentialVolume__c",
    priority: "Priority__c",
    product: "Product__c",
    remarks: "Remarks__c",
    sku: "SKU__c",
    type: "Type__c",
    units: "Units__c",

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
