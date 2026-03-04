import mongoose, {connect} from "mongoose";
const MONGO_URI=process.env.MONGO_URI;
async function connectDB():Promise<typeof mongoose> {
  if(!MONGO_URI){
    console.log("mongo db uri undefined");
    process.exit(1);
  }
  try {
    console.log("connected to DB");
    return await connect(MONGO_URI);
  } catch(e) {
    // Ensures that the client will close when you finish/error
    console.log(`errror in connections ${e}`);
    process.exit(1);
  }
}
export default connectDB;