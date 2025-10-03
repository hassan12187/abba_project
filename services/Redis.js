import {Redis} from "ioredis";
const client = new Redis();
client.set("testKey", "Hello Redis!")
  .then(() => client.get("testKey"))
  .then(result => {
    console.log("Redis says:", result);
  })
  .catch(err => console.error("Redis error:", err));
export default client;