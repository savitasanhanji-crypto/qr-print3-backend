const express = require("express");
const router = express.Router();
const Ticket = require("../models/Ticket");

// GET /api/tickets/summary?batch_no=121212&date=2026-03-28
router.get("/summary", async (req, res) => {
  try {
    const { batch_no, date } = req.query;

    const queryDate = date ? new Date(date) : new Date();
    const start = new Date(queryDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(queryDate);
    end.setHours(23, 59, 59, 999);

    const query = {
      dateTime: { $gte: start, $lte: end },
      ...(batch_no ? { batch_no } : {}),
    };

    const tickets = await Ticket.find(query);

    // Calculate summary
    let totalTickets = 0;
    let totalFare = 0;
    let cashFare = 0;
    let onlineFare = 0;
    let totalAdult = 0;
    let totalChild = 0;
    const passCountSummary = {};

    tickets.forEach(t => {
      if (t.paymentMode !== "Pass") {
        totalTickets++;
        totalFare += t.price || 0;
        if (t.paymentMode === "Cash") cashFare += t.price || 0;
        if (t.paymentMode === "Online") onlineFare += t.price || 0;
      }
      totalAdult += t.adultCount || 0;
      totalChild += t.childCount || 0;

      // Pass counts
      if (t.passCounts) {
        Object.entries(t.passCounts).forEach(([pass, count]) => {
          passCountSummary[pass] = (passCountSummary[pass] || 0) + Number(count);
        });
      }
    });

    res.status(200).json({
      success: true,
      date: queryDate.toISOString().slice(0, 10),
      batch_no: batch_no || "All",
      totalTickets,
      totalFare,
      cashFare,
      onlineFare,
      totalAdult,
      totalChild,
      passCountSummary,
      totalTransactions: tickets.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch summary", error: err.message });
  }
});

// POST /api/tickets
router.post("/", async (req, res) => {
  try {
    const { busNumber, batch_no } = req.body;
    const mongoose = require("mongoose");

    let routeNumber = "";
    let machineId = "";
    let resolvedBusNumber = busNumber;

    const ConductorBus = mongoose.models.conductor_bus_lookup ||
      mongoose.model("conductor_bus_lookup", new mongoose.Schema({
        conductor_id: String, bus_assigned: String,
      }, { collection: "conductor_bus" }));

    const BusPos = mongoose.models.buspos ||
      mongoose.model("buspos", new mongoose.Schema({
        bus: mongoose.Schema.Types.ObjectId,
        posMachine: mongoose.Schema.Types.ObjectId,
      }, { collection: "buspos" }));

    const PosMachine = mongoose.models.posmachines ||
      mongoose.model("posmachines", new mongoose.Schema({
        machineId: String, serialNumber: String, name: String,
      }, { collection: "posmachines" }));

    const Bus = mongoose.models.buses ||
      mongoose.model("buses", new mongoose.Schema({
        busNumber: String, name: String,
      }, { collection: "buses" }));

    if (batch_no) {
      const conductorBus = await ConductorBus.findOne({ conductor_id: batch_no }).catch(() => null);
      if (conductorBus) resolvedBusNumber = conductorBus.bus_assigned || busNumber;
    }

    const bus = await Bus.findOne({ busNumber: resolvedBusNumber }).catch(() => null);
    if (bus) {
      routeNumber = bus._id.toString().slice(-6).toUpperCase();
      const busPos = await BusPos.findOne({ bus: bus._id }).catch(() => null);
      if (busPos) {
        const posMachine = await PosMachine.findById(busPos.posMachine).catch(() => null);
        if (posMachine) {
          machineId = posMachine.machineId || posMachine.serialNumber ||
                      posMachine._id.toString().slice(-8).toUpperCase();
        }
      }
    }

    if (!routeNumber) routeNumber = resolvedBusNumber;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Ticket.countDocuments({ dateTime: { $gte: today } }).catch(() => 0);
    const serial = String(todayCount + 1).padStart(5, "0");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const midPart = machineId ? machineId.slice(-4) : "00";
    const ticketNumber = `SUR-${dateStr}-${midPart}-${serial}`;

    const ticketData = { ...req.body, ticketNumber, routeNumber, machineId, busNumber: resolvedBusNumber };
    const ticket = new Ticket(ticketData);
    await ticket.save();

    res.status(200).json({
      success: true, message: "Ticket saved successfully",
      ticketNumber, routeNumber, machineId, busNumber: resolvedBusNumber,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save ticket", error: err.message });
  }
});

module.exports = router;