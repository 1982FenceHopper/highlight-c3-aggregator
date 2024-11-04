interface Dataset {
  DatasetCode: string;
  DatasetName: string;
  Topic: string;
  DatasetDescription: string;
  Contact: string;
  Email: string;
  DateUpdate: string;
  CompressionFormat: string;
  FileType: string;
  FileSize: string;
  FileRows: number;
  FileLocation: string;
}

interface Datasets {
  "-xmlns:xsi": string;
  Dataset: Dataset[];
}

interface DatasetRoot {
  Datasets: Datasets;
}

export type { Dataset, Datasets, DatasetRoot };
