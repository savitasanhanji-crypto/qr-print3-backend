const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const https = require("https");
const Conductor = require("../models/Conductor");
const router = express.Router();

const otpStore = {};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP via ACL Gateway without DLT
const sendOTP = async (phone, otp) => {
  try {
    const smsMsg = encodeURIComponent(`Your SMT POS OTP is ${otp}. Valid for 10 minutes.`);
    const userId = "MahaITsomc";
    const pass = "mitsomc_10";

    // Send without dtm parameter
    const url = `https://push3.aclgateway.com/servlet/com.aclwireless.pushconnectivity.listeners.TextListener?appid=MahaITsomc&userId=${userId}&pass=${pass}&contenttype=3&from=MAHGOV&to=91${phone}&text=${smsMsg}&alert=1&selfid=true&dlrreq=true`;

    console.log("Sending SMS URL:", url);

    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          console.log("ACL SMS Response:", data);
          resolve(true);
        });
      }).on("error", (err) => {
        console.error("SMS Error:", err.message);
        resolve(false);
      });
    });
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
    const expiry = Date.now() + 10 * 60 * 1000;
    otpStore[batch_no] = { otp, expiry };

    console.log(`OTP for ${batch_no}: ${otp}`);

    await sendOTP(conductor.Contact, otp);

    const masked = conductor.Contact.slice(0, 2) + "XXXXXX" + conductor.Contact.slice(-2);
    res.json({
      success: true,
      message: `OTP sent to ${masked}`,
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

    const resetToken = `${batch_no}_${Date.now()}_reset`;
    otpStore[`reset_${batch_no}`] = { token: resetToken, expiry: Date.now() + 5 * 60 * 1000 };

    delete otpStore[batch_no];

    res.json({ success: true, message: "OTP verified", resetToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// POST /conductor/reset-password
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

    const hashed = await bcrypt.hash(newPassword, 10);
    await Conductor.updateOne({ batch_no }, { $set: { password: hashed } });

    delete otpStore[`reset_${batch_no}`];

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;