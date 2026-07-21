import mongoose, {connect} from "mongoose";
const MONGO_URI=process.env.MONGO_URI;
async function connectDB():Promise<typeof mongoose> {
  if(!MONGO_URI){
    process.exit(1);
  }
  try {
    return await connect(MONGO_URI);
  } catch(e) {
    // Ensures that the client will close when you finish/error
    process.exit(1);
  }
}
export default connectDB;