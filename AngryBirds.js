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
let birdLaunched = false;
let launchTime;
const TIME_TO_WAIT = 5000; 
let birdImages = []
let birdQueue = [];
const TOTAL_BIRDS = 4;


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
    collisionFilter: {
      mask: 0xFFFF 
    }
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

  for (let i = 0; i < TOTAL_BIRDS; i++) {
    let xPos = 120 - (i * 60); 
    let yPos = height - 55; 
    
    let img = birdImages[i % birdImages.length];
    let b = new Bird(xPos, yPos, 25, img);
    
    if (i > 0) {
      Matter.Body.setStatic(b.body, true);
    }
    birdQueue.push(b);
  }

  bird = birdQueue[0];
  Matter.Body.setPosition(bird.body, { x: targetPos.x, y: targetPos.y });
  Matter.Body.setStatic(bird.body, false); 

  slingshot = new Slingshot(bird, imgSlingshot, audioStreched);
  
  const yPig = height - 50*9; 
  let pig = new Pig(600, yPig, 25, pigStates);
  pigs.push(pig);
  
  pig = new Pig(700, yPig, 25, pigStates);
  pigs.push(pig);
  
  Events.on(engine, "afterUpdate", () => {
    if (!isAnimatingBird && bird) {
      slingshot.fly(mc);
    }

    if (birdLaunched === false && bird && !slingshot.hasBird()) {
      
      if (birdQueue.includes(bird)) {
        birdQueue.shift(); 
      }

      birdLaunched = true;
      launchTime = millis();
    }
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
  image(bgImg, 0, 0, width, height);
  
  Engine.update(engine);
  
  ground.show();

  if (birdLaunched && bird) {
    let currentTime = millis();
    let speed = bird.body.speed;

    if (currentTime - launchTime > TIME_TO_WAIT || (speed < 0.2 && currentTime - launchTime > 1000)) {
      World.remove(world, bird.body);
      bird = null; 
      birdLaunched = false;

      if (birdQueue.length > 1) {
        birdQueue.shift(); 
        bird = birdQueue[0];
        isAnimatingBird = true; 
        Matter.Body.setStatic(bird.body, true);
      } else {
        birdQueue.shift(); 
      }
    }
  }

  for (const box of boxes){
    box.show();
  }

  for (let i = 0; i < birdQueue.length; i++) {
    let b = birdQueue[i];
    
    if (b === bird) {
      continue; 
    }

    let targetX = 120 - (i * 60); 
    let targetY = height - 55;

    let currentPos = b.body.position;
    let nextX = lerp(currentPos.x, targetX, 0.1);
    let nextY = lerp(currentPos.y, targetY, 0.1);

    Matter.Body.setPosition(b.body, { x: nextX, y: nextY });
    
    b.show();
  }

  if (bird) {
    bird.show();
  }

  if (isAnimatingBird && bird) {
    let pos = bird.body.position;
    let newX = lerp(pos.x, targetPos.x, 0.1);
    let newY = lerp(pos.y, targetPos.y, 0.1);
    
    Matter.Body.setPosition(bird.body, { x: newX, y: newY });

    if (dist(newX, newY, targetPos.x, targetPos.y) < 2) {
      isAnimatingBird = false;
      Matter.Body.setStatic(bird.body, false);
      slingshot.attach(bird);
    }
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
}

let isAnimatingBird = false;
let targetPos = { x: 150, y: 400 };

function keyPressed() {
  if (key === " " && !slingshot.hasBird()) {
    if (!bird && birdQueue.length > 0) {
      bird = birdQueue[0];
      isAnimatingBird = true; 
    }
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