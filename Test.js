const CUSTOM_EVENTS_DATES = [
  // Fixed
  'Fixed Range Single Day Event:                          05.02.2000',
  'Fixed Range Multiple Days Event:                       10.03.2001-15.03.2001',

  'Fixed Range Multiple Days Crossed Event 1:             25.12.2001-05.01.2002',
  'Fixed Range Multiple Days Crossed Event 2:             10.01.2002-10.01.2003',

  // Recurring
  'Start|End Date Recurring Single Day Event:             20.01.2004_2006',

  'Start Date Recurring Single Day Event 1:               25.01.>2007',
  'Start Date Recurring Single Day Event 2:               30.01.2010-30.01.x',
  'Start Date Recurring Multiple Days Event 3:            25.03.2015-30.03.x',
  'Start Date Recurring Multiple Days Crossed Event 4:    25.12.2020-05.01.x',

  'End Date Recurring Single Day Event 1:                 30.01.<1980',
  'End Date Recurring Single Day Event 2:                 30.01.x-30.01.1985',
  'End Date Recurring Multiple Days Event 3:              25.01.x-30.01.1990',
  'End Date Recurring Multiple Days Crossed Event 4:      25.12.x-05.01.1995',

  'Global Recurring Single Day Event:                     11.11.x',
  'Global Recurring Multiple Days Event:                  15.11.x-20.11.x',

  'Global Recurring Multiple Days Crossed Event:          31.12.x-01.01.x',
];

function getCustomEventMatch(date) { }

// Fixed
/* Fixed Range Single Day Event: 05.02.2000 */
console.log(getCustomEventMatch(new Date('2000.02.05')));

/* Fixed Range Multiple Days Event: 10.03.2001-15.03.2001 */
console.log(getCustomEventMatch(new Date('2001.03.10')));
console.log(getCustomEventMatch(new Date('2001.03.12')));
console.log(getCustomEventMatch(new Date('2001.03.15')));

/* Fixed Range Multiple Days Crossed Event 1: 25.12.2001-05.01.2002 */
console.log(getCustomEventMatch(new Date('2001.12.25')));
console.log(getCustomEventMatch(new Date('2002.01.01')));
console.log(getCustomEventMatch(new Date('2002.01.05')));

/* Fixed Range Multiple Days Crossed Event 2: 10.01.2002-10.01.2003 */
console.log(getCustomEventMatch(new Date('2002.01.10')));
console.log(getCustomEventMatch(new Date('2002.05.10')));
console.log(getCustomEventMatch(new Date('2003.01.10')));


// Recurring
/* Start|End Date Recurring Single Day Event: 20.01.2004_2006 */
console.log(getCustomEventMatch(new Date('2004.01.20')));
console.log(getCustomEventMatch(new Date('2005.01.20')));
console.log(getCustomEventMatch(new Date('2006.01.20')));

/* Start Date Recurring Single Day Event 1: 25.01.>2007 */
console.log(getCustomEventMatch(new Date('2007.01.25')));
console.log(getCustomEventMatch(new Date('2008.01.25')));

/* Start Date Recurring Single Day Event 2: 30.01.2010-30.01.x */
console.log(getCustomEventMatch(new Date('2010.01.30')));
console.log(getCustomEventMatch(new Date('2012.01.30')));

/* Start Date Recurring Multiple Days Event 3: 25.03.2015-30.03.x */
console.log(getCustomEventMatch(new Date('2015.03.25')));
console.log(getCustomEventMatch(new Date('2017.03.27')));
console.log(getCustomEventMatch(new Date('2020.03.30')));

/* Start Date Recurring Multiple Days Crossed Event 4: 25.12.2020-05.01.x */
console.log(getCustomEventMatch(new Date('2020.12.25')));
console.log(getCustomEventMatch(new Date('2022.12.30')));
console.log(getCustomEventMatch(new Date('2025.01.05')));

/* End Date Recurring Single Day Event 1: 30.01.<1980 */
console.log(getCustomEventMatch(new Date('1980.01.30')));
console.log(getCustomEventMatch(new Date('1975.01.30')));

/* End Date Recurring Single Day Event 2: 30.01.x-30.01.1985 */
console.log(getCustomEventMatch(new Date('1985.01.30')));
console.log(getCustomEventMatch(new Date('1982.01.30')));

/* End Date Recurring Multiple Days Event 3: 25.01.x-30.01.1990 */
console.log(getCustomEventMatch(new Date('1990.01.25')));
console.log(getCustomEventMatch(new Date('1990.01.27')));
console.log(getCustomEventMatch(new Date('1990.01.30')));

/* End Date Recurring Multiple Days Crossed Event 4: 25.12.x-05.01.1995 */
console.log(getCustomEventMatch(new Date('1990.12.25')));
console.log(getCustomEventMatch(new Date('1992.12.30')));
console.log(getCustomEventMatch(new Date('1995.01.05')));

/* Global Recurring Single Day Event: 11.11.x */
// // console.log(getCustomEventMatch(new Date('2025.11.11')));
console.log(getCustomEventMatch(new Date('2027.11.11')));
console.log(getCustomEventMatch(new Date('2030.11.11')));

/* Global Recurring Multiple Days Event: 15.11.x-20.11.x */
console.log(getCustomEventMatch(new Date('2025.11.15')));
console.log(getCustomEventMatch(new Date('2027.11.17')));
console.log(getCustomEventMatch(new Date('2030.11.20')));

/* Global Recurring Multiple Days Crossed Event: 31.12.x-01.01.x */
console.log(getCustomEventMatch(new Date('2010.12.31')));
console.log(getCustomEventMatch(new Date('2015.01.01')));
