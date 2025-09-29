import {connect} from "mongoose";
const uri = process.env.MONGO_URI;

async function connectDB() {
  try {
    console.log("connected to DB");
    return await connect(uri);
  } catch(e) {
    // Ensures that the client will close when you finish/error
    console.log(`errror in connections ${e}`);
  }
}
export default connectDB;