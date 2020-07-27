const UserAgent = require('user-agents')
const axios = require('axios')
const rax = require('retry-axios');
const pLimit = require('p-limit');
const limit = pLimit(16);
const cliProgress = require('cli-progress');
const cheerio = require('cheerio');
const sanitize = require("sanitize-filename");
const htmlToText = require('html-to-text');
const fs = require('fs');


module.exports = class Scraper {
    rootDirectory = './data'
    constructor(novelUrl) {
        this.novelUrl = novelUrl;
        this.bar1 = new cliProgress.SingleBar({
            format: 'Downloading {bar} {value}/{total} Chapters'
        }, cliProgress.Presets.shades_classic);
        this.$ = null;
        this.novelName = null;
        this.novelPath = null;
        this.chaptersUrlList = null;
        this.novelNameSelector = null;
        this.chapterTextSelector = null;
        this.chapterTitleSelector = null;
    }

    showMethodNotOverriddenError() {
        throw new Error('You have to implement this method!');
    }

    getNewAxiosConfig() {
        const myAxiosInstance = axios.create();
        const interceptorId = rax.attach(myAxiosInstance);
        const userAgent = new UserAgent();
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
    }

    getNovelName() {
        return this.$(this.novelNameSelector).text().trim()
    }

    getChapterLinks() {
        //    Implement in children - return initial list of chapter links
        this.showMethodNotOverriddenError()
    }

    async getProcessedChaptersList(initialChaptersList) {
        //    Implement in children - return processed chapter links list with announcement etc. chapters removed
        this.showMethodNotOverriddenError()
    }

    async getChaptersList() {
        console.log('>>>Fetching Chapters')
        let initialChaptersList = this.getChapterLinks()
        return await this.getProcessedChaptersList(initialChaptersList)
    }

    async init() {
        const res = await axios.get(this.novelUrl, this.getNewAxiosConfig()).catch(e=>console.error(e));
        this.$ = cheerio.load(res.data);
        this.novelName = this.getNovelName();
        this.novelPath = `${this.rootDirectory}/${this.novelName}`
        this.chaptersUrlList = await this.getChaptersList()

        try {
            fs.accessSync(this.novelPath, fs.constants.F_OK)
        } catch (e) {
            fs.mkdirSync(this.novelPath)
        }
    }

    processCheerioDOMTree() {
        //    Implement in children - process the cheerio class property to remove useless tags and elements
        this.showMethodNotOverriddenError()
    }

    processChapterTitle(tempTitle) {
        //    Implement in children - process the Chapter Title and return
        this.showMethodNotOverriddenError()
    }

    getTitle() {
        const tempTitle =  this.$(this.chapterTitleSelector).text().trim();
        return this.processChapterTitle(tempTitle)
    }

    processChapterText(text) {
        //    Implement in children - return the chapter Title
        this.showMethodNotOverriddenError()
    }

    getText(textElement) {
        let tempText = htmlToText.fromString(textElement.toString(), {
            wordwrap: null,
            uppercaseHeadings: false
        })
        return this.processChapterText(tempText)
    }

    makeTitleTextBold(text, title) {
        let titleRegex = new RegExp(`.*${title}.*`, 'i')
        !text.match(titleRegex) && (titleRegex = /^chapter.*/i)
        return text
            .replace(titleRegex, '<strong>$&</strong>')
    }

    async fetchSingleChapter(chapterUrl) {
        const res =  await axios.get(chapterUrl, this.getNewAxiosConfig()).catch(e=>console.error(e));
        const htmlData = res.data;
        this.$ = cheerio.load(htmlData);

        this.processCheerioDOMTree()

        const novelTextElement = this.$(this.chapterTextSelector);
        const title = this.getTitle();
        const text = this.makeTitleTextBold(this.getText(novelTextElement), title);


        const chapterPath = `${this.novelPath}/${title}`
        const chapterFilePath = `${this.novelPath}/${title}/${title}.txt`

        try {
            fs.accessSync(chapterPath, fs.constants.F_OK)
        } catch (e) {
            fs.mkdirSync(chapterPath)
        }

        fs.writeFileSync(chapterFilePath, text)
        this.bar1.increment()
    }

    async fetchChapters() {
        const fetchChapterPromises = this.chaptersUrlList.map(chapterUrl=>limit(
            ()=>this.fetchSingleChapter(chapterUrl)
                .catch(
                    (err)=> {
                        console.log(`\n***Error at URL: ${chapterUrl}`)
                        console.error(err)
                    }
                )
        ))
        this.bar1.start(fetchChapterPromises.length, 0)
        await Promise.all(fetchChapterPromises)
        this.bar1.stop()
    }
}
