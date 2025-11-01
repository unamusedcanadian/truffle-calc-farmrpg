// ==UserScript==
// @name Truffle Calculator
// @namespace unamusedcanadian
// @version 0.4.1
// @description Determines approximate range of Truffles user can expect at daily reset.
// @match https://farmrpg.com/*
// @grant GM.getValue
// @grant GM.setValue
// @icon https://www.google.com/s2/favicons?sz=64&domain=farmrpg.com
// @author unamusedcanadian
// ==/UserScript==

// Values that can be safely configured to alter script behaviour
const CONFIG = Object.freeze({
    MAX_PIGS: 500,
    W_TRUFFLE_DROP: 1/100,
    B_TRUFFLE_DROP: 1/300,
    CHANCE_CUTOFF: 1/10000,
    FLT_TRUNCATE: 3,
});

// Magic values are bad
const BTN_CLASS = Object.freeze({
    FEED_PIG: '.item-link.close-panel.feedpigbtn',
    FEED_ALL: '.item-link.close-panel.feedallbtn',
    BACON_PIG: '.item-link.close-panel.baconbtn',
    // I am not buying send-o-matic 1 or 2 just to make this button work- 
    // ask someone who does have it for the last HTML class
    BACON_ALL: '.item-link.close-panel',
    STOP_BACON: '.button.btngreen.stoppigsbtn',
});

// Global mutable variables
const scriptMemory = {
    pigData: [],
    wTruffleChances: [],
    bTruffleChances: [],
    parseNeeded: true
};

console.log('Truffle Calculator loaded!'); 

// Make pig levels only parse if GM memory access failed or does not exist
GM.getValue("pigData", "")
  .then((data) => {
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

// When the namepig menu loads
// Only place other than pigpenLoad where global variables are accessed
function namepigLoad(elm) {
    if (feedBtn = elm.querySelector(BTN_CLASS.FEED_PIG)) {
        feedBtn.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
    }
    if (baconBtn = elm.querySelector(BTN_CLASS.BACON_PIG)) {
        baconBtn.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
    }
}

// Run every time the pigpen page is loaded
// Only place I access or modify global variables
function pigpenLoad(elm) {
    if (feedAllBtn = elm.querySelector(BTN_CLASS.FEED_ALL)) {
        feedAllBtn.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
    }
    /* Inactive until I find the classes of the send-o-matic button
    if (sendAllBtn = elm.querySelector(BTN_CLASS.SEND_ALL)) {
        sendAllBtn.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
    }
    */  
    if (stopPigsBtn = elm.querySelector(BTN_CLASS.STOP_BACON)) {
        stopPigsBtn.addEventListener("click", () => { scriptMemory.parseNeeded = true; }); 
    }
  
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
  
    const pigList = elm.querySelectorAll(".col-auto\
[style='line-height:14px;padding-bottom:12px;']");
  
    const accumulator = new Array(CONFIG.MAX_PIGS);
    let index = 0;
    pigList.forEach(pig => {
        const pigHTML = pig.innerHTML;
        // unfed pig
        if (pigHTML.match(/color:red/)) return; 
        // to-be-bacon pig
        else if (pigHTML.match(/text-decoration: line-through;/)) return;
        // catch any other edge cases
        else if (num = parseInt(pig.innerText.slice(-2))) 
            accumulator[index++] = num; 
    }); 
    accumulator.length = index;
    const levels = Uint8Array.from(accumulator);

    console.timeEnd('pigpenParse');
  
    return levels.sort();
}

// Calculates the rough probability of each truffle type being generated
// Taken from https://en.wikipedia.org/wiki/Poisson_binomial_distribution
function calculateProbability(levels, type) {
    console.time('calculateProbability');
    // TODO: Replace Array.from(levels) with just levels.map() if map() doesn't mutate array
    const probs = Array.from(levels).map(num => num * type);
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

// Function to render the graphs
// Graphics are placeholder right now
// TODO: Learn how to make actually decent looking HTML
// TODO: Show the sum of all Truffle-making pig levels
function renderData(elm, data) {
    const fragment = document.createDocumentFragment();
    data.forEach((chance, count) => {
        if (chance > 0) {
            const newline = document.createElement('br');
            const text = document.createTextNode(
                `Chance of ${count} Truffles: ${floatToPercent(chance)}`
            );
            fragment.appendChild(newline);
            fragment.appendChild(text);
        }
    });
    elm.appendChild(fragment);
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

    keys.forEach((k, i) => { 
        ret.push(new Array(values[i]).fill(k));
    });

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
