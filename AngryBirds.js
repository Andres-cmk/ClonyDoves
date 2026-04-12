const { Bodies, Engine, World, Events, Body,
  Mouse, MouseConstraint, Constraint } = Matter;

//matters
let engine, world;


// worlds
let ground; 
let bgImg;

// structure
let boxes = [];
let boxImg;


// pigs
let pigs = [];
let pigStates = [];
let pigSounds = [];
let pigDeathSound;

// birds
let bird;
let birdImages = []


// Slingshot
let slingshot;
let imgSlingshot;
let audioStreched;

// Explosion
let explosions = [];
let explosionImg;


function preload(){
    bgImg = loadImage("./images/background.jpg");
    boxImg = loadImage("./images/box.png");
    pigStates = [
    loadImage("./images/pig.png"),
    loadImage("./images/pig2.png"),
    loadImage("./images/pig3.png")
    ];
    imgSlingshot = loadImage("./images/Slingshot_Classic.png");
    audioStreched = createAudio("./audios/slingshot_streched.wav");
    birdImages = [
    loadImage("./images/red.png"),
    loadImage("./images/chuck.png"),
    loadImage("./images/bomb.png")
    ];
    explosionImg = loadImage("./images/explosion.gif");
    pigSounds.push(createAudio("./audios/pig1.wav"));
    pigSounds.push(createAudio("./audios/pig2.wav"));
    pigDeathSound = createAudio("./audios/pigDeath.wav");
}


function setup() {
  const canvas = createCanvas(800, 560);
  
  engine = Engine.create();
  world = engine.world;
  
  const mouse = Mouse.create(canvas.elt);
  mouse.pixelRatio = pixelDensity();
  
  const mc = MouseConstraint.create(engine, {
    mouse: mouse,
    collisionFilter: {mask: 2}
  });

  World.add(world, mc);
  

  ground = new Ground(width/2, height-10,
    width, 20);
  
  for(let i=1; i<=8; i++){
    const y = height - 50*i - 10;
    let box = new Box(600, y, 50, 50, boxImg);
    boxes.push(box);
    
    box = new Box(700, y, 50, 50, boxImg);
    boxes.push(box);
  }
  
  const y = height - 50*9;
  let pig = new Pig(600, y, 25, pigStates);
  pigs.push(pig);
  
  pig = new Pig(700, y, 25, pigStates);
  pigs.push(pig);
  
  bird = new Bird(150, 450, 25, birdImages[0]);
  slingshot = new Slingshot(bird, imgSlingshot, audioStreched);
  
  Events.on(engine, "afterUpdate", () => {
    slingshot.fly(mc);
  });

  Events.on(engine, 'collisionStart', (event) => {
  for (let pair of event.pairs) {
    const { bodyA, bodyB } = pair;

    checkAndDamagePig(bodyA);
    checkAndDamagePig(bodyB);
  }
});
}


function draw() {
  background(128);
  image(bgImg, 0, 0, width, height)
  
  Engine.update(engine);
  
  ground.show();
  
  for (const box of boxes){
    box.show();
  }
  
  for (let i = pigs.length - 1; i >= 0; i--) {
    pigs[i].show();

    if (pigs[i].isDead) {
      let pPos = pigs[i].body.position;
      explosions.push(new Explosion(pPos.x, pPos.y, explosionImg));

      World.remove(world, pigs[i].body);
      pigs.splice(i, 1);
    }
  }

  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].show();
    if (explosions[i].isFinished()) {
      explosions.splice(i, 1);
    }
}
  
  slingshot.show();
  bird.show();
}

function keyPressed(){
  if (key === " " && !slingshot.hasBird()){
    World.remove(world, bird.body);
    
    index = floor(random(0, birdImages.length));
    
    bird = new Bird(150, 450, 25,
      birdImages[index]);
    slingshot.attach(bird);
  }
}

function checkAndDamagePig(body) {
  const pigFound = pigs.find(p => p.body === body);
  
  if (pigFound) {
    if (body.speed > 4) {
      pigFound.hit(body.speed * 15, pigSounds, pigDeathSound); 
    }
  }
}