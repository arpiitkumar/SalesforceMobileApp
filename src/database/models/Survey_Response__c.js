import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Survey_Response__c extends Model {
  static table = "Survey_Response__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    survey_Template__c: "Survey_Template__c",
    visit__c: "Visit__c",
    outlet__c: "Outlet__c",
    field_User__c: "Field_User__c",
    status__c: "Status__c",
    start_Time__c: "Start_Time__c",
    submit_Time__c: "Submit_Time__c",
    geolocation__Latitude__s: "Geolocation__Latitude__s",
    geolocation__Longitude__s: "Geolocation__Longitude__s",

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
  @field("Survey_Template__c") survey_Template__c;
  @field("Visit__c") visit__c;
  @field("Outlet__c") outlet__c;
  @field("Field_User__c") field_User__c;
  @field("Status__c") status__c;
  @field("Start_Time__c") start_Time__c;
  @field("Submit_Time__c") submit_Time__c;
  @field("Geolocation__Latitude__s") geolocation__Latitude__s;
  @field("Geolocation__Longitude__s") geolocation__Longitude__s;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("ErrorMsg") errorMsg;
}
