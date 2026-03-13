const mongoose = require("mongoose");

const passSchema = new mongoose.Schema({
  passName: { type: String, required: true },
  concession: { type: String, required: true },
  description: { type: String }
}, { collection: "Pass" }); // <-- explicitly set collection name

const Pass = mongoose.model("Pass", passSchema);

module.exports = Pass;
