import { createObjectCsvWriter } from 'csv-writer';

export interface Metadata {
  filename: string;
  title: string;
  keywords: string;
  category: number;
  releases?: string;
}

export async function writeMetadataToCSV(metadataList: Metadata[], outputFilePath: string): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: outputFilePath,
    header: [
      { id: 'filename', title: 'Filename' },
      { id: 'title', title: 'Title' },
      { id: 'keywords', title: 'Keywords' },
      { id: 'category', title: 'Category' },
      { id: 'releases', title: 'Releases' },
    ],
  });

  await csvWriter.writeRecords(metadataList);
  console.log(`✅ Metadata successfully written to ${outputFilePath}`);
}