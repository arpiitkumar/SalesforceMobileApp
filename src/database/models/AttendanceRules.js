// models/AttendanceRules.js
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class AttendanceRules extends Model {
  static table = "AttendanceRule";

  @field("Sf_Id") sf_Id;
  @field("JSON") jSON;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  static columns = {
    sf_Id: "Sf_Id",
    jSON: "JSON",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
