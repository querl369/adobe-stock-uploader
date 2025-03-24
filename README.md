# Adobe Stock Image Uploader

This script is designed to analize images in a specified directory, rename them, convert PNG images to JPEG, generate metadata for each image using OpenAI, and add metadata to a CSV file.

## Prerequisites

- Node.js
- Cloudinary account
- OpenAI API key

## Setup

1. Clone the repository:
```git clone https://github.com/oleksii-yemets/adobe-stock-uploader.git```

2. Set up environment variables:
```cp .env.example .env```

3. Add your Cloudinary credentials and OpenAI API key to the `.env` file.

4. Install dependencies:
```npm i```

5. Create an `images` and `csv_output` directories in the root of the project.

6. Change prompt text in `src/prompt-text.ts`.

7. Run the script:
```npm run start```

## Working with Real-ESRGAN to upscale images

1. To successfully run Real-ESRGAN, you need to have:

- A compatible version of Python (3.7 or higher)
- A compatible version of CUDA (10.1 or higher)
- A compatible version of PyTorch (1.7 or higher)

2. By testing Real-ESRGAN, I found out that versions for PyTorch that are compatible with Real-ESRGAN itself:
- torch==2.0.1 torchvision==0.15.2
```pip install torch==2.0.1 torchvision==0.15.2 --extra-index-url https://download.pytorch.org/whl/cu118```
- numpy==1.26.4
```pip install numpy==1.26.4```

## Usage

The script will process all images in the `images` directory and generate a CSV file with metadata for each image.
