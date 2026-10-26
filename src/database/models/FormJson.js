import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";
import { isLowRamDevice } from "react-native-device-info";

export default class FormJson extends Model {
  static table = "FormJson";

  @field("Sf_Id") sfId;
  @field("Unique_Id") unique_Id;
  @field("Json") json;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  static columns = {
    sfId: "Sf_Id",
    unique_Id: "Unique_Id",
    json: "Json",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
