import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Function to get current date formatted as YYYYMMDD
function getCurrentFormattedDate(): string {
  const date = new Date();
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

// Converts PNG image to JPEG
export async function convertPngToJpeg({
  inputDir,
  outputDir,
}: {
  inputDir: string;
  outputDir: string;
}): Promise<void> {
  const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.png'));

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  for (const file of files) {
    const inputFilePath = path.join(inputDir, file);
    const outputFileName = file.replace(/\.png$/i, '.jpeg');
    const outputFilePath = path.join(outputDir, outputFileName);

    await sharp(inputFilePath)
      .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
      .toFile(outputFilePath);

    console.log(`✅ Converted ${file} → ${outputFileName}`);

    // Check if the new JPEG file was created
    if (!fs.existsSync(outputFilePath)) {
      throw new Error(`Failed to convert ${file}`);
    }

    // Delete the original PNG file
    fs.unlinkSync(inputFilePath);
  }
}

// Renames images in the specified folder to "IMG_OY_{date}_{counter}.ext"
export function renameImages(directoryPath: string, initials: string): string[] {
  const files = fs.readdirSync(directoryPath).filter(file => /\.(jpg|jpeg|png)$/i.test(file));

  const date = getCurrentFormattedDate();
  let counter = 1;
  const renamedFiles: string[] = [];

  for (const file of files) {
    if (file.startsWith(`IMG_${initials}_`)) {
      // Already renamed, just add to the list
      renamedFiles.push(file);
      continue;
    }
    const fileExtension = path.extname(file);
    const newFileName = `IMG_${initials}_${date}_${counter}${fileExtension}`;
    const oldFilePath = path.join(directoryPath, file);
    const newFilePath = path.join(directoryPath, newFileName);

    fs.renameSync(oldFilePath, newFilePath);
    console.log(`✅ Renamed: ${file} ➜ ${newFileName}`);

    renamedFiles.push(newFileName);
    counter++;
  }

  return renamedFiles;
}
