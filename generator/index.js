var fantasyNames = require('fantasy-names');
var fs = require('fs');
var htmlMinify = require('html-minifier').minify;
var glob = require('glob');
var Nunjucks = require('nunjucks');
var path = require('path');

// ADDING EASTER EGGS
// ------------------
// Easter eggs or procedural generation properties.
// The key is the name of the property that will become available in the template.
// The value is the chance that a zone will have that property (i.e., 1 out of 40).
// Add a property here, and then in the template, can have an if statement like:
//   {% if myZoneProperty %}
//     <a-entity id="someEasterEgg"></a-entity>
//   {% endif %}
// Then regenerate.
var ZONE_PROPERTIES = {
  animatedLights: 1 / 20,
  marioEasterEgg: 1 / 50,
  shiftingColors: 1 / 40
};

var htmlMinifyConfig = {collapse: true, collapseWhitespace: true, conservativeCollapse: true, removeComments: true};
var nunjucks = Nunjucks.configure('src', {noCache: true});
var songs = JSON.parse(fs.readFileSync('./assets/songs.json'));

// Generate from JSON filename.
function generateFromJson (filename) {
  generate(JSON.parse(fs.readFileSync(filename, 'utf-8')));
};
module.exports.generateFromJson = generateFromJson;

// Re-generate if already generated.
if (fs.existsSync('oasis.json')) {
  generateFromJson('oasis.json');
  return;
}

var AVG_ZONES = 40;
var MIN_ZONES = 20;

// Generation config.
var SECTORS = [
  {environmentType: 'forest'},
  {environmentType: 'tron'},
  {environmentType: 'volcano'},
  {environmentType: 'arches'},
  {environmentType: 'japan'},
  {environmentType: 'egypt'},
  {environmentType: 'contact'},
  {environmentType: 'goaland'},
  {environmentType: 'yavapai'},
  {environmentType: 'goldmine'},
  {environmentType: 'threetowers'},
  {environmentType: 'poison'},
  {environmentType: 'dream'},
  {environmentType: 'starry'},
  {environmentType: 'osiris'}
];

/**
 * Data structure for all sectors and zones to generate pages.
 * [
 *   [
 *     [environmentType": "tron", "seed": "12345"}],
 *     [environmentType": "tron", "seed": "54321"}]
 *   ],
 *   [
 *     [environmentType": "volcano", "seed": "abcdef"}],
 *     [environmentType": "volcano", "seed": "fedgto"}]
 *   ]
 * ]
 */
var SECTOR_PAGES = [];

// Generate sectors.
SECTORS.forEach((sector, sectorIndex) => {
  var i;
  var seed;
  var zone;
  var zoneProperty;

  // Generate zones for the sector.
  SECTOR_PAGES[sectorIndex] = SECTOR_PAGES[sectorIndex] || [];
  for (i = 0; i < Math.random() * AVG_ZONES + MIN_ZONES; i++) {
    seed = randomId();
    zone = {
      environment: `preset: ${sector.environmentType}; seed: ${seed}`,
      name: capitalize(randomName()),
      sectorType: sector.environmentType,
      seed: seed,
      song: `https://supermedium.com/oasis-audio/${randomArray(songs)}`,
      url: `../oasis/${seed}.html`,
    };

    // Randomly specified zone properties.
    for (zoneProperty in ZONE_PROPERTIES) {
      if (Math.random() > ZONE_PROPERTIES[zoneProperty]) { continue; }
      zone[zoneProperty] = true;
      console.log(`Zone ${seed} has ${zoneProperty}.`);
    }

    SECTOR_PAGES[sectorIndex].push(zone);
  }
});

// Generate links.
SECTOR_PAGES.forEach(sector => {
  sector.forEach(zone => {
    var i;
    var randomZone;
    zone.links = [];
    for (i = 0; i < Math.round(Math.random() * 5) + 2; i++) {
      // Get random zone.
      randomZone = Object.assign({}, sector[Math.floor(Math.random() * sector.length)]);

      if (randomZone.seed === zone.seed) { continue; }

      delete randomZone.links;
      zone.links.push({
        position: randomLinkPosition(),
        zone: Object.assign({}, randomZone)
      })
    }
  });
});

// Generate home zone.
var HOME_ZONE = {
  IS_HOME: true,
  links: SECTOR_PAGES.map((sector, i) => {
    var randomZone;
    randomZone = Object.assign({}, sector[Math.floor(Math.random() * sector.length)]);
    delete randomZone.links;
    return {
      position: `${i} 1.6 -5`,
      zone: randomZone
    };
  })
};


// Generate goal zone.
var GOAL_SEED = randomId();
var GOAL_ZONE = {
  IS_GOAL: true,
  environment: 'preset: goldmine; seed: 660; skyColor: #361c1b; horizonColor: #943842; lighting: none; fog: 0.669; flatShading: false; playArea: 1.5; groundYScale: 20.18; groundColor: #361c1b; groundColor2: #38292b; dressing: cubes; dressingAmount: 100; dressingColor: #d19747; dressingScale: 3.65; dressingVariance: 2 2 2; dressingOnPlayArea: 0.0',
  links: [],
  name: capitalize(randomName()),
  sectorType: 'goldmine',
  seed: GOAL_SEED,
  song: `https://supermedium.com/oasis-audio/${randomArray(songs)}`,
  url: `../oasis/${GOAL_SEED}.html`
};

// Add goal link to random zone.
var PRE_GOAL_ZONE = randomArray(randomArray(SECTOR_PAGES));
PRE_GOAL_ZONE.links.push({
  position: randomLinkPosition(),
  zone: GOAL_ZONE
});
console.log(`Pre-goal: ${PRE_GOAL_ZONE.seed}`);
console.log(`Goal: ${GOAL_ZONE.seed}`);

// Add hints.
SECTOR_PAGES.forEach(sector => {
  var hintZone;
  var i;
  for (i = 0; i < 2; i++) {
    hintZone = randomArray(sector);
    hintZone.hasHint = true;
    hintZone.inThisSector = GOAL_ZONE.sectorType === sector[0].sectorType;
    console.log(`Added hint to: ${hintZone.seed}. In this sector: ${hintZone.inThisSector}.`);
  }
});

// Compile final data structure.
var DATA = {HOME: HOME_ZONE, SECTORS: SECTOR_PAGES, GOAL: GOAL_ZONE};

// Write JSON.
fs.writeFileSync('oasis.json', JSON.stringify(DATA));

// Final step: Generate.
generate(DATA);

function generate (data) {
  var html;
  var template;

  template = fs.readFileSync('./src/index.html', 'utf-8');

  // Write home.
  html = nunjucks.renderString(template, data.HOME);
  html = htmlMinify(html, htmlMinifyConfig);
  fs.writeFileSync(`index.html`, html);

  // Write goal.
  html = nunjucks.renderString(template, data.GOAL);
  html = htmlMinify(html, htmlMinifyConfig);
  fs.writeFileSync(`oasis/${data.GOAL.seed}.html`, html);

  // Write sectors.
  data.SECTORS.forEach(sector => {
    sector.forEach(pageData => {
      html = nunjucks.renderString(template, pageData);
      html = htmlMinify(html, htmlMinifyConfig);
      fs.writeFileSync(`oasis/${pageData.seed}.html`, html);
    });
  });
}

/**
 * Random string.
 */
function randomId () {
	var i;
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var text = '';
  for (i = 0; i < 10; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

var GROUPS = [
  ['places', 'planets'],
  ['places', 'realms'],
  ['places', 'stars'],
];

function randomName (sectorType) {
  var random;
  if (sectorType === 'dream') {
    return fantasyNames('places', 'sky_islands');
  }
  if (sectorType === 'forest') {
    return fantasyNames('places', 'grasslands');
  }
  if (sectorType === 'tron') {
    return fantasyNames('places', 'space_colonys');
  }
  if (sectorType === 'volcano') {
    return fantasyNames('places', 'volcanos');
  }
  random = [
    fantasyNames('places', 'planets'),
    fantasyNames('places', 'realms'),
    fantasyNames('places', 'lands'),
    fantasyNames('places', 'dimensions'),
    fantasyNames('places', 'dungeons'),
    fantasyNames('places', 'grasslands'),
    fantasyNames('places', 'mountains')
  ];
  return randomArray(random);
}

function capitalize (string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function randomArray (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomLinkPosition () {
 var x = Math.random() * 30 - 15;
 var z = Math.random() * 30 - 15;
 if (x >= -5 || x <= 5) {
  if (x < 0) { x -= 5; }
  if (x >= 0) { x += 5; }
 }
 if (z >= -5 || z <= 5) {
  if (z < 0) { z -= 5; }
  if (z >= 0) { z += 5; }
 }
 return `${x} 0 ${z}`;
}
