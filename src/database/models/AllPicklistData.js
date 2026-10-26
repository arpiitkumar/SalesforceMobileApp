import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class AllDataPicklist extends Model {
  static table = "AllDataPicklist";

  static columns = {
    sfId: "Sf_Id",
    optionsData: "OptionsData",
    dependentOptionsData: "DependentOptionsData",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("OptionsData") optionsData;
  @field("DependentOptionsData") dependentOptionsData;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  @field("ErrorMsg") errorMsg;
}
