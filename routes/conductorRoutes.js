const express = require("express");
const bcrypt = require("bcryptjs");
const Conductor = require("../models/Conductor");

const router = express.Router();

// Conductor login
router.post("/login", async (req, res) => {
  try {
    const { batch_no, password } = req.body;
    console.log(batch_no, password, " Hellooo");
    

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

    // Login success
    res.status(200).json({ success: true, message: "Login successful", conductorId: conductor._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
