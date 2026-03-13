// routes/adminRoutes.js
const express = require("express");
const Pass = require("../models/Pass"); // ✅ CommonJS require

const router = express.Router(); // declare router

// GET all passes
router.get("/", async (req, res) => {
  try {
    const passes = await Pass.find({}, "passName"); // fetch only passName
    res.json({ success: true, passes });
  } catch (err) {
    console.error("Error fetching passes:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router; // ✅ CommonJS export
