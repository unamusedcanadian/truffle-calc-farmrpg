// ==UserScript==
// @name Truffle Calculator
// @namespace unamusedcanadian
// @version 0.1.1
// @description Determines approximate range of Truffles user can expect at daily reset.
// @include https://farmrpg.com/#!/pigpen.php*
// @include https://farmrpg.com/*
// @grant GM.getValue
// @grant GM.setValue
// @icon https://www.google.com/s2/favicons?sz=64&domain=farmrpg.com
// @author unamusedcanadian
// ==/UserScript==

console.log('Truffle Calculator loaded!'); 

// fireworks node always has the current menu encoded into it.
// look for mutations in the attributes to detect when the page changes
const fworks = document.getElementById('fireworks');

// TODO: Detect if pigpen is in the page-on-left class
// TODO: Reject promise if data-page stops being pigpen
const pageCheck = (mutationList, observer) => {
		if (fworks.getAttribute("data-page") === 'pigpen') { 
      // Wait for the page to be fully loaded before executing any code
    	waitForElm('.page-on-center[data-page="pigpen"]').then((elm) => {
        pigPenLoad(elm);
      }); 
    }
};

const loader = new MutationObserver(pageCheck);
loader.observe(fworks, { attributes: true });

// Taken from:
// https://stackoverflow.com/questions/5525071/how-to-wait-until-an-element-exists
function waitForElm(selector) {
  return new Promise((resolve) => {
    // Checks if desired element already exists
    if ((elm = document.querySelector(selector))) {
      return resolve(elm);
    }

    // Every mutation, check if the desired element exists now
    const observer = new MutationObserver((mutations) => {
      if ((elm = document.querySelector(selector))) {
        observer.disconnect();
        resolve(elm);
      }
    });

    // If you get "parameter 1 is not of type 'Node'" error, see:
    // https://stackoverflow.com/a/77855838/492336
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

// Run every time the pigpen page is loaded
function pigPenLoad(elm) {
	console.log('You are at the pigpen!');
  pigPenParse(elm);
  // Note: GM.setValue() cannot store arrays. Must convert array to string
  // 	first. Might be best to store based on key-value of level-quantity
}

/* Feed-o-matic button is in content-block/animationArea/card/card-content/list-block/ul/li/
	 But this is not the only way to feed pigs. You can also feed them manually.
   Re-parsing the data each page load might be the most efficient way to do this.
   Would still need to re-parse when feed button is pressed though
*/ 

// TODO: Only make this run during those times
// TODO: Detect pigs being sent to slaughterhouse
// Runs when pigs are fed or when script is run for the first time
function pigPenParse(elm) {
	const pigTable = elm.getElementsByClassName("row no-gutter");
  let levels = [];
  let other = [];
  
  for (row of pigTable) {
		let navigator = document.createTreeWalker(row, NodeFilter.SHOW_ELEMENT);
    let node;
    
    if (node = navigator.firstChild()) do {
    	let info = node.outerText.slice(-2);
      
      if (num = parseInt(info)) {
        levels.push(num);
      }
      // Keeps empty strings from being stored
      else if (info) { 
       	other.push(info); 
      }
    } while (node = navigator.nextSibling());
  }
  
  // Debug code
  console.log(levels);
  console.log(other);
  
  let sum = 0;
  for (num of levels) {
  	sum += num; 
  }
  console.log('Sum of pig levels: ' + sum + '.'); 
}

// Run after script decides if parsing is necessary or not
// Note: If pigpen was the last page visited, the HTML remains in memory and
// 	rerendering is unnecessary, and could even result in bugs. Need to find
//  a way to determine if the HTML is still in memory.
function renderData(elm) {
	return; 
}
