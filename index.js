import express from "express";
import bodyParser from "body-parser";
import createError from "http-errors";
import morgan from "morgan";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "node:fs/promises";
import {
  loadPdfFilesDataFromFile,
  updatePdfFilesDataToFile,
  pdfFiles,
} from "./data.js";

const app = express();

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan("dev"));

loadPdfFilesDataFromFile();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

/**
 * This is the main route handler for the root URL ("/") of the server.
 * It sends a welcome message to the client.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.get("/", (req, res, next) => {
  // Set the status code to 200 and send a welcome message to the client
  res.status(200).send("Welcome to the CME pdf host server");
});

/**
 * Fetches a PDF file.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.get("/pdf/fetch", (req, res, next) => {
  const allMetaData = Array.from(pdfFiles.values());
  res.json(allMetaData);
});

app.get("/pdf/fetch/:id", async (req, res, next) => {
  const { id } = req.params;

  console.log(pdfFiles);

  const metadata = pdfFiles.get(id);

  if (!metadata) {
    return next(createError(404, "PDF not found"));
  }

  const filePath = metadata.filepath;

  try {
    const data = await fs.readFile(filePath);
    res.contentType("application/pdf").send(data);
  } catch (e) {
    console.log(e);
    return next(createError(500, "Internal Server Error"));
  }
});

/**
 * POST endpoint for creating a PDF file.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {String} - A success message.
 */
app.post("/pdf/create", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return next(createError(400, "No file Uploaded"));
  }

  const { originalname, path } = req.file;

  const existingFile = Array.from(pdfFiles.values()).find(
    (file) => file.filename === originalname
  );

  if (existingFile) {
    return next(createError(409, "File with the same name already exists"));
  }

  const id = uuidv4();
  const metadata = { id, filename: originalname, filepath: path };

  pdfFiles.set(id, metadata);
  updatePdfFilesDataToFile();

  console.log(pdfFiles);

  res.send({ success: "success", id });
});

/**
 * PATCH route to edit a PDF document.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
app.patch("/pdf/edit/:id", (req, res, next) => {
  // Your code here
});

app.delete("/pdf/delete/:id", async (req, res, next) => {
  const { id } = req.params;

  // Check if the PDF file with the provided ID exists
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
    console.error("Error deleting file:", err);
    next(createError(500, "Error deleting PDF file"));
  }
});

// Middleware to handle 404 errors
app.use("*", (req, res, next) => {
  next(createError(404, "Resource Not Found"));
});

/**
 * Middleware function to handle errors in the Express app.
 * @param {Error} err - The error object.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.use((err, req, res, next) => {
  /**
   * Create an error object with status and message properties.
   * If the error object does not have a status property, default to 500.
   * If the error object does not have a message property, default to "Internal Server Error".
   */
  const error = {
    status: err.status || 500,
    message: err.message || "Internal Server Error",
  };

  // Set the response status code to the error status or default to 500.
  res.status(err.status || 500).send(error);
});

app.listen(8080, () => {
  console.log("The app is running on port 8080");
});
