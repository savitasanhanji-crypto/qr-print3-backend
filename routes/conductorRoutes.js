const express = require("express");
const bcrypt = require("bcryptjs");
const Conductor = require("../models/Conductor");
const mongoose = require("mongoose");
const router = express.Router();

const ConductorBus = mongoose.model("conductor_bus_lookup", new mongoose.Schema({
  conductor_id: String,
  bus_assigned: String,
}, { collection: "conductor_bus" }));

// Conductor login
router.post("/login", async (req, res) => {
  try {
    const { batch_no, password } = req.body;
    if (!batch_no || !password) {
      return res.status(400).json({ success: false, message: "batch_no and password required" });
    }
    const conductor = await Conductor.findOne({ batch_no });
    if (!conductor) {
      return res.status(404).json({ success: false, message: "Conductor not found" });
    }
    const isMatch = await bcrypt.compare(password, conductor.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }
    res.status(200).json({
      success: true,
      message: "Login successful",
      conductorId: conductor._id,
      conductorName: conductor.name,
      batch_no: conductor.batch_no,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// Get assigned bus for conductor
router.get("/bus/:batch_no", async (req, res) => {
  try {
    const { batch_no } = req.params;
    const conductorBus = await ConductorBus.findOne({ conductor_id: batch_no });
    if (!conductorBus) {
      return res.status(404).json({ success: false, message: "No bus assigned" });
    }
    res.status(200).json({
      success: true,
      busNumber: conductorBus.bus_assigned,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;