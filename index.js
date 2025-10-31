const axios = require("axios");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

// === Buat folder logs otomatis
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logFile = path.join(logDir, "bot.log");

// === Fungsi log
function logCommand(type, from, message) {
  const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const line = `[${time}] [${type}] ${from} → ${message}\n`;
  fs.appendFileSync(logFile, line, "utf8");
}

// === Inisialisasi client
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./session" }),
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/chromium", // FIX langsung untuk Railway
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
    ],
  },
});

// === Logging lifecycle
logCommand("SYSTEM", "-", "Inisialisasi bot WhatsApp dimulai...");
console.log("🚀 Menyiapkan bot WhatsApp, mohon tunggu...");

client.on("qr", (qr) => {
  logCommand("SYSTEM", "-", "QR code baru dihasilkan, tunggu scan user...");
  console.log("📱 Scan QR Code berikut untuk login WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Bot WhatsApp siap digunakan!");
  logCommand("SYSTEM", "-", "Bot WhatsApp berhasil dijalankan ✅");
});

client.on("disconnected", (reason) => {
  logCommand("SYSTEM", "-", `Bot terputus: ${reason}`);
  console.log("⚠️ Bot terputus, coba restart Railway container...");
});

const sessions = {};

// === Event message utama
client.on("message", async (msg) => {
  const from = msg.from;
  const text = msg.body.trim();
  const lower = text.toLowerCase();

  logCommand("INBOX", from, `Pesan diterima: ${text}`);

  // 🔹 Deteksi apakah ini perintah penting
  const isCommand =
    lower.startsWith("list bot") ||
    lower.startsWith("print nota") ||
    lower.startsWith("barang") ||
    lower === "tidak" ||
    lower === "1" ||
    lower === "2" ||
    (lower.includes("nama") &&
      lower.includes("alamat") &&
      lower.includes("telepon"));

  if (isCommand) logCommand("USER", from, text);

  // === Perintah LIST BOT ===
  if (lower === "list bot") {
    logCommand("BOT", from, "Menampilkan menu utama bot");
    await msg.reply(
      "🤖 *Selamat datang di Mustari Tani Bot!*\n\n" +
        "Pilih menu berikut ini yaa:\n\n" +
        "🍀 *1.* Print nota yang sudah ada\n" +
        "🧾 *2.* Buat nota baru (isi data pelanggan)\n\n" +
        "Ketik *1* atau *2* aja, aku siap bantu 🌾"
    );
    sessions[from] = { step: "menu" };
    return;
  }

  // === Perintah PRINT NOTA LANGSUNG ===
  if (lower.startsWith("print nota")) {
    const regex = /print nota\s*:\s*(.+)/i;
    const match = text.match(regex);
    if (!match) {
      logCommand("BOT", from, "Format print nota salah");
      await msg.reply(
        "⚠️ Format salah, contoh yang benar:\n`print nota : 45/kak fitriadi`"
      );
      return;
    }

    const input = match[1];
    const [nota_no] = input.split("/").map((s) => s.trim());

    logCommand("BOT", from, `Memproses print nota langsung (${nota_no})`);
    await msg.reply("🖨️ Sedang menyiapkan nota kamu, tunggu sebentar ya...");

    try {
      const notaRes = await axios.post(
        "https://app.invyti.com/api/generate-nota",
        { nota_no }
      );
      const base64 = notaRes.data.base64;
      const media = new MessageMedia("image/png", base64, "nota.png");
      await client.sendMessage(from, media, {
        caption: "🧾 Ini dia nota kamu!",
      });
      logCommand("BOT", from, `Nota berhasil dikirim (nota_no: ${nota_no})`);
    } catch (err) {
      logCommand("ERROR", from, `Gagal print nota: ${err.message}`);
      await msg.reply(
        "❌ Nota tidak ditemukan atau server lagi sibuk. Coba lagi nanti ya 🙏"
      );
    }
    return;
  }

  // === Jika sedang di menu list ===
  if (sessions[from]?.step === "menu") {
    if (lower === "1" || lower.includes("print")) {
      logCommand("BOT", from, "User memilih menu print nota");
      await msg.reply(
        "🖨️ Oke siap!\nLangsung aja ketik:\n\n`print nota : [nomor nota]/[nama]`\n\n" +
          "Contoh: `print nota : 45/kak fitriadi` 🧾"
      );
      delete sessions[from];
      return;
    }

    if (lower === "2" || lower.includes("buat")) {
      logCommand("BOT", from, "User memilih menu buat nota");
      await msg.reply(
        "📋 Yuk buat nota baru!\nKirim data pelanggan dengan format berikut:\n\n" +
          "Nama : [nama lengkap]\nAlamat : [alamat lengkap]\nTelepon : [nomor telepon]\n\n" +
          "Contoh:\nNama : Budi Setiawan\nAlamat : Bandung Barat\nTelepon : 08123456789"
      );
      delete sessions[from];
      return;
    }
  }

  // === Data pelanggan langsung ===
  if (
    lower.includes("nama") &&
    lower.includes("alamat") &&
    lower.includes("telepon")
  ) {
    logCommand("BOT", from, "Data pelanggan diterima dan disimpan sementara");

    sessions[from] = {
      step: "barang",
      data: {
        nama: text.match(/nama\s*:\s*(.+)/i)?.[1]?.trim() || "-",
        alamat: text.match(/alamat\s*:\s*(.+)/i)?.[1]?.trim() || "-",
        telepon: text.match(/telepon\s*:\s*(.+)/i)?.[1]?.trim() || "-",
        barang: [],
      },
    };

    await msg.reply(
      "✅ Data pelanggan disimpan!\nSekarang kirim data barang pertama dengan format:\n\n" +
        "Barang1\nNama : [nama barang]\nQty : [jumlah]\nHarga : [harga]\n\n" +
        "Contoh:\nBarang1\nNama : Bibit Durian\nQty : 2\nHarga : 500000"
    );
    return;
  }

  // === Input barang ===
  if (lower.startsWith("barang")) {
    const session = sessions[from];
    if (!session || session.step !== "barang") {
      logCommand("BOT", from, "User kirim barang tanpa data pelanggan");
      await msg.reply(
        "⚠️ Kirim dulu data pelanggan (nama, alamat, telepon) ya!"
      );
      return;
    }

    const lines = text.split("\n");
    const barang = {};
    lines.forEach((line) => {
      const [key, value] = line.split(":").map((s) => s.trim());
      if (key && value) barang[key.toLowerCase()] = value;
    });

    session.data.barang.push(barang);
    logCommand("BOT", from, `Barang ditambahkan (${JSON.stringify(barang)})`);

    await msg.reply(
      "🛒 Barang disimpan!\nKetik *Barang2* jika mau tambah barang lagi, atau ketik *tidak* jika sudah selesai belanja 🍃"
    );
    return;
  }

  // === User ketik “tidak” ===
  if (lower === "tidak") {
    const session = sessions[from];
    if (!session) {
      logCommand("BOT", from, "User ketik 'tidak' tanpa sesi aktif");
      await msg.reply(
        "⚠️ Belum ada data transaksi. Mulai dari awal ya (ketik *list bot*) 🌾"
      );
      return;
    }

    await msg.reply("💾 Menyimpan data ke server... tunggu sebentar ya ☕");
    logCommand("BOT", from, "User menyelesaikan nota dan dikirim ke server");

    try {
      const response = await axios.post(
        "https://app.invyti.com/api/save-transaksi",
        session.data
      );
      const nota_no = response.data.nota_no;

      await msg.reply(
        "✅ Transaksi tersimpan! Lagi nyiapin nota digital kamu 🧾✨"
      );

      const notaRes = await axios.post(
        "https://app.invyti.com/api/generate-nota",
        { nota_no }
      );
      const base64 = notaRes.data.base64;
      const media = new MessageMedia("image/png", base64, "nota.png");
      await client.sendMessage(from, media, {
        caption: "🧾 Nih nota kamu, makasih udah belanja di Mustari Tani 🍀",
      });

      logCommand("BOT", from, `Nota baru dikirim (nota_no: ${nota_no})`);
      delete sessions[from];
    } catch (err) {
      logCommand("ERROR", from, `Gagal simpan data: ${err.message}`);
      await msg.reply(
        "❌ Ada kendala saat menyimpan data, coba lagi nanti ya 😅"
      );
    }
    return;
  }

  // Kalau pesan bukan perintah → diabaikan
  logCommand("INFO", from, "Pesan tidak dikenali, diabaikan");
});

client.initialize();
