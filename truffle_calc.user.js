// ==UserScript==
// @name Truffle Calculator
// @namespace unamusedcanadian
// @version 0.3.1
// @description Determines approximate range of Truffles user can expect at daily reset.
// @match https://farmrpg.com/*
// @grant GM.getValue
// @grant GM.setValue
// @icon https://www.google.com/s2/favicons?sz=64&domain=farmrpg.com
// @author unamusedcanadian
// ==/UserScript==

// TODO: Fix tab indentation

// Constant variables
const MAX_PIGS = 500;
const W_TRUFFLE_DROP = 1/100;
const B_TRUFFLE_DROP = 1/300;
const CHANCE_CUTOFF = 1/10000;
const FLT_TRUNCATE = 3;

const FEED_BTN_CLASSES = '.item-link.close-panel.feedpigbtn';
const FEED_ALL_BTN_CLASSES = '.item-link.close-panel.feedallbtn';
const BACON_BTN_CLASSES = '.item-link.close-panel.baconbtn';
// I am not buying send-o-matic 1 or 2 just to make this button work- 
// ask someone who does have it for the last HTML class
const BACON_ALL_BTN_CLASSES = '.item-link.close-panel.'; 

// Global mutable variables.
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
	  scriptMemory.wTruffleChances = calculateProbability(scriptMemory.pigData, W_TRUFFLE_DROP);
	  scriptMemory.bTruffleChances = calculateProbability(scriptMemory.pigData, B_TRUFFLE_DROP);
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
		// TODO: Attach event listener to send all button
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
    if (feedBtn = elm.querySelector(FEED_BTN_CLASSES)) {
	feedBtn.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
    }
    if (baconBtn = elm.querySelector(BACON_BTN_CLASSES)) {
	baconBtn.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
    }
}

// Run every time the pigpen page is loaded
// Only place I access or modify global variables
function pigpenLoad(elm) {
  if (feedAllBtn = elm.querySelector(FEED_ALL_BTN_CLASSES)) {
  	feedAllBtn.addEventListener("click", () => { scriptMemory.parseNeeded = true; });
  }
  
  // Send all btn code goes here I guess
  
  if (scriptMemory.parseNeeded) {
  	scriptMemory.pigData = pigPenParse(elm);
    scriptMemory.wTruffleChances = calculateProbability(scriptMemory.pigData, W_TRUFFLE_DROP);
  	scriptMemory.bTruffleChances = calculateProbability(scriptMemory.pigData, B_TRUFFLE_DROP);
    scriptMemory.parseNeeded = false;
      GM.setValue("pigData", arrayEncode(scriptMemory.pigData));
  }
  
    const truffleMenu = elm.querySelector('.row.no-gutter');
  
    renderData(truffleMenu.firstElementChild, scriptMemory.wTruffleChances);
    renderData(truffleMenu.lastElementChild, scriptMemory.bTruffleChances);
}

// TODO: Differentiate unfed and to-be-bacon pigs
// Runs when pigs are fed or sent to slaughterhouse.
// Might want to make this promise-based for error catching
function pigPenParse(elm) {
    const startTime = performance.now();
    // RegExp powered mass murder (~45-52ms for 500 pigs)
    const levels = Uint8Array.from(
	elm.innerText
	    .replace(/.*\)\n/s,"") // Nukes all non-pig text
	    .replace(/\n*.*\nLevel /g," ") // Nukes all pig names 
	    .match(/[0-9]+/g) // Extracts array of remaining numbers
    );
    const endTime = performance.now();
    console.log(`Parsing HTML took ${endTime - startTime} miliseconds`);
	
    // Sorting pigs by level makes things simpler later
    return levels.sort();
}

// Calculates the rough probability of each truffle type being generated
// Taken from https://en.wikipedia.org/wiki/Poisson_binomial_distribution
function calculateProbability(levels, type) {
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
  
    // Any chance below CHANCE_CUTOFF is set to 0
    return PMF.map(num => num > CHANCE_CUTOFF ? num : 0); 
}

// Function to render the graphs
// Graphics are placeholder right now
// TODO: Learn how to make actually decent looking HTML
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
    const regex = new RegExp(`(\\..{${FLT_TRUNCATE}}).*`);
    const base = (num*100).toString()
	  .replace(regex,'$1')
	  .replace(/\.$/,'');
    return base + '%';
}
