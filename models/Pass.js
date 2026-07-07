const mongoose = require("mongoose");
const passSchema = new mongoose.Schema({
  passName: { type: String, required: true },
  concession: { type: Number, default: 0 },
  description: { type: String }
}, { collection: "passes" });
const Pass = mongoose.model("Pass", passSchema);
module.exports = Pass;