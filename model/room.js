import mongoose from "mongoose";

const timeFormatValidator = (value) => {
  return /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(value);
};
const bookingSchema = new mongoose.Schema(
  {
    namatempat: { type: String, required: true, index: true },
    nama: { type: String, required: true },
    jam_peminjaman: {
      start: {
        type: String,
        required: true,
        validate: [timeFormatValidator, 'Invalid start time format (HH:mm:ss)']
      },
      end: {
        type: String,
        required: true,
        validate: [timeFormatValidator, 'Invalid end time format (HH:mm:ss)']
      }
    },
    detail_kegiatan: { type: String },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["Accepted", "Rejected", "Pending", 'Avaliable'],
      default: "Pending",
    },
    expiredAt: { type: Date },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ListRoom",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);


const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
