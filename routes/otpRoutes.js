const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const axios = require("axios");
const Conductor = require("../models/Conductor");
const router = express.Router();

// Store OTPs temporarily in memory
const otpStore = {};

// Generate 6 digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP via Fast2SMS
const sendOTP = async (phone, otp) => {
  try {
    const response = await axios.get("https://www.fast2sms.com/dev/bulkV2", {
      params: {
        authorization: process.env.FAST2SMS_API_KEY,
        message: `Your SMT POS password reset OTP is: ${otp}. Valid for 10 minutes.`,
        language: "english",
        route: "q",
        numbers: phone,
      },
    });
    console.log("SMS response:", response.data);
    return response.data.return === true;
  } catch (err) {
    console.error("SMS error:", err.message);
    return false;
  }
};

// POST /conductor/forgot-password - Send OTP
router.post("/forgot-password", async (req, res) => {
  try {
    const { batch_no } = req.body;
    if (!batch_no) {
      return res.status(400).json({ success: false, message: "Batch number required" });
    }

    const conductor = await Conductor.findOne({ batch_no });
    if (!conductor) {
      return res.status(404).json({ success: false, message: "Conductor not found" });
    }

    if (!conductor.Contact) {
      return res.status(400).json({ success: false, message: "No contact number registered" });
    }

    const otp = generateOTP();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore[batch_no] = { otp, expiry };

    // Send SMS
    const sent = await sendOTP(conductor.Contact, otp);

    if (sent) {
      // Mask phone number for security
      const masked = conductor.Contact.slice(0, 2) + "XXXXXX" + conductor.Contact.slice(-2);
      res.json({ success: true, message: `OTP sent to ${masked}` });
    } else {
      // For testing - return OTP if SMS fails
      console.log("OTP for testing:", otp);
      res.json({ success: true, message: "OTP sent (check server logs if SMS fails)", otp: process.env.NODE_ENV === "development" ? otp : undefined });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// POST /conductor/verify-otp - Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { batch_no, otp } = req.body;
    if (!batch_no || !otp) {
      return res.status(400).json({ success: false, message: "Batch number and OTP required" });
    }

    const stored = otpStore[batch_no];
    if (!stored) {
      return res.status(400).json({ success: false, message: "OTP not found. Please request again." });
    }

    if (Date.now() > stored.expiry) {
      delete otpStore[batch_no];
      return res.status(400).json({ success: false, message: "OTP expired. Please request again." });
    }

    if (stored.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // OTP verified - generate reset token
    const resetToken = `${batch_no}_${Date.now()}_reset`;
    otpStore[`reset_${batch_no}`] = { token: resetToken, expiry: Date.now() + 5 * 60 * 1000 };

    res.json({ success: true, message: "OTP verified", resetToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// POST /conductor/reset-password - Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { batch_no, resetToken, newPassword } = req.body;
    if (!batch_no || !resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    const stored = otpStore[`reset_${batch_no}`];
    if (!stored || stored.token !== resetToken || Date.now() > stored.expiry) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);
    await Conductor.updateOne({ batch_no }, { $set: { password: hashed } });

    // Clear OTP store
    delete otpStore[batch_no];
    delete otpStore[`reset_${batch_no}`];

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;