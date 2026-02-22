import mongoose from "mongoose";
import Report from "./models/reportModel.js";

const seedDatabase = async () => {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect("mongodb+srv://hassan12187:hassan12187@cluster0.kuqcu97.mongodb.net/hostel_managment?retryWrites=true&w=majority&appName=Cluster0");
    console.log("✅ Connected to MongoDB.");

    // 2. Clear old data
    await Report.deleteMany({});
    console.log("🧹 Cleared old report data.");

    const fakeReports = [];
    const expenseCategories = ["Rent", "Salary", "Utilities", "Maintenance", "Supplies"];
    
    // 3. Set the start date to exactly 6 months ago from today
    const currentDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    startDate.setDate(1); 
    startDate.setHours(0, 0, 0, 0);

    // 4. Generate daily data
    for (let d = new Date(startDate); d <= currentDate; d.setDate(d.getDate() + 1)) {
      
      const dailyPayments = Math.floor(Math.random() * 800) + 200; // $200 - $1000
      const totalStudents = Math.floor(Math.random() * 15) + 150;  // 150 - 165 students
      
      // Create a randomized expense breakdown
      const dailyBreakdown = [];
      let dailyExpensesTotal = 0;

      // Randomly pick 2 to 4 categories for this specific day
      const numCategoriesToday = Math.floor(Math.random() * 3) + 2; 
      const shuffledCategories = [...expenseCategories].sort(() => 0.5 - Math.random());
      const selectedCategories = shuffledCategories.slice(0, numCategoriesToday);

      selectedCategories.forEach(category => {
        const amount = Math.floor(Math.random() * 100) + 20; // $20 - $120 per category
        dailyExpensesTotal += amount;
        dailyBreakdown.push({
          category: category,
          amount: amount
        });
      });

      // Push the finalized daily report to our array
      fakeReports.push({
        reportDate: new Date(d),
        total_payments: dailyPayments,
        total_expenses: dailyExpensesTotal, // Matches the exact sum of the breakdown
        net_profit: dailyPayments - dailyExpensesTotal,
        total_students: totalStudents,
        expense_breakdown: dailyBreakdown
      });
    }

    // 5. Insert into MongoDB
    await Report.insertMany(fakeReports);
    console.log(`🎉 Successfully seeded ${fakeReports.length} daily reports with expense breakdowns!`);
    
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
};

seedDatabase();