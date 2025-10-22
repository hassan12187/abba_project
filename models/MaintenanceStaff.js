import {Schema,model} from "mongoose";

const maintenanceStaff=new Schema({
   name: String,
  department: {
    type: String,
    enum: ["Electrical", "Plumbing", "Cleaning", "Furniture"]
  },
  contact: String,
  availability_status: {
    type: String,
    enum: ["Available", "Busy"],
    default: "Available"
  }

});
const MaintenanceStaff=model('MaintenanceStaff',maintenanceStaff);
export default MaintenanceStaff