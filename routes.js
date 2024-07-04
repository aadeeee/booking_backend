import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "./model/user.js";
import Booking from "./model/room.js";
import ListRoom from "./model/listroom.js";
import auth from "./jwt/verify.js";
import cron from "node-cron";
import moment from "moment-timezone";
const router = express.Router();

const getJakartaTime = (date = new Date()) => {
  return moment.tz(date, "Asia/Jakarta").toDate();
};

//AUTH

router.post("/register", [auth.checkDuplicateUsername], async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .send({ message: "Username and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 8);

    const user = new User({
      username,
      password: hashedPassword,
    });

    await user.save();

    res.send({ message: "User was registered successfully!" });
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while registering",
    });
  }
});

router.post("/register-admin", async (req, res) => {
  const { username, password, adminSecret } = req.body;

  if (!username || !password || !adminSecret) {
    return res
      .status(400)
      .send({ message: "Username, password, and admin secret are required" });
  }

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res
      .status(401)
      .send({ message: "Unauthorized: Invalid admin secret" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashedPassword,
      isAdmin: true,
    });

    await user.save();

    res.status(201).send({ message: "Admin was registered successfully!" });
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while registering admin",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.body.username,
    });

    if (!user) {
      return res.status(404).send({ message: "User Not found." });
    }

    const passwordIsValid = bcrypt.compareSync(
      req.body.password,
      user.password
    );

    if (!passwordIsValid) {
      return res.status(401).send({
        accessToken: null,
        message: "Invalid Password!",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
      },
      process.env.SECRET,
      {
        expiresIn: "24h",
      }
    );

    res.status(200).send({
      id: user._id,
      username: user.username,
      accessToken: token,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

router.post("/add-room", async (req, res) => {
  const roomsToAdd = [
    "Lapangan Olahraga",
    "Lapangan Upacara",
    "Auditorium",
    "Ruang Serbaguna A",
    "Ruang Serbaguna B",
    "Kelas TK A",
    "Kelas TK B",
    "lapangan",
  ];

  try {
    const promises = roomsToAdd.map(async (roomName) => {
      const existingRoom = await ListRoom.findOne({ namatempat: roomName });
      if (!existingRoom) {
        const newRoom = new ListRoom({ namatempat: roomName });
        await newRoom.save();
        return `${roomName} berhasil ditambahkan.`;
      }
      return `${roomName} sudah ada dalam sistem.`;
    });

    const results = await Promise.all(promises);
    res.status(200).json({ message: results });
  } catch (error) {
    console.error("Gagal menambahkan ruangan:", error);
    res.status(500).json({ message: "Gagal menambahkan ruangan." });
  }
});

// Peminjaman ruangan
router.post("/book-room", auth.verifyToken, async (req, res) => {
  const { namatempat, nama, jam_peminjaman, detail_kegiatan } = req.body;
  const userId = req.userId;

  if (!namatempat) {
    return res.status(400).json({ message: "Path 'namatempat' is required." });
  }

  try {
    const now = getJakartaTime();
    const currentDateString = now.toISOString().split("T")[0];

    const [startHour, startMinute, startSecond] = jam_peminjaman.start
      .split(":")
      .map(Number);
    const [endHour, endMinute, endSecond] = jam_peminjaman.end
      .split(":")
      .map(Number);

    const bookingStart = new Date(currentDateString);
    bookingStart.setHours(startHour, startMinute, startSecond);

    const bookingEnd = new Date(currentDateString);
    bookingEnd.setHours(endHour, endMinute, endSecond);

    if (bookingStart.getDate() !== now.getDate()) {
      return res.status(400).json({
        message: "Peminjaman hanya bisa dilakukan pada hari yang sama.",
      });
    }

    const expiredAt = new Date(bookingEnd);
    expiredAt.setMinutes(expiredAt.getMinutes() + 1);

    const existingRoom = await ListRoom.findOne({ namatempat });

    if (!existingRoom) {
      return res.status(404).json({ message: "Ruangan tidak ditemukan." });
    }

    const isRoomAvailable = await Booking.findOne({
      namatempat,
      $or: [
        {
          status: "Pending",
          $or: [
            {
              "jam_peminjaman.start": { $lt: jam_peminjaman.end },
              "jam_peminjaman.end": { $gt: jam_peminjaman.start },
            },
          ],
        },
        {
          status: "Accepted",
          "jam_peminjaman.start": { $lt: jam_peminjaman.end },
          "jam_peminjaman.end": { $gt: jam_peminjaman.start },
        },
      ],
    });

    if (isRoomAvailable) {
      return res.status(400).json({
        message: "Ruangan tidak tersedia pada waktu yang diminta.",
      });
    }

    const newBooking = new Booking({
      namatempat,
      nama,
      jam_peminjaman: { start: jam_peminjaman.start, end: jam_peminjaman.end },
      detail_kegiatan,
      userId,
      expiredAt,
      room: existingRoom._id,
    });

    await newBooking.save();

    existingRoom.status = "Pending";
    await existingRoom.save();

    res.status(201).json({
      message: "Peminjaman ruangan berhasil!",
    });
  } catch (err) {
    console.error("Error saving booking:", err);
    res.status(500).json({
      message: "Gagal melakukan peminjaman ruangan.",
    });
  }
});

// Semua peminjaman user
router.get("/my-bookings", auth.verifyToken, async (req, res) => {
  const userId = req.userId;

  try {
    const bookings = await Booking.find({
      userId,
    })
      .populate("userId", "username")
      .exec();
    res.status(200).json({
      bookings,
    });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({
      message: "Gagal mengambil daftar peminjaman.",
    });
  }
});

// peminjaman yang berstatus "Pending"
router.get(
  "/confirm-booking",
  auth.verifyToken,
  auth.isAdmin,
  async (req, res) => {
    try {
      const bookings = await Booking.find({
        status: "Pending",
      })
        .populate("userId", "username")
        .exec();

      res.status(200).json({
        bookings,
      });
    } catch (err) {
      console.error("Error fetching bookings:", err);
      res.status(500).json({
        message: "Gagal mengambil daftar peminjaman.",
      });
    }
  }
);

// Semua peminjaman (Admin)
router.get(
  "/all-confirm-booking",
  auth.verifyToken,
  auth.isAdmin,
  async (req, res) => {
    try {
      const bookings = await Booking.find({})
        .populate("userId", "username")
        .exec();

      res.status(200).json(bookings);
    } catch (err) {
      console.error("Error fetching bookings:", err);
      res.status(500).json({
        message: "Gagal mengambil daftar peminjaman.",
      });
    }
  }
);

// Ubah status peminjaman (Admin)
router.put(
  "/edit-booking/:id",
  auth.verifyToken,
  auth.isAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["Accepted", "Rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid!",
      });
    }

    try {
      const updatedBooking = await Booking.findByIdAndUpdate(
        id,
        {
          status,
        },
        {
          new: true,
        }
      );

      if (!updatedBooking) {
        return res.status(404).json({
          message: "Peminjaman tidak ditemukan.",
        });
      }

      res.status(200).json({
        message: "Status peminjaman berhasil diubah.",
        booking: updatedBooking,
      });
    } catch (err) {
      console.error("Error updating booking:", err);
      res.status(500).json({
        message: "Gagal mengubah status peminjaman.",
      });
    }
  }
);

// Daftar semua ruangan (All)

router.get("/list-rooms", async (req, res) => {
  try {
    const rooms = await ListRoom.find({}, "namatempat");

    let roomStatuses = rooms.map(async (room) => {
      const booking = await Booking.findOne({
        namatempat: room.namatempat,
        $or: [
          { status: "Pending" },
          { status: "Accepted" }
        ]
      });

      if (booking) {
        return {
          namatempat: room.namatempat,
          status: booking.status,
        };
      } else {
        return {
          namatempat: room.namatempat,
          status: "Available",
        };
      }
    });

    roomStatuses = await Promise.all(roomStatuses);

    res.status(200).json(roomStatuses);
  } catch (err) {
    console.error("Error fetching all rooms:", err);
    res.status(500).json({
      message: "Gagal mengambil daftar semua ruangan.",
    });
  }
});


// Mengubah status peminjaman yang sudah expired menjadi "Available"
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const expiredPendingAcceptedBookings = await Booking.find({
      $or: [
        { status: "Pending", expiredAt: { $lte: now } },
        { status: "Accepted", expiredAt: { $lte: now } },
        { status: "Rejected" },
      ],
    });

    await Promise.all(
      expiredPendingAcceptedBookings.map(async (booking) => {
        if (booking.status !== "Rejected") {
          booking.status = "Available";
        }
        await booking.save();
      })
    );

    console.log(
      "Expired bookings processed:",
      expiredPendingAcceptedBookings.length
    );
  } catch (err) {
    console.error("Error processing expired bookings:", err);
  }
});
export default router;