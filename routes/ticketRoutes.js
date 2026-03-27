const express = require("express");
const router = express.Router();
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");

const BusPos = mongoose.model("buspos", new mongoose.Schema({
  bus: mongoose.Schema.Types.ObjectId,
  posMachine: mongoose.Schema.Types.ObjectId,
}, { collection: "buspos" }));

const PosMachine = mongoose.model("posmachines", new mongoose.Schema({
  machineId: String,
  serialNumber: String,
  name: String,
}, { collection: "posmachines" }));

const Bus = mongoose.model("buses", new mongoose.Schema({
  busNumber: String,
  name: String,
}, { collection: "buses" }));

// POST /api/tickets
router.post("/", async (req, res) => {
  try {
    const { busNumber } = req.body;

    let routeNumber = busNumber || "";
    let machineId = "";

    // Get bus document
    const bus = await Bus.findOne({ busNumber }).catch(() => null);

    if (bus) {
      // Get machine ID from buspos
      const busPos = await BusPos.findOne({ bus: bus._id }).catch(() => null);
      if (busPos) {
        const posMachine = await PosMachine.findById(busPos.posMachine).catch(() => null);
        if (posMachine) {
          machineId = posMachine.machineId || posMachine.serialNumber ||
                      posMachine._id.toString().slice(-8).toUpperCase();
        }
      }
    }

    // Get today's running serial
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Ticket.countDocuments({
      dateTime: { $gte: today },
    }).catch(() => 0);
    const serial = String(todayCount + 1).padStart(5, "0");

    // Ticket number: SUR-YYYYMMDD-MID-XXXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const midPart = machineId ? machineId.slice(-4) : "00";
    const ticketNumber = `SUR-${dateStr}-${midPart}-${serial}`;

    const ticketData = {
      ...req.body,
      ticketNumber,
      routeNumber,
      machineId,
    };

    const ticket = new Ticket(ticketData);
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Ticket saved successfully",
      ticketNumber,
      routeNumber,
      machineId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save ticket", error: err.message });
  }
});

module.exports = router;