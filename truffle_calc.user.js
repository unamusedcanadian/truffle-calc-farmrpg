// ==UserScript==
// @name Truffle Calculator
// @namespace unamusedcanadian
// @version 0.5.1
// @description Determines approximate range of Truffles user can expect at daily reset.
// @match https://farmrpg.com/*
// @grant GM.getValue
// @grant GM.setValue
// @icon https://www.google.com/s2/favicons?sz=64&domain=farmrpg.com
// @author unamusedcanadian
// ==/UserScript==

// Values that can be safely configured (within reason) to alter script behaviour
const CONFIG = Object.freeze({
    MAX_PIGS: 500, // Keep at or above 0
    CHANCE_CUTOFF: 1/1000,
    FLT_TRUNCATE: 3, // Keep at or above 0
    W_TRUFFLE_DROP: 1/100,
    B_TRUFFLE_DROP: 1/300,
});

// Prevents HTML classes from becoming magic values
const HTML_CLASS = Object.freeze({
    PIG_ELM: ".col-auto[style='line-height:14px;padding-bottom:12px;']",
    FEED_PIG: '.item-link.close-panel.feedpigbtn',
    FEED_ALL: '.item-link.close-panel.feedallbtn',
    BACON_PIG: '.item-link.close-panel.baconbtn',
    BACON_ALL: '.item-link.close-panel.massbtn',
    STOP_BACON: '.button.btngreen.stoppigsbtn',
});

// Global mutable variables- read/mutate these only when absolutely necessary
const scriptMemory = {
    pigData: [],
    wTruffleChances: [],
    bTruffleChances: [],
    parseNeeded: true,
};

console.log('Truffle Calculator loaded!');

// Make pig levels only parse if GM memory access failed or does not exist
GM.getValue("pigData", "").then((data) => {
    if (data) {
        scriptMemory.pigData = arrayDecode(data);
        scriptMemory.wTruffleChances = calculateProbability(scriptMemory.pigData, CONFIG.W_TRUFFLE_DROP);
        scriptMemory.bTruffleChances = calculateProbability(scriptMemory.pigData, CONFIG.B_TRUFFLE_DROP);
        scriptMemory.parseNeeded = false;
    }
});

// Only element we want that has an ID is the fireworks node
// fireworks node seems to be constantly loaded, which is very useful.
const fworks = document.getElementById('fireworks');
const pages = fworks.querySelector('.pages');

// Sometimes, even when the pigpen is still in memory/background, it will
// refresh when the back button is pressed. This bug is part of the
// website itself, and is likely impossible to fix from my end.
const loader = new MutationObserver((mutationList, observer) => {
    mutationList.forEach((mutation) => {
    mutation.addedNodes.forEach((newNode) => {
        switch (newNode.getAttribute('data-page')) {
            case "pigpen":
                pigpenLoad(newNode);
                break;
            case "namepig":
                namepigLoad(newNode);
                break;
        }
    });
    });
});

loader.observe(pages, { childList: true });

// Adds an event listener to element that triggers a re-parse of the pig pen
function setupEventListenerIfExists(parent, childClass) {
    if (child = parent.querySelector(childClass))
        child.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
}

// When the namepig menu loads
function namepigLoad(elm) {
    setupEventListenerIfExists(elm, HTML_CLASS.FEED_PIG);
    setupEventListenerIfExists(elm, HTML_CLASS.BACON_PIG);
}

// Run every time the pigpen page is loaded
function pigpenLoad(elm) {
    setupEventListenerIfExists(elm, HTML_CLASS.FEED_ALL);
    setupEventListenerIfExists(elm, HTML_CLASS.SEND_ALL);
    setupEventListenerIfExists(elm, HTML_CLASS.STOP_BACON);

    if (scriptMemory.parseNeeded) {
        scriptMemory.pigData = pigpenParse(elm);
        scriptMemory.wTruffleChances = calculateProbability(scriptMemory.pigData, CONFIG.W_TRUFFLE_DROP);
        scriptMemory.bTruffleChances = calculateProbability(scriptMemory.pigData, CONFIG.B_TRUFFLE_DROP);
        scriptMemory.parseNeeded = false;
        GM.setValue("pigData", arrayEncode(scriptMemory.pigData));
    }

    // TODO: Make the rendering implementation more stable
    const truffleMenu = elm.querySelector('.row.no-gutter');

    renderData(truffleMenu.firstElementChild, scriptMemory.wTruffleChances);
    renderData(truffleMenu.lastElementChild, scriptMemory.bTruffleChances);
}

// Runs when pigs are fed or sent to slaughterhouse.
// Returns an array with the levels of all fed and not-in-mortal-peril pigs
function pigpenParse(elm) {
    console.time('pigpenParse');

    const pigList = elm.querySelectorAll(HTML_CLASS.PIG_ELM);

    const levels = new Uint8Array(CONFIG.MAX_PIGS);
    let index = 0;
    pigList.forEach(pig => {
        const pigHTML = pig.innerHTML;
        // unfed pig
        if (pigHTML.match(/color:red/)) return;
        // to-be-bacon pig
        else if (pigHTML.match(/text-decoration: line-through;/)) return;
        // catch any other edge cases like those weird trailing empty nodes
        else if (num = parseInt(pig.innerText.slice(-2)))
            levels[index++] = num;
    });
    levels.sort();

    console.timeEnd('pigpenParse');

    return levels.subarray(CONFIG.MAX_PIGS - index);
}

// Calculates the rough probability of each truffle type being generated
// Taken from https://en.wikipedia.org/wiki/Poisson_binomial_distribution
function calculateProbability(levels, type) {
    console.time('calculateProbability');

    // Doing a .map on levels without casting it to Float causes logic errors
    const probs = Float64Array.from(levels).map(num => num * type);
    let PMF = new Float64Array(1);
    PMF[0] = 1;

    for (let i = 1; i <= probs.length; ++i) {
        let nextPMF = new Float64Array(i+1);
        nextPMF[0] = (1-probs[i-1]) * PMF[0];
        nextPMF[i] = probs[i-1] * PMF[i-1];

        for (let j = 1; j < i; ++j) {
            nextPMF[j] = probs[i-1] * PMF[j-1] + (1-probs[i-1]) * PMF[j]
        }

        PMF = nextPMF;
    }

    console.timeEnd('calculateProbability');

    // Any chance below CHANCE_CUTOFF is set to 0
    return PMF.map(num => num > CONFIG.CHANCE_CUTOFF ? num : 0);
}

// Turns array into dictonary string for more space efficient storage
function arrayEncode(arr) {
    const compress = {};
    arr.forEach((num) => {
        compress[num] ? compress[num]++ : compress[num] = 1;
    });
    return JSON.stringify(compress);
}

// Turns dictonary string into array for usage in the script
function arrayDecode(str) {
    const compress = JSON.parse(str);
    const keys = Object.keys(compress).map(c => parseInt(c));
    const values = Object.values(compress);
    const ret = [];

    // Might be able to replace this with a .reduce() method call
    keys.forEach((k, i) => {
        ret.push(new Array(values[i]).fill(k));
    });

    // Probably a better way to do this
    return new Uint8Array(ret.flat());
}

// Formats floats as specified in config
function floatToPercent(num) {
    const regex = new RegExp(`(\\..{${CONFIG.FLT_TRUNCATE}}).*`);
    const base = (num*100).toString()
        .replace(regex,'$1')
        .replace(/\.$/,'');
    return `${base}%`;
}

// ############################## //
// Abandon all hope, ye who enter //
// ############################## //

// Function to render the graphs
// TODO: Show the sum of all Truffle-making pig levels
// TODO: Make the code more readable and efficient
// TODO: Make the graph generate a dynamic Y axis based on average rarity
// TODO: Show the range of truffles
// TODO: Maybe find a way to store the result in memory? Maybe?
// TODO: Have White and Black Truffles have different bar colours
function renderData(elm, data) {
    console.time('renderData');

    const max = 0.15; // Currently useless

    const fragment = document.createDocumentFragment();

    const style = document.createElement('style');
    setStyle(style);
    fragment.appendChild(style);

    const chart = document.createElement('chart');
    fragment.appendChild(chart);

    const table = document.createElement('table');
    chart.appendChild(table);

    const caption = document.createElement('caption');
    caption.appendChild(document.createTextNode('Chances'));
    table.appendChild(caption);

    const thead = document.createElement('thead');
    table.appendChild(thead);

    // Determine how to generate this later
    yAxisGen(0, 15, 5, 1, thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // Generates main table
    data.forEach((chance, count) => {
        if (chance <= 0) return;

        const tr = document.createElement('tr');
        tbody.appendChild(tr);

        const th = document.createElement('th');
        const td = document.createElement('td');
        // th.appendChild(document.createTextNode(count.toString()));
        td.setAttribute("style", "height:" + (100 * chance/max) + "%");

        // This order is very important- th must always come before td
        tr.appendChild(th);
        tr.appendChild(td);
    });

    elm.appendChild(fragment);
    console.timeEnd('renderData');
}

// TODO: Make this more efficient and readable
function yAxisGen(min, max, step, gap, head) {
    const appendMe = [];

    for (i = min; i <= max; i += step) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.appendChild(document.createTextNode(`${i}%`));
        tr.appendChild(th);
        appendMe.push(tr);

        if (i < max)
        for (j = 0; j < gap; ++j) {
            const tr2 = document.createElement('tr');
            const th2 = document.createElement('th');
            tr2.appendChild(th2);
            appendMe.push(tr2);
        }
    }

    appendMe.reverse();

    appendMe.forEach(part => {
        head.appendChild(part);
    });
}

// The CSS that creates the entire chart
// Will probably replace this with style objects instead of adding this to the DOM directly
function setStyle(style) {
    style.innerHTML = `
    chart {
        --caption-area: 1.5rem;
        --footer-area: 1.5rem;
        --ui-colour: white;

        display: block;
        box-sizing: border-box;
        container-type: inline-size;
        background-color: transparent;

        & * { box-sizing: border-box; }

        table {
            display: grid;
            grid-template-rows: var(--caption-area) 1fr var(--footer-area);
            height: 100%;
            max-height: 225px;
            max-width: 450px;
        }

        caption {
            grid-area: 1 / 1 / 2 / 2;
            display: block;
            font-size: 1rem;
        }

        thead {
            grid-area: 1 / 1 / 3 / 2;
            align-items: end;
            color: var(--ui-colour);
            display: grid;
            grid-template-rows: var(--caption-area);
            grid-auto-rows: 1fr;

            tr {
                display: contents;
            }

            th {
                font-size: 0.75rem;
                font-weight: 600;
                text-align: start;
                border-block-end: 1px solid var(--ui-colour);
                display: inline grid;
            }
        }

        tbody {
            grid-area: 2 / 1 / 4 / 2;
            container-type: size;
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: 1fr;
            padding-inline: 1rem 0;

            tr {
                align-items: end;
                display: grid;
                overflow-inline: clip;
                grid-template-rows: 1fr var(--footer-area);
            }

            th {
                grid-area: 2 / 1 / 3 / 2;
                color: var(--ui-colour);
                border-block-start: 2px solid var(--ui-colour);
                font-size: 1rem;
                font-weight: 600;
                height: var(--footer-area);
                place-content: center;
                display: none;

                &:has(+ td:hover) {
                    display: inline grid;
                }
            }

            td {
                grid-area: 1 / 1 / 2 / 2;
                background: beige;

                &:hover {
                    background-color: blue;
                }
            }
        }
    }`;
}