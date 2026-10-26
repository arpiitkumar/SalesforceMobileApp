import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class LineSRDistributorMapping extends Model {
  static table = "Line_SR_Distributor_Mapping__c";

  // Salesforce record ID
  @field("Sf_Id") sfId;

  // Fields from query
  @field("Line__c") line__c;
  @field("SR__c") sr__c;
  @field("Distributor__c") distributor__c;
  @field("DBType__c") dBType__c;
  @field("Distributor__Name") distributor__Name;
  @field("Distributor__PartyCode__c") distributor__PartyCode__c;

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
    sr__c: "SR__c",
    distributor__c: "Distributor__c",
    dBType__c: "DBType__c",
    distributor__Name: "Distributor__Name",
    distributor__PartyCode__c: "Distributor__PartyCode__c",

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
