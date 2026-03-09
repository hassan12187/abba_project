import mongoose, { Types } from "mongoose";
// import MessMenu from "./models/MessMenu.js";
import AttendanceRecord from "./models/mealAttendance.js";

const generateDates = (days: number = 30): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        dates.push(date);
    }
    
    return dates.reverse();
};

const generateMealAttendanceData = () => {
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
    const studentStatus=["Present","Absent","Leave"];
    const dates = generateDates(30);
    const attendanceRecords = [];
        for (const date of dates) {
            for (const mealType of mealTypes) {
                // Randomly skip some meals (simulate absence)
                // 85% attendance rate
                  const rand=Math.random();
                    let status:string;
                    if(rand < 0.80){
                      status="Present";
                    }else if(rand < 0.95){
                      status="Absent";
                    }else{
                      status="Leave";
                    };
                    attendanceRecords.push({
                        student: (new Types.ObjectId("690265d1df7bb1a6c28fbca0")),
                        date: date,
                        mealType: mealType,
                        status:status,
                        createdAt: new Date(date.getTime() + Math.random() * 86400000),
                        updatedAt: new Date(date.getTime() + Math.random() * 86400000)
                    });
            }
        }
    
    return attendanceRecords;
};


const fakeMealData=generateMealAttendanceData();

console.log(fakeMealData);
const seedDatabase = async () => {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect("mongodb+srv://hassan12187:hassan12187@cluster0.kuqcu97.mongodb.net/hostel_managment?retryWrites=true&w=majority&appName=Cluster0");

    await AttendanceRecord.deleteMany({});
    const result= await AttendanceRecord.insertMany(fakeMealData);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
};

seedDatabase();