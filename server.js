// server.js
require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

// Routes
const stopRoutes = require("./routes/stopRoutes");
const conductorRoutes = require("./routes/conductorRoutes");
const passRoutes = require("./routes/passRoutes");
const busRoutes = require("./routes/busRoutes");
const ticketRoute = require("./routes/ticketRoutes");
const posRoutes = require("./routes/pos");
const fareRoutes = require("./routes/fareRoutes");
const otpRoutes = require("./routes/otpRoutes");


const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Middleware MUST come before routes
app.use(bodyParser.json());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
.then(() => {
  console.log("Connected to MongoDB Atlas");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
})
.catch(err => {
  console.error("MongoDB connection error:", err.message);
});

// Health check
app.get("/", (req, res) => res.json({ status: "ok", message: "SMT Bus API running" }));

app.get("/check-assignments/:batch_no", async (req, res) => {
  try {
    const db = require("mongoose").connection.db;
    const assignments = await db.collection("conductor_bus").find({ batch_no: req.params.batch_no }).toArray();
    res.json({ success: true, count: assignments.length, assignments: assignments.map(a => ({ shift: a.shift, assignedDate: a.assignedDate, busNumber: a.assignedbusNumber })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/update-pos-device", async (req, res) => {
  try {
    const db = require("mongoose").connection.db;
    const result = await db.collection("posmachines").updateOne(
      { serialNumber: "9222136432" },
      { $set: { deviceId: "454d68d198898836" } }
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Temp - check posmachines
app.get("/check-pos", async (req, res) => {
  try {
    const db = require("mongoose").connection.db;
    const pos = await db.collection("posmachines").find({}).toArray();
    res.json({ success: true, pos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount routes
app.use("/bus", busRoutes);
app.use("/api/Stop", stopRoutes);
app.use("/api/stops", stopRoutes);
app.use("/api/tickets", ticketRoute);
app.use("/conductor", conductorRoutes);
app.use("/api/passes", passRoutes);
app.use("/api/pos", posRoutes);
app.use("/api", fareRoutes);
app.use("/conductor", otpRoutes);


