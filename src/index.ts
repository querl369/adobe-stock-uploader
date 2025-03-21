import fs from 'fs';
import path from 'path';
import cloudinary from './cloudinary';

async function uploadImage(filePath: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'adobe_stock', // Optional: organizes your files in Cloudinary
    });
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

// Run example
(async () => {
  const imagePath = path.resolve(__dirname, '../images/8w0eo0y7axu91.jpg');

  const url = await uploadImage(imagePath);
  console.log('Image uploaded successfully:', url);
})();