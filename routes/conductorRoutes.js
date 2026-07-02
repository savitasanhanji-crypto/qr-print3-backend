const express = require("express");
const bcrypt = require("bcryptjs");
const Conductor = require("../models/Conductor");
const mongoose = require("mongoose");
const router = express.Router();

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

    // Fetch latest bus assigned to conductor
    const db = mongoose.connection.db;
    // Fetch latest active bus assigned to conductor using batch_no
    const conductorBus = await db.collection("conductor_bus").findOne(
      { batch_no: batch_no, isActive: true },
      { sort: { assignedDate: -1 } } // Get latest assignment
    );
    let busNumber = null;
    let busId = null;
    if (conductorBus) {
      busNumber = conductorBus.assignedbusNumber;
      busId = conductorBus.busId ? conductorBus.busId.toString() : null;
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      conductorId: conductor._id,
      conductorName: conductor.name,
      batch_no: conductor.batch_no,
      busNumber: busNumber || null,
      busId: busId || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// Get assigned bus for conductor by batch_no
router.get("/bus/:batch_no", async (req, res) => {
  try {
    const { batch_no } = req.params;
    const db = mongoose.connection.db;
    const conductorBus = await db.collection("conductor_bus").findOne(
      { batch_no: batch_no, isActive: true },
      { sort: { assignedDate: -1 } }
    );
    if (!conductorBus) {
      return res.status(404).json({ success: false, message: "No bus assigned" });
    }
    res.status(200).json({ success: true, busNumber: conductorBus.assignedbusNumber, busId: conductorBus.busId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// Get bus number from POS device ID
router.get("/bus-by-pos/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const db = mongoose.connection.db;
    const posMachine = await db.collection("posmachines").findOne({ deviceId: deviceId });
    if (!posMachine) {
      return res.status(404).json({ success: false, message: "POS machine not found" });
    }
    const busPos = await db.collection("buspos").findOne({ posMachine: posMachine._id });
    if (!busPos) {
      return res.status(404).json({ success: false, message: "No bus assigned to this POS" });
    }
    const bus = await db.collection("buses").findOne({ _id: busPos.bus });
    if (!bus) {
      return res.status(404).json({ success: false, message: "Bus not found" });
    }
    return res.json({ success: true, busNumber: bus.busNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;