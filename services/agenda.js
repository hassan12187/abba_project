import Agenda from "agenda";
import { handleGenerateMontlyReport } from "./monthlyReportService.js";
import dotenv from "dotenv";
dotenv.config();

const mongoConnectionString = process.env.MONGO_URI;

const agenda = new Agenda({ db: { address: mongoConnectionString } });

agenda.define("generate monthly report", async (job) => {
  await handleGenerateMontlyReport();
});

(async function () {
  await agenda.start();

  // Runs at 00:00 on the 1st of every month
  await agenda.every("0 0 1 * *", "generate monthly report");

  console.log("✅ Agenda started and scheduled monthly report job.");
})();

export default agenda;
