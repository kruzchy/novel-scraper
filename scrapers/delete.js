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

const Scraper = require('./utils/scraper')

module.exports = class WordexcerptScraper extends Scraper{
    constructor(novelUrl) {
        super(novelUrl);
        this.novelNameSelector = 'h1';
    }

    getChapterLinks() {

    }


    async fetchChapters() {
        console.log('>>>Fetching chapters')
        const fetchChapterPromises = this.chaptersUrlList.map(chapterUrl=>limit(
            ()=>this.fetchSingleChapter(chapterUrl)
                .catch(
                    (err)=> {
                        console.log(`\n***Error at URL: ${chapterUrl}`)
                        console.error(err)
                    }
                )
        ))
        bar1.start(fetchChapterPromises.length, 0)
        await Promise.all(fetchChapterPromises)
        bar1.stop()
    }

    processHtml() {
        this.$('center').remove()
        this.$('img').remove()
    }

    getText(textElement) {
        const tempTitle = this.$('.breadcrumb .active').text().trim()
        let titleRegex = new RegExp(`.*${tempTitle}.*`, 'i')
        let tempText = htmlToText.fromString(textElement.toString(), {
            wordwrap: null,
            uppercaseHeadings: false
        })
        !tempText.match(titleRegex) && (titleRegex = /^chapter.*/i)
        return tempText
            .replace(titleRegex, '<strong>$&</strong>')
            .replace(/.*wait to read ahead\?(.*|\s|\n)+$/i, '')
            .trim();
    }

    makeTitleBold(text) {
        return text
    }

    checkIfExit() {
    }

    getTitle() {
        return sanitize(this.$('.breadcrumb .active').text().trim().replace(/[:.]/, ' -'))
    }

    async getChaptersList() {
        let tempArray = this.$('.wp-manga-chapter a').toArray().map(item => this.$(item).attr('href'));
        const res = await axios.get(tempArray[0], getNewAxiosConfig());
        const $ = cheerio.load(res.data);
        if ($('.breadcrumb .active').text().trim().match(/an announcement/i)) {
            console.log('>>>Last chapter is an announcement. So ignoring.')
            tempArray.shift()
        }
        return tempArray;
    }

    async fetchSingleChapter(chapterUrl) {
        const res =  await axios.get(chapterUrl, getNewAxiosConfig()).catch(e=>console.error(e));
        const htmlData = res.data;
        this.$ = cheerio.load(htmlData);

        this.processHtml()

        const novelTextElement = this.$('.text-left');
        const title = this.getTitle();
        const text = this.getText(novelTextElement, title);

        const chapterPath = `${this.novelPath}/${title}`
        const chapterFilePath = `${this.novelPath}/${title}/${title}.txt`


        try {
            fs.accessSync(chapterPath, fs.constants.F_OK)
        } catch (e) {
            fs.mkdirSync(chapterPath)
        }

        fs.writeFileSync(chapterFilePath, text)
        bar1.increment()
        // console.log(`>>>Created file "${title}.txt"`)

    }

}