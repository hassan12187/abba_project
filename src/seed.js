"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
// import MessMenu from "./models/MessMenu.js";
var mealAttendance_js_1 = require("./models/mealAttendance.js");
var generateDates = function (days) {
    if (days === void 0) { days = 30; }
    var dates = [];
    var today = new Date();
    for (var i = 0; i < days; i++) {
        var date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        dates.push(date);
    }
    return dates.reverse();
};
var generateMealAttendanceData = function () {
    var mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
    var studentStatus = ["Present", "Absent", "Leave"];
    var dates = generateDates(30);
    var attendanceRecords = [];
    for (var _i = 0, dates_1 = dates; _i < dates_1.length; _i++) {
        var date = dates_1[_i];
        for (var _a = 0, mealTypes_1 = mealTypes; _a < mealTypes_1.length; _a++) {
            var mealType = mealTypes_1[_a];
            // Randomly skip some meals (simulate absence)
            // 85% attendance rate
            var rand = Math.random();
            var status_1 = void 0;
            if (rand < 0.80) {
                status_1 = "Present";
            }
            else if (rand < 0.95) {
                status_1 = "Absent";
            }
            else {
                status_1 = "Leave";
            }
            ;
            attendanceRecords.push({
                student: (new mongoose_1.Types.ObjectId("690265d1df7bb1a6c28fbca0")),
                date: date,
                mealType: mealType,
                status: status_1,
                createdAt: new Date(date.getTime() + Math.random() * 86400000),
                updatedAt: new Date(date.getTime() + Math.random() * 86400000)
            });
        }
    }
    return attendanceRecords;
};
var fakeMealData = generateMealAttendanceData();
console.log(fakeMealData);
var seedDatabase = function () { return __awaiter(void 0, void 0, void 0, function () {
    var result, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                // 1. Connect to MongoDB
                return [4 /*yield*/, mongoose_1.default.connect("mongodb+srv://hassan12187:hassan12187@cluster0.kuqcu97.mongodb.net/hostel_managment?retryWrites=true&w=majority&appName=Cluster0")];
            case 1:
                // 1. Connect to MongoDB
                _a.sent();
                return [4 /*yield*/, mealAttendance_js_1.default.deleteMany({})];
            case 2:
                _a.sent();
                return [4 /*yield*/, mealAttendance_js_1.default.insertMany(fakeMealData)];
            case 3:
                result = _a.sent();
                return [4 /*yield*/, mongoose_1.default.disconnect()];
            case 4:
                _a.sent();
                process.exit(0);
                return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                console.error("❌ Error seeding data:", error_1);
                process.exit(1);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
seedDatabase();
