import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class SRBeatAssignment extends Model {
  static table = "SR_Beat_Assignment__c";

  @field("Sf_Id") sfId;

  @field("Beat__c") beat__c;
  @field("Distributor__c") distributor__c;
  @field("Assigned_To__c") salesRepresentative__c;
  @field("isActive__c") isActive;
  @field("BeatName") beatName;
  @field("SalesRepresentativeName") salesRepresentativeName;
  @field("Sales_Person_ManagerId__c") sales_Person_ManagerId__c;
  @field("SRDeveloperRole") sRDeveloperRole;

  @field("Name") name;
  @field("PartyCode__c") partyCode__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    beat__c: "Beat__c",
    distributor__c: "Distributor__c",
    salesRepresentative__c: "Assigned_To__c",
    isActive: "isActive__c",
    beatName: "BeatName",
    salesRepresentativeName: "SalesRepresentativeName",
    sales_Person_ManagerId__c: "Sales_Person_ManagerId__c",
    sRDeveloperRole: "SRDeveloperRole",
    name: "Name",
    partyCode__c: "PartyCode__c",

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
