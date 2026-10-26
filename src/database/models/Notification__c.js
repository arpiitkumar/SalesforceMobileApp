// Notification.js
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Notification extends Model {
  static table = "Notification__c";

  @field("Sf_Id") sfId;

  @field("Title") title;
  @field("Message") message;
  @field("Image") image;
  @field("Type") type;
  @field("Data") data; // 🔥 wrapped JSON
  @field("Status") status;
  @field("ReceivedAt") receivedAt;

  // Sync / local flags
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    title: "Title",
    message: "Message",
    image: "Image",
    type: "Type",
    data: "Data",
    status: "Status",
    receivedAt: "ReceivedAt",

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
