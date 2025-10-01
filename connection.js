import {connect} from "mongoose";

async function connectDB() {
  try {
    console.log("connected to DB");
    return await connect(process.env.MONGO_URI);
  } catch(e) {
    // Ensures that the client will close when you finish/error
    console.log(`errror in connections ${e}`);
  }
}
export default connectDB;