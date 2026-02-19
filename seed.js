import mongoose from "mongoose";
import Report from "./models/reportModel.js";

const seedDatabase = async () => {
  try {
    // 1. Connect to your database (Replace with your actual MongoDB URI)
    await mongoose.connect("mongodb+srv://hassan12187:hassan12187@cluster0.kuqcu97.mongodb.net/hostel_managment?retryWrites=true&w=majority&appName=Cluster0");
    console.log("✅ Connected to MongoDB.");

    // 2. Clear out old reports so you have a clean slate for testing
    await Report.deleteMany({});
    console.log("🧹 Cleared old report data.");

    const fakeReports = [];
    
    // 3. Set the start date to exactly 6 months ago
    const currentDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    startDate.setDate(1); // Start on the 1st of that month
    startDate.setHours(0, 0, 0, 0);

    // 4. Loop day-by-day until today
    for (let d = new Date(startDate); d <= currentDate; d.setDate(d.getDate() + 1)) {
      
      // Generate realistic randomized daily numbers
      const dailyPayments = Math.floor(Math.random() * 800) + 200; // Between 200 and 1000
      const dailyExpenses = Math.floor(Math.random() * 300) + 50;  // Between 50 and 350
      const totalStudents = Math.floor(Math.random() * 15) + 150;  // Between 150 and 165
      
      fakeReports.push({
        reportDate: new Date(d), // Clone the date object
        total_payments: dailyPayments,
        total_expenses: dailyExpenses,
        net_profit: dailyPayments - dailyExpenses,
        total_students: totalStudents
      });
    }

    // 5. Bulk insert all the generated days into MongoDB
    await Report.insertMany(fakeReports);
    console.log(`🎉 Successfully seeded ${fakeReports.length} daily reports!`);
    
    // Disconnect when finished
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
};

// Run the function
seedDatabase();