import { writeFile } from "node:fs/promises";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const QURAN_API = "https://api.alquran.cloud/v1/quran/quran-uthmani";
const TAFSIR_API = "https://api.alquran.cloud/v1/quran/ar.jalalayn";

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  return response.json();
}

function toPageMap(surahs, mapper) {
  const pages = {};

  for (const surah of surahs) {
    for (const ayah of surah.ayahs) {
      const page = String(ayah.page);
      if (!pages[page]) pages[page] = [];
      pages[page].push(mapper(surah, ayah));
    }
  }

  return pages;
}

const [quranResponse, tafsirResponse] = await Promise.all([
  getJson(QURAN_API),
  getJson(TAFSIR_API),
]);

const quranSurahs = quranResponse.data.surahs;
const tafsirSurahs = tafsirResponse.data.surahs;

const pages = toPageMap(quranSurahs, (surah, ayah) => ({
  number: ayah.number,
  text: ayah.text,
  numberInSurah: ayah.numberInSurah,
  juz: ayah.juz,
  page: ayah.page,
  surah: {
    number: surah.number,
    name: surah.name,
    englishName: surah.englishName,
    numberOfAyahs: surah.numberOfAyahs || surah.ayahs.length,
  },
}));

const tafsirPages = toPageMap(tafsirSurahs, (surah, ayah) => ({
  number: ayah.number,
  text: ayah.text,
  numberInSurah: ayah.numberInSurah,
  page: ayah.page,
  surahNumber: surah.number,
}));

const firstPageBySurah = {};
const firstPageByJuz = {};

for (const pageAyahs of Object.values(pages)) {
  for (const ayah of pageAyahs) {
    if (!firstPageBySurah[ayah.surah.number]) {
      firstPageBySurah[ayah.surah.number] = ayah.page;
    }
    if (!firstPageByJuz[ayah.juz]) {
      firstPageByJuz[ayah.juz] = ayah.page;
    }
  }
}

const offlineData = {
  generatedAt: new Date().toISOString(),
  source: {
    quran: QURAN_API,
    tafsir: TAFSIR_API,
  },
  surahs: quranSurahs.map((surah) => ({
    number: surah.number,
    name: surah.name,
    englishName: surah.englishName,
    englishNameTranslation: surah.englishNameTranslation,
    numberOfAyahs: surah.numberOfAyahs || surah.ayahs.length,
    revelationType: surah.revelationType,
  })),
  firstPageBySurah,
  firstPageByJuz,
  pages,
  tafsirPages,
};

const fileContent = `window.OFFLINE_QURAN_DATA = ${JSON.stringify(offlineData)};\n`;
await writeFile("offline-quran-data.js", fileContent, "utf8");

console.log(`Wrote offline-quran-data.js with ${offlineData.surahs.length} surahs and ${Object.keys(pages).length} pages.`);
