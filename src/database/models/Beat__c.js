import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Beat__c extends Model {
  static table = "Beat__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    status: "Beat_Status__c",
    distributor: "Distributor__c",
    beatCode__c: "BeatCode__c",
    visitFrequency: "VisitFrequency__c",
    directDbSubDb: "DirectDBSubDB__c",
    srTsiAsoName: "SR_TSI_ASO_Name__c",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("Beat_Status__c") status;
  @field("Distributor__c") distributor;
  @field("VisitFrequency__c") visitFrequency;
  @field("BeatCode__c") beatCode__c;
  @field("DirectDBSubDB__c") directDbSubDb;
  @field("SR_TSI_ASO_Name__c") srTsiAsoName;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}
