// POST /api/tickets
const express = require("express");
const router = express.Router();
const Ticket = require("../models/Ticket");

router.post("/", async (req, res) => {
  try {
    const ticket = new Ticket(req.body);
    await ticket.save();
    res.status(200).json({ success: true, message: "Ticket saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save ticket" });
  }
});

module.exports = router;
