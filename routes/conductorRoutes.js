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

    const db = mongoose.connection.db;

    // Auto-expire sessions older than 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    await db.collection("conductor_sessions").updateMany(
      { batch_no, isActive: true, loginTime: { $lt: twelveHoursAgo } },
      { $set: { isActive: false, logoutTime: new Date() } }
    );

    // Check if conductor already has active session
    const existingSession = await db.collection("conductor_sessions").findOne({
      batch_no: batch_no,
      isActive: true,
    });

    if (existingSession) {
      const { forceLogin } = req.body;
      if (!forceLogin) {
        return res.status(403).json({
          success: false,
          message: "Conductor is already logged in on another device. Do you want to force login?",
          alreadyLoggedIn: true,
        });
      }
      // Force login - clear existing session
      await db.collection("conductor_sessions").updateMany(
        { batch_no, isActive: true },
        { $set: { isActive: false, logoutTime: new Date() } }
      );
    }

    // Create new session
    const sessionToken = `${batch_no}_${Date.now()}`;
    await db.collection("conductor_sessions").insertOne({
      batch_no: batch_no,
      conductorId: conductor._id.toString(),
      sessionToken,
      isActive: true,
      loginTime: new Date(),
      deviceId: req.body.deviceId || "unknown",
    });

    // Fetch bus assigned to conductor
    const conductorBus = await db.collection("conductor_bus").findOne(
      { batch_no: batch_no, isActive: true },
      { sort: { assignedDate: -1 } }
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
      sessionToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// Conductor logout
router.post("/logout", async (req, res) => {
  try {
    const { batch_no, sessionToken } = req.body;
    if (!batch_no) {
      return res.status(400).json({ success: false, message: "batch_no required" });
    }
    const db = mongoose.connection.db;
    await db.collection("conductor_sessions").updateOne(
      { batch_no, sessionToken, isActive: true },
      { $set: { isActive: false, logoutTime: new Date() } }
    );
    res.status(200).json({ success: true, message: "Logged out successfully" });
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

// Temp - Clear all sessions for a conductor (admin use only)
router.post("/clear-session", async (req, res) => {
  try {
    const { batch_no } = req.body;
    const db = mongoose.connection.db;
    await db.collection("conductor_sessions").updateMany(
      { batch_no },
      { $set: { isActive: false } }
    );
    res.json({ success: true, message: "Sessions cleared" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;