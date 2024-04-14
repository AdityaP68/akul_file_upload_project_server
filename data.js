import fs from "node:fs/promises";

const DATA_FILE_PATH = "pdfFilesData.json";

let pdfFiles = new Map();

export async function savedPdfFilesDataToFile() {
  const data = JSON.stringify(Array.from(pdfFiles.entries()));
  await fs.writeFile(DATA_FILE_PATH, data);
}

export async function loadPdfFilesDataFromFile() {
  try {
    const data = await fs.readFile(DATA_FILE_PATH, "utf-8");
    if (data.trim() === "") {
      console.error("Nothing to load...");
      return;
    }
    const entries = JSON.parse(data);
    pdfFiles = new Map(entries);
  } catch (err) {
    console.error("Error loading pdfFiles data from file:", err);
    pdfFiles = new Map();
  }
}

export function updatePdfFilesDataToFile() {
  savedPdfFilesDataToFile()
    .then(() => console.log("PDF files data updated successfully"))
    .catch((err) => console.error("Error updating PDF files data:", err));
}

export { pdfFiles };
