const fs = require("fs");
const pup = require("puppeteer");
const { join } = require("path");
const { parse } = require("csv-parse");
const { write } = require("@fast-csv/format");

async function loadPQueue() {
  const { default: PQueue } = await import("p-queue");
  return PQueue;
}

async function writeNotFound(data, headers) {
  const path = join(__dirname, "..", "model", "not_found.csv");
  await new Promise((resolve, reject) => {
    write(data, { headers: headers })
      .pipe(fs.createWriteStream(path, { flags: "a" }))
      .on("finish", () => {
        resolve();
      })
      .on("error", (error) => {
        console.log(error);
        resolve(error);
      });
  });
  fs.appendFileSync(path, "\n");
}

async function writeToFile(data, headers) {
  const path = join(__dirname, "..", "model", "Rotten_Tomato_Info.csv");
  await new Promise((resolve, reject) => {
    write(data, { headers: headers })
      .pipe(fs.createWriteStream(path, { flags: "a" }))
      .on("finish", () => {
        resolve();
      })
      .on("error", (error) => {
        console.log(error);
        resolve(error);
      });
  });
  fs.appendFileSync(path, "\n");
}

async function writeError(data, dir, headers) {
  await new Promise((resolve, reject) => {
    write(data, { headers: headers })
      .pipe(fs.createWriteStream(dir, { flags: "a" }))
      .on("finish", () => {
        resolve();
      })
      .on("error", (error) => {
        console.log(error);
        resolve(error);
      });
  });
  fs.appendFileSync(dir, "\n");
}

async function scrapeAll(
  filename,
  errordir = join(__dirname, "..", "model", "error0.csv"),
  batchsize = 100
) {
  try {
    let errorHeader = true,
      infoHeader = true,
      notFoundHeader = true;
    let redo = false;
    const browser = await pup.launch({
      headless: true,
    });
    const PQueue = await loadPQueue();
    const queue = new PQueue({ concurrency: 10 });
    const writeQueue = new PQueue({ concurrency: 1 });
    const wq = [];

    fs.createReadStream(filename)
      .pipe(parse({ columns: true }))
      .on("data", async (row) => {
        queue.add(async () => {
          const page = await browser.newPage();
          page.setDefaultNavigationTimeout(60000);
          try {
            await page.goto("https://www.rottentomatoes.com");
            await page.setViewport({ width: 1280, height: 720 });
            const info = await scrape(page, row["title"], row["id"]);
            if (!info) {
              console.log(`${row["title"]} is not found`);
              await writeNotFound(
                [{ title: row["title"], id: row["id"] }],
                notFoundHeader
              );
              notFoundHeader = false;
              return;
            }
            writeQueue.add(async () => {
              wq.push(info);
              if (wq.length >= batchsize) {
                count += 100;
                console.log("writing to file..." + count);
                await writeToFile(wq, infoHeader);
                infoHeader = false;
                wq.length = 0;
              }
            });
          } catch (error) {
            redo = true;
            console.log(`Error scraping ${row["title"]} ${error}`);
            await writeError(
              [{ title: row["title"], id: row["id"] }],
              errordir,
              errorHeader
            );
            errorHeader = false;
          } finally {
            await page.close();
          }
        });
      })
      .on("error", (error) => {
        console.error("Error reading csv file", error);
      })
      .on("end", () => {
        console.log("Finished Reading " + filename);
      });
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await queue.onIdle();
    await writeQueue.onIdle();
    writeQueue.add(async () => {
      count += wq.length;
      console.log("writing to file..." + count);
      await writeToFile(wq);
    });
    console.log("Finished writing " + filename);
    await browser.close();
    return redo;
  } catch (error) {
    console.error("Error scraping at the highest level", error);
  }
}

async function movieInfo(page, query) {
  return await page.evaluate((query) => {
    const list = document.querySelectorAll(
      'search-page-result[type="movie"] search-page-media-row[data-qa="data-row"]'
    );
    if (!list) return null;
    for (const el of list) {
      const movieDate = el.releaseyear;
      const movieName = el.querySelector('a[data-qa="info-name"]').innerText;
      const movieLink = el.querySelector('a[data-qa="thumbnail-link"]').href;
      if (
        (movieName.trim() + " (" + movieDate.trim() + ")").toLowerCase() ===
        query.trim().toLowerCase()
      ) {
        return movieLink;
      }
    }
    return null;
  }, query);
}

async function scrape(page, query, id) {
  const inputElement = await page.$('input[aria-label="Search"]');
  await inputElement.type(query.slice(0, -6));
  await inputElement.press("Enter");
  await page.waitForNavigation();
  const movieLink = await movieInfo(page, query);
  if (!movieLink) {
    return null;
  }
  await page.goto(movieLink);
  const tomatometer = await page.evaluate(() => {
    try {
      let shadowRoot = document.querySelector("#scoreboard").shadowRoot;
      const customElement = shadowRoot.querySelector(
        'score-icon-critic-deprecated[data-qa="score-icon-critic-deprecated"]'
      );
      return parseInt(customElement.percentage, 10);
    } catch (e) {
      return null;
    }
  });
  const audienceScore = await page.evaluate(() => {
    try {
      let shadowRoot = document.querySelector("#scoreboard").shadowRoot;
      const customElement = shadowRoot.querySelector(
        'div[data-qa="audience-score-container"] score-icon-audience-deprecated[data-qa="score-icon-audience-deprecated"]'
      );
      return parseInt(customElement.percentage, 10);
    } catch (e) {
      return null;
    }
  });

  const otherInfo = await page.evaluate(() => {
    const keys = Array.from(
      document.querySelectorAll('b[data-qa="movie-info-item-label"]')
    ).map((el) => el.innerText.slice(0, -1));
    const values = Array.from(
      document.querySelectorAll('span[data-qa="movie-info-item-value"]')
    ).map((el) => el.innerText);
    const map = keys.reduce((obj, key, index) => {
      obj[key] = values[index];
      return obj;
    }, {});
    return map;
  });
  return {
    title: query,
    id: id,
    Tomatometer: tomatometer,
    "Audience Score": audienceScore,
    ...otherInfo,
  };
}

async function main() {
  const maxRedo = 5;
  let redoCount = 0;

  let redo = await scrapeAll(join(__dirname, "..", "model", "title+id.csv"));

  while (redo && redoCount < maxRedo) {
    redo = await scrapeAll(
      join(__dirname, "..", "model", `error${redoCount}.csv`),
      join(__dirname, "..", "model", `error${redoCount + 1}.csv`)
    );
    redoCount++;
  }
  process.exit(0);
}

var count = 0;
main();
