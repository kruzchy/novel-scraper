const axios = require('axios');
const cheerio = require('cheerio');
const htmlToText = require('html-to-text');
const { prompt } = require('enquirer');
const fs = require('fs');
const url = require('url');

const wordExcerptScraper = require('./scrapers/wordexcerpt')
const novelTrenchScraper = require('./scrapers/noveltrench')
const novelFullScraper = require('./scrapers/novelfull')
const readNovelFullScraper = require('./scrapers/readnovelfull')
const wuxiaWorldComScraper = require('./scrapers/wuxiaworld.com')
const readLightNovelOrgScraper = require('./scrapers/readlightnovel.org')
const webNovelOnlineScraper = require('./scrapers/webnovelonline')
//POST REQUEST CORS FOR PAGINATION
const readLightNovelsNetScraper = require('./scrapers/future/readlightnovels.net')
//CLOUDFARE. SCRAPING IS HARD
const wuxiaWorldSiteScraper = require('./scrapers/future/wuxiaworld.site')
//Rate limited only 15 requests per minute
const lightNovelWorldScraper = require('./scrapers/future/lightnovelworld')

try {
    fs.accessSync('./data', fs.constants.F_OK)
} catch (e) {
    fs.mkdirSync('./data')
}

class App {
    constructor(novelUrl) {
        this.scraper = null;
        this.novelUrl = novelUrl;
        this.scrapers = {
            'wordexcerpt.com': wordExcerptScraper,
            'noveltrench.com': novelTrenchScraper,
            'wuxiaworld.com': wuxiaWorldComScraper,
            'readlightnovel.org': readLightNovelOrgScraper,
            'webnovelonline.com': webNovelOnlineScraper,
            'novelfull.com': novelFullScraper,
            'readnovelfull.com': readNovelFullScraper,

            'wuxiaworld.site': wuxiaWorldSiteScraper,
            'readlightnovels.net': readLightNovelsNetScraper,
            'lightnovelworld.com': lightNovelWorldScraper,

        }
        this.initScraper()
    }

    initScraper() {
        for (let scraperKey of Object.keys(this.scrapers)) {
            if (url.parse(this.novelUrl).hostname === scraperKey) {
                this.scraper = new this.scrapers[scraperKey](this.novelUrl)
                break
            }
        }
    }

}



const start = async () => {
    const response = await prompt({
        type: 'input',
        name: 'novelUrl',
        message: 'Enter Novel URL'
    });
    const app = new App(response.novelUrl)
    await app.scraper.init();
    await app.scraper.fetchChapters();
    console.log('>>>Download complete!')
};
start();
