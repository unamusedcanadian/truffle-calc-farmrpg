# FarmRPG Truffle Calculator

A Greasemonkey user script designed to streamline the process of calculating how many truffles your pigs can produce per day.

This script takes unfed and slaughterhouse pigs into account, and will specifically avoid considering them in the calculations.

> [!Caution]
> While nothing in this script either makes calls to the FarmRPG servers or automates any in-game tasks, the Admins still have the final say as to whether or not scripts of this nature are allowed. As their opinions are subject to change, usage of this plugin comes at your own risk.

## Installation instructions

To download and install this script:
1. Download one of these three extentions, depending on your browser:
   - Greasemonkey (Firefox) **(Recommended)**
   - Tampermonkey (Chrome, Firefox, Edge)
   - Violentmonkey (Chrome, Firefox, Edge).
2. Open https://github.com/unamusedcanadian/truffle-calc-farmrpg/blob/main/truffle_calc.user.js in your browser.
3. Confirm the installation popup.

To uninstall this script:
1. Open this script in your extention's main ("monkey") menu.
2. Click "Uninstall".

> [!Warning]
> This code has only been tested with Greasemonkey. While it should be compatible with Tampermonkey and Violentmonkey, there are no guarantees of functionality on those forks.

## Technical details 

When you load your pigpen, it automatically scans the HTML of the webpage for the levels of your pigs. This process is fully client-side, meaning that there will be no additional strain on the FarmRPG servers. The script then calculates the probabilities using a Poisson Binomial Distribution algorithm, and displays them in a neat little graphic alongside some other miscellaneous information.

## Why I created this script

Ever since learning that truffles were not a guaranteed drop from pigs, I found myself slightly dissatisfied with the FarmRPG community simply saying you would get the sum of your pig levels divided by the droprate on average each reset. While it is true that this estimate is the average, it doesn't reflect the full range of possibilities that could occur in one daily reset. This got me thinking about how one would even go about calculating the full range of truffle drops in a timely manner- noone wants to count their pig levels manually!

Because of this, I was inspired to make a program that could calculate a full Binomial Distribution of truffle chances. However, due to the fact that pig levels can vary within a singular pen, I couldn't just calculate the probabilities through the classical Probability Mass Function, as said function requires *all* trials to have a constant chance. After some research, I found a wikipedia article that provided pseudocode for an algorithm that I could implement to accurately calculate the chances of each quantity of truffle type dropping. This plugin is the result.

## Credits

- Wikipedia article where I got the Poisson Binomial Distribution algorithm:\
https://en.wikipedia.org/wiki/Poisson_binomial_distribution.

- HTML/CSS I used as a reference when designing the graph:\
https://codepen.io/stoumann/pen/ByNRpBK.

- The FarmRPG dev team for making such an amazing game.
