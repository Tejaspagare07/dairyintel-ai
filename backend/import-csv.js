require("dotenv").config();
const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

// 1. MilkTest Model (Check history ke liye)
const MilkTest = require("./models/MilkTest");

// 2. Milk Collection Model (Milk collection /records ke liye)
let MilkRecordModel;
const possibleModels = ["Milk", "MilkRecord", "MilkCollection", "Collection"];
for (const name of possibleModels) {
  try {
    MilkRecordModel = require(`./models/${name}`);
    console.log(`Found Milk Collection Model: ./models/${name}`);
    break;
  } catch (e) {
    // next model check karega
  }
}

const TARGET_USER_ID = new mongoose.Types.ObjectId("6ab215f3a64475048e7099a8");

function mapGrade(alert) {
  const text = (alert || "").toLowerCase();
  if (text.includes("normal") || text.includes("good")) return "Good";
  if (text.includes("borderline") || text.includes("average")) return "Average";
  return "Poor";
}

async function runImport() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    console.log(`Target User ID: ${TARGET_USER_ID}`);

    const results = [];
    const csvPath = path.join(__dirname, "Milk_Quality_Clean.csv");

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", async () => {
        try {
          // Purane demo records clean karein
          await MilkTest.deleteMany({ userId: TARGET_USER_ID });
          if (MilkRecordModel) {
            await MilkRecordModel.deleteMany({ userId: TARGET_USER_ID });
          }

          const total = results.length;
          const now = new Date();

          const testDocs = [];
          const collectionDocs = [];

          results.forEach((row, index) => {
            const daysAgo = Math.floor((total - 1 - index) / 2);
            const entryDate = new Date(now);
            entryDate.setDate(now.getDate() - daysAgo);

            const fat = parseFloat(row.Fat_Percent) || 0;
            const snf = parseFloat(row.SNF_Percent) || 0;
            const protein = parseFloat(row.Protein_Percent) || 0;
            const lactose = parseFloat(row.Lactose_Percent) || 0;
            const temp = row.Milk_Temperature_C ? parseFloat(row.Milk_Temperature_C) : 29.5;
            const clr = row.CLR_Density ? parseFloat(row.CLR_Density) : 28.0;
            const grade = mapGrade(row.Health_Quality_Alert);
            const session = row.Shift || "Morning";

            // Demo quantity (L)
            const qty = parseFloat((Math.random() * (35 - 18) + 18).toFixed(1));

            // Check history document
            testDocs.push({
              userId: TARGET_USER_ID,
              testNo: row.Test_ID,
              shift: session,
              fat,
              snf,
              protein,
              lactose,
              temp,
              clr,
              quality: {
                grade,
                score: 90,
                standard: "Demo Dataset"
              },
              testedAt: entryDate
            });

            // Milk collection document (table columns match karne ke liye)
            collectionDocs.push({
              userId: TARGET_USER_ID,
              session: session,
              date: entryDate,
              quantity: qty,
              qty: qty,
              fat: fat,
              snf: snf,
              protein: protein,
              ec: 4.8,
              temp: temp,
              grade: grade,
              clr: clr
            });
          });

          // Dono collections me insert karein
          await MilkTest.insertMany(testDocs);
          console.log(`✅ Saved ${testDocs.length} tests to MilkTest (Check history)`);

          if (MilkRecordModel) {
            await MilkRecordModel.insertMany(collectionDocs);
            console.log(`✅ Saved ${collectionDocs.length} records to Milk collection table!`);
          } else {
            console.warn("⚠️ models folder me Milk model nahi mila! models/ ka exact file name check karein.");
          }

          console.log("🎉 All data imported successfully!");
          process.exit(0);
        } catch (insertError) {
          console.error("Insertion Error:", insertError);
          process.exit(1);
        }
      });
  } catch (connError) {
    console.error("Database connection error:", connError);
    process.exit(1);
  }
}

runImport();