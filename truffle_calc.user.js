// ==UserScript==
// @name Truffle Calculator
// @namespace unamusedcanadian
// @version 0.1.5
// @description Determines approximate range of Truffles user can expect at daily reset.
// @match https://farmrpg.com/*
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.listValues
// @grant GM.deleteValue
// @icon https://www.google.com/s2/favicons?sz=64&domain=farmrpg.com
// @author unamusedcanadian
// ==/UserScript==

// Constant variables
const DEBUG = false;
const BENCHMARK = false;

const MAX_PIGS = 500;
const W_TRUFFLE_DROP = 1/100;
const B_TRUFFLE_DROP = 1/300;
const CHANCE_CUTOFF = 1/10000;

const FEED_BTN_CLASSES = '.item-link.close-panel.feedpigbtn';
const FEED_ALL_BTN_CLASSES = '.item-link.close-panel.feedallbtn';
const BACON_BTN_CLASSES = '.item-link.close-panel.baconbtn';
// I am not buying send-o-matic 1 or 2 just to make this button work- 
// ask someone who does have it for the last HTML class
const BACON_ALL_BTN_CLASSES = '.item-link.close-panel.'; 

// Global mutable variables
var pigStats = []; // Attempt GM memory access
var wtc = []; // Attempt GM memory access
var btc = []; // Attempt GM memory access

// Make these only true if GM memory access failed

// Run every time pig levels could have changed
var parseNeeded = !pigStats.length; 
// Run when pig levels are confirmed to have changed
var calculateNeeded = !(wtc.length && btc.length);

console.log('Truffle Calculator loaded!'); 

if (DEBUG) {
	const testDict = { 1: 55, 2: 34, 3: 107 };
	dataStore(testDict, "test");
	GM.setValue("ShootyMcShootface", 69);
	GM.listValues().then((out) => { console.log(out); });
	dataList("test").then((out) => { console.log(out); });

	dataWipe("test").then(() => { console.log("delete test"); 		
		GM.listValues().then((out) => { console.log(out); }); });
}

// Only element we want that has an ID is the fireworks node
// fireworks node seems to be constantly loaded, which is very useful.
const fworks = document.getElementById('fireworks');
const pages = fworks.querySelector('.pages');

// Sometimes, even when the pigpen is still in memory/background, it will
// refresh when the back button is pressed. This bug is part of the
// website itself, and is likely impossible to fix from my end.
const loader = new MutationObserver((mutationList, observer) => {
  for (mutation of mutationList) {
		for (newNode of mutation.addedNodes) {
      switch (newNode.getAttribute('data-page')) {
        case "pigpen":
          // TODO: Attach event listener to send all button
          pigpenLoad(newNode);
          break;
        case "namepig":
          namepigLoad(newNode);
          break;
      }
    }
  }
});

loader.observe(pages, { childList: true });

// Run every time the pigpen page is loaded
function pigpenLoad(elm) {
  if (feedAllBtn = elm.querySelector(FEED_ALL_BTN_CLASSES)) {
  	feedAllBtn.addEventListener("click", () => { parseNeeded = true; });
  }
  
  // Send all btn code goes here I guess
  
  if (parseNeeded) {
    const startTime = performance.now();
  	pigStats = pigPenParse(elm);
    const endTime = performance.now();
    console.log(`Call to pigPenParse took ${endTime - startTime} milliseconds`);
    parseNeeded = false;
  }
  
  if (calculateNeeded) {
    const startTime1 = performance.now();
    wtc = calculateProbability(pigStats, W_TRUFFLE_DROP);
    const endTime1 = performance.now();
    console.log(`Call to calculateProbability took ${endTime1 - startTime1} miliseconds`);
    const startTime2 = performance.now();
    btc = calculateProbability(pigStats, B_TRUFFLE_DROP);
    const endTime2 = performance.now();
    console.log(`Call to calculateProbability took ${endTime2 - startTime2} miliseconds`);
    calculateNeeded = false;
  }
  
  if (DEBUG) {
    console.log(wtc);
  	console.log(btc);
  }
}

// Runs when pigs are fed or sent to slaughterhouse.
// Might want to make this promise-based for error catching
function pigPenParse(elm) {  
  
  const startTime = performance.now();
  // (NOTE: test to see if naming a pig "Level " screws anything up
  // RegExp powered mass murder (~45-52ms)
  const levels = Uint8Array.from(
  	elm.innerText
		.replace(/.*\)\n/s,"") // Nukes all non-pig text
		.replace(/\n*.*\nLevel /g," ") // Nukes all pig names 
    .match(/[0-9]+/g) // Extracts array of remaining numbers
  );
  const endTime = performance.now();
  console.log(`Parsing HTML took ${endTime - startTime} miliseconds`);
	
  // Sorting pigs by level makes things simpler
  levels.sort();
  levels.reverse();
  
  console.log(levels);
  
  if (DEBUG) {
    console.log(levels);
  
  	let sum = 0;
  	for (num of levels) {
  		sum += num; 
  	}
  	console.log('Sum of pig levels: ' + sum + '.'); 
  }
  
  // Truncate unused memory
  return levels;
}

// Calculates the rough probability of each truffle type being generated
// Taken from https://en.wikipedia.org/wiki/Poisson_binomial_distribution
function calculateProbability(levels, type) {
  // Might want to set a type for this array
  // 64 bit floats might be more precise, costs double memory (2kb vs 4kb)
  // 64 bit might be slower by about a milisecond. Doesn't matter much.
	const probs = Array.from(levels).map((num) => { return num * type });
  let PMF = new Float64Array(1);
  PMF[0] = 1;

  for (i = 1; i <= probs.length; ++i) {
    let nextPMF = new Float64Array(i+1);
    nextPMF[0] = (1-probs[i-1]) * PMF[0];
    nextPMF[i] = probs[i-1] * PMF[i-1];
    
    for (j = 1; j < i; ++j) {
    	nextPMF[j] = probs[i-1] * PMF[j-1] + (1-probs[i-1]) * PMF[j]
    }
    
    PMF = nextPMF;
  }
  
  // Any chance below CHANCE_CUTOFF is set to 0
  return PMF.map(num => { return (num > CHANCE_CUTOFF) ? num : 0 }); 
}

// When the namepig menu loads
function namepigLoad(elm) {
	if (feedBtn = elm.querySelector(FEED_BTN_CLASSES)) {
  	feedBtn.addEventListener("click", () => { parseNeeded = true; });
  }
  if (baconBtn = elm.querySelector(BACON_BTN_CLASSES)) {
  	baconBtn.addEventListener("click", () => { parseNeeded = true; });
  }
}

// Wrappers for GreaseMonkey API

// Note: Arrays can be made from strings. Maybe store the arrays that way?
// Would greatly reduce the number of calls we would need to make to
//  the Greasemonkey API

// Get all keys with a certain id
// TODO: Make it actually work
function dataList(id) {
 	return new Promise((resolve, reject) => {
    GM.listValues()
    	.then((data) => {
      	let index = 0;
      	// This is vulnerable to usage of dashes in id names.
        // Otherwise stable
      	const regex = new RegExp(`${id}-`);
      	const ret = data.map((str) => {
        	if (str.match(regex)) { 
            index++;
            return str;
          }
        });
        
        // Move undefined to end of array and "delete" them
      	ret.sort();
      	ret.length = index;
        
        resolve(ret);
    	})
    	.catch((error) => { reject(error); });
  }); 
}


// Store input dictonary under an id
function dataStore(dict, id) {
  return Promise.all(Object.entries(dict).map(([key, value]) => {
    return GM.setValue(id + '-' + key, value); 
  }));
}

/*
// Retreive dictionary from id
// Another function will expand it
function dataGet(id) {
	return new Promise((resolve, reject) => {
		dataList(id)
    	.then((data) => {
      	const regex = new RegExp(`${id}-`);
      	Promise.all(() => {
        	let promList = []
          for (entry of data) promList.push(GM.getValue(entry)) 
        	return promList; })
      		.then(() => {})
      		.catch((error) => { reject(error); });
      
      	let lorem = data.map((str) => { 
          return str.replace(regex,''); 
        });
      	
    	}
      .catch((error) => { reject(error); }});
  });
}
*/

// Deletes all key-value pairs with a certain id
// TODO: Clean up spaghetti code
function dataWipe(id) {
  return new Promise((resolve, reject) => {
  	dataList(id)
  	.then((data) => {
    	Promise.all(data.map((str) => {
				return GM.deleteValue(str); 
      }))
      .then(() => { resolve(); })
      .catch((error) => { reject() });
  	})
  	.catch((error) => { reject(); });
  });
}

// Remove id from all strings
function idCleanse(arr, id) {
  const regex = new RegExp(`${id}-`);
	return arr.map((str) => { str.replace(regex, '') }); 
}
