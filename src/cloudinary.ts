import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(filePath: string): Promise<{ url: string; publicId: string }> {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'adobe_stock', // Optional: organizes your files in Cloudinary
        });
        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        throw error;
    }
}

export async function deleteImage(publicId: string): Promise<void> {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result === 'not found') {
            console.warn(`⚠️ Image with public_id '${publicId}' not found.`);
        } else {
            console.log(`🗑️ Image with public_id '${publicId}' deleted successfully.`);
        }
    } catch (error) {
        console.error(`❌ Error deleting image with public_id '${publicId}':`, error);
    }
}