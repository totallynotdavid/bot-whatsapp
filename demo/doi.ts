// this demo fullfills: doi, paper in one file download from annas-archive.org + libgen.li

import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface SearchItem {
  id: string;
  title: string;
  author: string;
  fileType: string;
  fileSize: string;
}

async function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetchPage(res.headers.location!).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

async function searchAnnasArchive(query: string): Promise<SearchItem[]> {
  const html = await fetchPage(
    `https://annas-archive.org/search?q=${encodeURIComponent(query)}&ext=epub`,
  );
  const $ = cheerio.load(html);
  const results: SearchItem[] = [];

  $(".js-aarecord-list-outer > div > div").each((_, element) => {
    const $book = $(element);
    const details = $book.find("div:nth-child(3)").text().split(" · ");
    if (details.length < 3) return;

    const titleEl = $book.find("div a").eq(0);
    const href = titleEl.attr("href") || "";
    const id = href.split("/").pop() || "";

    results.push({
      id,
      title: titleEl.text(),
      author: $book.find("div a").eq(1).text(),
      fileType: details[1],
      fileSize: details[2],
    });
  });

  return results;
}

async function downloadFile(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;

    const request = client.get(
      url,
      { headers: { "User-Agent": USER_AGENT } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          downloadFile(res.headers.location!, outputPath).then(resolve);
          return;
        }

        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }

        const file = fs.createWriteStream(outputPath);
        res.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve(true);
        });

        file.on("error", () => {
          fs.unlinkSync(outputPath);
          resolve(false);
        });
      },
    );

    request.on("error", () => resolve(false));
  });
}

async function main() {
  const query = process.argv.slice(2).join(" ");
  console.log(`Searching: ${query}`);

  const results = await searchAnnasArchive(query);
  if (!results.length) {
    console.log("No results");
    return;
  }

  const book = results[0];
  console.log(`Found: ${book.title} by ${book.author}`);

  // Try to get IPFS CID from LibGen API
  try {
    const json = await fetchPage(
      `http://libgen.li/json.php?object=f&md5=${book.id}&fields=*&addkeys=877`,
    );
    const data = JSON.parse(json);

    for (const fileId in data) {
      if (data[fileId].add) {
        for (const addKey in data[fileId].add) {
          const item = data[fileId].add[addKey];
          if (item.key === "877" && item.value) {
            const ipfsCid = item.value;
            console.log("Trying IPFS...");
            const success = await downloadFile(
              `https://gateway.ipfs.io/ipfs/${ipfsCid}?filename=${book.id}.epub`,
              `${book.id}.epub`,
            );
            if (success) {
              console.log(`Downloaded: ${book.id}.epub`);
              return;
            }
          }
        }
      }
    }
  } catch {}

  // Fallback to LibGen
  console.log("Trying LibGen...");
  const html = await fetchPage(`http://libgen.li/ads.php?md5=${book.id}`);
  const $ = cheerio.load(html);
  const getLink = $('a:has(h2:contains("GET"))').attr("href");

  if (getLink) {
    const success = await downloadFile(
      `http://libgen.li/${getLink}`,
      `${book.id}.epub`,
    );
    console.log(success ? `Downloaded: ${book.id}.epub` : "Failed");
  }
}

main().catch(console.error);
