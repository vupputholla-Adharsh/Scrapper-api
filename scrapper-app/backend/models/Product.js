const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  rating: String,
  image: String,
  productUrl: String,
  sourceUrl: String,
}, {
  timestamps: true,
});

productSchema.index({ productUrl: 1 }, { unique: true });

module.exports = mongoose.model("Product", productSchema);
