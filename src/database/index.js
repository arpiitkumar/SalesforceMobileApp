import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { mySchema } from './schema';
import { migrations } from './migrations';
// Import all models
import User from './models/User';
import SoUser from './models/SoUser'
import Beat__c from './models/Beat__c';
import Attendant__c from './models/Attendant__c';
import BeatDay__c from './models/BeatDay__c';
import Visit from './models/Visit';
import Route_Plans__c from './models/Route_Plans__c';
import Account from './models/Account';
import Product2 from './models/Product2';
import CartItem from './models/CartItems';
import Order from './models/Order'
import Invoice from './models/Invoice';
import OrderItem from './models/OrderItem';
import Collection from './models/Collection';
import Collection_Allocation__c from './models/Collection_Allocation__c';
import Survey from './models/Survey'
import Competitor from './models/Competitor'
import InvoiceItem from './models/InvoiceItem';
import FormJson from './models/FormJson';
import StockCheck from './models/StockCheck';
import cgcloud__Unit_of_Measure__c from './models/cgcloud__Unit_of_Measure__c';
import AllDataPicklist from './models/AllPicklistData';
import MT_Exception from './models/MtException';
import Assortment from './models/Assortment';
import AssortmentProduct from './models/AssortmentProduct';
import CompetitorLineItem from './models/Competitor_LineItem__c';
import CompetitorMaster from './models/CompetitorMaster__c';
import Target from './models/Target__c';
import GrowthMappingEntry from './models/Growth_Mapping_Entry__c'
import IncotermAssignment__c from './models/IncotermAssignment__c'
import Product_Pricing_History from './models/Product_Pricing_History__c'
import LineSRDistributorMapping from './models/Line_SR_Distributor_Mapping__c';
import LineProductMapping from './models/Line_Product_Mapping__c';
import Scheme from './models/Scheme';
import SchemeParticipantFilter from './models/SchemeParticipantFilter';
import SchemeSlabPhase from './models/SchemeSlabPhase';
import SchemeProduct from './models/SchemeProduct';
import PricingMarginMaster from './models/PricingMarginMaster';
import SRBeatAssignment from './models/SRBeatAssignment';
import BeatMapping from './models/BeatMapping';
import Competitor__Product from './models/Competitor__Product';
import Geography__c from './models/Geography__c';
import Priority from './models/Priority';
import RecommendedProduct from './models/RecommendedProduct';
import CgcloudInventory from './models/CgcloudInventory';
import AttendanceRules from './models/AttendanceRules';
import SalaryAcknowledgement from './models/SalaryAcknowledgement';
import Notification__c from './models/Notification__c';
import Product_Pricing___c from './models/Product_Pricing___c'
import Gamification_Master__c from './models/Gamification_Master__c';
 import Gamification_Transaction__c from './models/Gamification_Transaction__c';
 import GamificationRank from './models/GamificationRank'
 import Gamification_Reward_Master__c from './models/Gamification_Reward_Master__c';
 import HNT_Competitor_Price__c from './models/HNT_Competitor_Price__c';
 import PlantDepotRake__c from './models/PlantDepotRake__c';
 import LastSync from './models/LastSync';
import SystemLog from './models/SystemLog';
import Survey_Template__c from './models/Survey_Template__c';
import Survey_Assignment__c from './models/Survey_Assignment__c';
import Survey_Assignment_Target__c from './models/Survey_Assignment_Target__c';
import Survey_Question__c from './models/Survey_Question__c';
import Survey_Question_Option__c from './models/Survey_Question_Option__c';
import Survey_Response__c from './models/Survey_Response__c';
import Survey_Response_Item__c from './models/Survey_Response_Item__c';

// If you have Order or Geography__c add them below:
// import Order from './models/Order';
// import Geography__c from './models/Geography__c';

// Setup SQLite Adapter
const adapter = new SQLiteAdapter({
  schema: mySchema,
  migrations,
  dbName: 'emami-local-db',
  jsi: false, // set false to prevent JSI fallback warning when native app is run in dev/debug mode or not recompiled
  onSetUpError: error => {
    console.error('Database setup failed:', error);
  },
});

// Register models
const database = new Database({
  adapter,
  modelClasses: [
    User,
    Beat__c,
    Attendant__c,
    BeatDay__c,
    Visit,
    Route_Plans__c,
    Account,
    Product2,
    CartItem,
    Order,
    OrderItem,
    Invoice,
    Collection,
    Collection_Allocation__c,
    Survey,
    Competitor,
    SoUser,
    InvoiceItem,
    FormJson,
    StockCheck,
    cgcloud__Unit_of_Measure__c,
    AllDataPicklist,
    MT_Exception,
    Assortment,
    AssortmentProduct,
    CompetitorLineItem,
    CompetitorMaster,
    Target,
    GrowthMappingEntry,
    IncotermAssignment__c,
    Product_Pricing_History,
    LineSRDistributorMapping,
    LineProductMapping,
    Scheme,
    SchemeParticipantFilter,
    SchemeSlabPhase,
    SchemeProduct,
    PricingMarginMaster,
    SRBeatAssignment,
    BeatMapping,
    Geography__c,
    Competitor__Product,
    Priority,
    RecommendedProduct,
    CgcloudInventory,
    AttendanceRules,
    SalaryAcknowledgement,
    Notification__c,
    Product_Pricing___c,
    Gamification_Master__c,
    Gamification_Transaction__c,
    GamificationRank,
    Gamification_Reward_Master__c,
    PlantDepotRake__c,
    HNT_Competitor_Price__c,
    LastSync,
    SystemLog,
    Survey_Template__c,
    Survey_Assignment__c,
    Survey_Assignment_Target__c,
    Survey_Question__c,
    Survey_Question_Option__c,
    Survey_Response__c,
    Survey_Response_Item__c
  ],
  actionsEnabled: true,
});

export default database;
