import express from "express";
import bodyParser from "body-parser";
import createError from "http-errors";
import morgan from "morgan";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "node:fs/promises";
import path from "path";
import {
  loadPdfFilesDataFromFile,
  updatePdfFilesDataToFile,
  pdfFiles,
  loadImageFilesDataFromFile,
  updateImageFilesDataToFile,
  imageFiles,
} from "./data.js";

const app = express();

const UPLOADS_PDFS_DIR = "uploads/pdfs/";
const UPLOADS_IMAGES_DIR = "uploads/images/";

// Ensure directories exist
async function ensureDirectoriesExist() {
  try {
    await fs.mkdir(UPLOADS_PDFS_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_IMAGES_DIR, { recursive: true });
    console.log("Upload directories are ensured.");
  } catch (err) {
    console.error("Error ensuring directories:", err);
  }
}

ensureDirectoriesExist();

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan("dev"));

loadPdfFilesDataFromFile();
loadImageFilesDataFromFile();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf";
    const uploadPath = isPdf ? UPLOADS_PDFS_DIR : UPLOADS_IMAGES_DIR;
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

app.get("/", (req, res, next) => {
  res.status(200).send("Welcome to the CME pdf and image host server");
});

// PDF Endpoints

app.get("/pdf/fetch", (req, res, next) => {
  const allMetaData = Array.from(pdfFiles.values());
  res.json(allMetaData);
});

app.get("/pdf/fetch/:id", async (req, res, next) => {
  const { id } = req.params;
  const metadata = pdfFiles.get(id);

  if (!metadata) {
    return next(createError(404, "PDF not found"));
  }

  const filePath = metadata.filepath;

  try {
    const data = await fs.readFile(filePath);
    res.contentType("application/pdf").send(data);
  } catch (e) {
    return next(createError(500, "Internal Server Error"));
  }
});

app.post("/pdf/create", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return next(createError(400, "No file uploaded"));
  }

  const { originalname, path, size } = req.file;

  const existingFile = Array.from(pdfFiles.values()).find(
    (file) => file.filename === originalname
  );

  if (existingFile) {
    return next(createError(409, "File with the same name already exists"));
  }

  const id = uuidv4();
  const uploadDate = new Date().toISOString();
  const metadata = {
    id,
    filename: originalname,
    filepath: path,
    size,
    uploadDate,
    editDate: uploadDate,
  };

  pdfFiles.set(id, metadata);
  updatePdfFilesDataToFile();

  res.send({ success: "success", id });
});

app.patch("/pdf/edit/:id", upload.single("file"), async (req, res, next) => {
  const { id } = req.params;

  if (!pdfFiles.has(id)) {
    return next(createError(404, "PDF not found"));
  }

  const metadata = pdfFiles.get(id);
  const { filename, filepath, size } = metadata;

  // Handle new file upload
  if (req.file) {
    const { originalname, path: newFilePath, size: newSize } = req.file;

    // Check for filename conflict
    const existingFile = Array.from(pdfFiles.values()).find(
      (file) => file.filename === originalname && file.id !== id
    );

    if (existingFile) {
      return next(createError(409, "File with the same name already exists"));
    }

    // Remove old file
    try {
      await fs.unlink(filepath);
    } catch (err) {
      return next(createError(500, "Error deleting old PDF file"));
    }

    // Update metadata with new file info
    metadata.filename = originalname;
    metadata.filepath = newFilePath;
    metadata.size = newSize;
  }

  // Update metadata from request body
  const { newFilename, newUploadDate, newEditDate } = req.body;
  
  if (newFilename) metadata.filename = newFilename;
  if (newUploadDate) metadata.uploadDate = newUploadDate;
  if (newEditDate) metadata.editDate = newEditDate;

  // Always update edit date to current date if not provided
  metadata.editDate = new Date().toISOString();

  // Save changes
  pdfFiles.set(id, metadata);
  updatePdfFilesDataToFile();

  res.send({ success: "PDF updated successfully", id });
});



app.delete("/pdf/delete/:id", async (req, res, next) => {
  const { id } = req.params;

  if (!pdfFiles.has(id)) {
    return next(createError(404, "PDF not found"));
  }

  const metadata = pdfFiles.get(id);
  const filePath = metadata.filepath;

  try {
    await fs.unlink(filePath);
    pdfFiles.delete(id);
    updatePdfFilesDataToFile();

    res.send({ success: true, message: "PDF file deleted successfully" });
  } catch (err) {
    next(createError(500, "Error deleting PDF file"));
  }
});

// Image Endpoints

app.get("/image/fetch", (req, res, next) => {
  const allMetaData = Array.from(imageFiles.values());
  res.json(allMetaData);
});

app.get("/image/fetch/:id", async (req, res, next) => {
  const { id } = req.params;
  const metadata = imageFiles.get(id);

  if (!metadata) {
    return next(createError(404, "Image not found"));
  }

  const filePath = metadata.filepath;

  try {
    const data = await fs.readFile(filePath);
    res.contentType("image/jpeg").send(data); // Change the content type as needed
  } catch (e) {
    return next(createError(500, "Internal Server Error"));
  }
});

app.post("/image/create", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return next(createError(400, "No file uploaded"));
  }

  const { originalname, path } = req.file;

  const existingFile = Array.from(imageFiles.values()).find(
    (file) => file.filename === originalname
  );

  if (existingFile) {
    return next(createError(409, "File with the same name already exists"));
  }

  const id = uuidv4();
  const uploadDate = new Date().toISOString();
  const metadata = {
    id,
    filename: originalname,
    filepath: path,
    size: req.file.size,
    uploadDate,
    editDate: uploadDate,
  };

  imageFiles.set(id, metadata);
  updateImageFilesDataToFile();

  res.send({ success: "success", id });
});

app.patch("/image/edit/:id", upload.single("file"), async (req, res, next) => {
  const { id } = req.params;

  if (!imageFiles.has(id)) {
    return next(createError(404, "Image not found"));
  }

  const metadata = imageFiles.get(id);
  const { filename, filepath, size } = metadata;

  // Handle new file upload
  if (req.file) {
    const { originalname, path: newFilePath, size: newSize } = req.file;

    const existingFile = Array.from(imageFiles.values()).find(
      (file) => file.filename === originalname && file.id !== id
    );

    if (existingFile) {
      return next(createError(409, "File with the same name already exists"));
    }

    try {
      await fs.unlink(filepath);
    } catch (err) {
      return next(createError(500, "Error deleting old image file"));
    }

    metadata.filename = originalname;
    metadata.filepath = newFilePath;
    metadata.size = newSize;
  }

  // Update metadata from request body
  const { newFilename, newUploadDate } = req.body;

  if (newFilename) metadata.filename = newFilename;
  if (newUploadDate) metadata.uploadDate = newUploadDate;

  // Always update edit date to current date
  metadata.editDate = new Date().toISOString();

  // Save changes
  imageFiles.set(id, metadata);
  updateImageFilesDataToFile();

  res.send({ success: "Image updated successfully", id });
});



app.delete("/image/delete/:id", async (req, res, next) => {
  const { id } = req.params;

  if (!imageFiles.has(id)) {
    return next(createError(404, "Image not found"));
  }

  const metadata = imageFiles.get(id);
  const filePath = metadata.filepath;

  try {
    await fs.unlink(filePath);
    imageFiles.delete(id);
    updateImageFilesDataToFile();

    res.send({ success: true, message: "Image file deleted successfully" });
  } catch (err) {
    next(createError(500, "Error deleting image file"));
  }
});

app.use("*", (req, res, next) => {
  next(createError(404, "Resource Not Found"));
});

app.use((err, req, res, next) => {
  const error = {
    status: err.status || 500,
    message: err.message || "Internal Server Error",
  };

  res.status(err.status || 500).send(error);
});

app.listen(8080, () => {
  console.log("The app is running on port 8080");
});
