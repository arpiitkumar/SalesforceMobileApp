// SchemeParticipantFilter model (SchemeParticipantFilter.js)
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class SchemeParticipantFilter extends Model {
  static table = "Scheme_Participant_Filters__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    whereCondition: "Where_Condition__c",
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
  @field("Where_Condition__c") whereCondition;
  @field("Scheme__c") scheme__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}
