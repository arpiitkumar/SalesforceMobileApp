import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class GamificationRank extends Model {
  static table = "GamificationRank";

  static columns = {
    sfId: "Sf_Id",
    rankData: "RankData",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("RankData") rankData;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  @field("ErrorMsg") errorMsg;
}
