// SchemeSlabPhase model (SchemeSlabPhase.js)
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class SchemeSlabPhase extends Model {
  static table = "Scheme_Slab_Phase__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    buyType: "Buy_Type__c",
    buyUoM: "Buy_UoM__c",
    benefitReward: "Benefit_Reward__c",
    scheme__c: "Scheme__c",

    // metadata
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    SoftDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("Buy_Type__c") buyType;
  @field("Buy_UoM__c") buyUoM;
  @field("Benefit_Reward__c") benefitReward;
  @field("Scheme__c") scheme__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}
