import mongoose from "mongoose";
import MessMenu from "./models/MessMenu.js";

const seedDatabase = async () => {
  try {
    // 1. Connect to MongoDB
    // await mongoose.connect("mongodb+srv://hassan12187:hassan12187@cluster0.kuqcu97.mongodb.net/hostel_managment?retryWrites=true&w=majority&appName=Cluster0");
    console.log("✅ Connected to MongoDB.");
const weeklyMenu= [
  {
    dayOfWeek: "Monday",
    breakfast: { items: ["Aloo Paratha", "Curd", "Pickle", "Tea/Coffee"] },
    lunch: { items: ["Dal Fry", "Rice", "Roti", "Mixed Veg", "Salad"] },
    dinner: { items: ["Paneer Butter Masala", "Rice", "Roti", "Raita"] },
  },
  {
    dayOfWeek: "Tuesday",
    breakfast: { items: ["Poha", "Boiled Eggs", "Bread & Butter", "Tea/Coffee"] },
    lunch: { items: ["Rajma", "Rice", "Roti", "Aloo Gobi", "Salad"] },
    dinner: { items: ["Chicken Curry", "Rice", "Roti", "Dal"] },
  },
  {
    dayOfWeek: "Wednesday",
    breakfast: { items: ["Idli", "Sambar", "Coconut Chutney", "Tea/Coffee"] },
    lunch: { items: ["Chole", "Bhature", "Rice", "Salad", "Pickle"] },
    dinner: { items: ["Egg Curry", "Rice", "Roti", "Mixed Veg"] },
  },
  {
    dayOfWeek: "Thursday",
    breakfast: { items: ["Upma", "Vada", "Chutney", "Tea/Coffee"] },
    lunch: { items: ["Dal Tadka", "Rice", "Roti", "Bhindi Fry", "Salad"] },
    dinner: { items: ["Fish Curry", "Rice", "Roti", "Dal Fry"] },
  },
  {
    dayOfWeek: "Friday",
    breakfast: { items: ["Puri Bhaji", "Sprouts", "Fruit", "Tea/Coffee"] },
    lunch: { items: ["Kadhi Pakora", "Rice", "Roti", "Aloo Matar", "Salad"] },
    dinner: { items: ["Biryani", "Raita", "Salad", "Gulab Jamun"] },
  },
  {
    dayOfWeek: "Saturday",
    breakfast: { items: ["Dosa", "Sambar", "Chutney", "Tea/Coffee"] },
    lunch: { items: ["Pav Bhaji", "Rice", "Dal", "Salad"] },
    dinner: { items: ["Mutton Curry", "Rice", "Roti", "Raita"] },
  },
  {
    dayOfWeek: "Sunday",
    breakfast: { items: ["Chole Bhature", "Lassi", "Fruit Salad", "Tea/Coffee"] },
    lunch: { items: ["Special Thali", "Rice", "Roti", "Sweet"] },
    dinner: { items: ["Butter Chicken", "Naan", "Rice", "Ice Cream"] },
  },
]
    await MessMenu.insertMany(weeklyMenu);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
};

// seedDatabase();