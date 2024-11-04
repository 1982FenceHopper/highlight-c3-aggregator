import express from "express";
import { existsSync, writeFile, readFileSync, rm } from "fs";
import { resolve, basename } from "path";
import readline from "readline";
import { stdin, stdout } from "process";
import decompress from "decompress";

import type { Dataset, Datasets, DatasetRoot } from "./interfaces/dataset";

const app = express();
app.use(express.json());

const PORT = 2130;
const DATASET_PATH = resolve(__dirname, "../upd_data/dataset.json");
const TEMP_PATH = resolve(__dirname, "../temp");

const reader = readline.createInterface(stdin, stdout);

//* Basic Server Logic

function commandHandler() {
  console.log("\x1b[47mCommands: 'u': Update, 'q': Quit\x1b[0m");
  reader.question("Enter Command: ", async (cmd) => {
    switch (cmd.toLowerCase()) {
      case "u":
        await updateList();
        break;
      case "q":
        console.log("\x1b[37m[INFO/AGGREGATOR]: Exiting...\x1b[0m");
        reader.close();
        process.exit(0);
      default:
        console.log("\x1b[31m[ERROR/AGGREGATOR]: Invalid Command!\x1b[0m");
    }
    commandHandler();
  });
}

async function updateList() {
  console.log("\n\x1b[34m[INFO/AGGREGATOR]: Checking dataset list...\x1b[0m");

  const datalist: DatasetRoot = await fetch(
    "https://bulks-faostat.fao.org/production/datasets_E.json"
  ).then((res) => res.json());

  if (!existsSync(DATASET_PATH)) {
    await Bun.write(Bun.file(DATASET_PATH), JSON.stringify(datalist, null, 2));
  } else {
    const file = readFileSync(DATASET_PATH, "utf-8");

    if (file === JSON.stringify(datalist, null, 2)) {
      console.log(
        `\n\x1b[32m[INFO/AGGREGATOR]: Dataset list is up to date as of ${new Date().toISOString()} of checking\x1b[0m`
      );
    } else {
      writeFile(DATASET_PATH, JSON.stringify(datalist, null, 2), (err) => {
        if (err) {
          console.error(err);
        } else {
          console.log(
            `\n\x1b[32m[INFO/AGGREGATOR]: Dataset list was updated as of ${new Date().toISOString()} of checking, wrote to ${DATASET_PATH}\x1b[0m`
          );
        }
      });
    }
  }
}

//* API Endpoints

app.get("/", async (req, res) => {
  const datalist: DatasetRoot = JSON.parse(readFileSync(DATASET_PATH, "utf-8"));

  res.send(datalist);
  console.log("\n");
  commandHandler();
});

app.get("/dataset/:code", async (req, res) => {
  console.log(
    `\n\x1b[32m[INFO/AGGREGATOR]: Requested Dataset ${req.params.code} from ${req.ip}\x1b[0m`
  );
  const dataset_code: string = req.params.code;

  const data = readFileSync(DATASET_PATH, "utf-8");
  const datalist: DatasetRoot = JSON.parse(data);

  const spec_ds = datalist.Datasets.Dataset.find(
    (d: any) => d.DatasetCode === dataset_code
  );

  if (!spec_ds) {
    console.log(
      `\n\x1b[31m[ERROR/AGGREGATOR]: Failed to find dataset ${dataset_code}\x1b[0m for request from ${req.ip}`
    );
    res.status(404).send({
      error: {
        code: 404,
        message: "Dataset not found",
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  await fetch(spec_ds.FileLocation)
    .then((res) => res.arrayBuffer())
    .then(async (data) => {
      const buff = new Uint8Array(data);

      await Bun.write(Bun.file(`${TEMP_PATH}/${dataset_code}.zip`), buff);

      decompress(
        `${TEMP_PATH}/${dataset_code}.zip`,
        `${TEMP_PATH}/${dataset_code}/`,
        { filter: (f) => f.path.endsWith("All_Data_(Normalized).csv") }
      ).then(async (files) => {
        const preferred = files.find((f) =>
          f.path.endsWith("All_Data_(Normalized).csv")
        );

        if (!preferred) {
          console.log(
            `\n\x1b[31m[ERROR/AGGREGATOR]: Failed to find main CSV file for ${dataset_code}, requested from ${req.ip}\x1b[0m`
          );
          res.status(404).send({
            error: {
              code: 404,
              message: "Dataset CSV was not found",
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          console.log("PATH: ", preferred.path);
          res.sendFile(
            `${TEMP_PATH}/${dataset_code}/${preferred.path}`,
            (err) => {
              if (err) {
                console.log(err);
              } else {
                rm(`${TEMP_PATH}/${dataset_code}.zip`, (err) => {
                  if (err) {
                    console.log(err);
                  }
                });
              }
            }
          );
        }
      });
    });

  console.log(
    `\n\x1b[32m[INFO/AGGREGATOR]: Specified Dataset ${dataset_code} sent to ${req.ip}\x1b[0m`
  );
  console.log("\n");
  commandHandler();
});

app.listen(PORT, async () => {
  console.log(
    `\n\x1b[37m[INFO/AGGREGATOR]: Aggregation Server Listening on http://localhost:${PORT}\x1b[0m`
  );
  commandHandler();
});
