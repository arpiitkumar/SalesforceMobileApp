import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class LastSync extends Model {
  static table = "LastSync";
  @field("Sf_Id") sfId;
  @field("DateTime") dateTime;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  static columns = {
    sfId: "Sf_Id",
    dateTime: "DateTime",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
