// ==UserScript==
// @name Truffle Calculator
// @namespace unamusedcanadian
// @version 1.0.1
// @description Determines approximate range of Truffles user can expect at daily reset.
// @match https://farmrpg.com/*
// @icon https://www.google.com/s2/favicons?sz=64&domain=farmrpg.com
// @author unamusedcanadian
// ==/UserScript==

// Values that can be safely configured (within reason) to alter script behaviour
// Keep all values within a range of 0 to 1 inclusive.
const CONFIG = Object.freeze({
    CHANCE_CUTOFF: 1/1000,
    WHITE_TRUFFLE_DROP: 1/100,
    BLACK_TRUFFLE_DROP: 1/300,
});

// For more advanced users who want to change the colours of the graphs
const WHITE_TRUFFLE_OPTIONS = Object.freeze({
    CAPTION: 'White Truffle Stats',
    COLOUR_PROFILE: 'wtruf-col',
    IDLE_BAR_COLOUR: 'beige',
    HOVER_BAR_COLOUR: 'grey',
});
const BLACK_TRUFFLE_OPTIONS = Object.freeze({
    CAPTION: 'Black Truffle Stats',
    COLOUR_PROFILE: 'btruf-col',
    IDLE_BAR_COLOUR: 'brown',
    HOVER_BAR_COLOUR: 'grey',
});

// Readable formatting can be found in the style.css file on GitHub
// Highly recommend that any attempt to refactor this be done with that first
const CSS_STYLE = Object.freeze({
    STYLE: `.chart { --caption-area: 1.5rem; --footer-area: 1.5rem;\
--ui-colour: #eee; background-color: transparent; box-sizing: border-box;\
container-type: inline-size; display: block; & * { box-sizing: border-box; }\
table { display: grid; grid-template-rows: var(--caption-area) minmax(0, 1fr)\
var(--footer-area); height: 100%; } caption { grid-area: 1 / 1 / 2 / 2;\
display: block; font-size: 1rem; } thead { align-items: end; display: grid;\
grid-area: 1 / 1 / 3 / 2; grid-auto-rows: minmax(0, 1fr); grid-template-rows: \
var(--caption-area); tr { display: contents; } th { border-block-end: 1px \
solid var(--ui-colour); display: inline grid; font-size: 0.75rem; text-align: start;\
} } tbody { container-type: size; display: grid; grid-auto-flow: column;\
grid-auto-columns: minmax(0, 1fr); grid-area: 2 / 1 / 4 / 2; padding-inline: \
1.5rem 0; tr { align-items: end; display: grid; grid-template-rows: 1fr \
var(--footer-area); } tr:hover { th { display: inline grid; } .wtruf-col {\
background-color: ${WHITE_TRUFFLE_OPTIONS.HOVER_BAR_COLOUR}; } .btruf-col {\
background-color: ${BLACK_TRUFFLE_OPTIONS.HOVER_BAR_COLOUR}; } } th {\
border-block-start: 2px solid var(--ui-colour); display: none; font-size: 1rem;\
grid-area: 2 / 1 / 3 / 2; height: var(--footer-area); min-width: 0;\
overflow: visible; place-content: center; text-align: center; &:has(+ td:hover) \
{ display: inline grid; } } td { grid-area: 1 / 1 / 2 / 2; } } } .wtruf-col {\
background-color: ${WHITE_TRUFFLE_OPTIONS.IDLE_BAR_COLOUR}; } .btruf-col { \
background-color: ${BLACK_TRUFFLE_OPTIONS.IDLE_BAR_COLOUR}; }`
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
    frontendHTML: "",
    parseNeeded: true,
};

// Confirms that the script loaded. If you don't see this something messed up
console.log('Truffle Calculator loaded!');

// Sometimes, even when the pigpen is still in memory/background, it will
// refresh when the back button is pressed. This bug (feature?) is part of the
// website itself, and is likely impossible to fix from my end.
const loader = new MutationObserver(mutationList => {
    mutationList.forEach(mutation => {
    mutation.addedNodes.forEach(newNode => {
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

// Look for page updates
const pages = document.getElementById('fireworks').querySelector('.pages');
loader.observe(pages, { childList: true });

// Adds an event listener to element that triggers a re-parse of the pig pen
function setupEventListenerIfExists(parent, childClass) {
    if (child = parent.querySelector(childClass))
        child.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
}

// When the namepig menu loads
function namepigLoad(elm) {
    // TODO: Replace this with an event listener on the parent (elm)
    setupEventListenerIfExists(elm, HTML_CLASS.FEED_PIG);
    setupEventListenerIfExists(elm, HTML_CLASS.BACON_PIG);
}

// Run every time the pigpen page is loaded
function pigpenLoad(elm) {
    // TODO: Replace this with an event listener on the parent (elm)
    setupEventListenerIfExists(elm, HTML_CLASS.FEED_ALL);
    setupEventListenerIfExists(elm, HTML_CLASS.SEND_ALL);
    setupEventListenerIfExists(elm, HTML_CLASS.STOP_BACON);

    if (scriptMemory.parseNeeded) {
        let parseData = pigpenParse(elm);
        scriptMemory.frontendHTML = createFrontend(parseData);
        scriptMemory.parseNeeded = false;
    }

    renderFrontend(elm, scriptMemory.frontendHTML);
}

// Runs when pigs are fed or sent to slaughterhouse.
// Returns an array with the levels of all fed and not-in-mortal-peril pigs
function pigpenParse(elm) {
    console.time('pigpenParse');

    const pigList = elm.querySelectorAll(HTML_CLASS.PIG_ELM);

    let sum = 0;
    let whiteTruffleChances = new Float64Array([1]);
    let blackTruffleChances = new Float64Array([1]);

    // TODO: make this function more efficient
    pigList.forEach(pig => {
        const pigHTML = pig.innerHTML;
        if (pigHTML.match(/color:red|text-decoration: line-through;/))
            return; // unfed or to-be-bacon pig
        else if (num = parseInt(pig.innerText.slice(-2))) {
            sum += num;
            whiteTruffleChances = calculateProbabilityParallel(
                whiteTruffleChances,
                num * CONFIG.WHITE_TRUFFLE_DROP
            );
            blackTruffleChances = calculateProbabilityParallel(
                blackTruffleChances,
                num * CONFIG.BLACK_TRUFFLE_DROP
            );
        }
    });

    console.timeEnd('pigpenParse');

    return Object.freeze({
        totalPigLevels: sum,
        whiteTruffleChances: whiteTruffleChances,
        blackTruffleChances: blackTruffleChances,
    });
}

// Calculates the rough probability of each truffle type being generated
// Taken from https://en.wikipedia.org/wiki/Poisson_binomial_distribution
function calculateProbabilityParallel(PMF, prob) {
    const size = PMF.length;
    let nextPMF = new Float64Array(size+1);

    nextPMF[0] = (1-prob) * PMF[0];
    nextPMF[size] = prob * PMF[size-1];

    for (let i = 1; i < size; ++i)
        nextPMF[i] = prob * PMF[i-1] + (1-prob) * PMF[i];

    return nextPMF;
}

// Ensures the content is placed in an appropriate space
// TODO: Tidy up code by reducing calls to .match
function renderFrontend(elm, frontendHTML) {
    console.time('render');

    const render = document.createElement('template');
    render.innerHTML = frontendHTML;

    // If user unlocked truffles, add this under that area.
    // Else, add it right before the pigs section.
    const anchorList = Array.from(elm.querySelectorAll('.content-block-title'));
    const anchor = anchorList.find(
        title => title.innerText.match(/Truffles|Pigs/i)
    );

    if (anchor.innerText.match(/Truffles/i))
        anchor.parentElement.insertBefore(
            render.content,
            anchor.nextElementSibling.nextElementSibling
        );
    else if (anchor.innerText.match(/Pigs/i))
        anchor.parentElement.insertBefore(
            render.content,
            anchor
        );
    else
        console.log("ERROR: No valid anchor detected. Rendering cancelled.");

    console.timeEnd('render');
}

// Create the custom website section of the pigpen
// TODO: Show the range of truffles without hovering
// TODO: Modularize this giant text block to make modification easier
const createFrontend = data =>
    `<div class="content-block-title">Truffle Calculations</div>\
<div class="row no-gutter" style="margin-bottom:0"><style>${CSS_STYLE.STYLE}\
</style>${createGraph(WHITE_TRUFFLE_OPTIONS, data.whiteTruffleChances)}\
${createGraph(BLACK_TRUFFLE_OPTIONS, data.blackTruffleChances)}</div>\
<div class="card"><div class="card-content"><div class="card-content-inner">\
Tip: White Truffles are best sold at <strong>190m-200m</strong> silver each.<br>\
Tip: Black Truffles are best sold at <strong>590m-600m</strong> silver each.<br><br>\
Hover your mouse over the graph to see the quantities of truffles.<br><br>\
Sum of all truffle-producing pig levels: <strong>${data.totalPigLevels}</strong>.\
<br><br>Currently not showing any quantity with chances under <strong>\
${100*CONFIG.CHANCE_CUTOFF}%</strong>. This can be changed in the config.\
</div></div></div>`;

// Function to render the graphs
function createGraph(options, chances) {
    // This method is kinda hacky but I don't think there's a better way
    const chartMax = Math.ceil(
        100 * chances.reduce((a, b) =>
            Math.max(a, b)
        )
    ) / 100;

    // To reduce the amount of times a new string has to be created
    const chartHTML = [`<div class="col-auto chart"><table>\
<caption>${options.CAPTION}</caption><thead><tr><th>${100*chartMax}%</th></tr>`];

    // Determine Y axis formatting
    // If divisible by 3
    if ((100*chartMax % 3) == 0) {
    chartHTML.push(`<tr><th></th></tr><tr><th>${200*chartMax/3}%</th></tr>\
    <tr><th></th></tr><tr><th>${100*chartMax/3}%</th></tr><tr><th></th></tr>`);
    }
    // If divisible by 2
    else if ((100*chartMax & 1) == 0) {
        chartHTML.push(`<tr><th></th></tr><tr><th></th></tr><tr>\
<th>${50*chartMax}%</th></tr><tr><th></th></tr><tr><th></th></tr>`);
    }
    else {
        chartHTML.push(`<tr><th></th></tr><tr><th></th></tr><tr><th></th></tr>\
<tr><th></th></tr><tr><th></th></tr>`);
    }

    chartHTML.push(`<tr><th>0%</th></tr></thead><tbody>`);

    // Creates the bars of the chart
    chances.forEach((chance, count) => {
        if (chance > CONFIG.CHANCE_CUTOFF)
            chartHTML.push(`<tr><th>${count}</th><td class=\
"${options.COLOUR_PROFILE}"style="height:${100*chance/chartMax}%"></td></tr>`);
    });

    chartHTML.push(`</tbody></table></div>`);

    return chartHTML.join("");
}