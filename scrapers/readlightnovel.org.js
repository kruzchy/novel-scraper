const cheerio = require('cheerio');
const axios = require('axios')
const rax = require('retry-axios');
const sanitize = require("sanitize-filename");
const htmlToText = require('html-to-text');
const fs = require('fs');
const cliProgress = require('cli-progress');

const pLimit = require('p-limit');
const limit = pLimit(16);
const UserAgent = require('user-agents')


const myAxiosInstance = axios.create();
const userAgent = new UserAgent();
const getNewAxiosConfig = () => {

    return {
        headers: {
            'User-Agent': userAgent.toString()
        },
        raxConfig: {
            noResponseRetries: 5,
            retry: 5,
            retryDelay: 100,
            instance: myAxiosInstance,
        }
    }
};
const interceptorId = rax.attach(myAxiosInstance);

const bar1 = new cliProgress.SingleBar({
    format: 'Downloading {bar} {value}/{total} Chapters'
}, cliProgress.Presets.shades_classic);
module.exports = class ReadLightNovelOrgScraper {
    constructor(novelUrl) {
        this.rootDirectory = './data'
        this.novelUrl = novelUrl;
        this.$ = null;
        this.novelName = null;
        this.novelPath = null;
        this.chaptersUrlList = null;
        this.bar = null;
    }
    async init() {
        const res = await axios.get(this.novelUrl, getNewAxiosConfig()).catch(e=>console.error(e));
        this.$ = cheerio.load(res.data);
        this.novelName = sanitize(this.$('h1').text().trim());
        this.novelPath = `${this.rootDirectory}/${this.novelName}`
        try {
            fs.accessSync(this.novelPath, fs.constants.F_OK)
        } catch (e) {
            fs.mkdirSync(this.novelPath)
        }
        this.chaptersUrlList = this.getChaptersList()
    }
    async fetchChapters() {
        console.log('>>>Fetching chapters')
        const fetchChapterPromises = this.chaptersUrlList.map(chapterUrl=>limit(()=>this.fetchSingleChapter(chapterUrl)))
        bar1.start(fetchChapterPromises.length, 0)
        await Promise.all(fetchChapterPromises)
        bar1.stop()

    }

    processHtml() {
        this.$('.trinity-player-iframe-wrapper, small, center, .desc div.hidden').remove()
    }

    getText(textElement) {
        return htmlToText.fromString(textElement.toString(), {
            wordwrap: 130
        }).trim();
    }

    checkIfExit(text) {
    }

    getTitle(text) {
        return sanitize(
            text.match(/chapter [\d.]+/i)[0]
            .replace(/[:.]/, ' -')
        ).trim()
    }

    getChaptersList() {
        return this.$('.chapter-chs li a').toArray().map(item => this.$(item).attr('href'))
    }

    async fetchSingleChapter(chapterUrl) {
        const res =  await axios.get(chapterUrl, getNewAxiosConfig()).catch(e=>console.error(e));
        const htmlData = res.data;
        this.$ = cheerio.load(htmlData);

        this.processHtml()

        const novelTextElement = this.$('.desc');
        const text = this.getText(novelTextElement);

        const title = this.getTitle(text);

        const chapterPath = `${this.novelPath}/${title}`
        const chapterFilePath = `${this.novelPath}/${title}/${title}.txt`


        try {
            fs.accessSync(chapterPath, fs.constants.F_OK)
        } catch (e) {
            fs.mkdirSync(chapterPath)
        }

        fs.writeFileSync(chapterFilePath, text)
        bar1.increment()
        // this.bar.tick();
        // console.log(`>>>Created file "${title}.txt"`)

    }

}
