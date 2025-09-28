import {connect} from "mongoose";
const uri = "mongodb+srv://hassan12187:hassan12187@cluster0.kuqcu97.mongodb.net/hostel_managment?retryWrites=true&w=majority&appName=Cluster0";

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