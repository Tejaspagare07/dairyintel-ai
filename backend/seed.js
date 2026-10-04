require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const Company = require("./models/Company");
const Animal = require("./models/Animal");
const MilkRecord = require("./models/MilkRecord");
const AnimalSample = require("./models/AnimalSample");
const Alert = require("./models/Alert");
const MilkTest = require("./models/MilkTest");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// small helper: random number between min and max, rounded to `d` decimals
const rand = (min, max, d = 2) => +(Math.random() * (max - min) + min).toFixed(d);

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Clearing old data...");

  // 1) wipe (safe for a dev project — do NOT do this in production)
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    Animal.deleteMany({}),
    MilkRecord.deleteMany({}),
    AnimalSample.deleteMany({}),
    Alert.deleteMany({}),
    MilkTest.deleteMany({}),
  ]);

  // 2) admin
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const admin = await User.create({
    name: "Super Admin",
    email: "dairyintel.ai@gmail.com",
    passwordHash: adminHash,
    role: "admin",
    emailVerified: true,
    status: "active",
  });

  // 3) company
  const company = await Company.create({
    name: "Green Valley Dairy",
    location: "Nagpur, Maharashtra",
    contact: "9999900000",
    email: "info@greenvalley.com",
    createdBy: admin._id,
  });

  // 4) two farmers
  const farmerHash = await bcrypt.hash("farmer123", 10);
  const ravi = await User.create({
    name: "Ravi Patil", email: "ravi@test.com", mobile: "9876543210",
    passwordHash: farmerHash, role: "user", companyId: company._id, emailVerified: true, status: "active", village: "Nashik",
  });
  const sunita = await User.create({
    name: "Sunita Rao", email: "sunita@test.com", mobile: "9876500000",
    passwordHash: farmerHash, role: "user", companyId: company._id, emailVerified: true, status: "active", village: "Sinnar",
  });

  // 5) three animals (used for registration + AI health monitoring, NOT bulk milk)
  const animals = await Animal.create([
    { animalId: "COW-001", name: "Ganga", breed: "Gir", age: 4, weight: 380, location: "Shed A", feedType: "Green fodder", ownerId: ravi._id, companyId: company._id },
    { animalId: "COW-002", name: "Jamuna", breed: "Sahiwal", age: 5, weight: 410, location: "Shed A", feedType: "Silage", ownerId: ravi._id, companyId: company._id },
    { animalId: "COW-003", name: "Laxmi", breed: "HF Cross", age: 6, weight: 450, location: "Shed B", feedType: "Mixed", ownerId: sunita._id, companyId: company._id },
  ]);

  // 6) BULK milk collection — per farmer, 2 sessions/day, 7 days (no animal tagging)
  const bulkRecords = [];
  const farmers = [
    { user: ravi, herdYield: 27 },    // Ravi's combined herd yield (COW-001 + COW-002)
    { user: sunita, herdYield: 13 },  // Sunita's herd (COW-003 alone, currently declining)
  ];

  for (const f of farmers) {
    for (let d = 6; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);

      const isSunitaSickDay = f.user._id.equals(sunita._id) && d <= 2; // her last 3 days
      const dayFactor = isSunitaSickDay ? rand(0.80, 0.85) : rand(0.95, 1.05);

      ["Morning", "Evening"].forEach((session) => {
        const sessionShare = session === "Morning" ? 0.55 : 0.45; // mornings usually yield a bit more
        bulkRecords.push({
          userId: f.user._id,
          companyId: company._id,
          session,
          collectionDate: date,
          quantity: +(f.herdYield * sessionShare * dayFactor).toFixed(1),
          fat: rand(3.6, 4.4),
          snf: rand(8.5, 9.0),
          protein: isSunitaSickDay ? rand(2.7, 2.9) : rand(3.1, 3.4),
          temperature: rand(3, 5, 1),
          storageTank: "Tank-A",
        });
      });
    }
  }
  await MilkRecord.insertMany(bulkRecords);

  // 7) ANIMAL SAMPLES — occasional per-animal checks (used for disease prediction / AI history)
  // Sunita checked on Laxmi (COW-003) daily because she looked unwell — realistic scenario.
  const sickCow = animals.find((a) => a.animalId === "COW-003");
  const sampleRecords = [];
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const sickWindow = d <= 2;

    sampleRecords.push({
      animalId: sickCow._id,
      userId: sunita._id,
      sampleDate: date,
      quantity: sickWindow ? rand(9, 10.5) : rand(12, 13.5),
      fat: rand(3.6, 4.4),
      protein: sickWindow ? rand(2.7, 2.9) : rand(3.1, 3.4),
      lactose: sickWindow ? rand(4.0, 4.3) : rand(4.6, 4.9),
      ec: sickWindow ? rand(6.8, 7.5) : rand(4.5, 5.5),
      scc: sickWindow ? Math.round(rand(450000, 600000, 0)) : Math.round(rand(100000, 200000, 0)),
    });
  }
  // a couple of one-off samples for the healthy cows, so they have SOME data to compare against
  for (const a of [animals[0], animals[1]]) {
    sampleRecords.push({
      animalId: a._id,
      userId: ravi._id,
      sampleDate: new Date(),
      quantity: rand(12, 15),
      fat: rand(3.6, 4.4),
      protein: rand(3.1, 3.4),
      lactose: rand(4.6, 4.9),
      ec: rand(4.5, 5.5),
      scc: Math.round(rand(100000, 200000, 0)),
    });
  }
  await AnimalSample.insertMany(sampleRecords);

  // 8) one sample alert for the sick cow
  await Alert.create({
    type: "disease_risk",
    message: "COW-003 (Laxmi): milk yield dropped in recent samples, EC rising. Possible mastitis — vet check recommended.",
    severity: "high",
    animalId: sickCow._id,
    userId: sickCow.ownerId,
  });

  // 9) MILK CHECKS - replay the 28 rows of the training CSV through the ML service
  //    (same analyzer fields the farmer types in), split between the two farmers.
  const csvPath = path.join(__dirname, "..", "ml-service", "data", "milk_testing_2week_full.csv");
  const ML = process.env.ML_SERVICE_URL || "http://localhost:8000";
  let testsMade = 0;
  if (fs.existsSync(csvPath)) {
    const [head, ...lines] = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
    const cols = head.split(",");
    const n = (v) => (v === undefined || v === "" || v === "NA" ? undefined : Number(v));
    try {
      for (let i = 0; i < lines.length; i++) {
        const cells = lines[i].split(",");
        const r = Object.fromEntries(cols.map((c, k) => [c, cells[k]]));
        const owner = i % 2 === 0 ? ravi : sunita;
        const animal = owner._id.equals(ravi._id) ? animals[i % 4 === 0 ? 0 : 1] : animals[2];
        const body = { fat: n(r["Fat_%"]), snf: n(r["SNF_%"]), clr: n(r["CLR_Density"]), protein: n(r["Protein_%"]),
          lactose: n(r["Lactose_%"]), added_water: n(r["Added_Water_%"]), temp: n(r["Milk_Temp_C"]), shift: r.Shift, species: "cow" };
        const { data } = await axios.post(`${ML}/predict/sample`, body, { timeout: 15000 });
        const when = new Date(Date.now() - (lines.length - 1 - i) * 12 * 3600e3);
        await MilkTest.create({
          userId: owner._id, animalId: animal._id, testNo: r.Test_No, shift: r.Shift, species: "cow",
          fat: body.fat, snf: body.snf, clr: body.clr, protein: body.protein, lactose: body.lactose,
          addedWater: body.added_water, temp: body.temp, quality: data.quality,
          disease: { ...data.disease }, modelVersion: data.model?.version, testedAt: when,
        });
        if (data.disease.status === "High Risk") {
          await Alert.create({ type: "disease_risk", severity: "high", animalId: animal._id, userId: owner._id,
            message: `${animal.animalId} (${animal.name}): ${data.disease.condition} risk (${Math.round(data.disease.probabilities.anyRisk * 100)}%) in test ${r.Test_No}. Do a CMT test or call a vet.` });
        }
        testsMade++;
      }
    } catch (e) {
      console.warn(`⚠️  Could not reach the ML service at ${ML} (${e.code || e.message}). Start it and re-run the seed to add milk checks.`);
    }
  }

  console.log("\n✅ Seed complete!");
  console.log(`   Milk checks (ML): ${testsMade}`);
  console.log(`   Users: ${await User.countDocuments()} (admin + 2 farmers)`);
  console.log(`   Animals: ${await Animal.countDocuments()}`);
  console.log(`   Milk collection records: ${await MilkRecord.countDocuments()}`);
  console.log(`   Animal health samples: ${await AnimalSample.countDocuments()}`);
  console.log("\n   Logins:");
  console.log("   Admin  → dairyintel.ai@gmail.com / Admin@123");
  console.log("   Farmer → ravi@test.com / farmer123");
  console.log("   Farmer → sunita@test.com / farmer123  (owns the 'sick' cow COW-003)\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});