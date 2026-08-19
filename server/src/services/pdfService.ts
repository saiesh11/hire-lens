import { PDFParse } from "pdf-parse";

export class PdfParseError extends Error {}

export async function extractResumeText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    if (!text) {
      throw new PdfParseError("No extractable text found in the PDF");
    }
    return text;
  } catch (error) {
    if (error instanceof PdfParseError) throw error;
    throw new PdfParseError("Could not parse the uploaded PDF");
  } finally {
    await parser.destroy();
  }
}
