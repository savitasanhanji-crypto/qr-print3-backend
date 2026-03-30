const express = require("express");
const bcrypt = require("bcryptjs");
const Conductor = require("../models/Conductor");
const mongoose = require("mongoose");
const router = express.Router();

const ConductorBus = mongoose.models.conductor_bus_lookup ||
  mongoose.model("conductor_bus_lookup", new mongoose.Schema({
    conductor_id: String, bus_assigned: String,
  }, { collection: "conductor_bus" }));

const PosMachine = mongoose.models.posmachines_lookup ||
  mongoose.model("posmachines_lookup", new mongoose.Schema({
    deviceId: String,
    machineId: String,
    serialNumber: String,
    name: String,
  }, { collection: "posmachines" }));

const BusPos = mongoose.models.buspos_lookup ||
  mongoose.model("buspos_lookup", new mongoose.Schema({
    bus: mongoose.Schema.Types.ObjectId,
    posMachine: mongoose.Schema.Types.ObjectId,
  }, { collection: "buspos" }));

const Bus = mongoose.models.buses_lookup ||
  mongoose.model("buses_lookup", new mongoose.Schema({
    busNumber: String, name: String,
  }, { collection: "buses" }));

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

// Get assigned bus for conductor by batch_no
router.get("/bus/:batch_no", async (req, res) => {
  try {
    const { batch_no } = req.params;
    const conductorBus = await ConductorBus.findOne({ conductor_id: batch_no });
    if (!conductorBus) {
      return res.status(404).json({ success: false, message: "No bus assigned" });
    }
    res.status(200).json({ success: true, busNumber: conductorBus.bus_assigned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// Get bus number from POS device ID
router.get("/bus-by-pos/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log("Looking up bus for deviceId:", deviceId);

    // Step 1: Find posMachine by deviceId
    const posMachine = await PosMachine.findOne({ deviceId: deviceId });
    console.log("PosMachine found:", posMachine);
    if (!posMachine) {
      return res.status(404).json({ success: false, message: "POS machine not found" });
    }

    // Step 2: Find buspos by posMachine._id
    const busPos = await BusPos.findOne({ posMachine: posMachine._id });
    console.log("BusPos found:", busPos);
    if (!busPos) {
      return res.status(404).json({ success: false, message: "No bus assigned to this POS" });
    }

    // Step 3: Find bus by bus._id
    const bus = await Bus.findById(busPos.bus);
    console.log("Bus found:", bus);
    if (!bus) {
      return res.status(404).json({ success: false, message: "Bus not found" });
    }

    res.status(200).json({ success: true, busNumber: bus.busNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;