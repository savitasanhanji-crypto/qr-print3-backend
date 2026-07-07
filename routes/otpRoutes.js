const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const axios = require("axios");
const router = express.Router();

const otpStore = {};
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTP = async (phone, otp) => {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY;
    console.log("API Key:", apiKey ? "SET (length:" + apiKey.length + ")" : "NOT SET");
    const message = `Your SMT POS OTP is ${otp}. Valid for 10 minutes.`;
    const response = await axios.post("https://www.fast2sms.com/dev/bulkV2", {
      route: "q",
      message: message,
      language: "english",
      flash: "0",
      numbers: phone,
    }, {
      headers: {
        "authorization": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
    console.log("Fast2SMS Response:", JSON.stringify(response.data));
    return response.data.return === true;
  } catch (err) {
    console.error("SMS Error:", err.message);
    if (err.response) console.error("SMS Response Error:", JSON.stringify(err.response.data));
    return false;
  }
};

// POST /conductor/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { batch_no } = req.body;
    if (!batch_no) return res.status(400).json({ success: false, message: "Batch number required" });
    const db = mongoose.connection.db;
    const conductor = await db.collection("Conductor").findOne({ batch_no: batch_no });
    if (!conductor) return res.status(404).json({ success: false, message: "Conductor not found" });
    if (!conductor.Contact) return res.status(400).json({ success: false, message: "No contact number registered" });

    const otp = generateOTP();
    otpStore[batch_no] = { otp, expiry: Date.now() + 10 * 60 * 1000 };
    console.log(`OTP for ${batch_no}: ${otp}`);

    const sent = await sendOTP(conductor.Contact, otp);
    const masked = conductor.Contact.slice(0, 2) + "XXXXXX" + conductor.Contact.slice(-2);
    res.json({
      success: true,
      message: sent ? `OTP sent to ${masked}` : `OTP generated (SMS failed)`,
      otp: sent ? undefined : otp,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// POST /conductor/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { batch_no, otp } = req.body;
    if (!batch_no || !otp) return res.status(400).json({ success: false, message: "Batch number and OTP required" });
    const stored = otpStore[batch_no];
    if (!stored) return res.status(400).json({ success: false, message: "OTP not found. Please request again." });
    if (Date.now() > stored.expiry) {
      delete otpStore[batch_no];
      return res.status(400).json({ success: false, message: "OTP expired. Please request again." });
    }
    if (stored.otp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP" });
    const resetToken = `${batch_no}_${Date.now()}_reset`;
    otpStore[`reset_${batch_no}`] = { token: resetToken, expiry: Date.now() + 5 * 60 * 1000 };
    delete otpStore[batch_no];
    res.json({ success: true, message: "OTP verified", resetToken });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// POST /conductor/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { batch_no, resetToken, newPassword } = req.body;
    if (!batch_no || !resetToken || !newPassword) return res.status(400).json({ success: false, message: "All fields required" });
    const stored = otpStore[`reset_${batch_no}`];
    if (!stored || stored.token !== resetToken || Date.now() > stored.expiry) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    const db = mongoose.connection.db;
    await db.collection("Conductor").updateOne({ batch_no }, { $set: { password: hashed } });
    delete otpStore[`reset_${batch_no}`];
    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;