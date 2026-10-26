import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class User extends Model {
  static table = "so_users";

  static columns = {
    sfId: "Sf_Id",
    deviceId: "DeviceId__c",
    name: "Name",
    developerName: "DeveloperName",
    role: "Role",
    managerId: "ManagerId",
    employeeCode__c: "EmployeeCode__c",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("DeviceId__c") deviceId;
  @field("Name") name;
  @field("Role") role;
  @field("DeveloperName") developerName;
  @field("ManagerId") managerId;
  @field("EmployeeCode__c") employeeCode__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}
