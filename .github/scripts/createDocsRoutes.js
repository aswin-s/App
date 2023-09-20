const yaml = require('js-yaml');
const fs = require('fs');
const _ = require('underscore');

const warn = (platform) => `Number of hubs in _routes.yml does not match number of hubs in docs/${platform}/articles. Please update _routes.yml with hub info.`;
const disclaimer = '# This file is auto-generated. Do not edit it directly. Use npm run createDocsRoutes instead.\n';
const docsDir = `${process.cwd()}/docs`;
const routes = yaml.load(fs.readFileSync(`${docsDir}/_data/_routes.yml`, 'utf8'));

/**
 * @param {String} str - The string to convert to title case
 * @returns {String}
 */
function toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/**
 * @param {String} filename - The name of the file
 * @returns {Object}
 */
function getArticleObj(filename) {
    const href = filename.replace('.md', '');
    return {
        href,
        title: toTitleCase(href.replaceAll('-', ' ')),
    };
}

/**
 * If the article / sections exist in the hub, then push the entry to the array.
 * Otherwise, create the array and push the entry to it.
 * @param {*} hubs - The hubs array
 * @param {*} hub - The hub we are iterating
 * @param {*} key - If we want to push sections / articles
 * @param {*} entry - The article / section to push
 */
function pushOrCreateEntry(hubs, hub, key, entry) {
    const hubObj = _.find(hubs, (obj) => obj.href === hub);
    if (hubObj[key]) {
        hubObj[key].push(entry);
    } else {
        hubObj[key] = [entry];
    }
}

function run() {
    const newExpensifyHubs = fs.readdirSync(`${docsDir}/articles/new-expensify`);
    const expensifyClassicHubs = fs.readdirSync(`${docsDir}/articles/expensify-classic`);

    const newExpensifyRoute = routes.platforms.find((platform) => platform.href === "new-expensify");
    const expensifyClassicRoute = routes.platforms.find((platform) => platform.href === "expensify-classic");

    if (newExpensifyHubs.length !== newExpensifyRoute.hubs.length) {
        console.error(warn("new-expensify"));
        return 1;
    }

    if (expensifyClassicHubs.length !== expensifyClassicRoute.hubs.length) {
        console.error(warn("expensify-classic"));
        return 1;
    }

    createHubsWithArticles(expensifyClassicHubs, "expensify-classic", expensifyClassicRoute.hubs);
    createHubsWithArticles(newExpensifyHubs, "new-expensify", newExpensifyRoute.hubs);

    // Convert the object to YAML and write it to the file
    let yamlString = yaml.dump(routes);
    yamlString = disclaimer + yamlString;
    fs.writeFileSync(`${docsDir}/_data/routes.yml`, yamlString);
}


function createHubsWithArticles(hubs, platformName, routeHubs) {
    _.each(hubs, (hub) => {
        // Iterate through each directory in articles
        fs.readdirSync(`${docsDir}/articles/${platformName}/${hub}`).forEach((fileOrFolder) => {
            // If the directory content is a markdown file, then it is an article
            if (fileOrFolder.endsWith('.md')) {
                const articleObj = getArticleObj(fileOrFolder);
                pushOrCreateEntry(routeHubs, hub, 'articles', articleObj);
                return;
            }

            // For readability, we will use the term section to refer to subfolders
            const section = fileOrFolder;
            const articles = [];

            // Each subfolder will be a section containing articles
            fs.readdirSync(`${docsDir}/articles/${platformName}/${hub}/${section}`).forEach((subArticle) => {
                articles.push(getArticleObj(subArticle));
            });

            pushOrCreateEntry(routeHubs, hub, 'sections', {
                href: section,
                title: toTitleCase(section.replaceAll('-', ' ')),
                articles,
            });
        });
    });
}

try {
    run();
} catch (error) {
    console.error('A problem occurred while trying to read the directories.', error);
    return 1;
}
