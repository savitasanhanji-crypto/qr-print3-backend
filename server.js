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

// QR Code ticket verification endpoint
app.get("/verify/:ticketNumber", async (req, res) => {
  try {
    const db = require("mongoose").connection.db;
    const ticket = await db.collection("Ticket").findOne({ ticketNumber: req.params.ticketNumber });
    if (!ticket) {
      return res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket Not Found</title>
<style>body{font-family:Arial;text-align:center;padding:20px;background:#f5f5f5;}
.card{background:#fff;border-radius:10px;padding:20px;max-width:400px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.1);}
.error{color:#f44336;font-size:18px;}</style></head>
<body><div class="card"><h2>SMT City Bus Service</h2><p class="error">❌ Ticket Not Found</p>
<p>Ticket number: ${req.params.ticketNumber}</p></div></body></html>`);
    }

    const passCounts = ticket.passCounts || {};
    const passRows = Object.entries(passCounts).map(([pass, count]) =>
      count > 0 ? `<tr><td>${pass}</td><td>${count}</td></tr>` : ""
    ).join("");

    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SMT Ticket Verification</title>
<style>
body{font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:16px;}
.card{background:#fff;border-radius:12px;padding:20px;max-width:420px;margin:0 auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);}
.header{background:#1E90FF;color:#fff;border-radius:8px;padding:12px;text-align:center;margin-bottom:16px;}
.header h2{margin:0;font-size:18px;}
.header p{margin:4px 0 0;font-size:13px;opacity:0.9;}
.badge{display:inline-block;background:#4caf50;color:#fff;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:bold;margin-bottom:12px;}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;}
.row:last-child{border-bottom:none;}
.label{color:#666;}
.value{font-weight:bold;color:#333;text-align:right;}
.fare{background:#e8f5e9;border-radius:8px;padding:12px;margin-top:12px;}
.fare .total{font-size:18px;font-weight:bold;color:#1E90FF;}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;}
th{background:#f5f5f5;padding:6px;text-align:left;}
td{padding:6px;border-bottom:1px solid #eee;}
.footer{text-align:center;margin-top:16px;font-size:12px;color:#999;}
.valid{color:#4caf50;}
</style></head>
<body>
<div class="card">
  <div class="header">
    <h2>🚌 SMT City Bus Service</h2>
    <p>Ticket Verification</p>
  </div>
  <div style="text-align:center">
    <span class="badge">✅ Valid Ticket</span>
  </div>
  <div class="row"><span class="label">Ticket No</span><span class="value">${ticket.ticketNumber}</span></div>
  <div class="row"><span class="label">Date/Time</span><span class="value">${ticket.date} ${ticket.time}</span></div>
  <div class="row"><span class="label">Conductor</span><span class="value">${ticket.batch_no} (${ticket.conductorName || "-"})</span></div>
  <div class="row"><span class="label">Bus/Route</span><span class="value">${ticket.busNumber} / Route ${ticket.routeNumber || "-"}</span></div>
  <div class="row"><span class="label">From</span><span class="value">${ticket.boardingStop}</span></div>
  <div class="row"><span class="label">To</span><span class="value">${ticket.destinationStop}</span></div>
  <div class="fare">
    ${ticket.adultCount > 0 ? `<div class="row"><span class="label">Adult x${ticket.adultCount}</span><span class="value">Rs.${ticket.adultCount * ticket.basePrice}</span></div>` : ""}
    ${ticket.childCount > 0 ? `<div class="row"><span class="label">Child x${ticket.childCount}</span><span class="value">Rs.${ticket.childCount * Math.ceil(ticket.basePrice / 2)}</span></div>` : ""}
    ${ticket.luggageCount > 0 ? `<div class="row"><span class="label">Luggage x${ticket.luggageCount}</span><span class="value">Rs.${ticket.luggageCount * ticket.luggageAmount}</span></div>` : ""}
    ${passRows ? `<table><tr><th>Pass Type</th><th>Count</th></tr>${passRows}</table>` : ""}
    <div class="row"><span class="label total">Total Fare</span><span class="value total">Rs.${ticket.price}</span></div>
    <div class="row"><span class="label">Payment</span><span class="value">${ticket.paymentMode}</span></div>
  </div>
  <div class="footer">
    <p>तिकीट हस्तांतरणीय नाही</p>
    <p>Powered by MIT Vishwaprayag University, Solapur</p>
  </div>
</div>
</body></html>`);
  } catch (err) {
    res.status(500).send("Server error: " + err.message);
  }
});

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


