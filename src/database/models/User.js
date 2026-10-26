import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class User extends Model {
  static table = "User";

  static columns = {
    sfId: "Sf_Id",
    deviceId: "DeviceId__c",
    name: "Name",
    developerName: "DeveloperName",
    userType: "User_Type__c",
    role: "Role",
    email: "Email",
    phone: "Phone",
    employeeCode__c: "EmployeeCode__c",
    geography: "Geography__c",
    assignedLatitude: "Assigned_Latitude__c",
    assignedLongitude: "Assigned_Longitude__c",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("DeviceId__c") deviceId;
  @field("Name") name;
  @field("Role") role;
  @field("DeveloperName") developerName;
  @field("User_Type__c") userType;
  @field("Email") email;
  @field("Phone") phone;
  @field("EmployeeCode__c") employeeCode__c;
  @field("Geography__c") geography;
  @field("Assigned_Latitude__c") assignedLatitude;
  @field("Assigned_Longitude__c") assignedLongitude;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  @field("ErrorMsg") errorMsg;
}
